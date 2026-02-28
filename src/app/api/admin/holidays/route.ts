import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function jsonSafe<T>(v: T): any {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(jsonSafe);
    if (v && typeof v === "object") {
        const out: any = {};
        for (const [k, val] of Object.entries(v as any)) out[k] = jsonSafe(val);
        return out;
    }
    return v;
}

function parseDateOnly(yyyy_mm_dd: string) {
    return new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const year = url.searchParams.get("year");

        const where: any = {};
        if (year) {
            const y = Number(year);
            if (!Number.isNaN(y) && y >= 2000 && y <= 2100) {
                const from = new Date(`${y}-01-01T00:00:00.000Z`);
                const to = new Date(`${y + 1}-01-01T00:00:00.000Z`);
                where.date = { gte: from, lt: to };
            }
        }

        const rows = await prisma.holidays.findMany({
            where,
            orderBy: { date: "asc" },
            select: { date: true, name: true, created_at: true },
        });

        return NextResponse.json(jsonSafe({ ok: true, list: rows }));
    } catch (e: any) {
        console.error("holidays GET error:", e);
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}

export async function POST(req: Request) {
    try {
        await requireAdmin();

        const body = await req.json().catch(() => ({} as any));
        const dateStr = body?.date ? String(body.date) : "";
        const name = body?.name ? String(body.name).trim() : "";

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
        }
        if (!name) {
            return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 });
        }

        const date = parseDateOnly(dateStr);

        const created = await prisma.holidays.create({
            data: {
                date,
                name,
                created_at: new Date(),
            },
            select: { date: true, name: true, created_at: true },
        });

        return NextResponse.json(jsonSafe({ ok: true, created }));
    } catch (e: any) {
        console.error("holidays POST error:", e);
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json(jsonSafe({ ok: false, error: msg }), { status });
    }
}