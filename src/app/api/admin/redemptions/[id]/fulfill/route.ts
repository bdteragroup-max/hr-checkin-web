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
        await prisma.$transaction(async (tx) => {
            const updated = await tx.reward_redemptions.updateMany({
                where: { id: redemptionId, status: "pending" }, // prevent double-fulfill
                data: { 
                    status: "fulfilled", 
                    fulfilled_at: new Date(),
                    processed_by: auth.emp.emp_id
                }
            });
            if (updated.count === 0) {
                throw new Error("Already processed or not found");
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Fulfill Redemption Error:", error.message);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fulfill redemption" },
            { status: 400 }
        );
    }
}
