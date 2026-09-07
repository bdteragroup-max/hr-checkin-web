import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminOrSupervisor } from "@/lib/adminAuth";
import { cookies } from "next/headers";

async function authenticateAdmin() {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get("admin_token")?.value;
    const userToken = cookieStore.get("token")?.value;

    if (adminToken) {
        try {
            const admin = await requireAdmin();
            return { ok: true as const, username: admin.emp_id, role: admin.role };
        } catch {}
    }

    if (userToken) {
        try {
            const auth = await requireAdminOrSupervisor();
            return { ok: true as const, username: auth.username, role: auth.role };
        } catch {}
    }

    return { ok: false as const, error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
}

export async function GET(request: Request) {
    const auth = await authenticateAdmin();
    if (!auth.ok) return auth.error;

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
                    select: { name: true, required_coins: true, required_coin_type: true, costs: true }
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
