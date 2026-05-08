import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const includeBorrowed = searchParams.get("include_borrowed") === "true";

        const whereClause: any = {};
        if (!includeBorrowed) {
            whereClause.status = "available";
        }
        
        if (category) {
            whereClause.category = category;
        }

        const now = new Date();
        
        // Final where clause
        const finalWhere: any = { ...whereClause };
        if (!includeBorrowed) {
            finalWhere.NOT = {
                product_borrowings: {
                    some: {
                        status: { in: ["borrowed", "reserved"] },
                        borrow_date: { lte: now },
                        expected_return_date: { gt: now }
                    }
                }
            };
        }

        const availableProducts = await prisma.products.findMany({
            where: finalWhere,
            include: {
                product_borrowings: {
                    where: {
                        status: { in: ["borrowed", "reserved"] },
                        borrow_date: { lte: now },
                        expected_return_date: { gt: now }
                    },
                    include: {
                        employee: {
                            select: { name: true, nickname: true }
                        }
                    },
                    orderBy: { borrow_date: "asc" }
                }
            },
            orderBy: { product_name: "asc" }
        });
        return NextResponse.json(availableProducts);
    } catch (e: any) {
        console.error("[API/products/available] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
