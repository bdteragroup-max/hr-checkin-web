import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function monthDateRange(month: string) {
    // month = YYYY-MM
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return { start, end };
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const month = url.searchParams.get("month") || "";
        const branchId = url.searchParams.get("branch") || "";

        if (!month) return NextResponse.json({ ok: false, error: "MONTH_REQUIRED" }, { status: 400 });

        const { start, end } = monthDateRange(month);

        const hideResigned = url.searchParams.get("hide_resigned") !== "0";

        // filter by branch_id and optionally is_active
        const empWhere: any = {};
        if (hideResigned) empWhere.is_active = true;
        if (branchId) empWhere.branch_id = branchId;

        const emps = await prisma.employees.findMany({
            where: empWhere,
            select: {
                emp_id: true,
                name: true,
                branch_id: true,
                base_salary: true,
                job_positions: { select: { is_ot_eligible: true } }
            },
            orderBy: { emp_id: "asc" },
        });
        const empIds = emps.map((e) => e.emp_id);

        // checkins in month (ใช้ timestamp ก็ได้ / หรือ date_key ก็ได้)
        const rows = await prisma.checkins.findMany({
            where: {
                emp_id: { in: empIds },
                timestamp: { gte: start, lte: end },
            },
            select: { emp_id: true, timestamp: true, type: true, late_status: true, late_min: true },
        });

        // leaves in month (approved only)
        const monthStart = new Date(`${month}-01T00:00:00.000Z`);
        const monthEnd = new Date(`${month}-31T00:00:00.000Z`);

        const leaves = await prisma.leave_requests.findMany({
            where: {
                emp_id: { in: empIds },
                status: "approved",
                start_date: { lte: monthEnd },
                end_date: { gte: monthStart },
            },
            select: { emp_id: true, days: true },
        });

        const holidaysFetch = await prisma.holidays.findMany({
            where: {
                date: {
                    gte: monthStart, // Since it's stored as DateTime in DB
                    lte: monthEnd
                }
            }
        });

        // Convert the fetched DB Date objects back into "YYYY-MM-DD" local strings to match against Check-ins
        const holidayDates = new Set(holidaysFetch.map(h =>
            new Date(h.date).toISOString().split("T")[0]
        ));

        // Calculate expected Work Days (Excluding Sundays and Holidays)
        let workDays = 0;
        const totalDaysInMonth = end.getDate();
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
            // skip sunday
            if (d.getUTCDay() === 0) continue;
            // skip holiday
            const dStr = d.toISOString().split("T")[0];
            if (holidayDates.has(dStr)) continue;

            workDays++;
        }

        const leaveDaysByEmp: Record<string, number> = {};
        for (const l of leaves) leaveDaysByEmp[l.emp_id] = (leaveDaysByEmp[l.emp_id] || 0) + (l.days || 0);

        const presentDaysSetByEmp: Record<string, Set<string>> = {};
        const lateTimesByEmp: Record<string, number> = {};
        const lateMinByEmp: Record<string, number> = {};
        const otMinByEmp: Record<string, number> = {};
        const workMinByEmp: Record<string, number> = {};
        // keep track of first checkins and last checkouts per day
        const dailyPairs: Record<string, Record<string, { in?: Date, out?: Date }>> = {};
        for (const id of empIds) {
            presentDaysSetByEmp[id] = new Set();
            lateTimesByEmp[id] = 0;
            lateMinByEmp[id] = 0;
            otMinByEmp[id] = 0;
            workMinByEmp[id] = 0;
            dailyPairs[id] = {};
        }

        for (const r of rows) {
            const d = new Date(r.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

            if (!dailyPairs[r.emp_id][d]) dailyPairs[r.emp_id][d] = {};

            if (r.type === "Check-in" || r.type === "Project-In") {
                presentDaysSetByEmp[r.emp_id]?.add(d);
                if (r.late_status === "late") {
                    lateTimesByEmp[r.emp_id] = (lateTimesByEmp[r.emp_id] || 0) + 1;
                    if (r.late_min) lateMinByEmp[r.emp_id] += r.late_min;
                }

                // Track earliest checkin
                const currentIn = dailyPairs[r.emp_id][d].in;
                if (!currentIn || r.timestamp.getTime() < currentIn.getTime()) {
                    dailyPairs[r.emp_id][d].in = r.timestamp;
                }
            } else if (r.type === "Check-out" || r.type === "Project-Out") {
                if (r.late_status === "ot" && r.late_min) {
                    otMinByEmp[r.emp_id] += r.late_min;
                }

                // Track latest checkout
                const currentOut = dailyPairs[r.emp_id][d].out;
                if (!currentOut || r.timestamp.getTime() > currentOut.getTime()) {
                    dailyPairs[r.emp_id][d].out = r.timestamp;
                }
            }
        }

        // Compute exact work hours and OT Pay
        const otPayByEmp: Record<string, number> = {};
        for (const e of emps) {
            const emp_id = e.emp_id;
            const days = dailyPairs[emp_id];

            const isOtEligible = e.job_positions?.is_ot_eligible ?? false;
            const baseSalary = e.base_salary ? Number(e.base_salary) : 0;
            const hourlyRate = (baseSalary / 30) / 8;

            let empTotalMin = 0;
            let otTotalPay = 0;

            for (const date in days) {
                const p = days[date];
                if (p.in && p.out && p.out > p.in) {
                    const diffMs = p.out.getTime() - p.in.getTime();
                    empTotalMin += Math.floor(diffMs / 60000);

                    if (isOtEligible && baseSalary > 0) {
                        const inTime = new Date(p.in.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
                        const outTime = new Date(p.out.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));

                        const inMin = inTime.getHours() * 60 + inTime.getMinutes();
                        const outMin = outTime.getHours() * 60 + outTime.getMinutes();

                        const isHolidayOrWeekend = new Date(date).getUTCDay() === 0 || holidayDates.has(date);

                        const calcOverlap = (startM: number, endM: number, b1: number, b2: number) => {
                            const minStart = Math.max(startM, b1);
                            const maxEnd = Math.min(endM, b2);
                            return Math.max(0, maxEnd - minStart);
                        };

                        const intersectWithBreak = (startM: number, endM: number) => {
                            return calcOverlap(startM, endM, 720, 780);
                        };

                        // OT threshold only after 17:00
                        const outAfterThreshold = outMin >= (1020 + 30) ? outMin : Math.min(outMin, 1020);

                        if (isHolidayOrWeekend) {
                            // 08:00-17:00 = 1x
                            let normalMins = calcOverlap(inMin, outMin, 480, 1020);
                            normalMins -= intersectWithBreak(Math.max(inMin, 480), Math.min(outMin, 1020));

                            // Outside 08:00-17:00 = 3x (considering threshold)
                            let outsideMinsBefore = calcOverlap(inMin, outMin, 0, 480);
                            let outsideMinsAfter = calcOverlap(inMin, outAfterThreshold, 1020, 1440);
                            let outsideMins = outsideMinsBefore + outsideMinsAfter;

                            otTotalPay += (normalMins / 60) * (hourlyRate * 1) + (outsideMins / 60) * (hourlyRate * 3);
                        } else {
                            // Weekday: OT 1.5x outside 08:00-17:00
                            let outsideMinsBefore = calcOverlap(inMin, outMin, 0, 480);
                            let outsideMinsAfter = calcOverlap(inMin, outAfterThreshold, 1020, 1440);
                            let outsideMins = outsideMinsBefore + outsideMinsAfter;

                            otTotalPay += (outsideMins / 60) * (hourlyRate * 1.5);
                        }
                    }
                }
            }
            workMinByEmp[emp_id] = empTotalMin;
            otPayByEmp[emp_id] = otTotalPay;
        }

        const employees = emps.map((e) => {
            const present = presentDaysSetByEmp[e.emp_id]?.size || 0;
            const leaves = leaveDaysByEmp[e.emp_id] || 0;
            const absents = Math.max(0, workDays - present - leaves);
            const otHoursText = otMinByEmp[e.emp_id] > 0 ? (Math.round((otMinByEmp[e.emp_id] / 60) * 10) / 10).toString() : "0";

            const wMins = workMinByEmp[e.emp_id];
            const wHoursText = wMins > 0 ? `${Math.floor(wMins / 60)}h ${wMins % 60}m` : "—";

            return {
                emp_id: e.emp_id,
                name: e.name,
                branch: e.branch_id || "—",
                presentDays: present,
                lateTimes: lateTimesByEmp[e.emp_id] || 0,
                lateMins: lateMinByEmp[e.emp_id] || 0,
                otHours: otHoursText,
                otPay: Math.round(otPayByEmp[e.emp_id] || 0),
                leaveDays: leaves,
                absentDays: absents,
                workHours: wHoursText,
            };
        });

        return NextResponse.json({
            workDays: workDays,
            lateTimes: employees.reduce((a, x) => a + x.lateTimes, 0),
            otMinutes: Object.values(otMinByEmp).reduce((a, b) => a + b, 0),
            leaveDays: employees.reduce((a, x) => a + x.leaveDays, 0),
            absentDays: employees.reduce((a, x) => a + x.absentDays, 0),
            totalOtPay: employees.reduce((a, x) => a + x.otPay, 0),
            holidays: holidayDates.size,
            employees,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}