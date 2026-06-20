import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { emp_id } = verifyToken(token);

        const subordinates = await prisma.employees.findMany({
            where: { 
                OR: [
                    { supervisor_id: emp_id },
                    { secondary_supervisor_id: emp_id }
                ],
                is_active: true 
            },
            select: { emp_id: true, name: true, job_positions: true, nickname: true }
        });

        const list = subordinates.map(emp => ({
            ...emp,
            name: emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name
        }));

        return NextResponse.json({ ok: true, subordinates: list });
    } catch (e: any) {
        console.error("GET Subordinates Error:", e);
        return NextResponse.json({ ok: false, error: "SERVER_ERROR", details: e.message }, { status: 500 });
    }
}
