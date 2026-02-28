import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

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

export async function POST(
    _req: Request,
    ctx: { params: Promise<{ id: string }> } // ✅ params เป็น Promise
) {
    try {
        const admin = await requireAdmin();

        const { id } = await ctx.params; // ✅ ต้อง await
        if (!id) return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });

        const updated = await prisma.leave_requests.update({
            where: { id }, // ✅ ของคุณเป็น string (LV-....)
            data: {
                status: "approved",
                approved_by: admin.emp_id,
                approved_at: new Date(), // (มีใน model ตาม log)
            },
            select: { id: true, status: true, approved_by: true, approved_at: true },
        });

        return NextResponse.json(jsonSafe({ ok: true, updated }));
    } catch (e: any) {
        console.error("approve error:", e);
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}