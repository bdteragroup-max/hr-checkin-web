import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const list = await prisma.job_positions.findMany({
        orderBy: [{ department_id: "asc" }, { title: "asc" }],
        include: {
            departments: true,
            _count: { select: { employees: true } }
        }
    });
    return NextResponse.json({ ok: true, list });
}

export async function POST(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.title?.trim() || !body?.department_id)
        return NextResponse.json({ error: "Title and Department are required" }, { status: 400 });

    try {
        const item = await prisma.job_positions.create({
            data: {
                title: body.title.trim(),
                department_id: Number(body.department_id),
                is_ot_eligible: Boolean(body.is_ot_eligible ?? true)
            },
            include: { departments: true }
        });
        return NextResponse.json({ ok: true, item });
    } catch {
        return NextResponse.json({ error: "Cannot create position" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id || !body?.title?.trim() || !body?.department_id)
        return NextResponse.json({ error: "ID, Title, and Department are required" }, { status: 400 });

    try {
        const item = await prisma.job_positions.update({
            where: { id: Number(body.id) },
            data: {
                title: body.title.trim(),
                department_id: Number(body.department_id),
                is_ot_eligible: Boolean(body.is_ot_eligible ?? true)
            },
            include: { departments: true }
        });
        return NextResponse.json({ ok: true, item });
    } catch {
        return NextResponse.json({ error: "Cannot update position" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    try {
        await prisma.job_positions.delete({
            where: { id: Number(body.id) }
        });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Cannot delete position (may have linked employees)" }, { status: 400 });
    }
}
