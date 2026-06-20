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

export async function GET(request: Request) {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const statusQuery = searchParams.get("status") || "pending"; // 'pending' or 'history'

    try {
        let whereClause: any = {};
        let orderByClause: any = {};

        if (statusQuery === "pending") {
            whereClause.status = "pending";
            orderByClause.redeemed_at = "asc"; // Oldest first
        } else {
            whereClause.status = { in: ["fulfilled", "rejected"] };
            orderByClause.redeemed_at = "desc"; // Newest first for history
        }

        const redemptions = await prisma.reward_redemptions.findMany({
            where: whereClause,
            orderBy: orderByClause,
            include: {
                employee: {
                    select: { name: true, emp_id: true }
                },
                reward: {
                    select: { name: true, required_coins: true, required_coin_type: true }
                },
                processor: {
                    select: { name: true }
                }
            }
        });

        return NextResponse.json({ success: true, redemptions });
    } catch (error: any) {
        console.error("GET Admin Redemptions Error:", error);
        return NextResponse.json({ error: "Failed to fetch redemptions" }, { status: 500 });
    }
}
