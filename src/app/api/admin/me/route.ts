import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const auth = await requireAdminOrSupervisor();

        if (!auth.isSupervisorOnly) {
            const admin: any = await prisma.admins.findUnique({
                where: { username: auth.username },
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
            const roleResult: any[] = await prisma.$queryRaw`SELECT role FROM admins WHERE username = ${auth.username} LIMIT 1`;
            admin.role = roleResult[0]?.role || "SUPER_ADMIN";

            return NextResponse.json({
                ok: true,
                admin
            });
        } else {
            // It's a supervisor using employee token
            const emp = await prisma.employees.findUnique({
                where: { emp_id: auth.emp_id },
                select: { emp_id: true, name: true, nickname: true }
            });
            return NextResponse.json({
                ok: true,
                admin: {
                    username: emp?.emp_id,
                    full_name: emp?.nickname ? `${emp.name} (${emp.nickname})` : emp?.name,
                    role: "SUPERVISOR"
                }
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "UNAUTHORIZED" }, { status: 401 });
    }
}
