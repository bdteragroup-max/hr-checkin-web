import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function sendReplyMessage(replyToken: string, text: string) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.warn("[LINE] No Channel Access Token found. Cannot send reply.");
        return;
    }
    try {
        await fetch("https://api.line.me/v2/bot/message/reply", {
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
    } catch (e) {
        console.error("[LINE] Failed to send reply to LINE:", e);
    }
}

async function sendPushMessage(to: string, text: string) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.warn("[LINE] No Channel Access Token found. Cannot send push.");
        return;
    }
    try {
        await fetch("https://api.line.me/v2/bot/message/push", {
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
    } catch (e) {
        console.error("[LINE] Failed to send push message to LINE:", e);
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("[LINE WEBHOOK] Received events:", JSON.stringify(body, null, 2));
        
        if (!body.events || body.events.length === 0) {
            return new NextResponse("OK", { status: 200 });
        }

        for (const event of body.events) {
            try {
                if (event.type === "postback" && event.postback?.data) {
                    const lineUserId = event.source?.userId;
                    const replyToken = event.replyToken;
                    
                    if (!lineUserId) {
                        console.warn("[LINE WEBHOOK] Missing lineUserId in event source.");
                        continue;
                    }

                    const params = new URLSearchParams(event.postback.data);
                    const action = params.get("action");
                    const targetId = params.get("id");

                    console.log(`[LINE WEBHOOK] Postback action: ${action}, id: ${targetId}, user: ${lineUserId}`);

                    if (!targetId) {
                        console.warn("[LINE WEBHOOK] Missing targetId in postback data.");
                        continue;
                    }

                    if (action === "approve_leave" || action === "reject_leave") {
                        const leaveReq = await prisma.leave_requests.findUnique({
                            where: { id: targetId },
                            include: { employees: true }
                        });

                        if (!leaveReq) {
                            console.warn(`[LINE WEBHOOK] Leave request not found: ${targetId}`);
                            await sendReplyMessage(replyToken, "❌ ไม่พบข้อมูลคำขอลา (อาจถูกลบไปแล้ว)");
                            continue;
                        }

                        if (leaveReq.status !== "pending_supervisor") {
                            console.log(`[LINE WEBHOOK] Leave request ${targetId} is already: ${leaveReq.status}`);
                            await sendReplyMessage(replyToken, `ℹ️ คำขอนี้ไม่อยู่ในสถานะรอการอนุมัติ (สถานะปัจจุบัน: ${leaveReq.status})`);
                            continue;
                        }

                        const supervisorEmpId = leaveReq.supervisor_id;
                        if (!supervisorEmpId) {
                            console.error(`[LINE WEBHOOK] Leave request ${targetId} has no supervisor_id.`);
                            await sendReplyMessage(replyToken, "❌ ข้อมูลไม่ถูกต้อง (ไม่พบหัวหน้างาน)");
                            continue;
                        }

                        const supervisor = await prisma.employees.findUnique({
                            where: { emp_id: supervisorEmpId }
                        });

                        if (!supervisor || supervisor.line_user_id !== lineUserId) {
                            console.warn(`[LINE WEBHOOK] Unauthorized supervisor for leave request ${targetId}. Expected: ${supervisor?.line_user_id}, Got: ${lineUserId}`);
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์ในการอนุมัติคำขอนี้");
                            continue;
                        }

                        const statusToSet = action === "approve_leave" ? "approved" : "rejected";

                        await prisma.leave_requests.update({
                            where: { id: targetId },
                            data: {
                                status: statusToSet,
                                approved_at: new Date()
                            }
                        });

                        const replyText = action === "approve_leave" 
                            ? `✅ คุณได้อนุมัติคำขอลาของ ${leaveReq.name} เรียบร้อยแล้ว`
                            : `❌ คุณได้ไม่อนุมัติคำขอลาของ ${leaveReq.name} เรียบร้อยแล้ว`;
                            
                        await sendReplyMessage(replyToken, replyText);

                        const employee = leaveReq.employees;
                        if (employee && employee.line_user_id) {
                            const statusThai = action === "approve_leave" ? "อนุมัติ" : "ไม่อนุมัติ";
                            const pushText = `📢 แจ้งเตือน: ใบลาของคุณได้รับการ "${statusThai}" โดยหัวหน้างานแล้ว`;
                            await sendPushMessage(employee.line_user_id, pushText);
                        }
                    }

                    else if (action === "approve_ot" || action === "reject_ot") {
                        const otReqId = parseInt(targetId);
                        if (isNaN(otReqId)) {
                            console.error(`[LINE WEBHOOK] Invalid OT request ID: ${targetId}`);
                            await sendReplyMessage(replyToken, "❌ รหัสคำขอ OT ไม่ถูกต้อง");
                            continue;
                        }

                        const otReq = await prisma.ot_requests.findUnique({
                            where: { id: otReqId },
                            include: { employee: true }
                        });

                        if (!otReq) {
                            console.warn(`[LINE WEBHOOK] OT request not found: ${otReqId}`);
                            await sendReplyMessage(replyToken, "❌ ไม่พบข้อมูลคำขอ OT");
                            continue;
                        }

                        if (otReq.status !== "pending") {
                            console.log(`[LINE WEBHOOK] OT request ${otReqId} is already: ${otReq.status}`);
                            await sendReplyMessage(replyToken, `ℹ️ คำขอ OT นี้ไม่อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${otReq.status})`);
                            continue;
                        }

                        const supervisorEmpId = otReq.supervisor_id;
                        const supervisor = await prisma.employees.findUnique({
                            where: { emp_id: supervisorEmpId || "" }
                        });

                        if (!supervisor || supervisor.line_user_id !== lineUserId) {
                            console.warn(`[LINE WEBHOOK] Unauthorized supervisor for OT request ${otReqId}. Expected: ${supervisor?.line_user_id}, Got: ${lineUserId}`);
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์ในการอนุมัติคำขอ OT นี้");
                            continue;
                        }

                        const statusToSet = action === "approve_ot" ? "approved" : "rejected";
                        const approvedHours = action === "approve_ot" ? otReq.total_hours : null;

                        await prisma.ot_requests.update({
                            where: { id: otReqId },
                            data: {
                                status: statusToSet,
                                approved_at: new Date(),
                                approved_hours: approvedHours
                            }
                        });

                        let replyText = action === "approve_ot" 
                            ? `✅ คุณได้อนุมัติคำขอ OT ของ ${otReq.employee.name} จำนวน ${otReq.total_hours} ชม. เรียบร้อยแล้ว`
                            : `❌ คุณได้ไม่อนุมัติคำขอ OT ของ ${otReq.employee.name} เรียบร้อยแล้ว`;
                            
                        if (action === "approve_ot") {
                            replyText += `\n(หากต้องการแก้ไขชั่วโมง กรุณาดำเนินการผ่านระบบหลังบ้าน)`;
                        }

                        await sendReplyMessage(replyToken, replyText);

                        const employee = otReq.employee;
                        if (employee && employee.line_user_id) {
                            const statusThai = action === "approve_ot" ? "อนุมัติ" : "ไม่อนุมัติ";
                            const pushText = `📢 แจ้งเตือน: คำขอ OT ของคุณได้รับการ "${statusThai}" โดยหัวหน้างานแล้ว`;
                            await sendPushMessage(employee.line_user_id, pushText);
                        }
                    }
                } else if (event.type === "message" && event.message?.type === "text") {
                    const lineUserId = event.source?.userId;
                    const replyToken = event.replyToken;
                    const text = event.message.text.trim().toLowerCase();
                    
                    if (lineUserId && replyToken) {
                        if (text === "/check") {
                            try {
                                const [pendingLeave, pendingOT, activeEmployees] = await Promise.all([
                                    prisma.leave_requests.count({ where: { status: "pending_supervisor" } }),
                                    prisma.ot_requests.count({ where: { status: "pending" } }),
                                    prisma.employees.count({ where: { is_active: true } })
                                ]);
                                
                                const statusMsg = `🛡️ [Manual Status Check]
Status: OK ✅
Active Employees: ${activeEmployees}
Pending Leaves: ${pendingLeave}
Pending OTs: ${pendingOT}
Checked at: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`;
                                await sendReplyMessage(replyToken, statusMsg);
                            } catch (err) {
                                await sendReplyMessage(replyToken, "❌ Error checking system status.");
                            }
                        } else {
                            const textToSend = `LINE ID ของคุณคือ:\n${lineUserId}\n\nคุณสามารถคัดลอกไอดีนี้ไปใส่ในแอประบบ HR ได้เลยครับ`;
                            await sendReplyMessage(replyToken, textToSend);
                        }
                    }
                }
            } catch (eventErr) {
                console.error("[LINE WEBHOOK] Error processing event:", eventErr);
            }
        }

        return new NextResponse("OK", { status: 200 });

    } catch (e) {
        console.error("[LINE WEBHOOK] Global Error:", e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
