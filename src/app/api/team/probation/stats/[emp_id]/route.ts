import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ emp_id: string }> }) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { emp_id } = await params;
    const { searchParams } = new URL(req.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");

    if (!startStr || !endStr) {
        return NextResponse.json({ error: "DATE_RANGE_REQUIRED" }, { status: 400 });
    }

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;

        // Verify that this user is either the primary or secondary supervisor
        const targetEmp = await prisma.employees.findUnique({
            where: { emp_id },
            select: { supervisor_id: true, secondary_supervisor_id: true }
        });

        const isAuthorized = targetEmp && (
            targetEmp.supervisor_id === supervisorId || 
            targetEmp.secondary_supervisor_id === supervisorId
        );

        if (!isAuthorized) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const start = new Date(startStr);
        const end = new Date(endStr);
        end.setHours(23, 59, 59, 999);

        // 0. Fetch Holidays
        const holidays = await prisma.holidays.findMany({
            where: { date: { gte: start, lte: end } },
            select: { date: true }
        });
        const holidayDates = new Set(holidays.map(h => h.date.toDateString()));

        // 1. Count Late Check-ins & Minutes
        const rawLateCheckins = await prisma.checkins.findMany({
            where: {
                emp_id,
                date_key: { gte: start, lte: end },
                late_status: { not: "ontime" },
                NOT: { late_status: null }
            },
            select: { date_key: true, late_min: true, late_status: true }
        });

        // Filter and Deduplicate: Only one late per day, skipping Sundays and Holidays
        const uniqueLateDays = new Map<string, any>();
        
        rawLateCheckins.forEach(c => {
            const dateObj = new Date(c.date_key);
            const dateStr = dateObj.toDateString();
            
            // Skip Sunday (0)
            if (dateObj.getDay() === 0) return;
            // Skip Holidays
            if (holidayDates.has(dateStr)) return;

            // Group by date: take the maximum late minutes for that day if there are multiple scans
            if (!uniqueLateDays.has(dateStr)) {
                uniqueLateDays.set(dateStr, c);
            } else {
                const existing = uniqueLateDays.get(dateStr);
                if ((c.late_min || 0) > (existing.late_min || 0)) {
                    uniqueLateDays.set(dateStr, c);
                }
            }
        });

        const lateCheckins = Array.from(uniqueLateDays.values());
        const totalLateMin = lateCheckins.reduce((sum, c) => sum + (c.late_min || 0), 0);
        const lateCount = lateCheckins.length;

        // Helper to calculate days within range for a leave request
        const calculateDaysInRange = (leaveStart: Date, leaveEnd: Date, leaveTotalDays: number) => {
            const actualStart = leaveStart < start ? start : leaveStart;
            const actualEnd = leaveEnd > end ? end : leaveEnd;
            
            if (actualStart > actualEnd) return 0;
            
            // Full request length in days
            const totalMs = leaveEnd.getTime() - leaveStart.getTime();
            if (totalMs <= 0) return leaveTotalDays; // Safety fallback
            
            // Proportion of the leave within our window
            const rangeMs = actualEnd.getTime() - actualStart.getTime();
            const proportion = rangeMs / totalMs;
            
            // If it's a single day leave, just return 1 if it's in range
            if (leaveStart.toDateString() === leaveEnd.toDateString()) return 1;

            return Math.min(leaveTotalDays, Number((leaveTotalDays * proportion).toFixed(2)));
        };

        // 2. Count Sick Leave
        const sickLeaves = await prisma.leave_requests.findMany({
            where: {
                emp_id,
                status: "approved",
                OR: [
                    { leave_type: { contains: "ป่วย" } },
                    { leave_type_id: "sick" }
                ],
                start_date: { lte: end },
                end_date: { gte: start }
            },
            select: { start_date: true, end_date: true, days: true, reason: true, leave_type: true }
        });

        // 3. Count Personal Leave (Including Unpaid Leave for probationers)
        const personalLeaves = await prisma.leave_requests.findMany({
            where: {
                emp_id,
                status: "approved",
                OR: [
                    { leave_type: { contains: "กิจ" } },
                    { leave_type_id: "personal" },
                    { leave_type: { contains: "ไม่รับค่าจ้าง" } },
                    { leave_type_id: "unpaid" }
                ],
                start_date: { lte: end },
                end_date: { gte: start }
            },
            select: { start_date: true, end_date: true, days: true, reason: true, leave_type: true }
        });

        const proRatedSick = sickLeaves.reduce((sum, l) => sum + calculateDaysInRange(new Date(l.start_date), new Date(l.end_date), l.days), 0);
        const proRatedPersonal = personalLeaves.reduce((sum, l) => sum + calculateDaysInRange(new Date(l.start_date), new Date(l.end_date), l.days), 0);

        return NextResponse.json({
            ok: true,
            stats: {
                late: lateCount,
                late_min: totalLateMin,
                sick: Number(proRatedSick.toFixed(2)),
                personal: Number(proRatedPersonal.toFixed(2))
            },
            details: {
                lates: lateCheckins.map(c => ({
                    date: c.date_key,
                    minutes: c.late_min,
                    status: c.late_status
                })),
                sick: sickLeaves.map(l => ({
                    start: l.start_date,
                    end: l.end_date,
                    days: l.days,
                    reason: l.reason,
                    type: l.leave_type
                })),
                personal: personalLeaves.map(l => ({
                    start: l.start_date,
                    end: l.end_date,
                    days: l.days,
                    reason: l.reason,
                    type: l.leave_type
                }))
            }
        });
    } catch (e: any) {
        console.error("[API/PROBATION/STATS] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
