import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    try {
        const list = await prisma.departments.findMany({
            orderBy: { name: "asc" },
            include: { 
                divisions: { select: { name: true } },
                _count: { select: { job_positions: true, employees: true } } 
            }
        });
        return NextResponse.json({ ok: true, list });
    } catch (e) {
        console.error("GET Departments Error:", e);
        return NextResponse.json({ error: "DATABASE_ERROR", details: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    try {
        const item = await prisma.departments.create({
            data: { 
                name: body.name.trim(),
                division_id: body.division_id ? Number(body.division_id) : null
            }
        });
        return NextResponse.json({ ok: true, item });
    } catch {
        return NextResponse.json({ error: "Cannot create department" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id || !body?.name?.trim()) return NextResponse.json({ error: "ID and Name are required" }, { status: 400 });

    try {
        const item = await prisma.departments.update({
            where: { id: Number(body.id) },
            data: { 
                name: body.name.trim(),
                division_id: body.division_id ? Number(body.division_id) : null
            }
        });
        return NextResponse.json({ ok: true, item });
    } catch {
        return NextResponse.json({ error: "Cannot update department" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    try {
        await prisma.departments.delete({
            where: { id: Number(body.id) }
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: "Cannot delete department (may have linked positions/employees)", details: String(e) }, { status: 400 });
    }
}
