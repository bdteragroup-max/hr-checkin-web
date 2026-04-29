import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const runtime = "nodejs"; // Rebuild trigger

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;
        const { id: targetEmpId } = await params;

        // Verify if the requester is the supervisor of this employee
        const employeeResult = await (prisma as any).employees.findFirst({
            where: {
                emp_id: targetEmpId,
                OR: [
                    { supervisor_id: supervisorId },
                    { secondary_supervisor_id: supervisorId }
                ]
            },
            select: {
                emp_id: true,
                name: true,
                branch_id: true,
                is_on_trial: true,
                hire_date: true,
                job_positions: { select: { title: true } },
                departments: { select: { name: true } },
                _count: { select: { subordinates: true } },
                kpiList: {
                    select: { 
                        id: true, 
                        category: true, 
                        status: true,
                        session_name: true,
                        year: true,
                        evaluation_no: true,
                        items: true,
                        period_start: true,
                        period_end: true
                    }
                }
            }
        });

        if (!employeeResult) {
            return NextResponse.json({ error: "NOT_FOUND_OR_FORBIDDEN" }, { status: 404 });
        }

        // Map kpiList to kpi_evaluations for frontend compatibility
        const employee = {
            ...employeeResult,
            kpi_evaluations: employeeResult.kpiList
        };
        delete (employee as any).kpiList;

        return NextResponse.json({ ok: true, employee });
    } catch (e: any) {
        console.error("[API/TEAM/KPI/EMPLOYEE] Error:", e.message);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 401 });
        }
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
