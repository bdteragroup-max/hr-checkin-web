import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const { status } = await req.json();
        const { id } = await params;

        const claim = await prisma.birthday_claims.update({
            where: { id },
            data: {
                status,
                approved_at: status === 'approved' ? new Date() : null
            }
        });

        return NextResponse.json({ ok: true, claim });
    } catch (e) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
}
