import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor } from "@/lib/adminAuth";
import { adjustCheckinsForLeaves } from "@/utils/checkin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatTime(d: Date) {
    return d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
}

export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrSupervisor();

        const url = new URL(req.url);
        const emp_id = url.searchParams.get("emp_id");
        const startMonth = url.searchParams.get("start_month");
        const endMonth = url.searchParams.get("end_month");
        const paramStartDate = url.searchParams.get("start_date");
        const paramEndDate = url.searchParams.get("end_date");

        if (!emp_id) {
            return NextResponse.json({ ok: false, error: "MISSING_EMP_ID" }, { status: 400 });
        }

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

        const emp = await prisma.employees.findUnique({ 
            where: { 
                emp_id,
                ...subordinateFilter
            } as any
        });
        if (!emp) return NextResponse.json({ ok: false, error: "EMP_NOT_FOUND" }, { status: 404 });

        let checkins = await prisma.checkins.findMany({
            where: {
                emp_id,
                date_key: { gte: startDate, lte: endDate },
            },
            orderBy: { timestamp: "asc" },
        });

        const leaves = await prisma.leave_requests.findMany({
            where: {
                emp_id,
                status: "approved",
                start_date: { lte: endDate },
                end_date: { gte: startDate },
            },
        });

        checkins = adjustCheckinsForLeaves(checkins, leaves);

        const travels = await prisma.travel_claims.findMany({
            where: {
                emp_id,
                status: "approved",
                date: { lte: endDate },
                OR: [
                    { end_date: { gte: startDate } },
                    { end_date: null, date: { gte: startDate } }
                ]
            },
        });

        const holidays = await prisma.holidays.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        });

        const workPlans = await prisma.daily_work_plans.findMany({
            where: {
                emp_id,
                date: { gte: startDate, lte: endDate }
            }
        });

        const holidayMap = new Map<string, string>();
        holidays.forEach(h => holidayMap.set(h.date.toISOString().split("T")[0], h.name));

        const reports: any[] = [];

        // Build a map of dates that fall under approved leaves
        const leaveDaysMap = new Map<string, string>();
        leaves.forEach(l => {
            let cur = new Date(l.start_date);
            const endD = new Date(l.end_date);
            while (cur <= endD) {
                const ds = cur.toISOString().split("T")[0];
                let leaveLabel = l.leave_type;
                if (l.days === 0.5 && l.start_at) {
                    const bkkHour = parseInt(new Date(l.start_at).toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", hour12: false }));
                    if (bkkHour < 12) {
                        leaveLabel += " (ครึ่งเช้า 08:00-12:00)";
                    } else {
                        leaveLabel += " (ครึ่งบ่าย 13:00-17:00)";
                    }
                } else if (l.days < 1 && l.start_at && l.end_at) {
                    leaveLabel += ` (${formatTime(new Date(l.start_at))} - ${formatTime(new Date(l.end_at))})`;
                }
                leaveDaysMap.set(ds, leaveLabel);
                cur.setDate(cur.getDate() + 1);
            }
        });

        // Build a map of dates that fall under approved travel claims
        const travelDaysMap = new Set<string>();
        travels.forEach((t: any) => {
            let cur = new Date(t.date);
            const endD = t.end_date ? new Date(t.end_date) : new Date(t.date);
            while (cur <= endD) {
                const ds = cur.toISOString().split("T")[0];
                travelDaysMap.add(ds);
                cur.setDate(cur.getDate() + 1);
            }
        });

        // Guard: Today's date in Bangkok for future date handling
        const nowBKK = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const todayDate = new Date(Date.UTC(nowBKK.getFullYear(), nowBKK.getMonth(), nowBKK.getDate()));
        const effectiveEnd = endDate < todayDate ? endDate : todayDate;

        // Loop over every day using UTC methods to avoid local server timezone shifts
        for (let dt = new Date(startDate); dt <= effectiveEnd; dt.setUTCDate(dt.getUTCDate() + 1)) {
            const dateStr = dt.toISOString().split("T")[0];
            const isSunday = dt.getUTCDay() === 0;
            const holName = holidayMap.get(dateStr);
            const leaveType = leaveDaysMap.get(dateStr);
            const isTravelDay = travelDaysMap.has(dateStr);

            // Match by date_key string comparison
            const dayCheckins = checkins.filter(c => {
                const checkInDateStr = c.date_key.toISOString().split("T")[0];
                return checkInDateStr === dateStr;
            });

            const workPlan = workPlans.find(wp => wp.date.toISOString().split("T")[0] === dateStr);

            const inRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-in") || c.type === "Trip-Update");
            const outRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-out") || c.type === "Check-out");

            const hasActivity = inRecords.length > 0 || outRecords.length > 0;

            // Skip Sunday if NO activity
            if (isSunday && !hasActivity) continue; 

            // Calculate Status
            let status = "ขาด"; // Default Absent
            const empResignStr = emp.resignation_date ? emp.resignation_date.toISOString().split("T")[0] : null;

            if (empResignStr && dateStr > empResignStr) {
                status = "ลาออก";
            } else if (isSunday) {
                status = "วันหยุด";
            } else if (holName) {
                status = `หยุดพิเศษ (${holName})`;
            } else if (leaveType) {
                status = leaveType;
            } else if (isTravelDay) {
                status = "ออกต่างจังหวัด";
            }

            const inRecord = inRecords.length > 0 ? inRecords[0] : null; 
            const outRecord = outRecords.length > 0 ? outRecords[outRecords.length - 1] : null;

            if (inRecord) {
                status = "มาทำงาน";
                if (inRecord.late_status === "late") {
                    status = `มาสาย`;
                }

                const todayStr = todayDate.toISOString().split("T")[0];
                if (!outRecord && dateStr < todayStr) {
                    status += " (ไม่เช็คเอาท์)";
                }
                if (leaveType) {
                    status += ` + ${leaveType}`;
                } else if (isTravelDay) {
                    status += ` (ตจว.)`;
                }
            } else if (outRecord) {
                status = "ไม่เช็คอิน";
            }

            const inLocs = new Set<string>();
            inRecords.forEach(c => {
                const loc = c.project_name || c.remark || c.branch_name;
                if (loc) inLocs.add(loc);
            });

            const outLocs = new Set<string>();
            outRecords.forEach(c => {
                const loc = c.project_name || c.remark || c.branch_name;
                if (loc) outLocs.add(loc);
            });

            const isTrip = inRecord?.is_trip || outRecord?.is_trip || dayCheckins.some(c => c.is_trip);

            reports.push({
                date: dateStr,
                in_time: inRecord ? formatTime(inRecord.timestamp) : null,
                in_loc: inLocs.size > 0 ? Array.from(inLocs).join(" → ") : null,
                out_time: outRecord ? formatTime(outRecord.timestamp) : null,
                out_loc: outLocs.size > 0 ? Array.from(outLocs).join(" → ") : null,
                late_mins: inRecord?.late_min || 0,
                status,
                is_trip: isTrip,
                is_weekend: isSunday,
                work_plan: workPlan ? {
                    morning: workPlan.morning_plan,
                    morning_loc: workPlan.morning_location,
                    afternoon: workPlan.afternoon_plan,
                    afternoon_loc: workPlan.afternoon_location,
                    ot: workPlan.ot_plan,
                    ot_loc: workPlan.ot_location,
                    ot_attendant: workPlan.ot_attendant
                } : null
            });
        }

        return NextResponse.json({ ok: true, details: reports, emp_name: emp.name });
    } catch (e: any) {
        console.error("DETAILS ERROR:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
