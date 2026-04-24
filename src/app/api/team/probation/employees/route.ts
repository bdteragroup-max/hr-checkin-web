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
                is_on_trial: true,
                is_active: true
            },
            select: {
                emp_id: true,
                name: true,
                hire_date: true,
                job_positions: { select: { title: true } },
                departments: { select: { name: true } },
                probation_evaluations: {
                    where: { supervisor_id: supervisorId },
                    select: { evaluation_no: true },
                    orderBy: { evaluation_no: "desc" },
                    take: 1
                }
            }
        });

        const now = new Date();
        const results = employees.map(emp => {
            const nextRound = (emp.probation_evaluations[0]?.evaluation_no || 0) + 1;
            
            // Calculate due date based on round
            let dueDays = 0;
            if (nextRound === 1) dueDays = 30;
            else if (nextRound === 2) dueDays = 60;
            else if (nextRound === 3) dueDays = 90;
            else dueDays = 119;
            
            let dueDate = null;
            let unlockDate = null;
            let isUnlocked = false;

            if (emp.hire_date) {
                dueDate = new Date(emp.hire_date);
                dueDate.setDate(dueDate.getDate() + dueDays);
                
                unlockDate = new Date(dueDate);
                unlockDate.setDate(unlockDate.getDate() - 7);
                
                isUnlocked = now >= unlockDate;
            }

            return {
                emp_id: emp.emp_id,
                name: emp.name,
                hire_date: emp.hire_date,
                position: emp.job_positions?.title || "N/A",
                department: emp.departments?.name || "N/A",
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
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
