import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function sendReplyMessage(replyToken: string, text: string) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.warn("[LINE DEBUG] Cannot reply: LINE_CHANNEL_ACCESS_TOKEN is MISSING in environment.");
        return;
    }
    try {
        console.log(`[LINE DEBUG] Sending reply to token ${replyToken.substring(0, 5)}...: ${text.substring(0, 50)}`);
        const res = await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                replyToken,
                messages: [{ type: "text", text }]
            })
        });
        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[LINE DEBUG] Reply API failed (Status: ${res.status}):`, errBody);
        } else {
            console.log("[LINE DEBUG] Reply sent successfully.");
        }
    } catch (e) {
        console.error("[LINE DEBUG] Exception in sendReplyMessage:", e);
    }
}

async function sendPushMessage(to: string, text: string) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.warn("[LINE DEBUG] Cannot push: LINE_CHANNEL_ACCESS_TOKEN is MISSING.");
        return;
    }
    try {
        console.log(`[LINE DEBUG] Sending push to ${to.substring(0, 5)}...: ${text.substring(0, 50)}`);
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to,
                messages: [{ type: "text", text }]
            })
        });
        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[LINE DEBUG] Push API failed (Status: ${res.status}):`, errBody);
        } else {
            console.log("[LINE DEBUG] Push sent successfully.");
        }
    } catch (e) {
        console.error("[LINE DEBUG] Exception in sendPushMessage:", e);
    }
}

