import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET() {
    try {
        await requireAdmin();

        const list = await prisma.kpi_evaluations.findMany({
            include: {
                employee: { 
                    select: { 
                        name: true, 
                        emp_id: true,
                        job_positions: { select: { title: true } },
                        departments: { select: { name: true } }
                    } 
                },
                supervisor: { select: { name: true } },
                items: true
            },
            orderBy: { created_at: "desc" }
        });

        return NextResponse.json({ ok: true, list });
    } catch (e: any) {
        if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
            return NextResponse.json({ error: e.message }, { status: 401 });
        }
        console.error("[API/ADMIN/KPI] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
