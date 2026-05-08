import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

        const history = await prisma.product_borrowings.findMany({
            where: { product_id: Number(id) },
            include: {
                employee: {
                    select: { name: true, nickname: true }
                }
            },
            orderBy: { borrow_date: "desc" }
        });

        return NextResponse.json({ ok: true, history });
    } catch (e: any) {
        console.error("[API/products/history] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
