import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

// GET: Fetch all active meeting rooms
export async function GET() {
    try {
        const rooms = await prisma.meeting_rooms.findMany({
            where: { is_active: true },
            orderBy: [{ floor: "asc" }, { name: "asc" }]
        });
        return NextResponse.json(rooms);
    } catch (error: any) {
        console.error("[API/MEETING_ROOMS/GET] Error:", error);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

// POST: Admin manages rooms (Add/Update)
export async function POST(req: Request) {
    try {
        await requireAdmin();
        const body = await req.json();
        const { id, name, floor, capacity, is_active } = body;

        if (!name || floor === undefined) {
            return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
        }

        if (id) {
            // Update existing room
            const updated = await prisma.meeting_rooms.update({
                where: { id: Number(id) },
                data: { name, floor, capacity, is_active }
            });
            return NextResponse.json(updated);
        } else {
            // Create new room
            const created = await prisma.meeting_rooms.create({
                data: { name, floor, capacity, is_active: is_active ?? true }
            });
            return NextResponse.json(created);
        }
    } catch (error: any) {
        if (error.message === "UNAUTHORIZED") {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }
        console.error("[API/MEETING_ROOMS/POST] Error:", error);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
