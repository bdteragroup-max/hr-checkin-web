import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await requireAdmin();
        const announcements = await prisma.announcements.findMany({
            orderBy: { created_at: 'desc' }
        });
        return NextResponse.json({ ok: true, announcements });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message || "UNAUTHORIZED" }, { status: 401 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAdmin();
        const body = await request.json();
        
        const { title, content, is_active } = body;
        
        if (!title) {
            return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
        }

        const admin = await prisma.admins.findUnique({
            where: { username: auth.emp_id },
            select: { id: true }
        });

        const newAnnouncement = await prisma.announcements.create({
            data: {
                title,
                content,
                is_active: is_active ?? true,
                created_by: admin?.id || null
            }
        });

        return NextResponse.json({ ok: true, announcement: newAnnouncement });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message || "Failed to create announcement" }, { status: 500 });
    }
}
