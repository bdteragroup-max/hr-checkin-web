import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { sendKpiDefineNotification } from "@/utils/lineMessaging";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;

        const body = await req.json();
        const { emp_id, items, period_start, period_end, category, year, session_name, evaluation_no } = body;

        if (!emp_id || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
        }

        // Validate total weight (should be 100)
        const totalWeight = items.reduce((sum, item) => sum + Number(item.weight), 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
            return NextResponse.json({ error: "TOTAL_WEIGHT_MUST_BE_100" }, { status: 400 });
        }

        const currentCategory = category || "PROBATION";
        const currentYear = year || new Date().getFullYear();

        const currentRound = evaluation_no || (currentCategory === "MONTHLY" ? new Date().getMonth() + 1 : undefined);

        // Check if there's an ongoing evaluation for THIS category/year/round
        const existing = await prisma.kpi_evaluations.findFirst({
            where: {
                emp_id,
                status: { not: "completed" },
                category: currentCategory,
                year: currentYear,
                ...(currentRound ? { evaluation_no: currentRound } : {})
            }
        });

        if (existing) {
            // Update existing draft ? 
            // For now, let's allow updating if it is still in draft or pending_employee
            if (existing.status !== "draft" && existing.status !== "pending_employee") {
                 return NextResponse.json({ error: "CANNOT_UPDATE_ONGOING_EVALUATION" }, { status: 400 });
            }

            await prisma.$transaction([
                prisma.kpi_items.deleteMany({ where: { kpi_evaluation_id: existing.id } }),
                prisma.kpi_evaluations.update({
                    where: { id: existing.id },
                    data: {
                        period_start: period_start ? new Date(period_start) : null,
                        period_end: period_end ? new Date(period_end) : null,
                        session_name: session_name || existing.session_name,
                        status: "pending_employee",
                        items: {
                            create: items.map(it => ({
                                objective: it.objective,
                                indicator: it.indicator,
                                weight: it.weight,
                                target_1: it.target_1,
                                target_2: it.target_2,
                                target_3: it.target_3,
                                target_4: it.target_4,
                                target_5: it.target_5,
                                section: it.section || "KPI"
                            }))
                        }
                    }
                })
            ]);

            // Notify Employee
            const employee = await prisma.employees.findUnique({
                where: { emp_id },
                select: { line_user_id: true }
            });
            const supervisor = await prisma.employees.findUnique({
                where: { emp_id: supervisorId },
                select: { name: true }
            });

            if (employee?.line_user_id) {
                await sendKpiDefineNotification(employee.line_user_id, {
                    evaluationNo: existing.evaluation_no,
                    supervisorName: supervisor?.name || "หัวหน้างาน"
                });
            }

            return NextResponse.json({ ok: true, id: existing.id });
        }

        let nextNo = evaluation_no;
        if (!nextNo) {
            if (currentCategory === "MONTHLY") {
                nextNo = new Date().getMonth() + 1;
            } else {
                const lastEval = await prisma.kpi_evaluations.findFirst({
                    where: { 
                        emp_id,
                        category: currentCategory 
                    },
                    orderBy: { evaluation_no: "desc" }
                });
                nextNo = (lastEval?.evaluation_no || 0) + 1;
            }
        }

        const newEval = await prisma.kpi_evaluations.create({
            data: {
                emp_id,
                supervisor_id: supervisorId,
                evaluation_no: nextNo,
                category: currentCategory,
                year: currentYear,
                session_name: session_name || null,
                period_start: period_start ? new Date(period_start) : null,
                period_end: period_end ? new Date(period_end) : null,
                status: "pending_employee",
                items: {
                    create: items.map(it => ({
                        objective: it.objective,
                        indicator: it.indicator,
                        weight: it.weight,
                        target_1: it.target_1,
                        target_2: it.target_2,
                        target_3: it.target_3,
                        target_4: it.target_4,
                        target_5: it.target_5,
                        section: it.section || "KPI"
                    }))
                }
            }
        });

        // Notify Employee
        const employee = await prisma.employees.findUnique({
            where: { emp_id },
            select: { line_user_id: true }
        });
        const supervisor = await prisma.employees.findUnique({
            where: { emp_id: supervisorId },
            select: { name: true }
        });

        if (employee?.line_user_id) {
            await sendKpiDefineNotification(employee.line_user_id, {
                evaluationNo: nextNo,
                supervisorName: supervisor?.name || "หัวหน้างาน"
            });
        }

        return NextResponse.json({ ok: true, id: newEval.id });
    } catch (e: any) {
        console.error("[API/KPI/DEFINE] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
