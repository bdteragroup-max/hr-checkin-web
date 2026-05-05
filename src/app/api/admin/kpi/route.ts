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

        // 1. Update the main evaluation
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

        // 2. Update individual items if provided
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
