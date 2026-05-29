import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO, formatDateThai } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const MANAGEMENT_LINE_USER_ID = process.env.MANAGEMENT_LINE_USER_ID;

function todayBangkok() {
    const iso = getTodayBangkokISO();
    const date = new Date(`${iso}T00:00:00Z`); // Explicit UTC for Prisma @db.Date
    return { dateStr: iso, date };
}

async function sendFlexMessage(to: string, flex: any, altText: string) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.error("[LEAVE NOTIFY] LINE_CHANNEL_ACCESS_TOKEN is MISSING.");
        return false;
    }
    try {
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to,
                messages: [{ type: "flex", altText, contents: flex }],
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            console.error(`[LEAVE NOTIFY] LINE push error (${res.status}):`, err);
            return false;
        }
        console.log("[LEAVE NOTIFY] Notification sent successfully.");
        return true;
    } catch (e: any) {
        console.error("[LEAVE NOTIFY] Exception:", e.message);
        return false;
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const targetId = searchParams.get("targetId") || MANAGEMENT_LINE_USER_ID;
    if (!targetId) {
        return NextResponse.json({ error: "NO_TARGET_ID" }, { status: 400 });
    }

    try {
        const { dateStr, date } = todayBangkok();

        // Check if today is Sunday (0)
        if (date.getDay() === 0) {
            return NextResponse.json({ ok: true, message: "Skipped: Today is Sunday" });
        }

        // Check if today is a Holiday
        const holiday = await prisma.holidays.findFirst({
            where: { date: date }
        });
        if (holiday) {
            return NextResponse.json({ ok: true, message: `Skipped: Today is a holiday (${holiday.name})` });
        }

        // Fetch Approved and Pending Leaves for today
        const leaves = await prisma.leave_requests.findMany({
            where: {
                status: {
                    in: ["approved", "pending_supervisor", "pending_hr", "pending_management", "pending"]
                },
                start_date: { lte: date },
                end_date: { gte: date }
            },
            include: {
                employees: {
                    select: { name: true, departments: { select: { name: true } } }
                }
            },
            orderBy: {
                emp_id: "asc"
            }
        });

        if (leaves.length === 0) {
            return NextResponse.json({ ok: true, message: "No leaves for today" });
        }

        const dateLabel = formatDateThai(date);

        // Build Flex Message contents
        const listContents: any[] = [];
        
        leaves.forEach((l) => {
            const empName = l.employees?.name || l.name;
            const leaveType = l.leave_type || "ลา";
            const reason = l.reason || "-";
            const timeStr = l.days === 1 ? "(เต็มวัน)" : `(${l.minutes / 60} ชม.)`;

            let statusLabel = "อนุมัติแล้ว";
            let statusColor = "#16a34a"; // Green
            if (l.status === "pending_supervisor") {
                statusLabel = "รอหัวหน้าอนุมัติ";
                statusColor = "#ea580c"; // Orange
            } else if (l.status === "pending_hr") {
                statusLabel = "รอ HR อนุมัติ";
                statusColor = "#ea580c"; // Orange
            } else if (l.status === "pending_management") {
                statusLabel = "รอผู้บริหารอนุมัติ";
                statusColor = "#7c3aed"; // Purple
            } else if (l.status === "pending") {
                statusLabel = "รออนุมัติ";
                statusColor = "#ea580c"; // Orange
            }

            listContents.push({
                type: "box",
                layout: "vertical",
                margin: "md",
                contents: [
                    {
                        type: "text",
                        text: `👤 ${empName} ${timeStr}`,
                        weight: "bold",
                        size: "sm",
                        color: "#111827",
                        wrap: true
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        margin: "sm",
                        contents: [
                            { type: "text", text: "ประเภท:", size: "xs", color: "#6b7280", flex: 2 },
                            { type: "text", text: leaveType, size: "xs", color: "#3b82f6", flex: 6, wrap: true }
                        ]
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "สถานะ:", size: "xs", color: "#6b7280", flex: 2 },
                            { type: "text", text: statusLabel, size: "xs", color: statusColor, flex: 6, wrap: true, weight: "bold" }
                        ]
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "เหตุผล:", size: "xs", color: "#6b7280", flex: 2 },
                            { type: "text", text: reason, size: "xs", color: "#111827", flex: 6, wrap: true }
                        ]
                    }
                ]
            });
            listContents.push({ type: "separator", margin: "md" });
        });

        // Remove the last separator
        if (listContents.length > 0) {
            listContents.pop();
        }

        const flex = {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "📢 รายงานพนักงานลางาน", weight: "bold", size: "lg", color: "#ea580c" },
                    { type: "text", text: `ประจำวันที่ ${dateLabel}`, size: "sm", color: "#6b7280", margin: "sm" },
                ],
                backgroundColor: "#fff7ed",
                paddingAll: "16px",
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                paddingAll: "16px",
                contents: listContents
            }
        };

        await sendFlexMessage(targetId, flex, `รายงานพนักงานลางานประจำวันที่ ${dateLabel}`);

        return NextResponse.json({
            ok: true,
            sentCount: leaves.length,
            message: "Notification sent"
        });

    } catch (error: any) {
        console.error("[LEAVE NOTIFY] Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
