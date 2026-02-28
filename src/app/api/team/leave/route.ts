import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const runtime = "nodejs";

type TokenPayload = { emp_id: string; role: "employee" | "admin" };

function jsonSafe<T>(v: T): any {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(jsonSafe);
    if (v && typeof v === "object") {
        const out: any = {};
        for (const [k, val] of Object.entries(v as any)) out[k] = jsonSafe(val);
        return out;
    }
    return v;
}

export async function GET() {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        let p: TokenPayload;
        try {
            p = verifyToken(token) as TokenPayload;
        } catch {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        const list = await prisma.leave_requests.findMany({
            where: { supervisor_id: p.emp_id, status: "pending_supervisor" },
            orderBy: { timestamp: "desc" },
            select: {
                id: true,
                emp_id: true,
                name: true,
                leave_type: true,
                start_at: true,
                end_at: true,
                start_date: true,
                end_date: true,
                days: true,
                reason: true,
                status: true,
                attachment_url: true,
            },
        });

        return NextResponse.json(jsonSafe({ ok: true, list }));
    } catch (e: any) {
        console.error("team leaves GET error:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
