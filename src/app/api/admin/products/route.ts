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

        const products = await prisma.products.findMany({
            where: whereClause,
            include: {
                product_borrowings: {
                    where: { status: { in: ["borrowed", "reserved"] } },
                    include: {
                        employee: { select: { name: true, nickname: true } }
                    }
                }
            },
            orderBy: { product_name: "asc" }
        });

        const formattedProducts = products.map((p: any) => {
            const formattedBorrowings = p.product_borrowings.map((b: any) => {
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
            product_code, product_name, category, company_name, description 
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

        const newProduct = await prisma.products.create({
            data: {
                product_code,
                product_name,
                category: category || null,
                company_name: company_name || null,
                description: description || null,
                status: "available"
            }
        });

        return NextResponse.json({ ok: true, data: newProduct });
    } catch (e: any) {
        console.error("[API/admin/products] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
