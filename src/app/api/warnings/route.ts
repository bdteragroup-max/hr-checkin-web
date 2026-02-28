import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || !payload.emp_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const warnings = await prisma.employee_warnings.findMany({
            where: { emp_id: payload.emp_id },
            orderBy: { date: 'desc' },
            select: {
                id: true,
                date: true,
                reason: true,
                created_at: true
            }
        });

        return NextResponse.json({ ok: true, warnings });
    } catch (error) {
        console.error("Fetch warnings error:", error);
        return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
    }
}
