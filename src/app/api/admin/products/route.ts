import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");

        const whereClause: any = {};
        if (category) {
            whereClause.category = category;
        }

        const products: any[] = await prisma.$queryRaw`
            SELECT id, product_code, product_name, category, company_name, description, status, stock 
            FROM products 
            ORDER BY product_name ASC
        `;

        // Manually fetch borrowings since include won't work with queryRaw
        const allBorrowings = await prisma.product_borrowings.findMany({
            where: { status: { in: ["borrowed", "reserved"] } },
            include: {
                employee: { select: { name: true, nickname: true } }
            }
        });

        const formattedProducts = products.map((p: any) => {
            const productBorrowings = allBorrowings.filter(b => b.product_id === p.id);
            const formattedBorrowings = productBorrowings.map((b: any) => {
                const nickname = b.employee?.nickname;
                let finalName = b.employee?.name || "";
                if (nickname && !finalName.includes(`(${nickname})`)) {
                    finalName = `${finalName} (${nickname})`;
                }
                return {
                    ...b,
                    employee: b.employee ? {
                        ...b.employee,
                        name: finalName
                    } : null
                };
            });
            return {
                ...p,
                product_borrowings: formattedBorrowings
            };
        });

        return NextResponse.json(formattedProducts);
    } catch (e: any) {
        console.error("[API/admin/products] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { 
            product_code, product_name, category, company_name, description, stock 
        } = body;

        if (!product_code || !product_name) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        const existing = await prisma.products.findUnique({
            where: { product_code }
        });

        if (existing) {
            return NextResponse.json({ error: "PRODUCT_CODE_ALREADY_EXISTS" }, { status: 400 });
        }

        await prisma.$executeRaw`
            INSERT INTO products (product_code, product_name, category, company_name, description, stock, status, created_at, updated_at)
            VALUES (
                ${product_code}, 
                ${product_name}, 
                ${category || null}, 
                ${company_name || null}, 
                ${description || null}, 
                ${stock !== undefined ? Number(stock) : 50}, 
                'available',
                NOW(),
                NOW()
            )
        `;

        const newProduct = await prisma.$queryRaw`SELECT * FROM products WHERE product_code = ${product_code} LIMIT 1`;


        return NextResponse.json({ ok: true, data: newProduct });
    } catch (e: any) {
        console.error("[API/admin/products] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
