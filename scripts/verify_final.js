const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dotenv = require('dotenv');
dotenv.config();

// MOCK FETCH
const originalFetch = global.fetch;
let lastPushPayload = null;
let lastReplyPayload = null;

global.fetch = async (url, options) => {
    if (url.includes('api.line.me/v2/bot/message/reply')) {
        lastReplyPayload = JSON.parse(options.body);
        console.log('--- Mocked LINE Reply Sent ---');
        console.log('Text:', lastReplyPayload.messages[0].text);
        return { ok: true, json: async () => ({}) };
    }
    if (url.includes('api.line.me/v2/bot/message/push')) {
        lastPushPayload = JSON.parse(options.body);
        console.log('--- Mocked LINE Push Sent ---');
        console.log('To:', lastPushPayload.to);
        console.log('Text:', lastPushPayload.messages[0].text);
        return { ok: true, json: async () => ({}) };
    }
    return originalFetch(url, options);
};

// ── CORE LOGIC FROM Webhook Route ──────────────────────────────
async function sendPushMessage(to, text) {
    await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        body: JSON.stringify({ to, messages: [{ type: "text", text }] })
    });
}
async function sendReplyMessage(replyToken, text) {
    await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] })
    });
}

async function processWebhookSim(event) {
    // This is a minimal simulation of the logic in the route.ts
    if (event.type === "postback") {
        const lineUserId = event.source.userId;
        const params = new URLSearchParams(event.postback.data);
        const action = params.get("action");
        const targetId = params.get("id");

        console.log(`Simulating Postback: ${action} for ID ${targetId} from ${lineUserId}`);

        if (action === "approve_leave") {
            const leaveReq = await prisma.leave_requests.findUnique({
                where: { id: targetId },
                include: { employees: true }
            });
            if (!leaveReq) throw new Error("Leave request not found");
            
            const supervisor = await prisma.employees.findUnique({
                where: { emp_id: leaveReq.supervisor_id }
            });

            if (!supervisor || supervisor.line_user_id !== lineUserId) {
                await sendReplyMessage(event.replyToken, "⛔ คุณไม่มีสิทธิ์ในการอนุมัติคำขอนี้");
                return;
            }

            await prisma.leave_requests.update({
                where: { id: targetId },
                data: { status: "approved", approved_at: new Date() }
            });

            await sendReplyMessage(event.replyToken, `✅ คุณได้อนุมัติคำขอลาของ ${leaveReq.name} เรียบร้อยแล้ว`);
            if (leaveReq.employees && leaveReq.employees.line_user_id) {
                await sendPushMessage(leaveReq.employees.line_user_id, `📢 แจ้งเตือน: ใบลาของคุณได้รับการ "อนุมัติ" โดยหัวหน้างานแล้ว`);
            }
        }
    } else if (event.type === "message" && event.message.text.trim().toLowerCase() === "/check") {
        console.log("Simulating /check command");
        const [pendingLeave, pendingOT, activeEmployees] = await Promise.all([
            prisma.leave_requests.count({ where: { status: "pending_supervisor" } }),
            prisma.ot_requests.count({ where: { status: "pending" } }),
            prisma.employees.count({ where: { is_active: true } })
        ]);
        const statusMsg = `🛡️ [Manual Status Check]\nStatus: OK ✅\nActive Employees: ${activeEmployees}\nPending Leaves: ${pendingLeave}\nPending OTs: ${pendingOT}`;
        await sendReplyMessage(event.replyToken, statusMsg);
    }
}

// ── TEST RUN ──────────────────────────────────────────────────
async function runTest() {
    const supervisorId = 'TP57001';
    const employee_id = 'TE68002';
    const mock_sup_line_id = 'U_SUP_LINE_123';
    const mock_lv_id = 'TEST-LV-' + Date.now();

    try {
        console.log('1. Setting up Test Data...');
        await prisma.employees.update({ 
            where: { emp_id: supervisorId }, 
            data: { line_user_id: mock_sup_line_id } 
        });

        const lv = await prisma.leave_requests.create({
            data: {
                id: mock_lv_id,
                emp_id: employee_id,
                name: 'Employee Test',
                leave_type_id: 'personal',
                leave_type: 'Personal',
                reason: 'Testing Webhook Fix',
                start_date: new Date(),
                end_date: new Date(),
                start_at: new Date(),
                end_at: new Date(),
                minutes: 480,
                status: 'pending_supervisor',
                supervisor_id: supervisorId,
                days: 1
            }
        });

        console.log('2. Simulating Approval Postback...');
        await processWebhookSim({
            type: "postback",
            replyToken: "mock_reply_token",
            source: { userId: mock_sup_line_id },
            postback: { data: `action=approve_leave&id=${lv.id}` }
        });

        console.log('3. Simulating /check command...');
        await processWebhookSim({
            type: "message",
            replyToken: "mock_reply_token_check",
            message: { text: "/check" }
        });

        console.log('\n✅ SIMULATION FINISHED');
        
        // Cleanup
        await prisma.leave_requests.delete({ where: { id: lv.id } });
        await prisma.employees.update({ where: { emp_id: supervisorId }, data: { line_user_id: null } });
        
    } catch (e) {
        console.error('Error during simulation:', e);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
