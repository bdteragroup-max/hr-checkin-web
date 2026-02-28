import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
    try {
        await requireAdmin();
        const now = new Date();
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(now.getDate() + 7);

        // 1. New Arrivals (Starting soon)
        const arrivals = await prisma.employees.findMany({
            where: {
                hire_date: {
                    gte: new Date(now.toISOString().split('T')[0] + 'T00:00:00Z'),
                    lte: new Date(sevenDaysLater.toISOString().split('T')[0] + 'T23:59:59Z')
                },
                is_active: true
            },
            select: { emp_id: true, name: true, hire_date: true }
        });

        // 2. Birthdays Today
        const allEmps = await prisma.employees.findMany({
            where: { is_active: true, birth_date: { not: null } },
            select: { emp_id: true, name: true, birth_date: true }
        });
        const todayEmps = allEmps.filter(e => {
            const b = new Date(e.birth_date!);
            return b.getMonth() === now.getMonth() && b.getDate() === now.getDate();
        });

        // 3. Pending Birthday Claims
        const pendingClaimsCount = await prisma.birthday_claims.count({
            where: { status: "pending" }
        });

        return NextResponse.json({
            ok: true,
            arrivals: arrivals.map(a => ({ ...a, hire_date: a.hire_date?.toISOString() })),
            birthdays: todayEmps,
            pendingClaimsCount
        });
    } catch (e) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
}
