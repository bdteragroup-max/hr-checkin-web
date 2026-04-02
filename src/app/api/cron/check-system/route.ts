import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";

async function sendPushMessage(to: string, text: string) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) return;
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
        console.error("Failed to send push message to LINE:", e);
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");
    const targetId = searchParams.get("targetId");

    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        // 1. Check DB
        const startTime = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const dbLatency = Date.now() - startTime;

        // 2. Statistics
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [pendingLeave, pendingOT, activeEmployees] = await Promise.all([
            prisma.leave_requests.count({ where: { status: "pending_supervisor" } }),
            prisma.ot_requests.count({ where: { status: "pending" } }),
            prisma.employees.count({ where: { is_active: true } })
        ]);

        const statusMessage = `🛡️ [System Health Check]
Status: OK ✅
DB Latency: ${dbLatency}ms
Active Employees: ${activeEmployees}
Pending Leaves: ${pendingLeave}
Pending OTs: ${pendingOT}
Checked at: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`;

        if (targetId) {
            await sendPushMessage(targetId, statusMessage);
        }

        return NextResponse.json({ 
            ok: true, 
            latency: dbLatency,
            stats: { pendingLeave, pendingOT, activeEmployees }
        });

    } catch (error: any) {
        const errMsg = `🚨 [System Health Check]
Status: ERROR ❌
Error: ${error.message}
Checked at: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`;

        if (targetId) {
            await sendPushMessage(targetId, errMsg);
        }

        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
