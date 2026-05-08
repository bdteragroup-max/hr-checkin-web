import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");

        const whereClause: any = { status: "available" };
        if (category) {
            whereClause.category = category;
        }

        const now = new Date();
        const availableProducts = await prisma.products.findMany({
            where: {
                ...whereClause,
                // Exclude products that have an active borrowing right now
                NOT: {
                    product_borrowings: {
                        some: {
                            status: { in: ["borrowed", "reserved"] },
                            borrow_date: { lte: now },
                            expected_return_date: { gt: now }
                        }
                    }
                }
            },
            include: {
                product_borrowings: {
                    where: {
                        status: { in: ["borrowed", "reserved"] },
                        expected_return_date: { gt: now }
                    },
                    include: {
                        employee: {
                            select: { name: true, nickname: true }
                        }
                    },
                    orderBy: { borrow_date: "asc" },
                    take: 3
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
