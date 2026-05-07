import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const payload = verifyToken(token);
        if (!payload || !payload.emp_id) {
            return NextResponse.json({ error: "INVALID_TOKEN_PAYLOAD" }, { status: 401 });
        }

        const emp = await prisma.employees.findUnique({ where: { emp_id: payload.emp_id } });
        if (!emp) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 401 });

        const subsCount = await prisma.employees.count({ where: { supervisor_id: emp.emp_id } });
        const publishedPayslipCount = await prisma.monthly_payroll_data.count({
            where: { 
                emp_id: {
                    equals: payload.emp_id,
                    mode: 'insensitive'
                }, 
                is_published: true 
            }
        });

        return NextResponse.json({
            emp_id: emp.emp_id,
            name: emp.name,
            branch_id: emp.branch_id,
            is_supervisor: subsCount > 0,
            base_salary: Number(emp.base_salary),
            birth_date: emp.birth_date,
            hire_date: emp.hire_date,
            gender: emp.gender,
            line_user_id: emp.line_user_id,
            is_checkin_exempt: emp.is_checkin_exempt,
            has_published_payslips: publishedPayslipCount > 0
        });
    } catch (err: any) {
        console.error("[API/ME] Error:", err.message);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 401 });
        }
        return NextResponse.json({ error: "INTERNAL_ERROR", message: err.message }, { status: 500 });
    }
}
