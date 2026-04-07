import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const payload = verifyToken(token) as { emp_id: string };

        const borrowings = await prisma.asset_borrowings.findMany({
            where: { 
                emp_id: payload.emp_id,
                status: "borrowed"
            },
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
