import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO, getNowBangkok, getBangkokWallClock } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const HR_LINE_USER_ID = process.env.HR_LINE_USER_ID;

// Helper: Push LINE Message
async function pushLineMessage(to: string, messages: any[]) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) return false;
    try {
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({ to, messages }),
        });
        return res.ok;
    } catch (e) {
        console.error("[PROBATION REPORT] LINE push error:", e);
        return false;
    }
}

// Milestone Configuration
// Days after hire_date to trigger a reminder
const REMINDER_DAYS: Record<number, { milestone: number; daysBefore: number }> = {
    23: { milestone: 30, daysBefore: 7 },
    27: { milestone: 30, daysBefore: 3 },
    29: { milestone: 30, daysBefore: 1 },
    53: { milestone: 60, daysBefore: 7 },
    57: { milestone: 60, daysBefore: 3 },
    59: { milestone: 60, daysBefore: 1 },
    83: { milestone: 90, daysBefore: 7 },
    87: { milestone: 90, daysBefore: 3 },
    89: { milestone: 90, daysBefore: 1 },
};

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

        // ── 2. Fetch Probation Employees with Supervisors ──
        const trialEmployees = await prisma.employees.findMany({
            where: {
                is_active: true,
                is_on_trial: true,
                hire_date: { not: null },
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
            include: {
                supervisor: {
                    select: { line_user_id: true, name: true }
                }
            }
        }) as any[];

        const reportStats = { checked: trialEmployees.length, notificationsSent: 0 };
        const results: any[] = [];

        // ── 3. Check Milestones & Notify ──
        for (const emp of trialEmployees) {
            let config: { milestone: string; daysBefore: number } | null = null;

            if (emp.probation_end_date) {
                // Scenario A: Manual End Date Set (Extensions or Custom)
                const endDate = new Date(emp.probation_end_date);
                endDate.setHours(0, 0, 0, 0);
                
                const diffTime = endDate.getTime() - todayBkk.getTime();
                const daysUntilEnd = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (daysUntilEnd === 7) config = { milestone: "สิ้นสุดทดลองงาน", daysBefore: 7 };
                else if (daysUntilEnd === 3) config = { milestone: "สิ้นสุดทดลองงาน", daysBefore: 3 };
                else if (daysUntilEnd === 1) config = { milestone: "สิ้นสุดทดลองงาน", daysBefore: 1 };

            } else if (emp.hire_date) {
                // Scenario B: Default Milestones (30, 60, 90 days from hire)
                const hireDate = new Date(emp.hire_date);
                hireDate.setHours(0, 0, 0, 0);

                const diffTime = todayBkk.getTime() - hireDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                const milestoneCfg = REMINDER_DAYS[diffDays];
                if (milestoneCfg) {
                    config = { 
                        milestone: `ครบรอบ ${milestoneCfg.milestone} วัน`, 
                        daysBefore: milestoneCfg.daysBefore 
                    };
                }
            }

            if (config && emp.supervisor?.line_user_id) {
                // Build Flex Message
                const flexContent = {
                    type: "bubble",
                    size: "mega",
                    header: {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#f0f9ff",
                        paddingAll: "16px",
                        contents: [
                            { type: "text", text: "ประเมินทดลองงาน", weight: "bold", size: "lg", color: "#0369a1" },
                            { type: "text", text: `การประเมิน: ${config.milestone}`, size: "sm", color: "#6b7280", margin: "sm" }
                        ]
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        spacing: "md",
                        paddingAll: "16px",
                        contents: [
                            { type: "text", text: `สวัสดีคุณ ${emp.supervisor.name}`, size: "sm", color: "#6b7280" },
                            {
                                type: "text",
                                text: `อีก ${config.daysBefore} วัน จะถึงกำหนดประเมินงานของ:`,
                                size: "sm",
                                color: "#111827",
                                wrap: true,
                                margin: "md"
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                margin: "lg",
                                spacing: "xs",
                                backgroundColor: "#f8fafc",
                                paddingAll: "12px",
                                cornerRadius: "8px",
                                contents: [
                                    { type: "text", text: `ชื่อ: ${emp.name}`, size: "sm", weight: "bold", color: "#1e293b" },
                                    { type: "text", text: `รหัส: ${emp.emp_id}`, size: "xs", color: "#64748b" },
                                    { type: "text", text: `วันที่เริ่มงาน: ${new Date(emp.hire_date!).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}`, size: "xs", color: "#64748b" }
                                ]
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                margin: "xxl",
                                contents: [
                                    {
                                        type: "text",
                                        text: config.milestone === "สิ้นสุดทดลองงาน" 
                                            ? `กรุณาเตรียมสรุปผลการทดลองงาน`
                                            : `กรุณาเตรียมประเมินผลการทำงาน (${config.milestone})`,
                                        size: "xs",
                                        color: "#0369a1",
                                        align: "center",
                                        wrap: true
                                    }
                                ]
                            }
                        ]
                    }
                };

                const success = await pushLineMessage(emp.supervisor.line_user_id, [
                    { type: "flex", altText: `แจ้งเตือนประเมินงาน: ${emp.name}`, contents: flexContent }
                ]);

                if (success) reportStats.notificationsSent++;
                results.push({ employee: emp.name, milestone: config.milestone, daysBefore: config.daysBefore, success });
            }
        }

        // ── 4. Summary to HR (Ms. Duangkamol) ──
        if (results.length > 0 && HR_LINE_USER_ID) {
            const summaryText = [
                "📊 สรุปการแจ้งเตือนพนักงานทดลองงาน",
                `ประจำวันที่ ${todayBkk.toLocaleDateString("th-TH")}`,
                "",
                ...results.map(r => `• ${r.employee} (${r.milestone}) -> แจ้งเตือน ${r.supervisor} ${r.success ? "✅" : "❌"}`)
            ].join("\n");

            await pushLineMessage(HR_LINE_USER_ID, [{ type: "text", text: summaryText }]);
        }

        return NextResponse.json({
            ok: true,
            stats: reportStats,
            results
        });
    } catch (error: any) {
        console.error("[PROBATION REPORT] Fatal error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
