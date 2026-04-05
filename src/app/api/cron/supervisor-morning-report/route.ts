import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO, getNowBangkok } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";



// Helper: Push LINE Message
async function pushLineMessage(to: string, messages: any[]) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.error("[SUBORDINATE REPORT] LINE_CHANNEL_ACCESS_TOKEN is missing");
        return false;
    }
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
            const err = await res.text();
            console.error(`[SUBORDINATE REPORT] LINE API error: ${res.status} - ${err}`);
        }
        return res.ok;
    } catch (e) {
        console.error("[SUBORDINATE REPORT] LINE push exception:", e);
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
        const dateStr = getTodayBangkokISO();
        const dateKey = new Date(dateStr);
        const bkk = getNowBangkok();
        const dayOfWeek = bkk.getDay();

        // 🟢 1. Check for Skip Conditions (Sundays)
        // Note: The user specifically asked to skip Sundays and Public Holidays.
        if (dayOfWeek === 0) { // Sunday
            console.log(`[SUBORDINATE REPORT] Skipping Sunday: ${dateStr}`);
            return NextResponse.json({ ok: true, status: "SKIP_SUNDAY", date: dateStr });
        }

        // 🟢 2. Check for Public Holidays
        const holiday = await prisma.holidays.findUnique({
            where: { date: dateKey }
        });
        if (holiday) {
            console.log(`[SUBORDINATE REPORT] Skipping Public Holiday: ${holiday.name} (${dateStr})`);
            return NextResponse.json({ ok: true, status: "SKIP_HOLIDAY", name: holiday.name, date: dateStr });
        }

        // ── 3. Find employees with active supervisors ──
        // We only care about employees who have a supervisor that is linked to LINE.
        const targetEmployees = await prisma.employees.findMany({
            where: {
                is_active: true,
                is_checkin_exempt: false,
                supervisor_id: { not: null },
                supervisor: { 
                    is_active: true,
                    line_user_id: { not: "" } 
                },
                NOT: {
                    supervisor: {
                        line_user_id: null as any
                    }
                }
            },
            select: {
                emp_id: true,
                name: true,
                supervisor_id: true,
                supervisor: {
                    select: { line_user_id: true, name: true }
                }
            }
        });

        if (targetEmployees.length === 0) {
            return NextResponse.json({ ok: true, msg: "NO_SUPERVISED_STAFF_WITH_LINE" });
        }

        const employeeIds = targetEmployees.map(e => e.emp_id);

        // ── 4. Check for Today's Activity ──
        
        // 4a. Check-ins for today
        const checkinsToday = await prisma.checkins.findMany({
            where: { 
                date_key: dateKey,
                emp_id: { in: employeeIds }
            },
            select: { emp_id: true }
        });
        const checkedInIds = new Set(checkinsToday.map(c => c.emp_id));

        // 4b. Approved leaves for today
        const leavesToday = await prisma.leave_requests.findMany({
            where: {
                emp_id: { in: employeeIds },
                status: "approved",
                start_date: { lte: dateKey },
                end_date: { gte: dateKey },
            },
            select: { emp_id: true }
        });
        const onLeaveIds = new Set(leavesToday.map(l => l.emp_id));

        // ── 5. Group missing employees by supervisor ──
        const missingBySupervisor: Record<string, { 
            line_user_id: string, 
            supervisor_name: string, 
            staff: string[] 
        }> = {};

        for (const emp of targetEmployees) {
            // Missing = No check-in AND Not on leave
            const isMissing = !checkedInIds.has(emp.emp_id) && !onLeaveIds.has(emp.emp_id);
            
            if (isMissing && emp.supervisor?.line_user_id) {
                const sid = emp.supervisor_id!;
                if (!missingBySupervisor[sid]) {
                    missingBySupervisor[sid] = {
                        line_user_id: emp.supervisor.line_user_id,
                        supervisor_name: emp.supervisor.name,
                        staff: []
                    };
                }
                missingBySupervisor[sid].staff.push(`${emp.name} (${emp.emp_id})`);
            }
        }

        const reportStats = { sent: 0, supervisorsInvolved: 0 };
        const results: any[] = [];

        // ── 6. Push Reports to Supervisors ──
        for (const sid in missingBySupervisor) {
            reportStats.supervisorsInvolved++;
            const report = missingBySupervisor[sid];
            
            // Build Flex Message (Warning Red Theme)
            const flexContent = {
                type: "bubble",
                size: "mega",
                header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#fef2f2",
                    paddingAll: "16px",
                    contents: [
                        { type: "text", text: "พนักงานยังไม่เข้างาน", weight: "bold", size: "lg", color: "#b91c1c" },
                        { type: "text", text: `ประจำวันที่ ${bkk.toLocaleDateString("th-TH")}`, size: "sm", color: "#6b7280", margin: "sm" },
                    ]
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    paddingAll: "16px",
                    contents: [
                        { type: "text", text: `สวัสดีคุณ ${report.supervisor_name}`, size: "sm", color: "#6b7280" },
                        { type: "text", text: "ทีมงานของคุณยังไม่มีการลงเวลามาทำงาน ดังนี้:", size: "sm", wrap: true, margin: "sm" },
                        { type: "separator", margin: "lg" },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "lg",
                            spacing: "sm",
                            contents: report.staff.map(name => ({
                                type: "text",
                                text: `• ${name}`,
                                size: "sm",
                                color: "#374151"
                            }))
                        },
                        { 
                            type: "text", 
                            text: "กรุณาตรวจสอบการเข้างานของทีมงาน", 
                            size: "xs", 
                            color: "#9ca3af", 
                            margin: "xxl", 
                            align: "center",
                            style: "italic"
                        }
                    ]
                }
            };

            const success = await pushLineMessage(report.line_user_id, [
                { type: "flex", altText: "สรุปการเข้างานทีมงาน (09:00)", contents: flexContent }
            ]);

            if (success) reportStats.sent++;
            results.push({ supervisor: report.supervisor_name, staffCount: report.staff.length, success });
        }

        console.log(`[SUBORDINATE REPORT] Processed today: ${dateStr}. Reports sent: ${reportStats.sent}`);

        return NextResponse.json({ 
            ok: true, 
            date: dateStr, 
            stats: reportStats, 
            results 
        });
    } catch (error: any) {
        console.error("[SUBORDINATE REPORT] Fatal error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
