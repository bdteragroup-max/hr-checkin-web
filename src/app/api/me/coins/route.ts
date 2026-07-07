import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function requireEmployee() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    try {
        const payload = verifyToken(token) as { emp_id: string };
        const emp = await prisma.employees.findUnique({ where: { emp_id: payload.emp_id } });
        if (!emp || !emp.is_active) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
        return { emp };
    } catch {
        return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    }
}

export async function GET() {
    const auth = await requireEmployee();
    if ("error" in auth) return auth.error;

    try {
        // Fetch everything in parallel
        const [balances, history, budget] = await Promise.all([
            prisma.employee_coins.findMany({
                where: { emp_id: auth.emp.emp_id },
                include: { coin_type: true },
            }),
            prisma.coin_ledgers.findMany({
                where: { emp_id: auth.emp.emp_id },
                orderBy: { created_at: "desc" },
                take: 50,
                include: { coin_type: true },
            }),
            prisma.transfer_budgets.findUnique({
                where: { emp_id: auth.emp.emp_id }
            })
        ]);

        return NextResponse.json({
            ok: true,
            balances,
            history,
            employee: auth.emp,
            budget: budget || { balance: 0, monthly_topup: 20 }
        });
    } catch (e: any) {
        console.error("GET Coins Error:", e);
        return NextResponse.json({ error: "Failed to fetch coins" }, { status: 500 });
    }
}
