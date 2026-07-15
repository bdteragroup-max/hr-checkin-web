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

        const loggedInUser = await prisma.employees.findUnique({
            where: { emp_id: supervisorId },
            select: { job_positions: { select: { node_type: true, title: true } } }
        });

        const checkIsManager = (emp: any) => {
            const title = emp?.job_positions?.title?.toLowerCase() || '';
            const nodeType = emp?.job_positions?.node_type;
            return nodeType === 'executive' || 
                title.includes('mgr') || 
                title.includes('manager') || 
                title.includes('หัวหน้า') ||
                title.includes('sup.') ||
                title.includes('supervisor') ||
                title.includes('director');
        };

        const isManager = checkIsManager(loggedInUser);

        const baseOrConditions: any[] = [
            { supervisor_id: supervisorId },
            { secondary_supervisor_id: supervisorId }
        ];

        if (isManager) {
            baseOrConditions.push({
                emp_id: { not: supervisorId },
                is_on_trial: true,
                job_positions: {
                    OR: [
                        { node_type: 'executive' },
                        { title: { contains: 'mgr', mode: 'insensitive' } },
                        { title: { contains: 'manager', mode: 'insensitive' } },
                        { title: { contains: 'หัวหน้า', mode: 'insensitive' } },
                        { title: { contains: 'sup.', mode: 'insensitive' } },
                        { title: { contains: 'supervisor', mode: 'insensitive' } },
                        { title: { contains: 'director', mode: 'insensitive' } }
                    ]
                }
            });
        }

        const employees = await prisma.employees.findMany({
            where: {
                OR: baseOrConditions,
                is_active: true
            },
            select: {
                emp_id: true,
                name: true,
                nickname: true,
                hire_date: true,
                is_on_trial: true,
                supervisor_id: true,
                secondary_supervisor_id: true,
                job_positions: { select: { title: true } },
                departments: { select: { name: true } },
                salary_type: true,
                probation_evaluations: {
                    select: { evaluation_no: true, evaluation_date: true, total_score: true, grade: true, supervisor_id: true },
                    orderBy: { evaluation_no: "asc" }
                }
            }
        });

        const now = new Date();
        const results = employees.map(emp => {
            const isDirectSubordinate = emp.supervisor_id === supervisorId || emp.secondary_supervisor_id === supervisorId;
            const isOtherManager = !isDirectSubordinate;
            
            const myEvals = emp.probation_evaluations;
            const lastEval = myEvals[myEvals.length - 1];
            const nextRound = (lastEval?.evaluation_no || 0) + 1;
            
            let dueDate = null;
            let unlockDate = null;
            let isUnlocked = false;

            if (emp.is_on_trial) {
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
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                
                unlockDate = new Date(currentYear, currentMonth, 20);
                dueDate = new Date(currentYear, currentMonth + 1, 0); 
                
                const lastEvalDate = lastEval ? new Date(lastEval.evaluation_date) : null;
                const evaluatedThisMonth = lastEvalDate && 
                                          lastEvalDate.getMonth() === currentMonth && 
                                          lastEvalDate.getFullYear() === currentYear;
                
                isUnlocked = (now >= unlockDate) && !evaluatedThisMonth;
            }

            return {
                emp_id: emp.emp_id,
                name: emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name,
                hire_date: emp.hire_date,
                is_on_trial: emp.is_on_trial,
                position: emp.job_positions?.title || "N/A",
                department: emp.departments?.name || "N/A",
                salary_type: emp.salary_type,
                last_evaluation_no: nextRound - 1,
                next_round: nextRound,
                due_date: dueDate ? dueDate.toISOString() : null,
                unlock_date: unlockDate ? unlockDate.toISOString() : null,
                is_unlocked: isUnlocked,
                evaluation_history: emp.probation_evaluations,
                is_other_manager: isOtherManager
            };
        });

        return NextResponse.json({ ok: true, list: results });
    } catch (e: any) {
        console.error("[API/PROBATION/EMPLOYEES] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR", message: e.message }, { status: 500 });
    }
}

