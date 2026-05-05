import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token" });

        const payload = verifyToken(token) as { emp_id: string };
        const employee = await prisma.employees.findUnique({
            where: { emp_id: payload.emp_id }
        });

        return NextResponse.json({
            emp_id: payload.emp_id,
            name: employee?.name,
            nickname: employee?.nickname
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
