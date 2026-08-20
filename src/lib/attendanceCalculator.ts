import { prisma } from "@/lib/prisma";

export interface AttendanceStats {
    latenessCount: number;
    sickLeaveCount: number;
    personalLeaveCount: number;
    latenessScore: number;
    sickLeaveScore: number;
    personalLeaveScore: number;
}

export async function calculateAttendanceStats(emp_id: string, start: Date, end: Date): Promise<AttendanceStats> {
    const lateCheckins = await prisma.checkins.count({
        where: {
            emp_id,
            late_status: "late",
            date_key: {
                gte: start,
                lte: end
            }
        }
    });

    const leaves = await prisma.leave_requests.findMany({
        where: {
            emp_id,
            status: "approved",
            start_date: { lte: end },
            end_date: { gte: start }
        },
        select: { leave_type_id: true, leave_type: true }
    });

    const sickLeaveCount = leaves.filter((l: any) => 
        (l.leave_type_id && l.leave_type_id.toLowerCase() === "sick") || 
        (l.leave_type && l.leave_type.includes("ลาป่วย"))
    ).length;

    const personalLeaveCount = leaves.filter((l: any) => 
        (l.leave_type_id && l.leave_type_id.toLowerCase() === "personal") || 
        (l.leave_type && l.leave_type.includes("ลากิจ"))
    ).length;

    return {
        latenessCount: lateCheckins,
        sickLeaveCount,
        personalLeaveCount,
        latenessScore: calculateLatenessScore(lateCheckins),
        sickLeaveScore: calculateSickLeaveScore(sickLeaveCount),
        personalLeaveScore: calculatePersonalLeaveScore(personalLeaveCount)
    };
}

function formatDateToKey(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calculateLatenessScore(count: number): number {
    if (count === 0) return 5;
    if (count <= 2) return 4;
    if (count <= 5) return 3;
    if (count <= 10) return 2;
    return 1;
}

function calculateSickLeaveScore(count: number): number {
    if (count === 0) return 5;
    if (count === 1) return 4;
    if (count === 2) return 3;
    if (count <= 4) return 2;
    return 1;
}

function calculatePersonalLeaveScore(count: number): number {
    if (count === 0) return 5;
    if (count === 1) return 4;
    if (count === 2) return 3;
    if (count <= 4) return 2;
    return 1;
}