export async function POST(req: Request) {
    console.log("[LINE WEBHOOK] --- New Request Received ---");

    // Check Token Presence
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.warn("[LINE WEBHOOK] ALERT: LINE_CHANNEL_ACCESS_TOKEN is NOT defined in this environment!");
    } else {
        console.log("[LINE WEBHOOK] Token detected: OK (starts with " + LINE_CHANNEL_ACCESS_TOKEN.substring(0, 5) + "...)");
    }

    try {
        const body = await req.json();
        console.log("[LINE WEBHOOK] Payload:", JSON.stringify(body, null, 2));

        if (!body.events || body.events.length === 0) {
            console.log("[LINE WEBHOOK] No events found in body.");
            return new NextResponse("OK", { status: 200 });
        }

        for (const event of body.events) {
            console.log(`[LINE WEBHOOK] Processing event: ${event.type}`);

            try {
                if (event.type === "postback" && event.postback?.data) {
                    const lineUserId = event.source?.userId;
                    const replyToken = event.replyToken;

                    const params = new URLSearchParams(event.postback.data);
                    const action = params.get("action");
                    const targetId = params.get("id");

                    console.log(`[LINE WEBHOOK] Action: ${action}, Target: ${targetId}, User: ${lineUserId}`);

                    if (action === "approve_leave" || action === "reject_leave") {
                        console.log(`[LINE WEBHOOK] Querying leave request: ${targetId}`);
                        const leaveReq = await prisma.leave_requests.findUnique({
                            where: { id: targetId! },
                            include: { employees: { select: { name: true, nickname: true, line_user_id: true } } }
                        });

                        if (!leaveReq) {
                            console.warn("[LINE WEBHOOK] Leave request NOT FOUND in DB.");
                            await sendReplyMessage(replyToken, "❌ ไม่พบข้อมูลคำขอลา");
                            continue;
                        }

                        // Auth Check: Supervisor, HR, or Management
                        const hrLineUserId = process.env.HR_LINE_USER_ID;
                        const managementLineUserId = process.env.MANAGEMENT_LINE_USER_ID;
                        const isHr = hrLineUserId === lineUserId;
                        const isManagement = managementLineUserId === lineUserId;
                        const supervisor = await prisma.employees.findUnique({
                            where: { emp_id: leaveReq.supervisor_id || "" }
                        });
                        const isSupervisor = supervisor && supervisor.line_user_id === lineUserId;

                        if (!isHr && !isSupervisor && !isManagement) {
                            console.warn(`[LINE WEBHOOK] UNAUTHORIZED: Expected supervisor(${supervisor?.line_user_id}), HR(${hrLineUserId}), or Management(${managementLineUserId}), Got ${lineUserId}`);
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์อนุมัติคำขอนี้");
                            continue;
                        }

                        // Better Role Guard: Allow dual-role users (e.g. Supervisor who is also Management) to approve if status matches ANY of their roles.
                        let canAct = false;
                        let errorMsg = "";

                        if (isSupervisor && leaveReq.status === "pending_supervisor") {
                            canAct = true;
                        } else if (isHr && ["pending_supervisor", "pending_hr"].includes(leaveReq.status)) {
                            canAct = true;
                        } else if (isManagement && leaveReq.status === "pending_management") {
                            canAct = true;
                        } else {
                            // Determine the most helpful error message
                            if (["approved", "rejected", "cancelled"].includes(leaveReq.status)) {
                                const statusMap: any = { approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ", cancelled: "ยกเลิกแล้ว" };
                                errorMsg = `⚠️ คำขอนี้ดำเนินการเสร็จสิ้นแล้ว (${statusMap[leaveReq.status]})`;
                            } else if (leaveReq.status === "pending_supervisor" && (isHr || isManagement)) {
                                errorMsg = `⚠️ คำขอนี้ยังไม่ผ่านการอนุมัติจากหัวหน้างาน (ปัจจุบัน: รอหัวหน้าอนุมัติ)`;
                            } else if (leaveReq.status === "pending_hr" && isManagement) {
                                errorMsg = `⚠️ คำขอนี้ยังไม่ผ่านการตรวจสอบจาก HR (ปัจจุบัน: รอ HR อนุมัติ)`;
                            } else {
                                errorMsg = `⚠️ คุณไม่สามารถดำเนินการในขั้นตอนนี้ได้ (สถานะปัจจุบัน: ${leaveReq.status})`;
                            }
                        }

                        if (!canAct) {
                            await sendReplyMessage(replyToken, errorMsg);
                            continue;
                        }

                        // Look up approver name from LINE ID
                        const approver = await prisma.employees.findFirst({
                            where: { line_user_id: lineUserId },
                            select: { name: true }
                        });
                        const approverName = approver?.name || (isHr ? "HR Team" : isManagement ? "Management" : (supervisor?.name || "Staff"));

                        const { sendLeaveApprovalFlexMessage, sendHrLeaveNotification, sendEmployeeLeaveStatusNotification, sendManagementLeaveSummary } = await import("@/utils/lineMessaging");
                        const leaveEmpName = leaveReq.employees?.nickname ? `${leaveReq.employees.name} (${leaveReq.employees.nickname})` : (leaveReq.employees?.name || leaveReq.name);

                        if (action === "approve_leave") {
                            // Management: pending_management → approved directly
                            // Supervisor: pending_supervisor → pending_hr
                            // HR: pending_supervisor|pending_hr → approved
                            // Determine the next status based on who is approving and what the current stage is
                            let nextStatus = "approved";
                            if (leaveReq.status === "pending_supervisor" && isSupervisor) {
                                // If acting as supervisor, move to pending_hr even if user is also Management/HR
                                nextStatus = "pending_hr";
                            } else if (isHr || isManagement) {
                                nextStatus = "approved";
                            }
                            const updated = await prisma.leave_requests.update({
                                where: { id: targetId! },
                                data: {
                                    status: nextStatus,
                                    supervisor_approved_at: isSupervisor ? new Date() : leaveReq.supervisor_approved_at,
                                    approved_at: (isHr || isManagement) ? new Date() : leaveReq.approved_at,
                                    approved_by: (isHr || isManagement) ? (isManagement ? "MANAGEMENT_LINE" : "HR_LINE") : leaveReq.approved_by
                                },
                                include: { employees: true }
                            });

                            await sendLeaveApprovalFlexMessage(lineUserId!, {
                                id: leaveReq.id,
                                empName: leaveEmpName,
                                leaveType: leaveReq.leave_type,
                                startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                minutes: leaveReq.minutes,
                                reason: leaveReq.reason || "",
                                handoverPerson: (leaveReq as any).handover_person,
                                supervisorName: supervisor?.name,
                                approvedBy: approverName,
                            }, true, replyToken);

                            // Start notifications
                            const notifications: Promise<any>[] = [];

                            // 1. Notify Employee
                            if (leaveReq.employees?.line_user_id) {
                                console.log(`[LINE WEBHOOK] Notifying employee: ${leaveReq.employees.line_user_id} Status: ${nextStatus}`);
                                notifications.push(sendEmployeeLeaveStatusNotification(leaveReq.employees.line_user_id, {
                                    empName: leaveEmpName,
                                    leaveType: leaveReq.leave_type,
                                    startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    minutes: leaveReq.minutes,
                                    reason: leaveReq.reason || "",
                                    handoverPerson: (leaveReq as any).handover_person,
                                    status: nextStatus as any,
                                    approvedBy: approverName,
                                }));
                            }

                            // 2. Supervisor approved → notify HR
                            if (isSupervisor) {
                                console.log(`[LINE WEBHOOK] Supervisor approved. Notifying HR.`);
                                notifications.push(sendHrLeaveNotification({
                                    id: leaveReq.id,
                                    empName: leaveEmpName,
                                    leaveType: leaveReq.leave_type,
                                    startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    minutes: leaveReq.minutes,
                                    reason: leaveReq.reason || "",
                                    handoverPerson: (leaveReq as any).handover_person,
                                    supervisorName: approverName,
                                }));
                            }

                            // 3. HR approved → notify Management Summary
                            if (isHr) {
                                console.log(`[LINE WEBHOOK] HR approved. Sending summary to Management.`);
                                notifications.push(sendManagementLeaveSummary({
                                    empName: leaveEmpName,
                                    leaveType: leaveReq.leave_type,
                                    startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    minutes: leaveReq.minutes,
                                    reason: leaveReq.reason || "",
                                    handoverPerson: (leaveReq as any).handover_person,
                                    supervisorName: supervisor?.name || "หัวหน้า",
                                    hrName: approverName
                                }));
                            }

                            const results = await Promise.allSettled(notifications);
                            results.forEach((res, i) => {
                                if (res.status === 'rejected') console.error(`[LINE WEBHOOK] Notification ${i} failed:`, res.reason);
                            });
                        } else {
                            // Reject Logic
                            await prisma.leave_requests.update({
                                where: { id: targetId! },
                                data: { status: "rejected" }
                            });

                            await sendLeaveApprovalFlexMessage(lineUserId!, {
                                id: leaveReq.id,
                                empName: leaveEmpName,
                                leaveType: leaveReq.leave_type,
                                startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                minutes: leaveReq.minutes,
                                reason: leaveReq.reason || "",
                                handoverPerson: (leaveReq as any).handover_person,
                            }, true, replyToken);

                            if (leaveReq.employees?.line_user_id) {
                                console.log(`[LINE WEBHOOK] Notifying employee of REJECTION: ${leaveReq.employees.line_user_id}`);
                                await sendEmployeeLeaveStatusNotification(leaveReq.employees.line_user_id, {
                                    empName: leaveEmpName,
                                    leaveType: leaveReq.leave_type,
                                    startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    minutes: leaveReq.minutes,
                                    reason: leaveReq.reason || "",
                                    handoverPerson: (leaveReq as any).handover_person,
                                    status: "rejected",
                                });
                            }
                        }
                    } else if (action === "approve_ot" || action === "reject_ot") {
                        console.log(`[LINE WEBHOOK] Querying OT request: ${targetId}`);
                        const otReq = await prisma.ot_requests.findUnique({
                            where: { id: Number(targetId!) },
                            include: { employee: { select: { name: true, nickname: true, emp_id: true, supervisor_id: true, line_user_id: true } } }
                        });

                        if (!otReq) {
                            console.warn("[LINE WEBHOOK] OT request NOT FOUND.");
                            await sendReplyMessage(replyToken, "❌ ไม่พบข้อมูลคำขอ OT");
                            continue;
                        }

                        // Auth Check: Either Supervisor or HR
                        const hrLineUserId = process.env.HR_LINE_USER_ID;
                        const isHr = hrLineUserId === lineUserId;
                        const supervisor = await prisma.employees.findUnique({
                            where: { emp_id: otReq.employee.supervisor_id || "" }
                        });
                        const isSupervisor = supervisor && supervisor.line_user_id === lineUserId;

                        if (!isHr && !isSupervisor) {
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์อนุมัติคำขอนี้");
                            continue;
                        }

                        // Look up approver name from LINE ID
                        const approver = await prisma.employees.findFirst({
                            where: { line_user_id: lineUserId },
                            select: { name: true }
                        });
                        const approverName = approver?.name || (isHr ? "HR Team" : (supervisor?.name || "Staff"));

                        // OT Role Guard Refactor
                        let canActOt = false;
                        let otErrorMsg = "";

                        if (isSupervisor && otReq.status === "pending_supervisor") {
                            canActOt = true;
                        } else if (isHr && ["pending_supervisor", "pending_hr"].includes(otReq.status)) {
                            canActOt = true;
                        } else {
                            if (["approved", "rejected"].includes(otReq.status)) {
                                const statusMap: any = { approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" };
                                otErrorMsg = `⚠️ คำขอนี้ดำเนินการเสร็จสิ้นแล้ว (${statusMap[otReq.status]})`;
                            } else if (otReq.status === "pending_supervisor" && isHr) {
                                otErrorMsg = `⚠️ คำขอนี้ยังไม่ผ่านการอนุมัติจากหัวหน้างาน (ปัจจุบัน: รอหัวหน้าอนุมัติ)`;
                            } else {
                                otErrorMsg = `⚠️ คุณไม่สามารถดำเนินการในขั้นตอนนี้ได้ (สถานะปัจจุบัน: ${otReq.status})`;
                            }
                        }

                        if (!canActOt) {
                            await sendReplyMessage(replyToken, otErrorMsg);
                            continue;
                        }

                        const { sendOtApprovalFlexMessage, sendHrOtNotification, sendEmployeeOtStatusNotification, sendManagementOtSummary } = await import("@/utils/lineMessaging");
                        const otEmpName = otReq.employee.nickname ? `${otReq.employee.name} (${otReq.employee.nickname})` : otReq.employee.name;

                        if (action === "approve_ot") {
                            const nextStatus = isHr ? "approved" : "pending_hr";
                            await prisma.ot_requests.update({
                                where: { id: Number(targetId!) },
                                data: {
                                    status: nextStatus,
                                    approved_at: isHr ? new Date() : otReq.approved_at,
                                }
                            });

                            // ✅ Feedback Feedback
                            await sendOtApprovalFlexMessage(lineUserId!, {
                                id: otReq.id,
                                empName: otEmpName,
                                dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                totalHours: Number(otReq.total_hours),
                                reason: otReq.reason || "",
                                supervisorName: supervisor?.name,
                                approvedBy: approverName,
                            }, true, replyToken);

                            // Notify employee
                            if (otReq.employee.line_user_id) {
                                sendEmployeeOtStatusNotification(otReq.employee.line_user_id, {
                                    empName: otEmpName,
                                    dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    totalHours: Number(otReq.total_hours),
                                    reason: otReq.reason || "",
                                    status: nextStatus,
                                    approvedBy: approverName,
                                }).catch(console.error);
                            }

                            // If Supervisor -> notify HR
                            if (isSupervisor) {
                                sendHrOtNotification({
                                    id: otReq.id,
                                    empName: otEmpName,
                                    dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    totalHours: Number(otReq.total_hours),
                                    reason: otReq.reason || "",
                                    supervisorName: approverName,
                                }).catch(console.error);
                            }

                            // If HR -> Management Summary
                            if (isHr) {
                                sendManagementOtSummary({
                                    empName: otEmpName,
                                    dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    totalHours: Number(otReq.total_hours),
                                    reason: otReq.reason || "",
                                    supervisorName: supervisor?.name || "หัวหน้า",
                                    hrName: approverName
                                }).catch(console.error);
                            }
                        } else {
                            await prisma.ot_requests.update({
                                where: { id: Number(targetId!) },
                                data: { status: "rejected" }
                            });

                            await sendOtApprovalFlexMessage(lineUserId!, {
                                id: otReq.id,
                                empName: otEmpName,
                                dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                totalHours: Number(otReq.total_hours),
                                reason: otReq.reason || "",
                            }, true, replyToken);

                            if (otReq.employee.line_user_id) {
                                sendEmployeeOtStatusNotification(otReq.employee.line_user_id, {
                                    empName: otEmpName,
                                    dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    totalHours: Number(otReq.total_hours),
                                    reason: otReq.reason || "",
                                    status: "rejected",
                                }).catch(console.error);
                            }
                        }
                    } else if (action === "approve_travel" || action === "reject_travel") {
                        console.log(`[LINE WEBHOOK] Querying travel claim: ${targetId}`);
                        const claim = await prisma.travel_claims.findUnique({
                            where: { id: targetId! },
                            include: { employee: { select: { name: true, nickname: true, emp_id: true, supervisor_id: true, line_user_id: true } } }
                        });

                        if (!claim) {
                            await sendReplyMessage(replyToken, "❌ ไม่พบข้อมูลคำขอเบี้ยเลี้ยง");
                            continue;
                        }

                        // Auth Check
                        const hrLineConfig = process.env.HR_LINE_USER_ID || "";
                        const hrLineIds = hrLineConfig.split(",").map(id => id.trim());
                        const isHr = hrLineIds.includes(lineUserId || "");

                        const supervisor = await prisma.employees.findUnique({
                            where: { emp_id: claim.supervisor_id || "" }
                        });
                        const isSupervisor = supervisor && supervisor.line_user_id === lineUserId;

                        if (!isHr && !isSupervisor) {
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์อนุมัติคำขอนี้");
                            continue;
                        }

                        let canAct = false;
                        if (isSupervisor && claim.status === "pending_supervisor") canAct = true;
                        else if (isHr) {
                            if (action === "approve_travel") {
                                if (claim.status === "pending_admin") canAct = true;
                            } else {
                                // Reject - allow at any pending stage
                                if (["pending_supervisor", "pending_admin"].includes(claim.status)) canAct = true;
                            }
                        }

                        if (!canAct) {
                            await sendReplyMessage(replyToken, `⚠️ คุณไม่สามารถดำเนินการในขั้นตอนนี้ได้ (สถานะปัจจุบัน: ${claim.status})`);
                            continue;
                        }

                        const { sendTravelClaimNotification, sendManagementTravelSummary } = await import("@/utils/lineMessaging");
                        const travelEmpName = claim.employee.nickname ? `${claim.employee.name} (${claim.employee.nickname})` : claim.employee.name;

                        // Look up approver name for summary
                        const approver = await prisma.employees.findFirst({
                            where: { line_user_id: lineUserId },
                            select: { name: true }
                        });
                        const approverName = approver?.name || (isHr ? "HR Team" : (supervisor?.name || "Staff"));

                        if (action === "approve_travel") {
                            const nextStatus = isHr ? "completed" : "pending_admin";
                            const updated = await prisma.travel_claims.update({
                                where: { id: targetId! },
                                data: {
                                    status: nextStatus,
                                    supervisor_approved_at: isSupervisor ? new Date() : claim.supervisor_approved_at,
                                    approved_at: isHr ? new Date() : claim.approved_at,
                                    approved_by: isHr ? "HR_LINE" : claim.approved_by
                                },
                                include: { employee: true }
                            });

                            // Card reply to Approver
                            await sendTravelClaimNotification({
                                id: claim.id,
                                employeeName: travelEmpName,
                                claimType: claim.claim_type,
                                siteName: claim.site_name,
                                dateRange: `${claim.date.toLocaleDateString("th-TH")}`,
                                amount: `${claim.accommodation_amount} THB`,
                                status: nextStatus,
                                reportUrl: claim.report_url,
                                hideButtons: true
                            }, [], replyToken);

                            // Notify Employee
                            if (claim.employee.line_user_id) {
                                await sendTravelClaimNotification({
                                    id: claim.id,
                                    employeeName: travelEmpName,
                                    claimType: claim.claim_type,
                                    siteName: claim.site_name,
                                    dateRange: `${claim.date.toLocaleDateString("th-TH")}`,
                                    amount: `${claim.accommodation_amount} THB`,
                                    status: isHr ? "completed" : "approved",
                                    reportUrl: claim.report_url,
                                    hideButtons: true
                                }, [claim.employee.line_user_id]);
                            }

                            // If Supervisor approved -> Notify HR
                            if (isSupervisor && nextStatus === "pending_admin" && hrLineConfig) {
                                await sendTravelClaimNotification({
                                    id: claim.id,
                                    employeeName: travelEmpName,
                                    claimType: claim.claim_type,
                                    siteName: claim.site_name,
                                    dateRange: `${claim.date.toLocaleDateString("th-TH")}`,
                                    amount: `${claim.accommodation_amount} THB`,
                                    status: "pending_admin",
                                    reportUrl: claim.report_url
                                }, hrLineIds); // Use the array of HR IDs
                            }

                            // If HR approved (Completed) -> Notify Management
                            if (isHr && nextStatus === "completed") {
                                await sendManagementTravelSummary({
                                    empName: travelEmpName,
                                    claimType: claim.claim_type,
                                    siteName: claim.site_name,
                                    dateRange: `${claim.date.toLocaleDateString("th-TH")}`,
                                    amount: `${claim.accommodation_amount} THB`,
                                    hrName: approverName
                                });
                            }
                        } else {
                            // Reject
                            await prisma.travel_claims.update({
                                where: { id: targetId! },
                                data: { status: "rejected" }
                            });

                            // Card reply to Approver
                            await sendTravelClaimNotification({
                                id: claim.id,
                                employeeName: travelEmpName,
                                claimType: claim.claim_type,
                                siteName: claim.site_name,
                                dateRange: `${claim.date.toLocaleDateString("th-TH")}`,
                                amount: `${claim.accommodation_amount} THB`,
                                status: "rejected",
                                reportUrl: claim.report_url,
                                hideButtons: true
                            }, [], replyToken);

                            if (claim.employee.line_user_id) {
                                await sendTravelClaimNotification({
                                    id: claim.id,
                                    employeeName: travelEmpName,
                                    claimType: claim.claim_type,
                                    siteName: claim.site_name,
                                    dateRange: `${claim.date.toLocaleDateString("th-TH")}`,
                                    amount: `${claim.accommodation_amount} THB`,
                                    status: "rejected",
                                    reportUrl: claim.report_url,
                                    hideButtons: true
                                }, [claim.employee.line_user_id]);
                            }
                        }
                    } else if (action === "approve_commission" || action === "reject_commission") {
                        console.log(`[LINE WEBHOOK] Querying commission claim: ${targetId}`);
                        const claim = await prisma.commission_claims.findUnique({
                            where: { id: targetId! },
                            include: { employee: { select: { name: true, nickname: true, emp_id: true, supervisor_id: true, line_user_id: true } } }
                        });

                        if (!claim) {
                            await sendReplyMessage(replyToken, "❌ ไม่พบข้อมูลคำขอค่าคอมมิชชั่น");
                            continue;
                        }

                        // Auth Check
                        const hrLineConfig = process.env.HR_LINE_USER_ID || "";
                        const hrLineIds = hrLineConfig.split(",").map(id => id.trim());
                        const isHr = hrLineIds.includes(lineUserId || "");

                        const supervisor = await prisma.employees.findUnique({
                            where: { emp_id: claim.supervisor_id || "" }
                        });
                        const isSupervisor = supervisor && supervisor.line_user_id === lineUserId;

                        if (!isHr && !isSupervisor) {
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์อนุมัติคำขอนี้");
                            continue;
                        }

                        let canAct = false;
                        if (isSupervisor && claim.status === "pending_supervisor") canAct = true;
                        else if (isHr) {
                            if (action === "approve_commission") {
                                if (claim.status === "pending_admin") canAct = true;
                            } else {
                                if (["pending_supervisor", "pending_admin"].includes(claim.status)) canAct = true;
                            }
                        }

                        if (!canAct) {
                            await sendReplyMessage(replyToken, `⚠️ คุณไม่สามารถดำเนินการในขั้นตอนนี้ได้ (สถานะปัจจุบัน: ${claim.status})`);
                            continue;
                        }

                        const { sendCommissionClaimNotification, sendManagementCommissionSummary } = await import("@/utils/lineMessaging");
                        const commEmpName = claim.employee.nickname ? `${claim.employee.name} (${claim.employee.nickname})` : claim.employee.name;

                        // Look up approver name for summary
                        const approver = await prisma.employees.findFirst({
                            where: { line_user_id: lineUserId },
                            select: { name: true }
                        });
                        const approverName = approver?.name || (isHr ? "HR Team" : (supervisor?.name || "Staff"));

                        if (action === "approve_commission") {
                            const nextStatus = isHr ? "completed" : "pending_admin";
                            const updated = await prisma.commission_claims.update({
                                where: { id: targetId! },
                                data: {
                                    status: nextStatus,
                                    supervisor_approved_at: isSupervisor ? new Date() : claim.supervisor_approved_at,
                                    approved_at: isHr ? new Date() : claim.approved_at,
                                    approved_by: isHr ? "HR_LINE" : claim.approved_by
                                },
                                include: { employee: true }
                            });

                            // Card reply to Approver
                            await sendCommissionClaimNotification({
                                id: claim.id,
                                employeeName: commEmpName,
                                customerName: claim.customer_name,
                                date: claim.date.toLocaleDateString("th-TH"),
                                totalAmount: claim.total_commission?.toLocaleString() || "0",
                                perPerson: claim.per_person_commission?.toLocaleString() || "0",
                                status: nextStatus,
                                hideButtons: true
                            }, [], replyToken);

                            // Notify Employee
                            if (claim.employee.line_user_id) {
                                await sendCommissionClaimNotification({
                                    id: claim.id,
                                    employeeName: commEmpName,
                                    customerName: claim.customer_name,
                                    date: claim.date.toLocaleDateString("th-TH"),
                                    totalAmount: claim.total_commission?.toLocaleString() || "0",
                                    perPerson: claim.per_person_commission?.toLocaleString() || "0",
                                    status: nextStatus,
                                    hideButtons: true
                                }, [claim.employee.line_user_id]);
                            }

                            // If Supervisor approved -> Notify HR
                            if (isSupervisor && nextStatus === "pending_admin" && hrLineConfig) {
                                await sendCommissionClaimNotification({
                                    id: claim.id,
                                    employeeName: commEmpName,
                                    customerName: claim.customer_name,
                                    date: claim.date.toLocaleDateString("th-TH"),
                                    totalAmount: claim.total_commission?.toLocaleString() || "0",
                                    perPerson: claim.per_person_commission?.toLocaleString() || "0",
                                    status: "pending_admin"
                                }, hrLineIds);
                            }

                            // If HR approved -> Notify Management
                            if (isHr && nextStatus === "completed") {
                                await sendManagementCommissionSummary({
                                    empName: commEmpName,
                                    customerName: claim.customer_name,
                                    date: claim.date.toLocaleDateString("th-TH"),
                                    amount: claim.total_commission?.toLocaleString() || "0",
                                    perPerson: claim.per_person_commission?.toLocaleString() || "0",
                                    hrName: approverName
                                });
                            }
                        } else {
                            // Reject
                            await prisma.commission_claims.update({
                                where: { id: targetId! },
                                data: { status: "rejected" }
                            });

                            // Card reply to Approver
                            await sendCommissionClaimNotification({
                                id: claim.id,
                                employeeName: commEmpName,
                                customerName: claim.customer_name,
                                date: claim.date.toLocaleDateString("th-TH"),
                                totalAmount: claim.total_commission?.toLocaleString() || "0",
                                perPerson: claim.per_person_commission?.toLocaleString() || "0",
                                status: "rejected",
                                hideButtons: true
                            }, [], replyToken);

                            if (claim.employee.line_user_id) {
                                await sendCommissionClaimNotification({
                                    id: claim.id,
                                    employeeName: commEmpName,
                                    customerName: claim.customer_name,
                                    date: claim.date.toLocaleDateString("th-TH"),
                                    totalAmount: claim.total_commission?.toLocaleString() || "0",
                                    perPerson: claim.per_person_commission?.toLocaleString() || "0",
                                    status: "rejected",
                                    hideButtons: true
                                }, [claim.employee.line_user_id]);
                            }
                        }
                    } else if (action === "approve_welfare" || action === "reject_welfare") {
                        console.log(`[LINE WEBHOOK] Querying welfare claim: ${targetId}`);
                        const claim = await prisma.general_welfare_claims.findUnique({
                            where: { id: targetId! },
                            include: { employees: { select: { name: true, nickname: true, emp_id: true, supervisor_id: true, line_user_id: true } } }
                        });

                        if (!claim) {
                            await sendReplyMessage(replyToken, "❌ ไม่พบข้อมูลคำขอสวัสดิการ");
                            continue;
                        }

                        // Auth Check: Supervisor or HR
                        const hrLineConfig = process.env.HR_LINE_USER_ID || "";
                        const hrLineIds = hrLineConfig.split(",").map(id => id.trim());
                        const isHr = hrLineIds.includes(lineUserId || "");

                        const supervisor = await prisma.employees.findUnique({
                            where: { emp_id: claim.employees.supervisor_id || "" }
                        });
                        const isSupervisor = supervisor && supervisor.line_user_id === lineUserId;

                        if (!isHr && !isSupervisor) {
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์อนุมัติคำขอนี้");
                            continue;
                        }

                        // Welfare Role Guard: 
                        // Supervisor can act if supervisor_status is pending
                        // HR can act if supervisor_status is approved AND status is pending
                        let canAct = false;
                        let roleError = "";

                        if (isSupervisor && claim.supervisor_status === "pending") {
                            canAct = true;
                        } else if (isHr) {
                            if (claim.supervisor_status === "pending") {
                                roleError = "⚠️ คำขอนี้ยังไม่ผ่านการอนุมัติจากหัวหน้างาน";
                            } else if (claim.status !== "pending") {
                                const statusMap: any = { approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" };
                                roleError = `⚠️ คำขอนี้ดำเนินการเสร็จสิ้นแล้ว (${statusMap[claim.status]})`;
                            } else {
                                canAct = true;
                            }
                        } else if (isSupervisor && claim.supervisor_status !== "pending") {
                            const statusMap: any = { approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" };
                            roleError = `⚠️ คุณดำเนินการไปแล้ว (${statusMap[claim.supervisor_status]})`;
                        } else {
                            roleError = "⚠️ คุณไม่สามารถดำเนินการในขั้นตอนนี้ได้";
                        }

                        if (!canAct) {
                            await sendReplyMessage(replyToken, roleError);
                            continue;
                        }

                        const { sendWelfareApprovalFlexMessage, sendEmployeeWelfareStatusNotification, sendHrWelfareNotification } = await import("@/utils/lineMessaging");
                        const WELFARE_TITLES: any = {
                            CHILD_EDUCATION: "ทุนการศึกษาบุตร",
                            MARRIAGE: "เงินแสดงความยินดีมงคลสมรส",
                            CHILDBIRTH: "เงินรับขวัญบุตร",
                            ORDINATION: "เงินช่วยเหลืองานอุปสมบท",
                            FUNERAL: "เงินช่วยเหลืองานฌาปนกิจ"
                        };
                        const welfareTitle = WELFARE_TITLES[claim.welfare_type] || claim.welfare_type;
                        const empDisplayName = claim.employees.nickname ? `${claim.employees.name} (${claim.employees.nickname})` : claim.employees.name;
                        const approver = await prisma.employees.findFirst({ where: { line_user_id: lineUserId }, select: { name: true } });
                        const approverName = approver?.name || (isHr ? "HR Team" : (supervisor?.name || "Staff"));

                        const urls = claim.attachment_url ? (claim.attachment_url.startsWith('[') ? JSON.parse(claim.attachment_url) : [claim.attachment_url]) : [];

                        if (action === "approve_welfare") {
                            if (isSupervisor && claim.supervisor_status === "pending") {
                                // Supervisor Approved -> Move to HR
                                await prisma.general_welfare_claims.update({
                                    where: { id: targetId! },
                                    data: {
                                        supervisor_status: "approved",
                                        supervisor_approved_by: approverName,
                                        supervisor_approved_at: new Date(),
                                    }
                                });

                                // Feedback to Supervisor
                                await sendWelfareApprovalFlexMessage(lineUserId!, {
                                    id: claim.id,
                                    empName: empDisplayName,
                                    welfareType: welfareTitle,
                                    amount: Number(claim.amount).toLocaleString(),
                                    createdAt: claim.created_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    approvedBy: approverName,
                                    metadata: claim.metadata as any,
                                    attachmentUrls: urls
                                }, true, replyToken);

                                // Notify HR
                                await sendHrWelfareNotification({
                                    id: claim.id,
                                    empName: empDisplayName,
                                    welfareType: welfareTitle,
                                    amount: Number(claim.amount).toLocaleString(),
                                    createdAt: claim.created_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    metadata: claim.metadata as any,
                                    attachmentUrls: urls,
                                    supervisorName: approverName
                                });

                                // Notify Employee (Optional status update)
                                if (claim.employees.line_user_id) {
                                    await sendEmployeeWelfareStatusNotification(claim.employees.line_user_id, {
                                        empName: empDisplayName,
                                        welfareType: welfareTitle,
                                        amount: Number(claim.amount).toLocaleString(),
                                        status: "pending_hr",
                                        approvedBy: approverName
                                    });
                                }
                            } else if (isHr) {
                                // HR Final Approved
                                await prisma.general_welfare_claims.update({
                                    where: { id: targetId! },
                                    data: {
                                        status: "approved",
                                        approved_by: approverName,
                                        approved_at: new Date(),
                                    }
                                });

                                // Feedback to HR
                                await sendWelfareApprovalFlexMessage(lineUserId!, {
                                    id: claim.id,
                                    empName: empDisplayName,
                                    welfareType: welfareTitle,
                                    amount: Number(claim.amount).toLocaleString(),
                                    createdAt: claim.created_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    approvedBy: approverName,
                                    metadata: claim.metadata as any,
                                    attachmentUrls: urls
                                }, true, replyToken);

                                // Final Notify Employee
                                if (claim.employees.line_user_id) {
                                    await sendEmployeeWelfareStatusNotification(claim.employees.line_user_id, {
                                        empName: empDisplayName,
                                        welfareType: welfareTitle,
                                        amount: Number(claim.amount).toLocaleString(),
                                        status: "approved",
                                        approvedBy: approverName
                                    });
                                }
                            }
                        } else {
                            // Reject Logic (Either supervisor or HR can reject)
                            await prisma.general_welfare_claims.update({
                                where: { id: targetId! },
                                data: {
                                    status: "rejected",
                                    supervisor_status: isSupervisor ? "rejected" : claim.supervisor_status
                                }
                            });

                            await sendWelfareApprovalFlexMessage(lineUserId!, {
                                id: claim.id,
                                empName: empDisplayName,
                                welfareType: welfareTitle,
                                amount: Number(claim.amount).toLocaleString(),
                                createdAt: claim.created_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                metadata: claim.metadata as any,
                                attachmentUrls: urls,
                                approvedBy: approverName + " (ไม่อนุมัติ)"
                            }, true, replyToken);

                            if (claim.employees.line_user_id) {
                                await sendEmployeeWelfareStatusNotification(claim.employees.line_user_id, {
                                    empName: empDisplayName,
                                    welfareType: welfareTitle,
                                    amount: Number(claim.amount).toLocaleString(),
                                    status: "rejected",
                                    approvedBy: approverName
                                });
                            }
                        }
                    }
                } else if (event.type === "message" && event.message?.type === "text") {
                    const lineUserId = event.source?.userId;
                    const replyToken = event.replyToken;
                    const text = event.message.text.trim().toLowerCase();

                    console.log(`[LINE WEBHOOK] Message: ${text} from ${lineUserId}`);

                    if (text === "/check") {
                        console.log("[LINE WEBHOOK] /check command triggered.");
                        try {
                            const [pendingLeave, pendingOT, activeEmployees] = await Promise.all([
                                prisma.leave_requests.count({ where: { status: "pending_supervisor" } }),
                                prisma.ot_requests.count({ where: { status: "pending" } }),
                                prisma.employees.count({ where: { is_active: true } })
                            ]);

                            const statusMsg = `🛡️ [Status Check]\nEmployees: ${activeEmployees}\nPending Leave: ${pendingLeave}\nPending OT: ${pendingOT}`;
                            await sendReplyMessage(replyToken, statusMsg);
                        } catch (err: any) {
                            console.error("[LINE WEBHOOK] DB Count Error:", err.message);
                            await sendReplyMessage(replyToken, "❌ DB Error: " + err.message);
                        }
                    } else {
                        await sendReplyMessage(replyToken, `ID ของคุณคือ: ${lineUserId}`);
                    }
                }
            } catch (eventErr: any) {
                console.error("[LINE WEBHOOK] Event Processing Error:", eventErr.message);
            }
        }

        return new NextResponse("OK", { status: 200 });
    } catch (e: any) {
        console.error("[LINE WEBHOOK] GLOBAL CRASH:", e.message);
        return new NextResponse("Error", { status: 500 });
    }
}
