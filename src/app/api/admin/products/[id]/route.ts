import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        const body = await req.json();
        const { product_code, product_name, category, company_name, description, status } = body;

        const updated = await prisma.products.update({
            where: { id },
            data: {
                product_code,
                product_name,
                category: category || null,
                company_name: company_name || null,
                description: description || null,
                status: status || undefined
            }
        });

        return NextResponse.json({ ok: true, data: updated });
    } catch (e: any) {
        console.error("[API/admin/products/[id]] PATCH Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        await prisma.products.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/admin/products/[id]] DELETE Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
