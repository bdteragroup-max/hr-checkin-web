import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
    try {
        const rows = await prisma.holidays.findMany({
            orderBy: { date: "asc" },
            select: { date: true, name: true }
        });
        return NextResponse.json({ ok: true, list: rows.map(r => ({ ...r, date: r.date.toISOString() })) });
    } catch (e) {
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}
