import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // 1. Get today's local date (Asia/Bangkok)
        const now = new Date();
        const str = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
        const localNow = new Date(str);
        const y = localNow.getFullYear();
        const m = String(localNow.getMonth() + 1).padStart(2, "0");
        const d = String(localNow.getDate()).padStart(2, "0");
        const dateKey = `${y}-${m}-${d}T00:00:00.000Z`;

        const todayStart = new Date(dateKey);
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

        // 2. Fetch all active employees
        const activeEmployees = await prisma.employees.findMany({
            where: { is_active: true },
            select: {
                emp_id: true,
                name: true,
                branches: { select: { name: true } },
                departments: { select: { name: true } }
            },
            orderBy: [{ emp_id: 'asc' }]
        });

        // 3. Fetch today's checkins
        const checkinsToday = await prisma.checkins.findMany({
            where: {
                date_key: todayStart,
                type: { in: ["Check-in", "Project-In", "Offsite-In"] }
            },
            select: { emp_id: true }
        });

        const checkedInSet = new Set(checkinsToday.map(c => c.emp_id));

        // 4. Fetch today's approved leaves
        const leavesToday = await prisma.leave_requests.findMany({
            where: {
                status: "approved",
                start_date: { lte: todayEnd },
                end_date: { gte: todayStart }
            },
            select: { emp_id: true, leave_type: true }
        });

        const leaveMap = new Map();
        for (const l of leavesToday) {
            leaveMap.set(l.emp_id, l.leave_type);
        }

        // 5. Calculate missing
        const missing = activeEmployees
            .filter(emp => !checkedInSet.has(emp.emp_id))
            .map(emp => ({
                emp_id: emp.emp_id,
                name: emp.name,
                branch_name: emp.branches?.name || "ไม่ระบุสาขา",
                department_name: emp.departments?.name || "ไม่ระบุแผนก",
                on_leave: leaveMap.has(emp.emp_id),
                leave_type: leaveMap.get(emp.emp_id) || null
            }));

        const retrievalTime = new Date().toISOString();

        return NextResponse.json({
            ok: true,
            missing_count: missing.length,
            list: missing,
            retrieval_time: retrievalTime
        });

    } catch (e: any) {
        console.error("Absenteeism API Error:", e);
        return NextResponse.json({ error: e.message || "SERVER_ERROR" }, { status: 500 });
    }
}
