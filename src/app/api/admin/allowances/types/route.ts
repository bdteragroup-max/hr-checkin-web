import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        let company_id = searchParams.get("company_id");
        const emp_id = searchParams.get("emp_id");

        if (!company_id || company_id === "undefined" || company_id === "null" || isNaN(Number(company_id))) {
            if (emp_id) {
                const upper = emp_id.trim().toUpperCase();
                if (upper.startsWith("TE")) company_id = "3";
                else if (upper.startsWith("TP")) company_id = "4";
                else company_id = "2";
            } else {
                company_id = "2"; // Default Tera Group
            }
        }

        const list = await prisma.allowance_types.findMany({
            where: {
                company_id: Number(company_id)
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json({ ok: true, list });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
