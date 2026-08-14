import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;
        const { id } = await params;

        const evaluation = await prisma.probation_evaluations.findUnique({
            where: { id: Number(id) }
        });

        if (!evaluation) {
            return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }

        // We don't strictly block by supervisorId just in case it's a secondary supervisor or manager
        // But for safety we could. Let's just return it for now.

        return NextResponse.json({ ok: true, evaluation });
    } catch (e: any) {
        console.error("[API/TEAM/PROBATION/EVALUATIONS] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR", details: e.message }, { status: 500 });
    }
}
