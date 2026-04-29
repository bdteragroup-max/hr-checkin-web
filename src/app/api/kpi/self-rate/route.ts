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

        // Pre-fetch existing items to get weights/sections for calculation without awaiting each update
        const existingItems = await prisma.kpi_items.findMany({
            where: { kpi_evaluation_id: evaluation_id }
        });
        const itemMap = new Map(existingItems.map(i => [i.id, i]));

        // Update items and evaluation status
        await prisma.$transaction(async (tx) => {
            let totalEmployeeScore = 0;
            for (const it of items) {
                if (it.id) {
                    const existingItem = itemMap.get(it.id);

                    // Update existing item
                    await tx.kpi_items.update({
                        where: { id: it.id },
                        data: {
                            result_description: it.result_description,
                            employee_score: it.employee_score,
                            objective: it.objective, // Part 4 fields
                            indicator: it.indicator,
                            target_1: it.target_1
                        }
                    });

                    // Only calculate weight for non-development items (Part 1-3)
                    if (existingItem && existingItem.section !== "DEVELOPMENT") {
                        totalEmployeeScore += (Number(existingItem.weight) / 100) * (it.employee_score || 0);
                    }
                } else {
                    // Create new item (usually Part 4: DEVELOPMENT)
                    await tx.kpi_items.create({
                        data: {
                            kpi_evaluation_id: evaluation_id,
                            objective: it.objective || "",
                            indicator: it.indicator || "",
                            target_1: it.target_1 || "",
                            result_description: it.result_description || "",
                            employee_score: it.employee_score || 0,
                            section: it.section || "DEVELOPMENT",
                            weight: 0
                        }
                    });
                }
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
        }, {
            timeout: 30000 // 30 seconds timeout
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
