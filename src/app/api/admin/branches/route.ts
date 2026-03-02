import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    try {
        const list = await prisma.branches.findMany({
            orderBy: { name: "asc" },
            include: { _count: { select: { employees: true } } }
        });
        return NextResponse.json({ ok: true, list });
    } catch (e) {
        return NextResponse.json({ error: "Cannot fetch branches", details: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id || !body?.name) {
        return NextResponse.json({ error: "ID and Name are required" }, { status: 400 });
    }

    try {
        const item = await prisma.branches.create({
            data: {
                id: body.id.trim(),
                name: body.name.trim(),
                center_lat: body.center_lat || 0,
                center_lon: body.center_lon || 0,
                radius_m: parseInt(body.radius_m) || 200,
            }
        });
        return NextResponse.json({ ok: true, item });
    } catch (e) {
        return NextResponse.json({ error: "Cannot create branch", details: String(e) }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id || !body?.name) {
        return NextResponse.json({ error: "ID and Name are required" }, { status: 400 });
    }

    try {
        const item = await prisma.branches.update({
            where: { id: body.id },
            data: {
                name: body.name.trim(),
                center_lat: body.center_lat,
                center_lon: body.center_lon,
                radius_m: parseInt(body.radius_m),
                updated_at: new Date(),
            }
        });
        return NextResponse.json({ ok: true, item });
    } catch (e) {
        return NextResponse.json({ error: "Cannot update branch", details: String(e) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    try {
        await prisma.branches.delete({
            where: { id: body.id }
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: "Cannot delete branch (may have linked employees)", details: String(e) }, { status: 400 });
    }
}
