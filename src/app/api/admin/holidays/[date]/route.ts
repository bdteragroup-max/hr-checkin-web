import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function parseDateOnly(yyyy_mm_dd: string) {
    return new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
}

export async function DELETE(
    _req: Request,
    ctx: { params: Promise<{ date: string }> } // ✅ params เป็น Promise
) {
    try {
        await requireAdmin();

        const { date: dateStr } = await ctx.params;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
        }

        const date = parseDateOnly(dateStr);

        await prisma.holidays.delete({
            where: { date },
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("holidays DELETE error:", e);
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}