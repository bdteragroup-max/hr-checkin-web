import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { sendKpiSelfRateNotification } from "@/utils/lineMessaging";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const empId = decoded.emp_id;

        const body = await req.json();
        const { evaluation_id, items, employee_comment } = body;

        if (!evaluation_id || !items || !Array.isArray(items)) {
            return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
        }

        const evaluation = await prisma.kpi_evaluations.findUnique({
            where: { id: evaluation_id }
        });

        if (!evaluation || evaluation.emp_id !== empId) {
            return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }

        if (evaluation.status !== "pending_employee") {
            return NextResponse.json({ error: "WRONG_STATUS" }, { status: 400 });
        }

        // Update items and evaluation status
        await prisma.$transaction(async (tx) => {
            let totalEmployeeScore = 0;
            for (const it of items) {
                const item = await tx.kpi_items.update({
                    where: { id: it.id },
                    data: {
                        result_description: it.result_description,
                        employee_score: it.employee_score
                    }
                });
                totalEmployeeScore += (Number(item.weight) / 100) * (it.employee_score || 0);
            }

            await tx.kpi_evaluations.update({
                where: { id: evaluation_id },
                data: {
                    status: "pending_supervisor",
                    employee_comment: employee_comment,
                    total_employee_score: totalEmployeeScore,
                    updated_at: new Date()
                }
            });
        });

        // Notify Supervisor
        const emp = await prisma.employees.findUnique({
            where: { emp_id: empId },
            select: { name: true, supervisor_id: true }
        });

        if (emp?.supervisor_id) {
            const supervisor = await prisma.employees.findUnique({
                where: { emp_id: emp?.supervisor_id },
                select: { line_user_id: true }
            });

            if (supervisor?.line_user_id) {
                await sendKpiSelfRateNotification(supervisor.line_user_id, {
                    empName: emp.name,
                    evaluationNo: evaluation.evaluation_no
                });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/KPI/SELF_RATE] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
