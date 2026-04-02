const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dotenv = require('dotenv');
dotenv.config();

// MOCK FETCH
const originalFetch = global.fetch;
let lastLinePayload = null;

global.fetch = async (url, options) => {
    if (url.includes('api.line.me')) {
        lastLinePayload = JSON.parse(options.body);
        console.log('--- Mocked LINE Message Sent ---');
        console.log('To Supervisor:', lastLinePayload.messages[0].text);
        return { ok: true, json: async () => ({}) };
    }
    return originalFetch(url, options);
};

// ── CORE LOGIC FROM Webhook Route ──────────────────────────────
async function processWebhookSim(lineUserId, postbackData) {
    const params = new URLSearchParams(postbackData);
    const action = params.get("action");
    const targetId = params.get("id");

    if (action === "approve_leave") {
        const leaveReq = await prisma.leave_requests.findUnique({
            where: { id: targetId }
        });

        if (!leaveReq) throw new Error("Leave request not found: " + targetId);
        
        const supervisor = await prisma.employees.findUnique({
            where: { emp_id: leaveReq.supervisor_id }
        });

        if (!supervisor || supervisor.line_user_id !== lineUserId) {
            throw new Error("Unauthorized supervisor: " + lineUserId);
        }

        // Update DB
        await prisma.leave_requests.update({
            where: { id: targetId },
            data: {
                status: "approved",
                approved_at: new Date()
            }
        });

        // Send Reply
        const text = `✅ คุณได้อนุมัติคำขอลาของ ${leaveReq.name} เรียบร้อยแล้ว`;
        await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            body: JSON.stringify({ messages: [{ type: "text", text }] })
        });
    }
}

// ── TEST RUN ──────────────────────────────────────────────────
async function runTest() {
    const supervisorId = 'TP57001';
    const employee_id = 'TE68002';
    const mock_line_id = 'U_SIMULATED_SUP_001';
    const mock_lv_id = 'TEST-LV-' + Date.now();

    try {
        console.log('1. Setting up Supervisor LINE ID...');
        await prisma.employees.update({ 
            where: { emp_id: supervisorId }, 
            data: { line_user_id: mock_line_id } 
        });

        console.log('2. Creating Pending Leave Request (ID: ' + mock_lv_id + ')...');
        const lv = await prisma.leave_requests.create({
            data: {
                id: mock_lv_id,
                emp_id: employee_id,
                name: 'Employee Test (Sim)',
                leave_type_id: 'personal',
                leave_type: 'Personal',
                reason: 'Simulating LINE approval',
                start_date: new Date('2026-05-01'),
                end_date: new Date('2026-05-01'),
                start_at: new Date('2026-05-01T08:00:00+07:00'),
                end_at: new Date('2026-05-01T17:00:00+07:00'),
                minutes: 480,
                status: 'pending_supervisor',
                supervisor_id: supervisorId,
                days: 1
            }
        });

        console.log('3. Running Simulation...');
        await processWebhookSim(mock_line_id, `action=approve_leave&id=${lv.id}`);

        console.log('4. Verifying Final State...');
        const updated = await prisma.leave_requests.findUnique({ where: { id: lv.id } });
        console.log('New Status:', updated.status);
        console.log('Approved At:', updated.approved_at);

        if (updated.status === 'approved' && lastLinePayload) {
            console.log('\n✅ SIMULATION SUCCESSFUL');
            console.log('Confirmed: Supervisor received the "Approval Result" confirmation message.');
        } else {
            console.log('\n❌ SIMULATION FAILED');
        }

        // Cleanup
        await prisma.leave_requests.delete({ where: { id: lv.id } });
        await prisma.employees.update({ where: { emp_id: supervisorId }, data: { line_user_id: null } });
        
    } catch (e) {
        console.error('Error:', e.message);
        // Try cleanup if ID was created
        try { await prisma.leave_requests.delete({ where: { id: mock_lv_id } }); } catch(err){}
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
