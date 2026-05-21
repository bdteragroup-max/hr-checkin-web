import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const payload = verifyToken(token);
        if (!payload || !payload.emp_id) {
            return NextResponse.json({ error: "INVALID_TOKEN_PAYLOAD" }, { status: 401 });
        }

        // Fetch all active employees
        const list = await prisma.employees.findMany({
            where: { is_active: true },
            select: {
                emp_id: true, // Needed for React keys
                name: true,
                nickname: true,
                phone_number: true,
                email: true,
                branches: {
                    select: { name: true }
                },
                departments: {
                    select: {
                        name: true,
                        divisions: {
                            select: { name: true }
                        }
                    }
                },
                job_positions: {
                    select: { title: true }
                }
            },
            orderBy: { name: "asc" }
        });

        const formattedList = list.map(emp => ({
            id: emp.emp_id,
            name: emp.name,
            nickname: emp.nickname,
            phone_number: emp.phone_number,
            email: emp.email,
            branch: emp.branches?.name || "—",
            department: emp.departments?.name || "—",
            division: emp.departments?.divisions?.name || "—",
            position: emp.job_positions?.title || "—"
        }));

        return NextResponse.json({ ok: true, list: formattedList });
    } catch (err: any) {
        console.error("[API/DIRECTORY] Error:", err.message);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 401 });
        }
        return NextResponse.json({ error: "INTERNAL_ERROR", message: err.message }, { status: 500 });
    }
}
