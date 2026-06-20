import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { emp_id } = verifyToken(token);

        const params = await props.params;
        const assignmentId = parseInt(params.id);
        if (isNaN(assignmentId)) {
            return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
        }

        // Fetch assignment to verify task ownership
        const assignment = await prisma.task_assignments.findUnique({
            where: { id: assignmentId },
            include: { task: true }
        });

        if (!assignment) {
            return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }

        if (assignment.task.created_by !== emp_id) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        // Complete Assignment Transaction
        await prisma.$transaction(async (tx) => {
            const updated = await tx.task_assignments.updateMany({
                where: { id: assignmentId, status: { in: ["PENDING", "OVERDUE"] } },
                data: { status: "COMPLETED", completed_at: new Date(), completed_by: emp_id }
            });
            if (updated.count === 0) throw new Error("ALREADY_COMPLETED");

            // Fetch or create budget
            let budget = await tx.task_coin_budgets.findUnique({ where: { emp_id } });
            
            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            if (!budget) {
                budget = await tx.task_coin_budgets.create({
                    data: {
                        emp_id,
                        used_this_month: 0,
                        monthly_limit: 20,
                        reset_at: currentMonthStart
                    }
                });
            } else if (budget.reset_at < currentMonthStart) {
                // Lazy reset logic
                budget = await tx.task_coin_budgets.update({
                    where: { emp_id },
                    data: {
                        used_this_month: 0,
                        reset_at: currentMonthStart
                    }
                });
            }

            if (budget.used_this_month >= budget.monthly_limit) {
                throw new Error("BUDGET_EXHAUSTED");
            }

            // Consume 1 budget
            const budgetUpdated = await tx.task_coin_budgets.updateMany({
                where: { emp_id, used_this_month: { lt: budget.monthly_limit } },
                data: { used_this_month: { increment: 1 } }
            });

            if (budgetUpdated.count === 0) throw new Error("BUDGET_EXHAUSTED");

            // Grant +1 Task Coin
            const coinType = "TASK";
            
            const currentCoin = await tx.employee_coins.findUnique({
                where: { emp_id_coin_type_id: { emp_id: assignment.emp_id, coin_type_id: coinType } }
            });

            if (currentCoin) {
                await tx.employee_coins.update({
                    where: { id: currentCoin.id },
                    data: { balance: { increment: 1 } }
                });
            } else {
                await tx.employee_coins.create({
                    data: { emp_id: assignment.emp_id, coin_type_id: coinType, balance: 1 }
                });
            }

            await tx.coin_ledgers.create({
                data: {
                    emp_id: assignment.emp_id,
                    coin_type_id: coinType,
                    amount: 1,
                    transaction_type: "EARN",
                    source_key: `task_complete:${assignment.task_id}:${assignment.emp_id}`,
                    description: `Task Completion: ${assignment.task.title}`
                }
            });
        });

        return NextResponse.json({ ok: true });

    } catch (e: any) {
        console.error("Complete Task Error:", e);
        if (e.message === "ALREADY_COMPLETED" || e.message === "BUDGET_EXHAUSTED") {
            return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
        }
        return NextResponse.json({ ok: false, error: "SERVER_ERROR", details: e.message }, { status: 500 });
    }
}
