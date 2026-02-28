import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const payload = verifyToken(token);

    const emp = await prisma.employees.findUnique({ where: { emp_id: payload.emp_id } });

    if (!emp) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const subsCount = await prisma.employees.count({ where: { supervisor_id: emp.emp_id } });

    return NextResponse.json({
        emp_id: emp.emp_id,
        name: emp.name,
        branch_id: emp.branch_id,
        is_supervisor: subsCount > 0,
        base_salary: Number(emp.base_salary),
        birth_date: emp.birth_date
    });
}
