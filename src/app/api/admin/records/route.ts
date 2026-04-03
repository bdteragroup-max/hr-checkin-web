import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const startMonth = url.searchParams.get("start_month"); // e.g. "2026-01"
        const endMonth = url.searchParams.get("end_month");     // e.g. "2026-03"

        if (!startMonth || !endMonth) {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        const [sy, sm] = startMonth.split("-").map(Number);
        const [ey, em] = endMonth.split("-").map(Number);

        const start = new Date(Date.UTC(sy, sm - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(ey, em, 0, 23, 59, 59, 999));

        const emps = await prisma.employees.findMany({
            where: { is_active: true, is_checkin_exempt: false } as any, 
            select: {
                emp_id: true,
                name: true,
                branch_id: true,
                is_active: true,
            },
            orderBy: { emp_id: "asc" },
        });

        const empIds = emps.map(e => e.emp_id);

        const rows = await prisma.checkins.findMany({
            where: {
                emp_id: { in: empIds },
                timestamp: { gte: start, lte: end },
            },
            select: { emp_id: true, timestamp: true, type: true, late_status: true, late_min: true },
        });

        const leaves = await prisma.leave_requests.findMany({
            where: {
                emp_id: { in: empIds },
                start_date: { lte: end },
                end_date: { gte: start },
            },
            select: { emp_id: true, days: true, status: true },
        });

        const holidaysFetch = await prisma.holidays.findMany({
            where: { date: { gte: start, lte: end } }
        });

        const holidayDates = new Set(holidaysFetch.map(h => new Date(h.date).toISOString().split("T")[0]));

        // Calculate expected Work Days
        let totalWorkDays = 0;
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
            if (dt.getUTCDay() === 0) continue; // skip sunday
            const dStr = dt.toISOString().split("T")[0];
            if (holidayDates.has(dStr)) continue; // skip holiday
            totalWorkDays++;
        }

        // Initialize counters for all employees
        const stats: Record<string, {
            leave_days: number;
            pending_leave_days: number;
            late_count: number;
            late_mins: number;
            present_dates: Set<string>;
        }> = {};

        for (const id of empIds) {
            stats[id] = { leave_days: 0, pending_leave_days: 0, late_count: 0, late_mins: 0, present_dates: new Set() };
        }

        // Process leaves
        for (const l of leaves) {
            if (!stats[l.emp_id]) continue;
            if (l.status === "approved") {
                stats[l.emp_id].leave_days += l.days || 0;
            } else if (l.status === "pending") {
                stats[l.emp_id].pending_leave_days += l.days || 0;
            }
        }

        // Process checkins
        for (const r of rows) {
            if (!stats[r.emp_id]) continue;
            const d = new Date(r.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

            if (r.type === "Check-in" || r.type === "Project-In" || r.type === "Offsite-In") {
                stats[r.emp_id].present_dates.add(d);
                if (r.late_status === "late") {
                    stats[r.emp_id].late_count += 1;
                    if (r.late_min) stats[r.emp_id].late_mins += r.late_min;
                }
            }
        }

        // Build summary output
        const summary = emps.map(e => {
            const s = stats[e.emp_id];
            // Absences = Total Work Days - Present Days - Approved Leave Days (very rough estimation, just like the old report tab)
            // A more precise absence calculation skips analyzing overlapping dates, but for now this is the standard metric.
            let absences = totalWorkDays - s.present_dates.size - s.leave_days;
            if (absences < 0) absences = 0;

            return {
                emp_id: e.emp_id,
                name: e.name,
                branch_id: e.branch_id,
                is_active: e.is_active,
                leave_days: s.leave_days,
                pending_leave_days: s.pending_leave_days,
                late_count: s.late_count,
                late_mins: s.late_mins,
                absent_days: absences,
                present_days: s.present_dates.size,
                total_work_days_period: totalWorkDays,
            };
        });

        return NextResponse.json({ ok: true, start_date: start, end_date: end, summary });

    } catch (e: any) {
        console.error("ADMIN_RECORDS_ERROR:", e);
        return NextResponse.json({ ok: false, error: "ERROR", msg: e.message, stack: e.stack }, { status: 500 });
    }
}
