import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO, formatDateThai } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const MANAGEMENT_LINE_USER_ID = process.env.MANAGEMENT_LINE_USER_ID;
const HR_LINE_USER_ID = process.env.HR_LINE_USER_ID;

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
        console.log(`[LEAVE NOTIFY] Notification sent successfully to ${to}.`);
        return true;
    } catch (e: any) {
        console.error("[LEAVE NOTIFY] Exception:", e.message);
        return false;
    }
}

function buildFlexMessage(leavesList: any[], dateLabel: string, title: string) {
    const listContents: any[] = [];
    
    leavesList.forEach((l) => {
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

    if (listContents.length > 0) {
        listContents.pop();
    }

    return {
        type: "bubble",
        size: "mega",
        header: {
            type: "box",
            layout: "vertical",
            contents: [
                { type: "text", text: `📢 ${title}`, weight: "bold", size: "lg", color: "#ea580c" },
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
                    select: { 
                        name: true, 
                        departments: { select: { name: true } },
                        supervisor_id: true,
                        secondary_supervisor_id: true 
                    }
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
        
        let sentCount = 0;

        // 1. Send Global Summary to Management and HR
        const globalFlex = buildFlexMessage(leaves, dateLabel, "รายงานพนักงานลางาน (ทั้งหมด)");
        if (targetId) {
            await sendFlexMessage(targetId, globalFlex, `รายงานพนักงานลางานประจำวันที่ ${dateLabel}`);
            sentCount++;
        }
        if (HR_LINE_USER_ID && HR_LINE_USER_ID !== targetId) {
            await sendFlexMessage(HR_LINE_USER_ID, globalFlex, `รายงานพนักงานลางานประจำวันที่ ${dateLabel}`);
            sentCount++;
        }

        // 2. Group Leaves by Supervisor
        const supervisorLeaves: Record<string, any[]> = {};
        
        leaves.forEach(l => {
            const s1 = l.employees?.supervisor_id;
            const s2 = l.employees?.secondary_supervisor_id;
            
            if (s1) {
                if (!supervisorLeaves[s1]) supervisorLeaves[s1] = [];
                supervisorLeaves[s1].push(l);
            }
            if (s2 && s2 !== s1) {
                if (!supervisorLeaves[s2]) supervisorLeaves[s2] = [];
                supervisorLeaves[s2].push(l);
            }
        });

        // 3. Send Tailored Summaries to Supervisors
        const supervisorIds = Object.keys(supervisorLeaves);
        if (supervisorIds.length > 0) {
            const supervisors = await prisma.employees.findMany({
                where: { emp_id: { in: supervisorIds } },
                select: { emp_id: true, line_user_id: true, name: true }
            });

            for (const sup of supervisors) {
                if (!sup.line_user_id) continue;
                
                // Avoid sending duplicate global message if the supervisor is also management/HR
                if (sup.line_user_id === targetId || sup.line_user_id === HR_LINE_USER_ID) continue;

                const supLeaves = supervisorLeaves[sup.emp_id];
                if (supLeaves && supLeaves.length > 0) {
                    const supFlex = buildFlexMessage(supLeaves, dateLabel, "ทีมของคุณ: รายงานพนักงานลางาน");
                    await sendFlexMessage(sup.line_user_id, supFlex, `รายงานพนักงานลางานในทีม ประจำวันที่ ${dateLabel}`);
                    sentCount++;
                }
            }
        }

        return NextResponse.json({
            ok: true,
            sentCount: sentCount,
            totalAbsences: leaves.length,
            message: "Notifications sent"
        });

    } catch (error: any) {
        console.error("[LEAVE NOTIFY] Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
