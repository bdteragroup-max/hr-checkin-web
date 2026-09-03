import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET() {
    try {
        await requireAdmin();

        const evaluations = await prisma.probation_evaluations.findMany({
            orderBy: { created_at: "desc" },
            include: {
                employee: { 
                    select: { 
                        name: true, 
                        nickname: true,
                        emp_id: true,
                        salary_type: true,
                        is_on_trial: true,
                        job_positions: { select: { title: true } },
                        departments: { select: { name: true } }
                    } 
                },
                supervisor: { select: { name: true, nickname: true } }
            }
        });

        const formattedEvaluations = evaluations.map(ev => {
            const empNickname = (ev.employee as any)?.nickname;
            let empName = ev.employee?.name || "";
            if (empNickname && !empName.includes(`(${empNickname})`)) {
                empName = `${empName} (${empNickname})`;
            }

            const supNickname = (ev.supervisor as any)?.nickname;
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

        const pendingEmployees = await prisma.employees.findMany({
            where: { is_on_trial: true, is_active: true },
            include: {
                probation_evaluations: { 
                    select: { evaluation_no: true, supervisor_id: true },
                    orderBy: { evaluation_no: 'desc' }
                },
                job_positions: { select: { title: true } },
                departments: { select: { name: true } }
            }
        });

        const allCoEvals: any[] = ((await prisma.$queryRawUnsafe(
            `SELECT employee_id, evaluator_id FROM employee_co_evaluators;`
        ).catch(() => [])) as any[]) || [];
        const coEvalMap = new Map<string, Set<string>>();
        for (const row of allCoEvals) {
            if (!coEvalMap.has(row.employee_id)) {
                coEvalMap.set(row.employee_id, new Set());
            }
            coEvalMap.get(row.employee_id)!.add(row.evaluator_id);
        }

        const pending = pendingEmployees.map(emp => {
            let finalPendingName = emp.name;
            if (emp.nickname && !finalPendingName.includes(`(${emp.nickname})`)) {
                finalPendingName = `${finalPendingName} (${emp.nickname})`;
            }
            const allowedEvaluators = new Set([emp.supervisor_id, emp.secondary_supervisor_id].filter(Boolean));
            const extraCoEvals = coEvalMap.get(emp.emp_id);
            if (extraCoEvals) {
                extraCoEvals.forEach(id => allowedEvaluators.add(id));
            }
            const directEvals = emp.probation_evaluations.filter((e: any) => allowedEvaluators.has(e.supervisor_id));
            const latestEvalNo = directEvals.length > 0 ? directEvals[0].evaluation_no : 0;
            return {
                emp_id: emp.emp_id,
                name: finalPendingName,
                hire_date: emp.hire_date,
                probation_end_date: emp.probation_end_date,
                job_title: emp.job_positions?.title || "-",
                department: emp.departments?.name || "-",
                next_round: latestEvalNo + 1
            };
        });

        return NextResponse.json({ ok: true, list: formattedEvaluations, pending });
    } catch (e: any) {
        console.error("[API/ADMIN/PROBATION/LIST] Error:", e);
        return NextResponse.json({ error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
