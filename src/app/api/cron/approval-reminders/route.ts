import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
    sendLeaveApprovalFlexMessage, 
    sendOtApprovalFlexMessage, 
    sendTravelClaimNotification, 
    sendCommissionClaimNotification 
} from "@/utils/lineMessaging";
import { formatDateShortThai, formatTime24h } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Helper: Push LINE Message (Generic for KPI or fallback)
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
        console.error("[APPROVAL REMINDER] LINE push error:", e);
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
        // 1. Fetch all pending requests requiring supervisor action
        const [leaves, ots, travels, commissions, kpis] = await Promise.all([
            prisma.leave_requests.findMany({
                where: { status: "pending_supervisor" },
                include: { employees: { select: { name: true, line_user_id: true, supervisor: { select: { line_user_id: true, name: true } } } } }
            }),
            prisma.ot_requests.findMany({
                where: { status: "pending_supervisor" },
                include: { employee: { select: { name: true, line_user_id: true, supervisor: { select: { line_user_id: true, name: true } } } } }
            }),
            prisma.travel_claims.findMany({
                where: { status: "pending_supervisor" },
                include: { employee: { select: { line_user_id: true, name: true, supervisor: { select: { line_user_id: true, name: true } } } } }
            }),
            prisma.commission_claims.findMany({
                where: { status: "pending_supervisor" },
                include: { employee: { select: { line_user_id: true, name: true, supervisor: { select: { line_user_id: true, name: true } } } } }
            }),
            prisma.kpi_evaluations.findMany({
                where: { status: "pending_supervisor" },
                include: { employee: { select: { line_user_id: true, name: true, supervisor: { select: { line_user_id: true, name: true } } } } }
            })
        ]);

        let totalSent = 0;

        // 2. Process Leaves
        for (const leave of leaves) {
            const supervisorLineId = leave.employees?.supervisor?.line_user_id;
            if (!supervisorLineId) continue;

            await sendLeaveApprovalFlexMessage(supervisorLineId, {
                id: leave.id,
                empName: leave.name,
                leaveType: leave.leave_type,
                startDate: formatDateShortThai(leave.start_at),
                endDate: formatDateShortThai(leave.end_at),
                minutes: leave.minutes,
                reason: leave.reason || "",
                handoverPerson: leave.handover_person || "",
                supervisorName: leave.employees?.supervisor?.name || ""
            });
            totalSent++;
        }

        // 3. Process OTs
        for (const ot of ots) {
            const supervisorLineId = ot.employee?.supervisor?.line_user_id;
            if (!supervisorLineId) continue;

            await sendOtApprovalFlexMessage(supervisorLineId, {
                id: ot.id,
                empName: ot.employee.name,
                dateFor: formatDateShortThai(ot.date_for),
                startTime: formatTime24h(ot.start_time),
                endTime: formatTime24h(ot.end_time),
                totalHours: Number(ot.total_hours),
                reason: ot.reason || "",
                hasDiscrepancy: ot.has_discrepancy,
                actualIn: formatTime24h(ot.actual_start_at),
                actualOut: formatTime24h(ot.actual_end_at),
                supervisorName: ot.employee.supervisor?.name || ""
            });
            totalSent++;
        }

        // 4. Process Travel Claims
        for (const tc of travels) {
            const supervisorLineId = tc.employee?.supervisor?.line_user_id;
            if (!supervisorLineId) continue;

            await sendTravelClaimNotification({
                id: tc.id,
                employeeName: tc.employee.name,
                claimType: tc.claim_type,
                siteName: tc.site_name,
                dateRange: formatDateShortThai(tc.date),
                amount: `${tc.accommodation_amount} THB`,
                status: tc.status,
                remark: tc.remark || "",
                reportUrl: tc.report_url
            }, [supervisorLineId]);
            totalSent++;
        }

        // 5. Process Commission Claims
        for (const cc of commissions) {
            const supervisorLineId = cc.employee?.supervisor?.line_user_id;
            if (!supervisorLineId) continue;

            await sendCommissionClaimNotification({
                id: cc.id,
                employeeName: cc.employee.name,
                customerName: cc.customer_name,
                date: formatDateShortThai(cc.date),
                totalAmount: cc.total_commission?.toString() || "0",
                perPerson: cc.per_person_commission?.toString() || "0",
                status: cc.status
            }, [supervisorLineId]);
            totalSent++;
        }

        // 6. Process KPIs (No binary approval, send link reminder)
        for (const kpi of kpis) {
            const supervisorLineId = kpi.employee?.supervisor?.line_user_id;
            if (!supervisorLineId) continue;

            const flexContent = {
                type: "bubble",
                header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#fef2f2",
                    contents: [{ type: "text", text: "แจ้งเตือน: การประเมิน KPI", weight: "bold", color: "#991b1b" }]
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    contents: [
                        { type: "text", text: `พนักงาน: ${kpi.employee.name}`, size: "sm", weight: "bold" },
                        { type: "text", text: "รอกระบวนการประเมินจากคุณ", size: "xs", color: "#6b7280" }
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
                                label: "ไปหน้าประเมิน",
                                uri: `https://hr-checkin-web.vercel.app/team/kpi/evaluate/${kpi.id}`
                            },
                            style: "primary",
                            color: "#991b1b"
                        }
                    ]
                }
            };

            await pushLineMessage(supervisorLineId, [{ type: "flex", altText: "แจ้งเตือนประเมิน KPI", contents: flexContent }]);
            totalSent++;
        }

        return NextResponse.json({
            ok: true,
            remindersSent: totalSent
        });

    } catch (error: any) {
        console.error("[APPROVAL REMINDER] Fatal error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
