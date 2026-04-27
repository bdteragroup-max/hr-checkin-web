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
                is_active: true
            },
            select: {
                emp_id: true,
                name: true,
                hire_date: true,
                is_on_trial: true,
                job_positions: { select: { title: true } },
                departments: { select: { name: true } },
                salary_type: true,
                probation_evaluations: {
                    where: { supervisor_id: supervisorId },
                    select: { evaluation_no: true, created_at: true },
                    orderBy: { created_at: "desc" },
                    take: 1
                }
            }
        });

        const now = new Date();
        const results = employees.map(emp => {
            const lastEval = emp.probation_evaluations[0];
            const nextRound = (lastEval?.evaluation_no || 0) + 1;
            
            let dueDate = null;
            let unlockDate = null;
            let isUnlocked = false;

            if (emp.is_on_trial) {
                // Calculate due date based on round (30, 60, 90, 119 days)
                let dueDays = 0;
                if (nextRound === 1) dueDays = 30;
                else if (nextRound === 2) dueDays = 60;
                else if (nextRound === 3) dueDays = 90;
                else dueDays = 119;
                
                if (emp.hire_date) {
                    dueDate = new Date(emp.hire_date);
                    dueDate.setDate(dueDate.getDate() + dueDays);
                    
                    unlockDate = new Date(dueDate);
                    unlockDate.setDate(unlockDate.getDate() - 7);
                    
                    isUnlocked = now >= unlockDate;
                }
            } else {
                // Regular staff: Monthly Evaluation
                // Rule: If last evaluation was in a different month, or no evaluation yet, it's due.
                // We'll set the unlock date to the 20th of every month.
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                
                unlockDate = new Date(currentYear, currentMonth, 20);
                dueDate = new Date(currentYear, currentMonth + 1, 0); // Last day of month
                
                const lastEvalDate = lastEval ? new Date(lastEval.created_at) : null;
                const evaluatedThisMonth = lastEvalDate && 
                                          lastEvalDate.getMonth() === currentMonth && 
                                          lastEvalDate.getFullYear() === currentYear;
                
                isUnlocked = (now >= unlockDate) && !evaluatedThisMonth;
            }

            return {
                emp_id: emp.emp_id,
                name: emp.name,
                hire_date: emp.hire_date,
                is_on_trial: emp.is_on_trial,
                position: emp.job_positions?.title || "N/A",
                department: emp.departments?.name || "N/A",
                salary_type: emp.salary_type,
                last_evaluation_no: nextRound - 1,
                next_round: nextRound,
                due_date: dueDate ? dueDate.toISOString() : null,
                unlock_date: unlockDate ? unlockDate.toISOString() : null,
                is_unlocked: isUnlocked
            };
        });

        return NextResponse.json({ ok: true, list: results });
    } catch (e: any) {
        console.error("[API/PROBATION/EMPLOYEES] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR", message: e.message }, { status: 500 });
    }
}

