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
                        emp_id: true,
                        salary_type: true,
                        is_on_trial: true,
                        job_positions: { select: { title: true } },
                        departments: { select: { name: true } }
                    } 
                },
                supervisor: { select: { name: true } }
            }
        });

        const pendingEmployees = await prisma.employees.findMany({
            where: { is_on_trial: true, is_active: true },
            include: {
                _count: { select: { probation_evaluations: true } },
                job_positions: { select: { title: true } },
                departments: { select: { name: true } }
            }
        });

        const pending = pendingEmployees.map(emp => ({
            emp_id: emp.emp_id,
            name: emp.name,
            hire_date: emp.hire_date,
            probation_end_date: emp.probation_end_date,
            job_title: emp.job_positions?.title || "-",
            department: emp.departments?.name || "-",
            next_round: (emp._count.probation_evaluations || 0) + 1
        }));

        return NextResponse.json({ ok: true, list: evaluations, pending });
    } catch (e: any) {
        console.error("[API/ADMIN/PROBATION/LIST] Error:", e);
        return NextResponse.json({ error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
