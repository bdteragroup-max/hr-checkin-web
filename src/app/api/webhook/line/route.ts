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
                            include: { employees: true }
                        });

                        if (!leaveReq) {
                            console.warn("[LINE WEBHOOK] Leave request NOT FOUND in DB.");
                            await sendReplyMessage(replyToken, "❌ ไม่พบข้อมูลคำขอลา");
                            continue;
                        }

                        // Auth Check: Either Supervisor or HR
                        const hrLineUserId = process.env.HR_LINE_USER_ID;
                        const isHr = hrLineUserId === lineUserId;
                        const supervisor = await prisma.employees.findUnique({
                            where: { emp_id: leaveReq.supervisor_id || "" }
                        });
                        const isSupervisor = supervisor && supervisor.line_user_id === lineUserId;

                        if (!isHr && !isSupervisor) {
                            console.warn(`[LINE WEBHOOK] UNAUTHORIZED: Expected supervisor(${supervisor?.line_user_id}) or HR(${hrLineUserId}), Got ${lineUserId}`);
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์อนุมัติคำขอนี้");
                            continue;
                        }

                        // ✅ Guard: Prevent duplicate clicks
                        // If it's supervisor, only allow if status is pending_supervisor
                        // If it's HR, only allow if status is pending_hr
                        if (isSupervisor && leaveReq.status !== "pending_supervisor") {
                            await sendReplyMessage(replyToken, `⚠️ คำขอนี้ไม่อยู่ในขั้นตอนของหัวหน้าแล้ว`);
                            continue;
                        }
                        if (isHr && !["pending_supervisor", "pending_hr"].includes(leaveReq.status)) {
                            await sendReplyMessage(replyToken, `⚠️ คำขอนี้ดำเนินการเสร็จสิ้นแล้ว`);
                            continue;
                        }

                        const { sendLeaveApprovalFlexMessage, sendHrLeaveNotification, sendEmployeeLeaveStatusNotification, sendManagementLeaveSummary } = await import("@/utils/lineMessaging");

                        if (action === "approve_leave") {
                            // Logic: Supervisor approves -> pending_hr | HR approves -> approved
                            const nextStatus = isHr ? "approved" : "pending_hr";
                            const updated = await prisma.leave_requests.update({
                                where: { id: targetId! },
                                data: {
                                    status: nextStatus,
                                    supervisor_approved_at: isSupervisor ? new Date() : leaveReq.supervisor_approved_at,
                                    approved_at: isHr ? new Date() : leaveReq.approved_at,
                                    approved_by: isHr ? "HR_LINE" : leaveReq.approved_by
                                },
                                include: { employees: true }
                            });

                            await sendLeaveApprovalFlexMessage(lineUserId!, {
                                id: leaveReq.id,
                                empName: leaveReq.name,
                                leaveType: leaveReq.leave_type,
                                startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                minutes: leaveReq.minutes,
                                reason: leaveReq.reason || "",
                            }, true, replyToken);

                            // Notify employee
                            if (leaveReq.employees?.line_user_id) {
                                sendEmployeeLeaveStatusNotification(leaveReq.employees.line_user_id, {
                                    empName: leaveReq.name,
                                    leaveType: leaveReq.leave_type,
                                    startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    minutes: leaveReq.minutes,
                                    reason: leaveReq.reason || "",
                                    status: nextStatus,
                                    approvedBy: isHr ? "HR" : supervisor?.name || "หัวหน้า",
                                }).catch(console.error);
                            }

                            // If Supervisor approved -> notify HR
                            if (isSupervisor) {
                                sendHrLeaveNotification({
                                    id: leaveReq.id,
                                    empName: leaveReq.name,
                                    leaveType: leaveReq.leave_type,
                                    startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    minutes: leaveReq.minutes,
                                    reason: leaveReq.reason || "",
                                    supervisorName: supervisor?.name || "หัวหน้า",
                                }).catch(console.error);
                            }

                            // If HR approved -> notify Management Summary
                            if (isHr) {
                                sendManagementLeaveSummary({
                                    empName: leaveReq.name,
                                    leaveType: leaveReq.leave_type,
                                    startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    minutes: leaveReq.minutes,
                                    reason: leaveReq.reason || "",
                                    supervisorName: supervisor?.name || "หัวหน้า",
                                    hrName: "HR Team (via LINE)"
                                }).catch(console.error);
                            }
                        } else {
                            // Reject Logic
                            await prisma.leave_requests.update({
                                where: { id: targetId! },
                                data: { status: "rejected" }
                            });
                            
                            await sendLeaveApprovalFlexMessage(lineUserId!, {
                                id: leaveReq.id,
                                empName: leaveReq.name,
                                leaveType: leaveReq.leave_type,
                                startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                minutes: leaveReq.minutes,
                                reason: leaveReq.reason || "",
                            }, true, replyToken);

                            if (leaveReq.employees?.line_user_id) {
                                sendEmployeeLeaveStatusNotification(leaveReq.employees.line_user_id, {
                                    empName: leaveReq.name,
                                    leaveType: leaveReq.leave_type,
                                    startDate: leaveReq.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    endDate: leaveReq.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    minutes: leaveReq.minutes,
                                    reason: leaveReq.reason || "",
                                    status: "rejected",
                                }).catch(console.error);
                            }
                        }
                    } else if (action === "approve_ot" || action === "reject_ot") {
                        console.log(`[LINE WEBHOOK] Querying OT request: ${targetId}`);
                        const otReq = await prisma.ot_requests.findUnique({
                            where: { id: Number(targetId!) },
                            include: { employee: true }
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
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์อนุมัติคำขอนนี้");
                            continue;
                        }

                        if (isSupervisor && otReq.status !== "pending_supervisor") {
                            await sendReplyMessage(replyToken, `⚠️ คำขอนี้ไม่อยู่ในขั้นตอนของหัวหน้าแล้ว`);
                            continue;
                        }
                        if (isHr && !["pending_supervisor", "pending_hr"].includes(otReq.status)) {
                            await sendReplyMessage(replyToken, `⚠️ คำขอนี้ดำเนินการเสร็จสิ้นแล้ว`);
                            continue;
                        }

                        const { sendOtApprovalFlexMessage, sendHrOtNotification, sendEmployeeOtStatusNotification, sendManagementOtSummary } = await import("@/utils/lineMessaging");

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
                                empName: otReq.employee.name,
                                dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                totalHours: Number(otReq.total_hours),
                                reason: otReq.reason || "",
                            }, true, replyToken);

                            // Notify employee
                            if (otReq.employee.line_user_id) {
                                sendEmployeeOtStatusNotification(otReq.employee.line_user_id, {
                                    empName: otReq.employee.name,
                                    dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    totalHours: Number(otReq.total_hours),
                                    reason: otReq.reason || "",
                                    status: nextStatus,
                                    approvedBy: isHr ? "HR" : supervisor?.name || "หัวหน้า",
                                }).catch(console.error);
                            }

                            // If Supervisor -> notify HR
                            if (isSupervisor) {
                                sendHrOtNotification({
                                    id: otReq.id,
                                    empName: otReq.employee.name,
                                    dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    totalHours: Number(otReq.total_hours),
                                    reason: otReq.reason || "",
                                    supervisorName: supervisor?.name || "หัวหน้า",
                                }).catch(console.error);
                            }

                            // If HR -> Management Summary
                            if (isHr) {
                                sendManagementOtSummary({
                                    empName: otReq.employee.name,
                                    dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    totalHours: Number(otReq.total_hours),
                                    reason: otReq.reason || "",
                                    supervisorName: supervisor?.name || "หัวหน้า",
                                    hrName: "HR Team (via LINE)"
                                }).catch(console.error);
                            }
                        } else {
                            await prisma.ot_requests.update({
                                where: { id: Number(targetId!) },
                                data: { status: "rejected" }
                            });
                            
                            await sendOtApprovalFlexMessage(lineUserId!, {
                                id: otReq.id,
                                empName: otReq.employee.name,
                                dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                totalHours: Number(otReq.total_hours),
                                reason: otReq.reason || "",
                            }, true, replyToken);

                            if (otReq.employee.line_user_id) {
                                sendEmployeeOtStatusNotification(otReq.employee.line_user_id, {
                                    empName: otReq.employee.name,
                                    dateFor: otReq.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                                    startTime: otReq.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    endTime: otReq.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                                    totalHours: Number(otReq.total_hours),
                                    reason: otReq.reason || "",
                                    status: "rejected",
                                }).catch(console.error);
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
