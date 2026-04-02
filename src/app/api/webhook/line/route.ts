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

                        // Auth Check
                        const supervisor = await prisma.employees.findUnique({
                            where: { emp_id: leaveReq.supervisor_id || "" }
                        });
                        console.log(`[LINE WEBHOOK] Supervisor in DB: ${supervisor?.name} (Line: ${supervisor?.line_user_id})`);

                        if (!supervisor || supervisor.line_user_id !== lineUserId) {
                            console.warn(`[LINE WEBHOOK] UNAUTHORIZED: Expected ${supervisor?.line_user_id}, Got ${lineUserId}`);
                            await sendReplyMessage(replyToken, "⛔ คุณไม่มีสิทธิ์อนุมัติคำขอนี้");
                            continue;
                        }

                        const statusToSet = action === "approve_leave" ? "approved" : "rejected";
                        await prisma.leave_requests.update({
                            where: { id: targetId! },
                            data: { status: statusToSet, approved_at: new Date() }
                        });
                        console.log(`[LINE WEBHOOK] DB Updated to ${statusToSet}`);

                        await sendReplyMessage(replyToken, action === "approve_leave" ? "✅ อนุมัติสำเร็จ" : "❌ ปฏิเสธสำเร็จ");
                        
                        if (leaveReq.employees?.line_user_id) {
                            await sendPushMessage(leaveReq.employees.line_user_id, `📢 ใบลาของคุณได้รับการ "${action === "approve_leave" ? "อนุมัติ" : "ไม่อนุมัติ"}" แล้ว`);
                        }
                    }
                    // OT Logic similarly logged...
                } 
                
                else if (event.type === "message" && event.message?.type === "text") {
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
