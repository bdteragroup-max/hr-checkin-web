import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await props.params;
        const id = Number(idStr);
        const body = await req.json();
        const { product_code, product_name, category, company_name, description, status, stock } = body;

        await prisma.$executeRaw`
            UPDATE products 
            SET 
                product_code = ${product_code || undefined}, 
                product_name = ${product_name || undefined}, 
                category = ${category || null}, 
                company_name = ${company_name || null}, 
                description = ${description || null}, 
                stock = ${stock !== undefined ? Number(stock) : undefined}, 
                status = ${status || undefined},
                updated_at = NOW()
            WHERE id = ${id}
        `;

        const updated = await prisma.$queryRaw`SELECT * FROM products WHERE id = ${id} LIMIT 1`;


        return NextResponse.json({ ok: true, data: updated });
    } catch (e: any) {
        console.error("[API/admin/products/[id]] PATCH Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await props.params;
        const id = Number(idStr);
        await prisma.products.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/admin/products/[id]] DELETE Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
