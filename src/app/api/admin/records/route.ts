import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor } from "@/lib/adminAuth";
import { adjustCheckinsForLeaves } from "@/utils/checkin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrSupervisor();

        const url = new URL(req.url);
        const startMonth = url.searchParams.get("start_month"); // e.g. "2026-01"
        const endMonth = url.searchParams.get("end_month");     // e.g. "2026-03"
        const paramStartDate = url.searchParams.get("start_date"); // e.g. "2026-03-26"
        const paramEndDate = url.searchParams.get("end_date");     // e.g. "2026-04-25"
        const status = url.searchParams.get("status");

        let startDate: Date;
        let endDate: Date;

        if (paramStartDate && paramEndDate) {
            const [sy, sm, sd] = paramStartDate.split("-").map(Number);
            const [ey, em, ed] = paramEndDate.split("-").map(Number);
            startDate = new Date(Date.UTC(sy, sm - 1, sd));
            endDate = new Date(Date.UTC(ey, em - 1, ed));
        } else if (startMonth && endMonth) {
            const [sy, sm] = startMonth.split("-").map(Number);
            const [ey, em] = endMonth.split("-").map(Number);
            startDate = new Date(Date.UTC(sy, sm - 1, 1));
            endDate = new Date(Date.UTC(ey, em, 0));
        } else {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        const teamOnly = url.searchParams.get("team") === "1";
 
         const subordinateFilter: any = {};
         if (auth.isSupervisorOnly || teamOnly) {
             subordinateFilter.OR = [
                 { supervisor_id: auth.emp_id },
                 { secondary_supervisor_id: auth.emp_id }
             ];
         }

        const employeeWhere: any = {
            is_checkin_exempt: false,
            ...subordinateFilter
        };
        if (status === "active") {
            employeeWhere.is_active = true;
        } else if (status === "inactive") {
            employeeWhere.is_active = false;
        } else {
            employeeWhere.OR = [
                { is_active: true },
                { resignation_date: { gte: startDate, lte: endDate } }
            ];
        }

        const [emps, holidaysFetch] = await Promise.all([
            prisma.employees.findMany({
                where: employeeWhere,
                select: {
                    emp_id: true,
                    name: true,
                    nickname: true,
                    branch_id: true,
                    is_active: true,
                    hire_date: true,
                    resignation_date: true,
                },
                orderBy: { emp_id: "asc" },
            }),
            prisma.holidays.findMany({
                where: { date: { gte: startDate, lte: endDate } }
            })
        ]);

        const empIds = emps.map(e => e.emp_id);

        const [rows, leaves, travels] = await Promise.all([
            prisma.checkins.findMany({
                where: {
                    emp_id: { in: empIds },
                    date_key: { gte: startDate, lte: endDate },
                },
                select: { emp_id: true, date_key: true, timestamp: true, type: true, late_status: true, late_min: true },
            }),
            prisma.leave_requests.findMany({
                where: {
                    emp_id: { in: empIds },
                    start_date: { lte: endDate },
                    end_date: { gte: startDate },
                },
                select: { emp_id: true, days: true, status: true, start_date: true, end_date: true, leave_type: true },
            }),
            prisma.travel_claims.findMany({
                where: {
                    emp_id: { in: empIds },
                    status: "approved",
                    date: { lte: endDate },
                    OR: [
                        { end_date: { gte: startDate } },
                        { end_date: null, date: { gte: startDate } }
                    ]
                },
            })
        ]);

        const holidayDates = new Set(holidaysFetch.map(h => new Date(h.date).toISOString().split("T")[0]));

        // Guard: Today's date in Bangkok
        const nowBKK = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const todayDate = new Date(Date.UTC(nowBKK.getFullYear(), nowBKK.getMonth(), nowBKK.getDate()));
        const effectiveEnd = endDate < todayDate ? endDate : todayDate;

        // Calculate expected Work Days per employee based on hire_date and resignation_date
        const stats: Record<string, {
            leave_days: number;
            pending_leave_days: number;
            late_count: number;
            late_mins: number;
            present_dates: Set<string>;
            travel_dates: Set<string>;
            total_work_days: number;
        }> = {};

        for (const e of emps) {
            let empStartDate = startDate;
            if (e.hire_date && e.hire_date > startDate) {
                empStartDate = e.hire_date;
            }
            
            let empEndDate = effectiveEnd;
            if (e.resignation_date && e.resignation_date < effectiveEnd) {
                empEndDate = e.resignation_date;
            }

            let empTotalWorkDays = 0;
            // Only count if start is before or equal to end
            if (empStartDate <= empEndDate) {
                for (let dt = new Date(empStartDate); dt <= empEndDate; dt.setUTCDate(dt.getUTCDate() + 1)) {
                    if (dt.getUTCDay() === 0) continue; // skip sunday
                    const dStr = dt.toISOString().split("T")[0];
                    if (holidayDates.has(dStr)) continue; // skip holiday
                    empTotalWorkDays++;
                }
            }

            stats[e.emp_id] = { 
                leave_days: 0, 
                pending_leave_days: 0, 
                late_count: 0, 
                late_mins: 0, 
                present_dates: new Set(), 
                travel_dates: new Set(),
                total_work_days: empTotalWorkDays
            };
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

        // Process travel claims
        for (const t of travels) {
            if (!stats[t.emp_id]) continue;
            let cur = new Date(t.date);
            const endD = t.end_date ? new Date(t.end_date) : new Date(t.date);
            while (cur <= endD) {
                const dStr = cur.toISOString().split("T")[0];
                if (cur >= startDate && cur <= effectiveEnd) {
                    if (cur.getUTCDay() !== 0 && !holidayDates.has(dStr)) { // Only count work days
                        stats[t.emp_id].travel_dates.add(dStr);
                    }
                }
                cur.setDate(cur.getDate() + 1);
            }
        }

        // Process checkins
        const checkins = adjustCheckinsForLeaves(rows, leaves);

        for (const r of checkins) {
            if (!stats[r.emp_id]) continue;
            // Match by date_key string comparison
            const d = r.date_key.toISOString().split("T")[0];

            if (r.type === "Check-in" || r.type === "Project-In" || r.type === "Offsite-In" || r.type === "Trip-Update") {
                stats[r.emp_id].present_dates.add(d);

                // Consistency: Skip counting late on Sundays and Holidays
                const isSunday = r.date_key.getUTCDay() === 0;
                if (!isSunday && !holidayDates.has(d)) {
                    if (r.late_status === "late") {
                        stats[r.emp_id].late_count += 1;
                        if (r.late_min) stats[r.emp_id].late_mins += r.late_min;
                    }
                }
            }
        }

        // Build summary output
        const summary = emps.map(e => {
            const s = stats[e.emp_id];
            
            // To avoid double-counting, if a travel date also has a checkin, we remove it from present_dates
            // or we just calculate unique present + travel days
            const attendedDates = new Set([...Array.from(s.present_dates), ...Array.from(s.travel_dates)]);
            const travelDays = s.travel_dates.size;

            let absences = s.total_work_days - attendedDates.size - s.leave_days;
            if (absences < 0) absences = 0;

            let finalName = e.name;
            if (e.nickname && !finalName.includes(`(${e.nickname})`)) {
                finalName = `${finalName} (${e.nickname})`;
            }

            return {
                emp_id: e.emp_id,
                name: finalName,
                branch_id: e.branch_id,
                is_active: e.is_active,
                leave_days: s.leave_days,
                pending_leave_days: s.pending_leave_days,
                late_count: s.late_count,
                late_mins: s.late_mins,
                absent_days: absences,
                present_days: s.present_dates.size,
                travel_days: travelDays,
                total_work_days_period: s.total_work_days,
            };
        });

        return NextResponse.json({ ok: true, start_date: startDate, end_date: endDate, summary });

    } catch (e: any) {
        console.error("ADMIN_RECORDS_ERROR:", e);
        return NextResponse.json({ ok: false, error: "ERROR", msg: e.message, stack: e.stack }, { status: 500 });
    }
}
