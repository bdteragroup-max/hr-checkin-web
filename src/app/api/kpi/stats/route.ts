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
        const myId = decoded.emp_id;

        // 1. Employee Alerts: Evaluations waiting for ME (pending_employee)
        const myAlerts = await (prisma as any).kpi_evaluations.count({
            where: {
                emp_id: myId,
                status: "pending_employee"
            }
        });

        // Also check if current month is open and I haven't started (Monthly)
        // BUT only if I already have some KPI records (meaning I'm in the KPI system)
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        let startAlert = 0;
        
        // 1.1 Check if I am even in the KPI system
        const kpiCount = await (prisma as any).kpi_evaluations.count({
            where: { emp_id: myId }
        });

        if (kpiCount > 0 && now.getDate() >= 20) {
            const hasThisMonth = await (prisma as any).kpi_evaluations.findFirst({
                where: {
                    emp_id: myId,
                    category: "MONTHLY",
                    evaluation_no: currentMonth,
                    year: currentYear
                }
            });
            if (!hasThisMonth) startAlert = 1;
        }

        // 2. Supervisor Alerts: Evaluations waiting for my approval (pending_supervisor)
        const teamKpiAlerts = await (prisma as any).kpi_evaluations.count({
            where: {
                supervisor_id: myId,
                status: "pending_supervisor"
            }
        });

        // 3. Probation Alerts: Evaluations waiting for supervisor review
        const teamProbationAlerts = await (prisma as any).probation_evaluations.count({
            where: {
                supervisor_id: myId,
                status: "submitted" // In probation, 'submitted' means waiting for review/HR
            }
        });

        return NextResponse.json({
            ok: true,
            myKpiAlerts: myAlerts + startAlert,
            teamKpiAlerts: teamKpiAlerts,
            teamProbationAlerts: teamProbationAlerts
        });

    } catch (e: any) {
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
