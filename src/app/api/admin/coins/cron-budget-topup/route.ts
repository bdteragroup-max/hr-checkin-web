import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        // Ensure this is called securely, e.g., via a secret token in headers
        // Since Vercel Cron or similar would call this, check for the auth header
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'secret-cron-key'}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Top up transfer budgets by their monthly_topup amount (default 20)
        // We use executeRaw to perform a bulk update on the transfer_budgets table
        // We check last_topup_at to ensure idempotency (only once per month)
        const result = await prisma.$executeRaw`
            UPDATE transfer_budgets 
            SET balance = balance + monthly_topup, 
                last_topup_at = NOW(),
                updated_at = NOW()
            FROM employees
            WHERE transfer_budgets.emp_id = employees.emp_id 
              AND employees.is_active = true
              AND (transfer_budgets.last_topup_at IS NULL OR DATE_TRUNC('month', transfer_budgets.last_topup_at) < DATE_TRUNC('month', CURRENT_DATE))
        `;

        // Create budget rows for active employees who don't have one yet
        const missingBudgetEmps = await prisma.$queryRaw<any[]>`
            SELECT emp_id FROM employees 
            WHERE is_active = true 
              AND emp_id NOT IN (SELECT emp_id FROM transfer_budgets)
        `;

        if (missingBudgetEmps.length > 0) {
            await prisma.transfer_budgets.createMany({
                data: missingBudgetEmps.map(emp => ({
                    emp_id: emp.emp_id,
                    balance: 20,
                    monthly_topup: 20,
                    last_topup_at: new Date(),
                })),
                skipDuplicates: true,
            });
        }

        return NextResponse.json({
            ok: true,
            message: "Monthly transfer budgets topped up successfully",
            updated_existing: result,
            created_new: missingBudgetEmps.length,
        });

    } catch (error: any) {
        console.error("Cron Budget Top-up Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to top up budgets" },
            { status: 500 }
        );
    }
}
