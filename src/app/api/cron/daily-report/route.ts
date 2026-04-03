import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const MANAGEMENT_LINE_USER_ID = process.env.MANAGEMENT_LINE_USER_ID;

function todayBangkok() {
    const now = new Date();
    const bkk = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const y = bkk.getFullYear();
    const m = String(bkk.getMonth() + 1).padStart(2, "0");
    const d = String(bkk.getDate()).padStart(2, "0");
    return { dateStr: `${y}-${m}-${d}`, date: new Date(`${y}-${m}-${d}T00:00:00`), bkk };
}

function formatDateThai(d: Date) {
    return d.toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

async function sendFlexMessage(to: string, flex: any, altText: string) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.error("[DAILY REPORT] LINE_CHANNEL_ACCESS_TOKEN is MISSING.");
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
            console.error(`[DAILY REPORT] LINE push error (${res.status}):`, err);
            return false;
        }
        console.log("[DAILY REPORT] Report sent successfully.");
        return true;
    } catch (e: any) {
        console.error("[DAILY REPORT] Exception:", e.message);
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
        const { dateStr, date, bkk } = todayBangkok();
        const todayStart = date;
        const todayEnd = new Date(date);
        todayEnd.setHours(23, 59, 59, 999);

        // ── 1. Pending Approvals ──
        const [pendingSupervisor, pendingHr, pendingOt] = await Promise.all([
            prisma.leave_requests.count({ where: { status: "pending_supervisor" } }),
            prisma.leave_requests.count({ where: { status: "pending_hr" } }),
            prisma.ot_requests.count({ where: { status: "pending" } }),
        ]);

        // ── 2. Today's Attendance ──
        const activeEmployees = await prisma.employees.findMany({
            where: { is_active: true },
            select: { emp_id: true, name: true },
        });

        const todayCheckins = await prisma.checkins.findMany({
            where: { date_key: todayStart },
            select: { emp_id: true, type: true, late_status: true },
        });

        // Approved leaves overlapping today
        const todayLeaves = await prisma.leave_requests.findMany({
            where: {
                status: "approved",
                start_date: { lte: todayStart },
                end_date: { gte: todayStart },
            },
            select: { emp_id: true },
        });

        const onLeaveIds = new Set(todayLeaves.map(l => l.emp_id));

        // Who checked in today
        const checkedInIds = new Set(todayCheckins.map(c => c.emp_id));

        // Who was late
        const lateIds = new Set(
            todayCheckins.filter(c => c.late_status === "late").map(c => c.emp_id)
        );

        const totalActive = activeEmployees.length;
        const onLeaveCount = onLeaveIds.size;
        const checkedInCount = checkedInIds.size;
        const lateCount = lateIds.size;

        // Absent = active employees who didn't check in AND are not on leave
        const absentCount = activeEmployees.filter(
            e => !checkedInIds.has(e.emp_id) && !onLeaveIds.has(e.emp_id)
        ).length;

        // ── Build Flex Message ──
        const dateLabel = formatDateThai(bkk);

        const flex = {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "📊 รายงานประจำวัน", weight: "bold", size: "lg", color: "#1d4ed8" },
                    { type: "text", text: dateLabel, size: "sm", color: "#6b7280", margin: "sm" },
                ],
                backgroundColor: "#eff6ff",
                paddingAll: "16px",
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "lg",
                paddingAll: "16px",
                contents: [
                    // ── Section 1: Pending Approvals ──
                    { type: "text", text: "สถานะคำขอ", weight: "bold", size: "md", color: "#111827" },
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "sm",
                        margin: "sm",
                        contents: [
                            makeRow("🕐 ลารอหัวหน้าอนุมัติ", pendingSupervisor, pendingSupervisor > 0 ? "#ea580c" : "#6b7280"),
                            makeRow("🕐 ลารอ HR อนุมัติ", pendingHr, pendingHr > 0 ? "#ea580c" : "#6b7280"),
                            makeRow("🕐 OT รออนุมัติ", pendingOt, pendingOt > 0 ? "#ea580c" : "#6b7280"),
                        ],
                    },
                    { type: "separator", margin: "lg" },
                    // ── Section 2: Daily Overview ──
                    { type: "text", text: "ภาพรวมวันนี้", weight: "bold", size: "md", color: "#111827", margin: "lg" },
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "sm",
                        margin: "sm",
                        contents: [
                            makeRow("✅ เข้างาน", checkedInCount, "#16a34a", "คน"),
                            makeRow("⏰ สาย", lateCount, lateCount > 0 ? "#dc2626" : "#6b7280", "คน"),
                            makeRow("❌ ไม่มาลงเวลา", absentCount, absentCount > 0 ? "#dc2626" : "#6b7280", "คน"),
                            makeRow("📝 ลา", onLeaveCount, "#3b82f6", "คน"),
                            makeRow("👥 พนักงานทั้งหมด", totalActive, "#6b7280", "คน"),
                        ],
                    },
                ],
            },
        };

        await sendFlexMessage(targetId, flex, `รายงานประจำวัน ${dateLabel}`);

        return NextResponse.json({
            ok: true,
            report: {
                date: dateStr,
                pending: { supervisor: pendingSupervisor, hr: pendingHr, ot: pendingOt },
                attendance: { total: totalActive, checkedIn: checkedInCount, late: lateCount, absent: absentCount, onLeave: onLeaveCount },
            },
        });
    } catch (error: any) {
        console.error("[DAILY REPORT] Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

function makeRow(label: string, value: number, color: string, unit: string = "รายการ") {
    return {
        type: "box",
        layout: "horizontal",
        contents: [
            { type: "text", text: label, size: "sm", color: "#6b7280", flex: 7 },
            { type: "text", text: `${value} ${unit}`, size: "sm", color, weight: "bold", flex: 3, align: "end" },
        ],
    };
}
