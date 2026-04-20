import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    try {
        const list = await prisma.divisions.findMany({
            orderBy: { name: "asc" },
            include: { _count: { select: { departments: true } } }
        });
        return NextResponse.json({ ok: true, list });
    } catch (e) {
        console.error("GET Divisions Error:", e);
        return NextResponse.json({ error: "DATABASE_ERROR", details: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    try {
        const item = await prisma.divisions.create({
            data: { name: body.name.trim() }
        });
        return NextResponse.json({ ok: true, item });
    } catch (e: any) {
        console.error("POST Divisions Error:", e);
        return NextResponse.json({ error: "Cannot create division", details: e.message || String(e) }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id || !body?.name?.trim()) return NextResponse.json({ error: "ID and Name are required" }, { status: 400 });

    try {
        const item = await prisma.divisions.update({
            where: { id: Number(body.id) },
            data: { name: body.name.trim() }
        });
        return NextResponse.json({ ok: true, item });
    } catch {
        return NextResponse.json({ error: "Cannot update division" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    try {
        await prisma.divisions.delete({
            where: { id: Number(body.id) }
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: "Cannot delete division (may have linked departments)", details: String(e) }, { status: 400 });
    }
}
