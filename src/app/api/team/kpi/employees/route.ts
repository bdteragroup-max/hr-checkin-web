import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;

        const employees = await prisma.employees.findMany({
            where: {
                OR: [
                    { supervisor_id: supervisorId },
                    { secondary_supervisor_id: supervisorId }
                ],
                is_active: true,
                NOT: {
                    job_positions: {
                        title: {
                            contains: "ฝึกงาน"
                        }
                    }
                }
            },
            select: {
                emp_id: true,
                name: true,
                hire_date: true,
                is_on_trial: true,
                job_positions: { select: { title: true } },
                departments: { select: { name: true } },
                kpi_evaluations: {
                    select: { 
                        id: true,
                        evaluation_no: true,
                        status: true,
                        total_supervisor_score: true,
                        evaluation_date: true,
                        category: true,
                        year: true,
                        session_name: true
                    },
                    orderBy: { created_at: "desc" }
                }
            }
        });

        const results = employees.map((emp: any) => ({
            emp_id: emp.emp_id,
            name: emp.name,
            hire_date: emp.hire_date,
            is_on_trial: emp.is_on_trial,
            position: emp.job_positions?.title || "Staff",
            department: emp.departments?.name || "N/A",
            evaluations: emp.kpi_evaluations
        }));

        return NextResponse.json({ ok: true, list: results });
    } catch (e: any) {
        console.error("[API/KPI/EMPLOYEES] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
