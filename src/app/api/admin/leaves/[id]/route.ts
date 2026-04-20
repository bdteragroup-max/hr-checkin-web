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

        // Hard delete the leave request as per "removing results" request
        await prisma.leave_requests.delete({
            where: { id }
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("DELETE leave error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
