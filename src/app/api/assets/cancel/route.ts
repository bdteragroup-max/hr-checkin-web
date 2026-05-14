import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function POST(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const payload = verifyToken(token) as { emp_id: string; role: string };
        const body = await req.json();
        const { borrowing_id } = body;

        if (!borrowing_id) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        const isAdmin = payload.role === "admin" || payload.role === "SUPER_ADMIN" || payload.role === "WAREHOUSE_MANAGER";

        // Find the borrowing record
        const borrowing = await prisma.asset_borrowings.findUnique({
            where: { id: Number(borrowing_id) },
            include: { assets: true }
        });

        if (!borrowing) {
            return NextResponse.json({ error: "BORROWING_NOT_FOUND" }, { status: 404 });
        }

        const isOwner = borrowing.emp_id === payload.emp_id;
        let isAuthorized = isOwner || isAdmin;

        if (!isAuthorized) {
            const employee = await prisma.employees.findUnique({
                where: { emp_id: borrowing.emp_id },
                select: { supervisor_id: true, secondary_supervisor_id: true }
            });
            if (employee && (employee.supervisor_id === payload.emp_id || employee.secondary_supervisor_id === payload.emp_id)) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        if (borrowing.status !== "reserved" && borrowing.status !== "borrowed") {
            return NextResponse.json({ error: "CANNOT_CANCEL_COMPLETED_BOOKING" }, { status: 400 });
        }

        // Process cancellation
        await prisma.$transaction(async (tx) => {
            await tx.asset_borrowings.update({
                where: { id: Number(borrowing_id) },
                data: { status: "cancelled", updated_at: new Date() }
            });

            if (borrowing.status === "borrowed" || borrowing.assets.status === "borrowed") {
                const now = new Date();
                const otherActiveBorrowing = await tx.asset_borrowings.findFirst({
                    where: {
                        asset_id: borrowing.asset_id,
                        id: { not: Number(borrowing_id) },
                        status: { in: ["borrowed", "reserved"] },
                        borrow_date: { lte: now },
                        expected_return_date: { gt: now }
                    }
                });

                if (!otherActiveBorrowing) {
                    await tx.assets.update({
                        where: { id: borrowing.asset_id },
                        data: { status: "available" }
                    });
                }
            }
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/assets/cancel] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
