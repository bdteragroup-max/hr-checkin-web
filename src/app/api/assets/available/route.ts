import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const categoryExclude = searchParams.get("category_exclude");

        const whereClause: any = { status: "available" };
        if (category) {
            whereClause.category = category;
        } else if (categoryExclude) {
            whereClause.category = { not: categoryExclude };
        }

        const now = new Date();
        const availableAssets = await prisma.assets.findMany({
            where: {
                ...whereClause,
                NOT: {
                    asset_borrowings: {
                        some: {
                            status: { in: ["borrowed", "reserved"] },
                            borrow_date: { lte: now },
                            expected_return_date: { gte: now }
                        }
                    }
                }
            },
            include: {
                asset_borrowings: {
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
            orderBy: { name: "asc" }
        });
        return NextResponse.json(availableAssets);
    } catch (e: any) {
        console.error("[API/assets/available] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
