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

        const availableAssets = await prisma.assets.findMany({
            where: whereClause,
            orderBy: { name: "asc" }
        });
        return NextResponse.json(availableAssets);
    } catch (e: any) {
        console.error("[API/assets/available] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
