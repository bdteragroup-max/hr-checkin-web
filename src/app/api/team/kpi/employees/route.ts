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

        const now = new Date();
        const results = employees.map((emp: any) => {
            const probEvals = emp.kpi_evaluations.filter((ev: any) => ev.category === "PROBATION");
            const nextRound = probEvals.length + 1;
            
            let dueDays = 0;
            if (nextRound === 1) dueDays = 30;
            else if (nextRound === 2) dueDays = 60;
            else if (nextRound === 3) dueDays = 90;
            else dueDays = 119;
            
            const dueDate = new Date(emp.hire_date);
            dueDate.setDate(dueDate.getDate() + dueDays);
            
            const unlockDate = new Date(dueDate);
            unlockDate.setDate(unlockDate.getDate() - 7);

            return {
                emp_id: emp.emp_id,
                name: emp.name,
                hire_date: emp.hire_date,
                is_on_trial: emp.is_on_trial,
                position: emp.job_positions?.title || "Staff",
                department: emp.departments?.name || "N/A",
                evaluations: emp.kpi_evaluations,
                
                prob_next_round: nextRound,
                prob_due_date: dueDate.toISOString(),
                prob_unlock_date: unlockDate.toISOString(),
                prob_is_unlocked: now >= unlockDate
            };
        });

        return NextResponse.json({ ok: true, list: results });
    } catch (e: any) {
        console.error("[API/KPI/EMPLOYEES] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
