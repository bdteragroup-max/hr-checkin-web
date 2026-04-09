import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const { id: idStr } = await params;
        const id = Number(idStr);

        const history = await prisma.asset_borrowings.findMany({
            where: { asset_id: id },
            include: {
                employee: {
                    select: { name: true, emp_id: true }
                }
            },
            orderBy: { borrow_date: "desc" }
        });

        return NextResponse.json({ ok: true, history });
    } catch (e: any) {
        console.error("[API/admin/assets/[id]/history] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
