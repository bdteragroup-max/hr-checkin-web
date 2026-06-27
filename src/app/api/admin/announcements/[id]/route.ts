import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const { id } = await params;
        const body = await request.json();
        
        const { title, content, is_active } = body;
        
        const updated = await prisma.announcements.update({
            where: { id: Number(id) },
            data: {
                title,
                content,
                is_active,
                updated_at: new Date()
            }
        });

        return NextResponse.json({ ok: true, announcement: updated });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message || "Failed to update announcement" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const { id } = await params;
        
        await prisma.announcements.delete({
            where: { id: Number(id) }
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message || "Failed to delete announcement" }, { status: 500 });
    }
}
