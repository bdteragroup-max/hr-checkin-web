import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const runtime = "nodejs"; // Rebuild trigger

export async function GET() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;

        const employees = await (prisma as any).employees.findMany({
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
                nickname: true,
                hire_date: true,
                is_on_trial: true,
                job_positions: { select: { title: true } },
                departments: { select: { name: true } },
                kpiList: {
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
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const results = employees.map((emp: any) => {
            const isTrial = emp.is_on_trial;
            const evals = emp.kpiList || [];
            
            // 1. Probation Track (Trial only)
            const probEvals = evals.filter((ev: any) => ev.category === "PROBATION");
            let probNextRound = probEvals.length + 1;
            let probDueDate = null;
            let probUnlockDate = null;
            let probIsUnlocked = false;

            if (isTrial && emp.hire_date) {
                let dueDays = probNextRound === 1 ? 30 : probNextRound === 2 ? 60 : probNextRound === 3 ? 90 : 119;
                probDueDate = new Date(emp.hire_date);
                probDueDate.setDate(probDueDate.getDate() + dueDays);
                probUnlockDate = new Date(probDueDate);
                probUnlockDate.setDate(probUnlockDate.getDate() - 7);
                probIsUnlocked = now >= probUnlockDate;
            }

            // 2. Monthly Track (Regular only)
            const monthlyEvals = evals.filter((ev: any) => ev.category === "MONTHLY");
            let monthlyNextRound = currentMonth;
            let monthlyUnlockDate = new Date(currentYear, currentMonth - 1, 20);
            let monthlyDueDate = new Date(currentYear, currentMonth, 0);
            let monthlyIsUnlocked = now >= monthlyUnlockDate;

            // 3. Annual Track (Regular only)
            const annualEvals = evals.filter((ev: any) => ev.category === "ANNUAL");
            let annualIsUnlocked = true; // Annual is usually open

            return {
                emp_id: emp.emp_id,
                name: emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name,
                hire_date: emp.hire_date,
                is_on_trial: emp.is_on_trial,
                position: emp.job_positions?.title || "Staff",
                department: emp.departments?.name || "N/A",
                evaluations: evals,
                
                track_info: {
                    probation: { next_round: probNextRound, due_date: probDueDate, unlock_date: probUnlockDate, is_unlocked: probIsUnlocked },
                    monthly: { next_round: monthlyNextRound, due_date: monthlyDueDate, unlock_date: monthlyUnlockDate, is_unlocked: monthlyIsUnlocked },
                    annual: { is_unlocked: annualIsUnlocked }
                }
            };
        });

        return NextResponse.json({ ok: true, list: results });
    } catch (e: any) {
        console.error("[API/KPI/EMPLOYEES] Critical Error:", e);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 401 });
        }
        return NextResponse.json({ error: "INTERNAL_ERROR", message: e.message }, { status: 500 });
    }
}
