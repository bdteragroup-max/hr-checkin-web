import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBangkokWallClock } from "@/utils/time";

export async function GET(req: Request) {
    try {
        const now = getBangkokWallClock();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Find all employees who are supervisors (department heads)
        const supervisors = await prisma.employees.groupBy({
            by: ['supervisor_id'],
            where: {
                supervisor_id: { not: null },
                is_active: true
            }
        });

        const supervisorIds = supervisors.map(s => s.supervisor_id).filter(Boolean) as string[];

        let resetCount = 0;

        for (const emp_id of supervisorIds) {
            const budget = await prisma.task_coin_budgets.findUnique({
                where: { emp_id }
            });

            if (!budget) {
                await prisma.task_coin_budgets.create({
                    data: {
                        emp_id,
                        used_this_month: 0,
                        monthly_limit: 20,
                        reset_at: currentMonthStart
                    }
                });
                resetCount++;
            } else if (budget.reset_at < currentMonthStart || budget.used_this_month > 0) {
                await prisma.task_coin_budgets.update({
                    where: { emp_id },
                    data: {
                        used_this_month: 0,
                        reset_at: currentMonthStart
                    }
                });
                resetCount++;
            }
        }

        return NextResponse.json({ ok: true, resetCount, currentMonthStart });

    } catch (e: any) {
        console.error("[CRON] Reset Task Budgets Error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
