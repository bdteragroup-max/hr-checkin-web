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

        // 1. Find subordinates
        const subordinates = await prisma.employees.findMany({
            where: {
                OR: [
                    { supervisor_id: payload.emp_id },
                    { secondary_supervisor_id: payload.emp_id }
                ]
            },
            select: { emp_id: true }
        });
        const subIds = subordinates.map(s => s.emp_id);
        const allIds = [payload.emp_id, ...subIds];

        const whereClause: any = { 
            emp_id: { in: allIds }, 
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
                assets: true,
                employee: { select: { name: true, nickname: true, emp_id: true } }
            },
            orderBy: { borrow_date: "desc" }
        });

        return NextResponse.json(borrowings);
    } catch (e: any) {
        console.error("[API/assets/my] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
