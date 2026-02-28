import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
    try {
        await requireAdmin();
        const claims = await prisma.birthday_claims.findMany({
            orderBy: { created_at: "desc" }
        });
        return NextResponse.json({ ok: true, claims });
    } catch (e) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
}
