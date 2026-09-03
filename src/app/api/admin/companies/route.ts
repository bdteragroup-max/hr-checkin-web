import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET() {
    try {
        await requireAdmin();
        const companies = await prisma.company_settings.findMany({
            orderBy: { id: 'asc' }
        });
        return NextResponse.json({ ok: true, list: companies });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
