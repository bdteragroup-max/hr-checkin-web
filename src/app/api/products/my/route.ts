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

        const myBorrowings = await prisma.product_borrowings.findMany({
            where: {
                emp_id: { in: allIds },
                status: { in: ["borrowed", "reserved"] }
            },
            include: {
                product: true,
                employee: { select: { name: true, nickname: true, emp_id: true } }
            },
            orderBy: { borrow_date: "desc" }
        });

        return NextResponse.json(myBorrowings);
    } catch (e: any) {
        console.error("[API/products/my] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
