import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";

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
        console.error("[KPI REMINDER] LINE push error:", e);
        return false;
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");
    const force = searchParams.get("force") === "true";

    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        // 1. Determine "Today" in Bangkok
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const dayOfMonth = now.getDate();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // ONLY RUN ON THE 20th (Unless forced for testing)
        if (dayOfMonth !== 20 && !force) {
            return NextResponse.json({ ok: true, message: "Skipped. Notifications only sent on the 20th." });
        }

        // 2. Fetch all Regular Employees (not on trial) who are active
        const employees = await prisma.employees.findMany({
            where: {
                is_active: true,
                is_on_trial: false,
                OR: [
                    { supervisor_id: { not: null } },
                    { secondary_supervisor_id: { not: null } }
                ]
            },
            include: {
                supervisor: { select: { emp_id: true, name: true, line_user_id: true } },
                secondary_supervisor: { select: { emp_id: true, name: true, line_user_id: true } }
            }
        });

        // 3. Group by Supervisor
        const supervisorMap: Record<string, { info: any, subs: any[] }> = {};

        employees.forEach((emp: any) => {
            // Primary Supervisor
            if (emp.supervisor?.line_user_id) {
                const sid = emp.supervisor.emp_id;
                if (!supervisorMap[sid]) supervisorMap[sid] = { info: emp.supervisor, subs: [] };
                supervisorMap[sid].subs.push(emp);
            }
            // Secondary Supervisor (Optional: Decide if they should also get notified)
            if (emp.secondary_supervisor?.line_user_id) {
                const sid = emp.secondary_supervisor.emp_id;
                if (!supervisorMap[sid]) supervisorMap[sid] = { info: emp.secondary_supervisor, subs: [] };
                supervisorMap[sid].subs.push(emp);
            }
        });

        let notificationsSent = 0;

        // 4. Send Notifications
        for (const sid in supervisorMap) {
            const { info, subs } = supervisorMap[sid];
            
            const flexContent = {
                type: "bubble",
                size: "mega",
                header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#fef2f2",
                    paddingAll: "16px",
                    contents: [
                        { type: "text", text: "แจ้งเตือน: ประเมิน KPI ประจำเดือน", weight: "bold", size: "lg", color: "#991b1b" },
                        { type: "text", text: `ประจำวันที่ 20/${currentMonth}/${currentYear}`, size: "sm", color: "#6b7280", margin: "sm" }
                    ]
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    paddingAll: "16px",
                    contents: [
                        { type: "text", text: `สวัสดีคุณ ${info.name}`, size: "sm", color: "#6b7280" },
                        {
                            type: "text",
                            text: `ได้เวลาประเมินผลการทำงานและ KPI ของพนักงานในทีมแล้ว (พนักงานประจำ):`,
                            size: "sm",
                            color: "#111827",
                            wrap: true,
                            margin: "md"
                        },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "lg",
                            spacing: "sm",
                            contents: subs.slice(0, 10).map((s: any) => ({
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    { type: "text", text: "•", width: "10px", size: "xs", color: "#94a3b8" },
                                    { type: "text", text: s.name, size: "xs", weight: "bold", color: "#1e293b", flex: 1 }
                                ]
                            }))
                        },
                        subs.length > 10 ? { type: "text", text: `... และคนอื่นๆ อีก ${subs.length - 10} ท่าน`, size: "xxs", color: "#94a3b8", margin: "sm" } : { type: "filler" },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "xxl",
                            contents: [
                                {
                                    type: "button",
                                    action: {
                                        type: "uri",
                                        label: "จัดการ KPI ทีม",
                                        uri: "https://hr-checkin-web.vercel.app/team/kpi"
                                    },
                                    style: "primary",
                                    color: "#991b1b"
                                }
                            ]
                        }
                    ]
                }
            };

            const success = await pushLineMessage(info.line_user_id, [
                { type: "flex", altText: "แจ้งเตือนประเมิน KPI ประจำเดือน", contents: flexContent }
            ]);
            if (success) notificationsSent++;
        }

        return NextResponse.json({
            ok: true,
            day: dayOfMonth,
            supervisorsNotified: notificationsSent,
            totalSupervisors: Object.keys(supervisorMap).length
        });

    } catch (error: any) {
        console.error("[KPI REMINDER] Fatal error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
