import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET() {
    try {
        await requireAdmin();

        const evaluations = await prisma.probation_evaluations.findMany({
            orderBy: { created_at: "desc" },
            include: {
                employee: { 
                    select: { 
                        name: true, 
                        emp_id: true,
                        job_positions: { select: { title: true } },
                        departments: { select: { name: true } }
                    } 
                },
                supervisor: { select: { name: true } }
            }
        });

        return NextResponse.json({ ok: true, list: evaluations });
    } catch (e: any) {
        console.error("[API/ADMIN/PROBATION/LIST] Error:", e);
        return NextResponse.json({ error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
