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

        // 1. Count Late Check-ins
        const lateCount = await prisma.checkins.count({
            where: {
                emp_id,
                date_key: { gte: start, lte: end },
                late_status: { not: "ontime" },
                NOT: { late_status: null }
            }
        });

        // 2. Count Sick Leave Days
        const sickLeaves = await prisma.leave_requests.findMany({
            where: {
                emp_id,
                status: "approved",
                leave_type: { contains: "ป่วย" }, // Thai for 'Sick'
                OR: [
                    { start_date: { lte: end }, end_date: { gte: start } }
                ]
            },
            select: { start_date: true, end_date: true, days: true }
        });

        // 3. Count Personal Leave Days
        const personalLeaves = await prisma.leave_requests.findMany({
            where: {
                emp_id,
                status: "approved",
                leave_type: { contains: "กิจ" }, // Thai for 'Personal'
                OR: [
                    { start_date: { lte: end }, end_date: { gte: start } }
                ]
            },
            select: { start_date: true, end_date: true, days: true }
        });

        // Simple day calculation for leaves within range
        const sumDays = (leaves: any[]) => leaves.reduce((sum, l) => sum + l.days, 0);

        return NextResponse.json({
            ok: true,
            stats: {
                late: lateCount,
                sick: sumDays(sickLeaves),
                personal: sumDays(personalLeaves)
            }
        });
    } catch (e: any) {
        console.error("[API/PROBATION/STATS] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
