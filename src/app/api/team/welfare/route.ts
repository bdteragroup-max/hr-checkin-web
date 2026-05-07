import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function getAuth() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch {
        return null;
    }
}

export async function GET() {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        // Find claims of employees supervised by the current user
        const claims = await prisma.general_welfare_claims.findMany({
            where: {
                employees: {
                    supervisor_id: user.emp_id
                }
            },
            include: {
                employees: {
                    select: { name: true, nickname: true, emp_id: true }
                }
            },
            orderBy: { created_at: "desc" }
        });

        return NextResponse.json({ ok: true, list: claims });
    } catch (err: any) {
        console.error("[API/TEAM/WELFARE] Error:", err.message);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const body = await req.json();
        const { id, status, remark } = body; // status: approved/rejected

        if (!id || !status) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        const claim = await prisma.general_welfare_claims.findUnique({
            where: { id },
            include: { employees: true }
        });

        if (!claim || claim.employees.supervisor_id !== user.emp_id) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const updated = await prisma.general_welfare_claims.update({
            where: { id },
            data: {
                supervisor_status: status,
                supervisor_approved_by: user.name || user.emp_id,
                supervisor_approved_at: new Date(),
                remark: remark ? `${claim.remark || ""}\n[Supervisor]: ${remark}` : claim.remark
            }
        });

        return NextResponse.json({ ok: true, data: updated });
    } catch (err: any) {
        console.error("[API/TEAM/WELFARE/PATCH] Error:", err.message);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
