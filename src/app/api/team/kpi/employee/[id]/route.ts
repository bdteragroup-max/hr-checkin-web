import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;
        const { id: targetEmpId } = await params;

        // Verify if the requester is the supervisor of this employee
        const employee = await prisma.employees.findFirst({
            where: {
                emp_id: targetEmpId,
                OR: [
                    { supervisor_id: supervisorId },
                    { secondary_supervisor_id: supervisorId }
                ]
            },
            include: {
                job_positions: { select: { title: true } },
                departments: { select: { name: true } },
                _count: { select: { subordinates: true } },
                kpi_evaluations: {
                    select: { 
                        id: true, 
                        category: true, 
                        status: true,
                        session_name: true,
                        year: true,
                        items: true,
                        period_start: true,
                        period_end: true
                    }
                }
            }
        });

        if (!employee) {
            return NextResponse.json({ error: "NOT_FOUND_OR_FORBIDDEN" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, employee });
    } catch (e: any) {
        console.error("[API/TEAM/KPI/EMPLOYEE] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
