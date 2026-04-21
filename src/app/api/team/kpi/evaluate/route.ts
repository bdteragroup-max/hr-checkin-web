import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { sendKpiEvaluateHrAlert, sendKpiManagementSummary } from "@/utils/lineMessaging";

export const runtime = "nodejs";

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
            where: { id: evaluation_id }
        });

        if (!evaluation || evaluation.supervisor_id !== supervisorId) {
            return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }

        if (evaluation.status !== "pending_supervisor") {
            return NextResponse.json({ error: "WRONG_STATUS" }, { status: 400 });
        }

        // Update items and evaluation status
        await prisma.$transaction(async (tx) => {
            let totalSupervisorScore = 0;
            for (const it of items) {
                const item = await tx.kpi_items.update({
                    where: { id: it.id },
                    data: {
                        supervisor_score: it.supervisor_score
                    }
                });
                totalSupervisorScore += (Number(item.weight) / 100) * (it.supervisor_score || 0);
            }

            // Calculate Grade based on totalSupervisorScore (1-5)
            // A: 4.5-5.0, B: 3.5-4.49, C: 2.5-3.49, D: 1.5-2.49, E: <1.5
            let grade = "E";
            if (totalSupervisorScore >= 4.5) grade = "A";
            else if (totalSupervisorScore >= 3.5) grade = "B";
            else if (totalSupervisorScore >= 2.5) grade = "C";
            else if (totalSupervisorScore >= 1.5) grade = "D";

            await tx.kpi_evaluations.update({
                where: { id: evaluation_id },
                data: {
                    status: "completed",
                    supervisor_comment: supervisor_comment,
                    total_supervisor_score: totalSupervisorScore,
                    grade: grade,
                    updated_at: new Date()
                }
            });
        });

        // Notify HR and Management
        const employee = await prisma.employees.findUnique({
            where: { emp_id: evaluation.emp_id },
            select: { name: true }
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
            await sendKpiEvaluateHrAlert({
                empName: employee.name,
                supervisorName: supervisor.name,
                evaluationNo: finalEval.evaluation_no,
                totalScore: Number(finalEval.total_supervisor_score),
                grade: finalEval.grade || "E"
            });

            await sendKpiManagementSummary({
                empName: employee.name,
                supervisorName: supervisor.name,
                totalScore: Number(finalEval.total_supervisor_score),
                grade: finalEval.grade || "E"
            });
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/KPI/EVALUATE] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
