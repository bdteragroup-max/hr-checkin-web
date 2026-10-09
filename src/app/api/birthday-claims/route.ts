import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { toBangkokWallClock } from "@/utils/time";

export async function POST(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { emp_id } = verifyToken(token);

        const body = await req.json();
        const { transfer_slip_url, celebration_photo_url, substitute_date, meal_amount } = body;

        const employee = await prisma.employees.findUnique({
            where: { emp_id },
            include: { job_positions: true, departments: true }
        });

        if (!employee || !employee.birth_date) {
            return NextResponse.json({ error: "BIRTHDATE_NOT_SET" }, { status: 400 });
        }

        const now = new Date();
        const bDay = new Date(employee.birth_date);
        const bkkNow = toBangkokWallClock(now);
        const bkkTarget = substitute_date ? toBangkokWallClock(new Date(substitute_date)) : bkkNow;

        // Check if target is birthday month (bDay is UTC midnight date)
        const bDayMonth = bDay.getUTCMonth();
        const targetMonth = bkkTarget.getMonth();
        const isBirthdayMonth = targetMonth === bDayMonth;

        if (!isBirthdayMonth) {
            return NextResponse.json({ error: "NOT_BIRTHDAY_MONTH" }, { status: 400 });
        }

        // Check if employee is sales
        const isSales = employee.job_positions?.title?.toLowerCase().includes("sales") ||
            employee.departments?.name?.toLowerCase().includes("sales");

        // Attendance check: Must have attendance in the birthday month
        const year = bkkTarget.getFullYear();
        const month = bkkTarget.getMonth();

        // 1-day buffer before and after to ensure any UTC/Asia:Bangkok boundary overlap is covered
        const firstDayOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
        firstDayOfMonth.setUTCDate(firstDayOfMonth.getUTCDate() - 1);

        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
        lastDayOfMonth.setUTCDate(lastDayOfMonth.getUTCDate() + 1);

        const startDayStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const lastDateNum = new Date(year, month + 1, 0).getDate();
        const endDayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDateNum).padStart(2, "0")}`;

        const monthScans = await prisma.checkins.findMany({
            where: {
                emp_id,
                OR: [
                    {
                        timestamp: {
                            gte: firstDayOfMonth,
                            lte: lastDayOfMonth
                        }
                    },
                    {
                        date_key: {
                            gte: new Date(startDayStr),
                            lte: new Date(endDayStr)
                        }
                    }
                ]
            },
            orderBy: { timestamp: "asc" }
        });

        // Valid attendance types
        const VALID_ATTENDANCE_TYPES = [
            "Check-in", 
            "Project-In", 
            "Offsite-In", 
            "Trip-Update",
            "Check-out", 
            "Project-Out", 
            "Offsite-Out"
        ];

        // Eligible if employee has checked in (or checked out) at least once in the birthday month
        const hasAttendance = monthScans.some(s => VALID_ATTENDANCE_TYPES.includes(s.type));

        if (!hasAttendance) {
            return NextResponse.json({
                error: "NO_ATTENDANCE"
            }, { status: 400 });
        }

        // Tenure-based Cash Gift
        let cashGift = 500;
        if (employee.hire_date) {
            const hire = new Date(employee.hire_date);
            let yrs = now.getFullYear() - hire.getFullYear();
            const mDiff = now.getMonth() - hire.getMonth();
            if (mDiff < 0 || (mDiff === 0 && now.getDate() < hire.getDate())) {
                yrs--;
            }
            if (yrs >= 2) cashGift = 1000;
            else if (yrs >= 1) cashGift = 800;
        }

        const mealAllowance = Math.min(Number(meal_amount) || 0, 300);

        const claim = await prisma.birthday_claims.create({
            data: {
                id: `BC-${emp_id}-${Date.now()}`,
                emp_id,
                name: employee.name,
                amount_cash: cashGift,
                amount_meal: mealAllowance,
                transfer_slip_url: transfer_slip_url || null,
                celebration_photo_url: celebration_photo_url || null,
                substitute_date: substitute_date ? new Date(substitute_date) : null,
                is_sales: isSales
            }
        });

        return NextResponse.json({ ok: true, claim });

    } catch (e: any) {
        console.error("BIRTHDAY_CLAIM_POST_ERROR:", e);
        return NextResponse.json({ ok: false, error: "SERVER_ERROR", details: e.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { emp_id } = verifyToken(token);

        const claims = await prisma.birthday_claims.findMany({
            where: { emp_id },
            orderBy: { created_at: "desc" }
        });

        return NextResponse.json({ ok: true, claims });
    } catch (e) {
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
}
