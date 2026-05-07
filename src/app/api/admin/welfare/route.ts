import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

import { requireAdmin } from "@/lib/adminAuth";

export async function GET(req: Request) {
    try {
        const admin = await requireAdmin();

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const supervisor_status = searchParams.get("supervisor_status");
        const welfare_type = searchParams.get("type");

        const where: any = {};
        if (status && status !== "all") where.status = status;
        if (supervisor_status && supervisor_status !== "all") where.supervisor_status = supervisor_status;
        if (welfare_type && welfare_type !== "all") where.welfare_type = welfare_type;

        const claims = await prisma.general_welfare_claims.findMany({
            where,
            include: {
                employees: {
                    select: { name: true, nickname: true, emp_id: true }
                }
            },
            orderBy: { created_at: "desc" }
        });

        return NextResponse.json({ ok: true, list: claims });
    } catch (err: any) {
        console.error("[API/ADMIN/WELFARE/GET] Error:", err.message);
        const status = err.message === "UNAUTHORIZED" ? 401 : 500;
        return NextResponse.json({ error: err.message }, { status });
    }
}

export async function PATCH(req: Request) {
    try {
        const admin = await requireAdmin();
        const body = await req.json();
        const { id, status, admin_comment } = body;

        if (!id || !status) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        const updated = await prisma.general_welfare_claims.update({
            where: { id },
            data: {
                status,
                admin_comment: admin_comment || null,
                approved_by: admin.emp_id || "admin",
                approved_at: status === "approved" ? new Date() : null
            },
            include: { employees: true }
        });

        return NextResponse.json({ ok: true, data: updated });
    } catch (err: any) {
        console.error("[API/ADMIN/WELFARE/PATCH] Error:", err.message);
        const status = err.message === "UNAUTHORIZED" ? 401 : 500;
        return NextResponse.json({ error: err.message }, { status });
    }
}
