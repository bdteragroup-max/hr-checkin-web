import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const categoryExclude = searchParams.get("category_exclude");
        const includeBorrowed = searchParams.get("include_borrowed") === "true";

        const whereClause: any = {};
        if (!includeBorrowed) {
            whereClause.status = "available";
        }

        if (category) {
            whereClause.category = category;
        } else if (categoryExclude) {
            whereClause.OR = [
                { category: { not: categoryExclude } },
                { category: null }
            ];
        }

        console.log("[API/assets/available] searchParams:", { category, categoryExclude, includeBorrowed });
        
        const now = new Date();
        const finalWhere: any = { ...whereClause };
        if (!includeBorrowed) {
            finalWhere.NOT = {
                asset_borrowings: {
                    some: {
                        status: { in: ["borrowed", "reserved"] },
                        borrow_date: { lte: now },
                        expected_return_date: { gt: now }
                    }
                }
            };
        }

        const availableAssets = await prisma.assets.findMany({
            where: finalWhere,
            include: {
                asset_borrowings: {
                    where: {
                        status: { in: ["borrowed", "reserved"] }
                    },
                    include: {
                        employee: {
                            select: { name: true, nickname: true }
                        }
                    },
                    orderBy: { borrow_date: "asc" }
                }
            },
            orderBy: { name: "asc" }
        });
        return NextResponse.json(availableAssets);
    } catch (e: any) {
        console.error("[API/assets/available] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
