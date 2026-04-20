import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const list = await prisma.job_positions.findMany({
        orderBy: [{ order_index: "asc" }, { title: "asc" }],
        include: {
            departments: { include: { divisions: true } },
            parent: { select: { title: true } },
            employees: {
                where: { is_active: true },
                select: { name: true, emp_id: true }
            }
        }
    });
    return NextResponse.json({ ok: true, list });
}

export async function POST(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    try {
        const item = await prisma.job_positions.create({
            data: {
                title: body.title.trim(),
                department_id: body.department_id ? Number(body.department_id) : null,
                parent_id: body.parent_id ? Number(body.parent_id) : null,
                node_type: body.node_type || "staff",
                order_index: Number(body.order_index || 0),
                is_ot_eligible: Boolean(body.is_ot_eligible ?? true)
            }
        });
        return NextResponse.json({ ok: true, item });
    } catch (e) {
        return NextResponse.json({ error: "Cannot create position", details: String(e) }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id || !body?.title?.trim()) return NextResponse.json({ error: "ID and Title are required" }, { status: 400 });

    try {
        const item = await prisma.job_positions.update({
            where: { id: Number(body.id) },
            data: {
                title: body.title.trim(),
                department_id: body.department_id ? Number(body.department_id) : null,
                parent_id: body.parent_id ? Number(body.parent_id) : null,
                node_type: body.node_type || "staff",
                order_index: Number(body.order_index || 0),
                is_ot_eligible: Boolean(body.is_ot_eligible ?? true)
            }
        });
        return NextResponse.json({ ok: true, item });
    } catch (e) {
        return NextResponse.json({ error: "Cannot update position", details: String(e) }, { status: 500 });
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
    } catch (e) {
        return NextResponse.json({ error: "Cannot delete position (may have linked children or employees)", details: String(e) }, { status: 400 });
    }
}
