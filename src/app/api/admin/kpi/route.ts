import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET() {
    try {
        await requireAdmin();

        const list = await (prisma as any).kpi_evaluations.findMany({
            include: {
                employee: { 
                    select: { 
                        name: true, 
                        nickname: true,
                        emp_id: true,
                        is_on_trial: true,
                        hire_date: true,
                        job_positions: { select: { title: true } },
                        departments: { select: { name: true } }
                    } 
                },
                supervisor: { select: { name: true, nickname: true } },
                items: true
            },
            orderBy: { created_at: "desc" }
        });

        const formattedList = list.map((ev: any) => {
            const empNickname = ev.employee?.nickname;
            let empName = ev.employee?.name || "";
            if (empNickname && !empName.includes(`(${empNickname})`)) {
                empName = `${empName} (${empNickname})`;
            }

            const supNickname = ev.supervisor?.nickname;
            let supName = ev.supervisor?.name || "";
            if (supNickname && !supName.includes(`(${supNickname})`)) {
                supName = `${supName} (${supNickname})`;
            }

            return {
                ...ev,
                employee: {
                    ...ev.employee,
                    name: empName
                },
                supervisor: ev.supervisor ? {
                    ...ev.supervisor,
                    name: supName
                } : null
            };
        });

        return NextResponse.json({ ok: true, list: formattedList });
    } catch (e: any) {
        if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
            return NextResponse.json({ error: e.message }, { status: 401 });
        }
        console.error("[API/ADMIN/KPI] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
export async function PATCH(req: Request) {
    try {
        await requireAdmin();
        const body = await req.json();
        const { id, items, status, supervisor_comment, employee_comment, total_supervisor_score, grade } = body;

        if (!id) return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });

        // 1. Fetch current evaluation
        const currentEval = await (prisma as any).kpi_evaluations.findUnique({
            where: { id: Number(id) }
        });

        if (!currentEval) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        
        // Guard against editing APPROVED evaluations
        if (currentEval.status === "APPROVED") {
            return NextResponse.json({ error: "ALREADY_APPROVED" }, { status: 400 });
        }

        // If status is transitioning to APPROVED, perform atomic transaction
        if (status === "APPROVED") {
            let resultEval: any;
            await prisma.$transaction(async (tx: any) => {
                // Determine final grade before lock
                const finalGrade = grade || currentEval.grade;
                const emp_id = currentEval.emp_id;
                
                // 1. Atomic updateMany lock
                const updated = await tx.kpi_evaluations.updateMany({
                    where: { id: Number(id), status: "PENDING_APPROVAL" },
                    data: {
                        status: "APPROVED",
                        supervisor_comment: supervisor_comment || undefined,
                        employee_comment: employee_comment || undefined,
                        total_supervisor_score: total_supervisor_score != null ? Number(total_supervisor_score) : undefined,
                        grade: finalGrade,
                        updated_at: new Date()
                    }
                });

                if (updated.count === 0) {
                    throw new Error("ALREADY_APPROVED_OR_NOT_FOUND");
                }

                // 2. Award KPI Coins based on grade
                let coinAmount = 0;
                if (finalGrade === "A") coinAmount = 2;
                else if (finalGrade === "B" || finalGrade === "B+") coinAmount = 1;

                if (coinAmount > 0) {
                    const kpiCoinTypeId = "KPI";
                    
                    // Upsert employee coin balance
                    const existingCoin = await tx.employee_coins.findUnique({
                        where: { emp_id_coin_type_id: { emp_id, coin_type_id: kpiCoinTypeId } }
                    });

                    if (existingCoin) {
                        await tx.employee_coins.update({
                            where: { id: existingCoin.id },
                            data: { balance: { increment: coinAmount } }
                        });
                    } else {
                        await tx.employee_coins.create({
                            data: { emp_id, coin_type_id: kpiCoinTypeId, balance: coinAmount }
                        });
                    }

                    // Insert Ledger
                    await tx.coin_ledgers.create({
                        data: {
                            emp_id,
                            coin_type_id: kpiCoinTypeId,
                            amount: coinAmount,
                            transaction_type: "EARN",
                            source_key: `kpi_reward:${emp_id}:${id}`,
                            description: `KPI evaluation approved — Grade ${finalGrade}`
                        }
                    });
                }
                
                resultEval = await tx.kpi_evaluations.findUnique({ where: { id: Number(id) } });
            });

            return NextResponse.json({ ok: true, evaluation: resultEval });
        }

        // Standard pre-approval update
        const updatedEval = await (prisma as any).kpi_evaluations.update({
            where: { id: Number(id) },
            data: {
                status: status || undefined,
                supervisor_comment: supervisor_comment || undefined,
                employee_comment: employee_comment || undefined,
                total_supervisor_score: total_supervisor_score != null ? Number(total_supervisor_score) : undefined,
                grade: grade || undefined,
                updated_at: new Date()
            }
        });

        // Update individual items if provided
        if (items && Array.isArray(items)) {
            for (const item of items) {
                if (item.id) {
                    await (prisma as any).kpi_items.update({
                        where: { id: Number(item.id) },
                        data: {
                            objective: item.objective || undefined,
                            indicator: item.indicator || undefined,
                            weight: item.weight != null ? Number(item.weight) : undefined,
                            target_1: item.target_1 || undefined,
                            target_2: item.target_2 || undefined,
                            target_3: item.target_3 || undefined,
                            target_4: item.target_4 || undefined,
                            target_5: item.target_5 || undefined,
                            employee_score: item.employee_score != null ? Number(item.employee_score) : undefined,
                            supervisor_score: item.supervisor_score != null ? Number(item.supervisor_score) : undefined,
                            result_description: item.result_description || undefined
                        }
                    });
                }
            }
        }

        return NextResponse.json({ ok: true, evaluation: updatedEval });
    } catch (e: any) {
        if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
            return NextResponse.json({ error: e.message }, { status: 401 });
        }
        console.error("[API/ADMIN/KPI] Patch Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
