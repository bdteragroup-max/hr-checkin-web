import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await requireAdmin();
        const warnings = await prisma.employee_warnings.findMany({
            where: { emp_id: id },
            orderBy: { date: "desc" }
        });
        return NextResponse.json({ ok: true, warnings });
    } catch (e) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await requireAdmin();
        const { date, reason } = await req.json();
        
        const warning = await prisma.employee_warnings.create({
            data: {
                emp_id: id,
                date: new Date(date),
                reason: reason
            }
        });
        
        return NextResponse.json({ ok: true, warning });
    } catch (e) {
        return NextResponse.json({ error: "Error creating warning" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const id = parseInt(searchParams.get("id") || "");
        
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
        
        await prisma.employee_warnings.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: "Error deleting warning" }, { status: 500 });
    }
}
