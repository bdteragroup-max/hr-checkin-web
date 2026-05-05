import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const borrowings = await prisma.asset_borrowings.findMany({
            where: {
                status: { in: ["borrowed", "reserved"] }
            },
            include: {
                assets: true
            },
            orderBy: { created_at: "desc" }
        });

        return NextResponse.json(borrowings.map(b => ({
            id: b.id,
            asset: b.assets.name,
            status: b.status,
            start: b.borrow_date,
            end: b.expected_return_date,
            created_at: b.created_at
        })));
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
