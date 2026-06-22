import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        await requireAdmin();
        const body = await req.json();
        const { category, year } = body;

        if (!category || !year) {
            return NextResponse.json({ error: "MISSING_PARAMETERS" }, { status: 400 });
        }

        // Find all approved or completed evaluations for this category and year
        const evals = await (prisma as any).kpi_evaluations.findMany({
            where: {
                category,
                year: Number(year),
                status: { in: ["APPROVED", "completed"] }
            }
        });

        let awardedCount = 0;
        let skipCount = 0;

        for (const ev of evals) {
            const finalGrade = ev.grade;
            if (['A', 'B', 'B+'].includes(finalGrade)) {
                let coinAmount = 0;
                if (finalGrade === 'A') coinAmount = 2;
                else if (finalGrade === 'B' || finalGrade === 'B+') coinAmount = 1;

                if (coinAmount > 0) {
                    const sourceKey = `kpi_reward:${ev.emp_id}:${ev.id}`;
                    
                    // Check if already awarded
                    const existing = await (prisma as any).coin_ledgers.findUnique({
                        where: { source_key: sourceKey }
                    });

                    if (!existing) {
                        // Use a transaction for safety
                        await prisma.$transaction(async (tx: any) => {
                            const existingCoin = await tx.employee_coins.findUnique({
                                where: { emp_id_coin_type_id: { emp_id: ev.emp_id, coin_type_id: 'KPI' } }
                            });

                            if (existingCoin) {
                                await tx.employee_coins.update({
                                    where: { id: existingCoin.id },
                                    data: { balance: { increment: coinAmount } }
                                });
                            } else {
                                await tx.employee_coins.create({
                                    data: { emp_id: ev.emp_id, coin_type_id: 'KPI', balance: coinAmount }
                                });
                            }

                            await tx.coin_ledgers.create({
                                data: {
                                    emp_id: ev.emp_id,
                                    coin_type_id: 'KPI',
                                    amount: coinAmount,
                                    transaction_type: "EARN",
                                    source_key: sourceKey,
                                    description: `KPI evaluation approved (Retro) — Grade ${finalGrade}`
                                }
                            });
                        });
                        awardedCount++;
                    } else {
                        skipCount++;
                    }
                }
            } else {
                skipCount++;
            }
        }

        return NextResponse.json({ 
            ok: true, 
            message: `Retrospective award completed.`,
            awarded: awardedCount,
            skipped: skipCount,
            total_found: evals.length
        });

    } catch (e: any) {
        if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
            return NextResponse.json({ error: e.message }, { status: 401 });
        }
        console.error("[API/ADMIN/KPI/RETRO] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
