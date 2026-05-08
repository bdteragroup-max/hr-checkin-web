import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { emp_id } = await requireAdmin();

        const admin: any = await prisma.admins.findUnique({
            where: { username: emp_id },
            select: {
                username: true,
                full_name: true,
                last_login: true
            }
        });

        if (!admin) {
            return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }

        // Fetch role using raw query to bypass generated client limitations
        const roleResult: any[] = await prisma.$queryRaw`SELECT role FROM admins WHERE username = ${emp_id} LIMIT 1`;
        admin.role = roleResult[0]?.role || "SUPER_ADMIN";

        return NextResponse.json({
            ok: true,
            admin
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "UNAUTHORIZED" }, { status: 401 });
    }
}
