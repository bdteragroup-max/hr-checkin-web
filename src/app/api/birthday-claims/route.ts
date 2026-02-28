import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

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

        // Check if today (or substitute) is birthday month/day
        const targetDate = substitute_date ? new Date(substitute_date) : now;
        const isBirthdayMonth = targetDate.getMonth() === bDay.getMonth();

        if (!isBirthdayMonth) {
            return NextResponse.json({ error: "NOT_BIRTHDAY_MONTH" }, { status: 400 });
        }

        // Check if employee is sales
        const isSales = employee.job_positions?.title?.toLowerCase().includes("sales") ||
            employee.departments?.name?.toLowerCase().includes("sales");

        // Attendance check: Any valid check-in/out pair in the birthday month
        const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

        const monthScans = await prisma.checkins.findMany({
            where: {
                emp_id,
                timestamp: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth
                }
            },
            orderBy: { timestamp: "asc" }
        });

        // Group scans by date to find a day with both In and Out
        const scansByDate: Record<string, any[]> = {};
        monthScans.forEach(s => {
            const d = new Date(s.timestamp);
            const dateKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
            if (!scansByDate[dateKey]) scansByDate[dateKey] = [];
            scansByDate[dateKey].push(s);
        });

        let hasValidDay = false;
        for (const dateKey in scansByDate) {
            const dayScans = scansByDate[dateKey];
            const hasIn = dayScans.some(s => s.type === "Check-in" || s.type === "Project-In");
            const hasOut = dayScans.some(s => s.type === "Check-out" || s.type === "Project-Out");

            if (hasIn && hasOut) {
                if (isSales) {
                    const hasProject = dayScans.some(s => s.type === "Project-In" || s.type === "Project-Out");
                    if (hasProject) {
                        hasValidDay = true;
                        break;
                    }
                } else {
                    hasValidDay = true;
                    break;
                }
            }
        }

        if (!hasValidDay) {
            return NextResponse.json({
                error: isSales ? "SALES_NO_PROJECT_SCAN" : "NO_ATTENDANCE"
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
