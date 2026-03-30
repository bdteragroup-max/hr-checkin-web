import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvEscape(s: any) {
    const v = (s ?? "").toString();
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const startMonth = url.searchParams.get("start_month");
        const endMonth = url.searchParams.get("end_month");

        if (!startMonth || !endMonth) {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        const [sy, sm] = startMonth.split("-").map(Number);
        const [ey, em] = endMonth.split("-").map(Number);
        const start = new Date(Date.UTC(sy, sm - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(ey, em, 0, 23, 59, 59, 999));

        const emps = await prisma.employees.findMany({
            where: { is_active: true },
            select: { emp_id: true, name: true, branch_id: true },
            orderBy: { emp_id: "asc" },
        });

        const empIds = emps.map(e => e.emp_id);
        const rows = await prisma.checkins.findMany({
            where: { emp_id: { in: empIds }, timestamp: { gte: start, lte: end } },
            select: { emp_id: true, timestamp: true, type: true, late_status: true, late_min: true },
        });

        const leaves = await prisma.leave_requests.findMany({
            where: { emp_id: { in: empIds }, start_date: { lte: end }, end_date: { gte: start } },
            select: { emp_id: true, days: true, status: true },
        });

        const holidaysFetch = await prisma.holidays.findMany({
            where: { date: { gte: start, lte: end } }
        });
        const holidayDates = new Set(holidaysFetch.map(h => new Date(h.date).toISOString().split("T")[0]));

        let totalWorkDays = 0;
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
            if (dt.getUTCDay() === 0) continue;
            const dStr = dt.toISOString().split("T")[0];
            if (holidayDates.has(dStr)) continue;
            totalWorkDays++;
        }

        const stats: Record<string, { leave_days: number, pending_leave_days: number, late_count: number, late_mins: number, present_dates: Set<string> }> = {};
        for (const id of empIds) stats[id] = { leave_days: 0, pending_leave_days: 0, late_count: 0, late_mins: 0, present_dates: new Set() };

        for (const l of leaves) {
            if (!stats[l.emp_id]) continue;
            if (l.status === "approved") stats[l.emp_id].leave_days += l.days || 0;
            else if (l.status === "pending") stats[l.emp_id].pending_leave_days += l.days || 0;
        }

        for (const r of rows) {
            if (!stats[r.emp_id]) continue;
            const dStr = new Date(r.timestamp);
            const d = dStr.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
            if (r.type === "Check-in" || r.type === "Project-In") {
                stats[r.emp_id].present_dates.add(d);
                if (r.late_status === "late") {
                    stats[r.emp_id].late_count += 1;
                    if (r.late_min) stats[r.emp_id].late_mins += r.late_min;
                }
            }
        }

        const lines: string[] = [];
        lines.push(["EMP_ID", "NAME", "BRANCH", "PRESENT_DAYS", "TOTAL_ABSENT_DAYS", "APPROVED_LEAVES", "PENDING_LEAVES", "LATE_TIMES", "LATE_MINUTES", "TOTAL_WORK_DAYS"].map(csvEscape).join(","));

        for (const e of emps) {
            const s = stats[e.emp_id];
            let absences = totalWorkDays - s.present_dates.size - s.leave_days;
            if (absences < 0) absences = 0;

            lines.push([
                e.emp_id,
                e.name,
                e.branch_id || "-",
                s.present_dates.size,
                absences,
                s.leave_days,
                s.pending_leave_days,
                s.late_count,
                s.late_mins,
                totalWorkDays
            ].map(csvEscape).join(","));
        }

        const csv = lines.join("\\n");
        return new Response(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="historical_records_${startMonth}_to_${endMonth}.csv"`,
            },
        });

    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
