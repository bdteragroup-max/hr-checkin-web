import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { emp_id } = verifyToken(token);

        // Check if user is a supervisor
        const isSupervisor = await prisma.employees.findFirst({
            where: { supervisor_id: emp_id }
        });

        if (!isSupervisor) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let budget = await prisma.task_coin_budgets.findUnique({
            where: { emp_id }
        });

        if (!budget) {
            budget = await prisma.task_coin_budgets.create({
                data: {
                    emp_id,
                    used_this_month: 0,
                    monthly_limit: 20,
                    reset_at: currentMonthStart
                }
            });
        } else if (budget.reset_at < currentMonthStart) {
            // Lazy reset
            budget = await prisma.task_coin_budgets.update({
                where: { emp_id },
                data: {
                    used_this_month: 0,
                    reset_at: currentMonthStart
                }
            });
        }

        return NextResponse.json({ ok: true, budget });

    } catch (e: any) {
        console.error("GET Task Budget Error:", e);
        return NextResponse.json({ ok: false, error: "SERVER_ERROR", details: e.message }, { status: 500 });
    }
}
