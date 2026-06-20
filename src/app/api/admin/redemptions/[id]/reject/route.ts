import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function requireAdmin() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    try {
        const payload = verifyToken(token) as { emp_id: string };
        const emp = await prisma.employees.findUnique({
            where: { emp_id: payload.emp_id },
            include: { departments: true }
        });
        if (!emp || !emp.is_active) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
        return { emp };
    } catch {
        return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const idStr = (await params).id;
    const redemptionId = parseInt(idStr, 10);
    if (isNaN(redemptionId)) {
        return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    try {
        const body = await request.json();
        if (!body.cancelled_reason || typeof body.cancelled_reason !== "string" || body.cancelled_reason.trim() === "") {
            return NextResponse.json({ success: false, error: "Cancellation reason is required" }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Find redemption to ensure it is PENDING
            const redemption = await tx.reward_redemptions.findUnique({
                where: { id: redemptionId }
            });

            if (!redemption || redemption.status !== "pending") {
                throw new Error("Already processed or not found");
            }

            // 2. Update Status and Reason atomically
            const updatedStatus = await tx.reward_redemptions.updateMany({
                where: { id: redemptionId, status: "pending" },
                data: {
                    status: "rejected",
                    cancelled_reason: body.cancelled_reason,
                    fulfilled_at: new Date(),
                    processed_by: auth.emp.emp_id
                }
            });

            if (updatedStatus.count === 0) {
                throw new Error("Already processed or not found");
            }

            // 3. Return stock to reward
            await tx.rewards.update({
                where: { id: redemption.reward_id },
                data: { stock_quantity: { increment: redemption.quantity } }
            });

            // 4. Return coins to employee
            if (redemption.coin_type_id && redemption.points_spent > 0) {
                await tx.employee_coins.updateMany({
                    where: { emp_id: redemption.emp_id, coin_type_id: redemption.coin_type_id },
                    data: { balance: { increment: redemption.points_spent } }
                });

                // 5. Create ledger entry for the refund
                await tx.coin_ledgers.create({
                    data: {
                        emp_id: redemption.emp_id,
                        coin_type_id: redemption.coin_type_id,
                        amount: redemption.points_spent,
                        transaction_type: "REFUND",
                        source_key: `refund:redemption:${redemption.id}`, // unique constraint prevents duplicate refunds
                        ref_id: String(redemption.id),
                        description: `Refund for rejected redemption #${redemption.id}`
                    }
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Reject Redemption Error:", error.message);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to reject redemption" },
            { status: 400 }
        );
    }
}
