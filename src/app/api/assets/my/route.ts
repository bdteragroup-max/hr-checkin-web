import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const categoryExclude = searchParams.get("category_exclude");

        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const payload = verifyToken(token) as { emp_id: string };

        const whereClause: any = { 
            emp_id: payload.emp_id, 
            status: { in: ["borrowed", "reserved"] } 
        };
        if (category) {
            whereClause.assets = { category };
        } else if (categoryExclude) {
            whereClause.assets = { category: { not: categoryExclude } };
        }

        const borrowings = await prisma.asset_borrowings.findMany({
            where: whereClause,
            include: {
                assets: true
            },
            orderBy: { borrow_date: "desc" }
        });

        return NextResponse.json(borrowings);
    } catch (e: any) {
        console.error("[API/assets/my] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
