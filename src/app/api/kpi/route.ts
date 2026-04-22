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
        const empId = decoded.emp_id;

        const list = await prisma.kpi_evaluations.findMany({
            where: { emp_id: empId },
            include: {
                items: true,
                supervisor: { select: { name: true } },
                employee: {
                    include: {
                        _count: {
                            select: { subordinates: true }
                        },
                        job_positions: { select: { title: true } }
                    }
                }
            },
            orderBy: { created_at: "desc" }
        });

        return NextResponse.json({ ok: true, list });
    } catch (e: any) {
        console.error("[API/KPI/LIST] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
