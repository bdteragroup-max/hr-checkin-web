import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const MANAGEMENT_LINE_USER_ID = process.env.MANAGEMENT_LINE_USER_ID;

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
        return res.ok;
    } catch (e) {
        console.error("[PROBATION WEEKLY SUMMARY] LINE push error:", e);
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
        // 1. Determine "Today" (Bangkok time) and the Monday-Sunday range
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        now.setHours(0, 0, 0, 0);

        const dayOfWeek = now.getDay();
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        const monday = new Date(now.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
        sunday.setHours(23, 59, 59, 999);

        // 2. Fetch Probation Employees with their past evaluations
        const trialEmployees = await prisma.employees.findMany({
            where: {
                is_active: true,
                is_on_trial: true,
                hire_date: { not: null },
            },
            include: {
                probation_evaluations: true,
                departments: true
            }
        });

        const upcomingEvaluations: any[] = [];

        // 3. Calculate Upcoming Milestones
        for (const emp of trialEmployees) {
            let evalDate: Date | null = null;
            let evalReason = "";

            if (emp.probation_end_date) {
                const pEnd = new Date(emp.probation_end_date);
                pEnd.setHours(0, 0, 0, 0);
                if (pEnd >= monday && pEnd <= sunday) {
                    evalDate = pEnd;
                    evalReason = "สิ้นสุดทดลองงาน";
                }
            } else if (emp.hire_date) {
                const hireDate = new Date(emp.hire_date);
                hireDate.setHours(0, 0, 0, 0);

                [30, 60, 90, 119].forEach(days => {
                    const milestoneDate = new Date(hireDate.getTime() + days * 24 * 60 * 60 * 1000);
                    if (milestoneDate >= monday && milestoneDate <= sunday) {
                        evalDate = milestoneDate;
                        evalReason = days === 119 ? "สิ้นสุดทดลองงาน" : `รอบ ${days} วัน`;
                    }
                });
            }

            if (evalDate) {
                const maxEvalNo = emp.probation_evaluations?.reduce((max, ev) => Math.max(max, ev.evaluation_no), 0) || 0;
                const evaluationNo = maxEvalNo + 1;
                upcomingEvaluations.push({
                    name: emp.name,
                    dept: emp.departments?.name || "-",
                    evalDate: evalDate,
                    reason: evalReason,
                    evaluationNo: evaluationNo
                });
            }
        }

        if (upcomingEvaluations.length === 0) {
            return NextResponse.json({ ok: true, message: "No evaluations this week." });
        }

        // Sort by evaluation date ascending
        upcomingEvaluations.sort((a, b) => a.evalDate.getTime() - b.evalDate.getTime());

        // 4. Send Summary to Management
        const dateRangeStr = `${monday.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })} - ${sunday.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}`;

        const flexContent = {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#1e293b",
                paddingAll: "16px",
                contents: [
                    { type: "text", text: "สรุปการประเมินทดลองงาน (รายสัปดาห์)", weight: "bold", size: "lg", color: "#ffffff", wrap: true },
                    { type: "text", text: `สัปดาห์ที่ ${dateRangeStr}`, size: "sm", color: "#94a3b8", margin: "sm" }
                ]
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                paddingAll: "16px",
                contents: upcomingEvaluations.map(e => ({
                    type: "box",
                    layout: "vertical",
                    margin: "sm",
                    spacing: "xs",
                    backgroundColor: "#f8fafc",
                    paddingAll: "12px",
                    cornerRadius: "8px",
                    contents: [
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                { type: "text", text: e.name, size: "sm", weight: "bold", color: "#1e293b", flex: 7 },
                                { type: "text", text: `ครั้งที่ ${e.evaluationNo}`, size: "xs", color: "#0369a1", align: "end", weight: "bold", flex: 3 }
                            ]
                        },
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                { type: "text", text: "แผนก:", size: "xs", color: "#64748b", flex: 3 },
                                { type: "text", text: e.dept, size: "xs", color: "#475569", flex: 7 }
                            ]
                        },
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                { type: "text", text: "วันที่ประเมิน:", size: "xs", color: "#64748b", flex: 3 },
                                { type: "text", text: e.evalDate.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }), size: "xs", color: "#475569", weight: "bold", flex: 7 }
                            ]
                        },
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                { type: "text", text: "เหตุผล:", size: "xs", color: "#64748b", flex: 3 },
                                { type: "text", text: e.reason, size: "xs", color: "#d97706", weight: "bold", flex: 7 }
                            ]
                        }
                    ]
                }))
            }
        };

        let success = false;
        if (MANAGEMENT_LINE_USER_ID) {
            success = await pushLineMessage(MANAGEMENT_LINE_USER_ID, [
                { type: "flex", altText: "สรุปการประเมินทดลองงานประจำสัปดาห์", contents: flexContent }
            ]);
        }

        return NextResponse.json({
            ok: true,
            notified: success,
            evaluations: upcomingEvaluations
        });

    } catch (error: any) {
        console.error("[PROBATION WEEKLY SUMMARY] Fatal error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
