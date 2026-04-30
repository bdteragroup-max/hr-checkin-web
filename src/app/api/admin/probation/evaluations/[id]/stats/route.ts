import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const { id } = await params;

        const evalRecord = await prisma.probation_evaluations.findUnique({
            where: { id: Number(id) },
            select: { emp_id: true, period_start: true, period_end: true }
        });

        if (!evalRecord) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        const { emp_id, period_start, period_end } = evalRecord;
        const start = new Date(period_start);
        const end = new Date(period_end);
        end.setHours(23, 59, 59, 999);

        // 0. Fetch Holidays
        const holidays = await prisma.holidays.findMany({
            where: { date: { gte: start, lte: end } },
            select: { date: true }
        });
        const holidayDates = new Set(holidays.map(h => h.date.toDateString()));

        // 1. Fetch Late & OT
        const rawCheckins = await prisma.checkins.findMany({
            where: {
                emp_id,
                date_key: { gte: start, lte: end },
                OR: [
                    { 
                        late_status: "late", 
                        type: { in: ["Check-in", "Project-In", "Offsite-In"] } 
                    },
                    { 
                        late_status: "ot", 
                        type: { in: ["Check-out", "Project-Out", "Offsite-Out"] } 
                    }
                ]
            },
            select: { date_key: true, late_min: true, late_status: true, type: true }
        });

        // Filter and Deduplicate
        const uniqueLateDays = new Map<string, any>();
        const uniqueOtDays = new Map<string, any>();
        
        rawCheckins.forEach(c => {
            const dateObj = new Date(c.date_key);
            const dateStr = dateObj.toDateString();
            
            if (c.late_status === "late") {
                // Skip Sunday (0)
                if (dateObj.getDay() === 0) return;
                // Skip Holidays
                if (holidayDates.has(dateStr)) return;

                if (!uniqueLateDays.has(dateStr)) {
                    uniqueLateDays.set(dateStr, c);
                } else {
                    const existing = uniqueLateDays.get(dateStr);
                    if ((c.late_min || 0) > (existing.late_min || 0)) {
                        uniqueLateDays.set(dateStr, c);
                    }
                }
            } else if (c.late_status === "ot") {
                if (!uniqueOtDays.has(dateStr)) {
                    uniqueOtDays.set(dateStr, c);
                } else {
                    const existing = uniqueOtDays.get(dateStr);
                    if ((c.late_min || 0) > (existing.late_min || 0)) {
                        uniqueOtDays.set(dateStr, c);
                    }
                }
            }
        });

        const lateCheckins = Array.from(uniqueLateDays.values());
        const totalLateMin = lateCheckins.reduce((sum, c) => sum + (c.late_min || 0), 0);
        const lateCount = lateCheckins.length;

        const otCheckins = Array.from(uniqueOtDays.values());
        const totalOtMin = otCheckins.reduce((sum, c) => sum + (c.late_min || 0), 0);

        // Helper to calculate days within range
        const calculateDaysInRange = (leaveStart: Date, leaveEnd: Date, leaveTotalDays: number) => {
            const actualStart = leaveStart < start ? start : leaveStart;
            const actualEnd = leaveEnd > end ? end : leaveEnd;
            if (actualStart > actualEnd) return 0;
            const totalMs = leaveEnd.getTime() - leaveStart.getTime();
            if (totalMs <= 0) return leaveTotalDays; 
            const rangeMs = actualEnd.getTime() - actualStart.getTime();
            const proportion = rangeMs / totalMs;
            if (leaveStart.toDateString() === leaveEnd.toDateString()) return 1;
            return Math.min(leaveTotalDays, Number((leaveTotalDays * proportion).toFixed(2)));
        };

        // 2. Fetch Sick Leaves
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

        // 3. Fetch Personal Leaves (Including Unpaid Leave for probationers)
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
                late_min_ot: totalOtMin,
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
        console.error("[API/ADMIN/PROBATION/STATS] Error:", e);
        return NextResponse.json({ error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
