import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAdmin();
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ ok: false, error: "Missing ID" }, { status: 400 });
        }

        await prisma.ot_requests.delete({
            where: { id: Number(id) }
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("DELETE OT error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
