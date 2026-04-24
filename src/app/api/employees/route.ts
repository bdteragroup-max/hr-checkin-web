import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const runtime = "nodejs";

export async function GET() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    
    try {
        verifyToken(token);
        const list = await prisma.employees.findMany({
            where: { is_active: true },
            select: { emp_id: true, name: true },
            orderBy: { name: "asc" }
        });
        return NextResponse.json(list);
    } catch (error) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
}
