import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'; // Prevent caching so new announcements appear immediately

export async function GET() {
    try {
        const announcements = await prisma.announcements.findMany({
            where: { is_active: true },
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                title: true,
                content: true,
                created_at: true,
            }
        });
        
        return NextResponse.json({ ok: true, announcements });
    } catch (error) {
        console.error("Error fetching announcements:", error);
        return NextResponse.json({ ok: false, error: "Failed to fetch announcements" }, { status: 500 });
    }
}
