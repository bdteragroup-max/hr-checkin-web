import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const HR_LINE_USER_ID = process.env.HR_LINE_USER_ID;

// Helper: Push LINE Message
async function pushLineMessage(to: string, messages: any[]) {
    if (!LINE_CHANNEL_ACCESS_TOKEN || !to) return false;
    try {
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({ to, messages }),
        });
        if (!res.ok) {
            console.error("[ASSET REMINDER] LINE API Error:", await res.text());
        }
        return res.ok;
    } catch (e) {
        console.error("[ASSET REMINDER] LINE push error:", e);
        return false;
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        // ── 1. Determine "Today" in Bangkok ──
        const dateStr = getTodayBangkokISO();
        const todayBkk = new Date(dateStr);
        todayBkk.setHours(0, 0, 0, 0);

        // ── 2. Fetch Borrowed Assets ──
        const activeBorrowings = await prisma.asset_borrowings.findMany({
            where: {
                status: "borrowed",
                actual_return_date: null
            },
            include: {
                employee: {
                    select: { name: true, line_user_id: true, emp_id: true }
                },
                assets: {
                    select: { name: true, asset_id: true }
                }
            }
        });

        const reportStats = { 
            totalActive: activeBorrowings.length, 
            remindersSent: 0,
            overdueCount: 0,
            dueTodayCount: 0,
            dueTomorrowCount: 0
        };
        
        const hrSummaryItems: string[] = [];

        // ── 3. Processing and Notifying ──
        for (const borrow of activeBorrowings) {
            const expectedDate = new Date(borrow.expected_return_date);
            expectedDate.setHours(0, 0, 0, 0);

            const diffTime = expectedDate.getTime() - todayBkk.getTime();
            const daysUntilReturn = Math.round(diffTime / (1000 * 60 * 60 * 24));

            let statusLabel = "";
            let color = "#111827"; // Default black
            let headerColor = "#0284c7"; // Default blue
            let headerBg = "#f0f9ff";
            let reminderType = "";

            if (daysUntilReturn < 0) {
                reminderType = "OVERDUE";
                statusLabel = `เกินกำหนดคืน ${Math.abs(daysUntilReturn)} วัน`;
                color = "#dc2626"; // Red
                headerColor = "#dc2626";
                headerBg = "#fef2f2";
                reportStats.overdueCount++;
            } else if (daysUntilReturn === 0) {
                reminderType = "DUE_TODAY";
                statusLabel = "ครบกำหนดคืนวันนี้";
                color = "#ea580c"; // Orange
                headerColor = "#ea580c";
                headerBg = "#fff7ed";
                reportStats.dueTodayCount++;
            } else if (daysUntilReturn === 1) {
                reminderType = "DUE_TOMORROW";
                statusLabel = "ครบกำหนดคืนพรุ่งนี้";
                color = "#0284c7"; // Blue
                headerColor = "#0284c7";
                headerBg = "#f0f9ff";
                reportStats.dueTomorrowCount++;
            } else {
                // Not a milestone day, just skip employee notification but keep for HR summary
                hrSummaryItems.push(`• ${borrow.employee.name}: ${borrow.assets.name} (เหลือ ${daysUntilReturn} วัน)`);
                continue;
            }

            // Summary for HR (only milestones or overdue)
            hrSummaryItems.push(`• [${reminderType}] ${borrow.employee.name}: ${borrow.assets.name} (${statusLabel})`);

            // Send to Employee if Milestone met
            if (borrow.employee.line_user_id) {
                const flexContent = {
                    type: "bubble",
                    header: {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: headerBg,
                        contents: [
                            { type: "text", text: "แจ้งเตือนการคืนทรัพย์สิน", weight: "bold", size: "md", color: headerColor }
                        ]
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        spacing: "md",
                        contents: [
                            { type: "text", text: `สวัสดีคุณ ${borrow.employee.name}`, size: "sm", color: "#6b7280" },
                            { type: "text", text: `กรุณานำทรัพย์สินที่ยืมไปส่งคืนตามกำหนด:`, size: "sm", color: "#111827", wrap: true },
                            {
                                type: "box",
                                layout: "vertical",
                                margin: "lg",
                                spacing: "xs",
                                backgroundColor: "#f8fafc",
                                paddingAll: "12px",
                                cornerRadius: "8px",
                                contents: [
                                    { type: "text", text: `รายการ: ${borrow.assets.name}`, size: "sm", weight: "bold", color: "#1e293b" },
                                    { type: "text", text: `รหัสทรัพย์สิน: ${borrow.assets.asset_id}`, size: "xs", color: "#64748b" },
                                    { type: "text", text: `กำหนดคืน: ${new Date(borrow.expected_return_date).toLocaleDateString("th-TH")}`, size: "xs", color: "#64748b" }
                                ]
                            },
                            {
                                type: "text",
                                text: statusLabel,
                                size: "sm",
                                color: color,
                                weight: "bold",
                                align: "center",
                                margin: "md"
                            }
                        ]
                    },
                    footer: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "button",
                                action: {
                                    type: "uri",
                                    label: "ดูรายละเอียดการยืม",
                                    uri: `${process.env.NEXT_PUBLIC_BASE_URL || "https://hr-checkin-web.vercel.app"}/car-borrow`
                                },
                                style: "primary",
                                color: "#1e293b"
                            }
                        ]
                    }
                };

                const success = await pushLineMessage(borrow.employee.line_user_id, [
                    { type: "flex", altText: `แจ้งเตือนคืนทรัพย์สิน: ${borrow.assets.name}`, contents: flexContent }
                ]);
                if (success) reportStats.remindersSent++;
            }
        }

        // ── 4. HR Summary Report (Sent every day) ──
        if (HR_LINE_USER_ID) {
            const summaryText = [
                "📋 สรุปรายการยืมทรัพย์สินค้างส่ง",
                `ประจำวันที่ ${todayBkk.toLocaleDateString("th-TH")}`,
                "",
                `• เกินกำหนด: ${reportStats.overdueCount} รายการ`,
                `• ครบกำหนดวันนี้: ${reportStats.dueTodayCount} รายการ`,
                `• ครบกำหนดพรุ่งนี้: ${reportStats.dueTomorrowCount} รายการ`,
                `• รวมค้างส่งทั้งหมด: ${reportStats.totalActive} รายการ`,
                "",
                hrSummaryItems.length > 0 ? "รายละเอียด:" : "ไม่มีรายการค้างส่งในขณะนี้ ✨",
                ...hrSummaryItems.slice(0, 20) // Limit to 20 items to avoid message limit
            ].join("\n");

            await pushLineMessage(HR_LINE_USER_ID, [{ type: "text", text: summaryText }]);
        }

        return NextResponse.json({
            ok: true,
            stats: reportStats
        });

    } catch (error: any) {
        console.error("[ASSET REMINDER] Fatal error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
