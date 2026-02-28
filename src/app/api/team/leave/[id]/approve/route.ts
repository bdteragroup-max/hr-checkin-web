import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const runtime = "nodejs";

type TokenPayload = { emp_id: string; role: "employee" | "admin" };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        let p: TokenPayload;
        try {
            p = verifyToken(token) as TokenPayload;
        } catch {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        const { id } = await params;
        if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

        const leave = await prisma.leave_requests.findUnique({ where: { id } });
        if (!leave) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        if (leave.supervisor_id !== p.emp_id) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        if (leave.status !== "pending_supervisor") {
            return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
        }

        await prisma.leave_requests.update({
            where: { id },
            data: {
                status: "pending_hr",
                supervisor_approved_at: new Date(),
            },
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("team leave approve error:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
