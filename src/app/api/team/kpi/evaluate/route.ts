import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { 
    sendKpiEvaluateHrAlert, 
    sendKpiManagementSummary, 
    sendKpiEvaluateEmployeeNotification 
} from "@/utils/lineMessaging";

export const runtime = "nodejs";

export async function GET(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

        const evaluation = await prisma.kpi_evaluations.findUnique({
            where: { id: Number(id) },
            include: {
                items: true,
                employee: {
                    include: {
                        job_positions: { select: { title: true } },
                        departments: { select: { name: true } },
                        _count: { select: { subordinates: true } }
                    }
                }
            }
        });

        if (!evaluation || (evaluation.supervisor_id !== supervisorId && evaluation.employee?.secondary_supervisor_id !== supervisorId)) {
            return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, evaluation });
    } catch (e: any) {
        console.error("[API/KPI/EVALUATE/GET] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;

        const body = await req.json();
        const { evaluation_id, items, supervisor_comment } = body;

        if (!evaluation_id || !items || !Array.isArray(items)) {
            return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
        }

        const evaluation = await prisma.kpi_evaluations.findUnique({
            where: { id: evaluation_id },
            include: { employee: true }
        });

        if (!evaluation || (evaluation.supervisor_id !== supervisorId && evaluation.employee?.secondary_supervisor_id !== supervisorId)) {
            return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }

        if (evaluation.status !== "pending_supervisor") {
            return NextResponse.json({ error: "WRONG_STATUS" }, { status: 400 });
        }

        // Update items and evaluation status
        await prisma.$transaction(async (tx) => {
            // 1. Get existing item IDs
            const existingItems = await tx.kpi_items.findMany({
                where: { kpi_evaluation_id: evaluation_id },
                select: { id: true }
            });
            const existingIds = existingItems.map(i => i.id);
            const incomingIds = items.map((i: any) => i.id).filter(id => !!id);

            // 2. Delete items that are no longer in the list
            const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));
            if (idsToDelete.length > 0) {
                await tx.kpi_items.deleteMany({
                    where: { id: { in: idsToDelete } }
                });
            }

            // 3. Update or Create items
            const allItems = [];
            for (const it of items) {
                if (it.id) {
                    const item = await tx.kpi_items.update({
                        where: { id: it.id },
                        data: {
                            objective: it.objective,
                            indicator: it.indicator,
                            weight: it.weight,
                            target_1: it.target_1,
                            target_2: it.target_2,
                            target_3: it.target_3,
                            target_4: it.target_4,
                            target_5: it.target_5,
                            supervisor_score: it.supervisor_score
                        }
                    });
                    allItems.push(item);
                } else {
                    const item = await tx.kpi_items.create({
                        data: {
                            kpi_evaluation_id: evaluation_id,
                            objective: it.objective,
                            indicator: it.indicator,
                            weight: it.weight,
                            section: it.section || "KPI",
                            target_1: it.target_1,
                            target_2: it.target_2,
                            target_3: it.target_3,
                            target_4: it.target_4,
                            target_5: it.target_5,
                            supervisor_score: it.supervisor_score
                        }
                    });
                    allItems.push(item);
                }
            }

            const p1 = allItems.filter(it => it.section === "KPI");
            const p2 = allItems.filter(it => it.section === "CORE_VALUE");
            const p3 = allItems.filter(it => it.section === "COMPETENCY");

            const isProbation = evaluation.category === 'PROBATION';
            const hasP3 = p3.length > 0;
            
            let totalScore = 0;
            if (isProbation) {
                // Probation: 100% Part 1 (KPI)
                totalScore = p1.reduce((sum, it) => sum + (Number(it.weight) / 100) * (it.supervisor_score || 0), 0);
            } else {
                // Annual: 70 / 20 / 10 or 70 / 30
                const w1 = 0.70;
                const w2 = hasP3 ? 0.20 : 0.30;
                const w3 = hasP3 ? 0.10 : 0;

                const s1 = p1.reduce((sum, it) => sum + (Number(it.weight) / 100) * (it.supervisor_score || 0), 0);
                const s2 = p2.length > 0 ? (p2.reduce((sum, it) => sum + (it.supervisor_score || 0), 0) / p2.length) : 0;
                const s3 = p3.length > 0 ? (p3.reduce((sum, it) => sum + (it.supervisor_score || 0), 0) / p3.length) : 0;

                totalScore = (s1 * w1) + (s2 * w2) + (s3 * w3);
            }

            let grade = "E";
            if (totalScore >= 4.5) grade = "A";
            else if (totalScore >= 3.5) grade = "B";
            else if (totalScore >= 2.5) grade = "C";
            else if (totalScore >= 1.5) grade = "D";

            const isPassing = ["A", "B", "C"].includes(grade);

            await tx.kpi_evaluations.update({
                where: { id: evaluation_id },
                data: {
                    status: "completed",
                    supervisor_comment: supervisor_comment,
                    total_supervisor_score: totalScore,
                    grade: grade,
                    recommend_salary: body.recommend_salary || false,
                    is_passing: isPassing,
                    updated_at: new Date()
                }
            });
        }, {
            timeout: 30000 // 30 seconds timeout
        });

        // Notify HR and Management
        const employee = await prisma.employees.findUnique({
            where: { emp_id: evaluation.emp_id },
            select: { name: true, nickname: true, line_user_id: true }
        });
        const supervisor = await prisma.employees.findUnique({
            where: { emp_id: supervisorId },
            select: { name: true }
        });

        // Re-calculate local values for notification (since transaction is done)
        const finalEval = await prisma.kpi_evaluations.findUnique({
            where: { id: evaluation_id }
        });

        if (finalEval && employee && supervisor) {
            const empDisplayName = employee.nickname ? `${employee.name} (${employee.nickname})` : employee.name;
            await sendKpiEvaluateHrAlert({
                empName: empDisplayName,
                supervisorName: supervisor.name,
                evaluationNo: finalEval.evaluation_no,
                totalScore: Number(finalEval.total_supervisor_score),
                grade: finalEval.grade || "E"
            });

            await sendKpiManagementSummary({
                empName: empDisplayName,
                supervisorName: supervisor.name,
                totalScore: Number(finalEval.total_supervisor_score),
                grade: finalEval.grade || "E"
            });

            if (employee.line_user_id) {
                await sendKpiEvaluateEmployeeNotification(employee.line_user_id, {
                    evaluationNo: finalEval.evaluation_no,
                    totalScore: Number(finalEval.total_supervisor_score),
                    grade: finalEval.grade || "E",
                    supervisorName: supervisor.name
                });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/KPI/EVALUATE] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
