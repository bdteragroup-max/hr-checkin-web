import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const runtime = "nodejs";

// GET: Fetch bookings for a specific period
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const start = url.searchParams.get("start");
        const end = url.searchParams.get("end");
        const roomId = url.searchParams.get("roomId");

        console.log(`[API/BOOKINGS/GET] start=${start}, end=${end}, roomId=${roomId}`);

        if (!start || !end) {
            console.error("[API/BOOKINGS/GET] Missing dates");
            return NextResponse.json({ error: "MISSING_DATES", message: "Start and end dates are required." }, { status: 400 });
        }

        const bookings = await prisma.room_bookings.findMany({
            where: {
                start_time: { gte: new Date(start) },
                end_time: { lte: new Date(end) },
                ...(roomId ? { room_id: Number(roomId) } : {}),
                status: "approved"
            },
            include: {
                employee: {
                    select: { name: true, emp_id: true }
                },
                room: {
                    select: { name: true, floor: true }
                }
            },
            orderBy: { start_time: "asc" }
        });

        return NextResponse.json(bookings);
    } catch (error: any) {
        console.error("[API/BOOKINGS/GET] Error:", error);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

// POST: Create a new booking
export async function POST(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const emp_id = decoded.emp_id;

        const body = await req.json();
        const { room_id, start_time, end_time, purpose } = body;

        if (!room_id) {
            return NextResponse.json({ error: "MISSING_ROOM", message: "Please select a meeting room." }, { status: 400 });
        }
        if (!start_time || !end_time) {
            return NextResponse.json({ error: "MISSING_TIME", message: "Please select both start and end times." }, { status: 400 });
        }

        const start = new Date(start_time);
        const end = new Date(end_time);

        if (start >= end) {
            return NextResponse.json({ error: "INVALID_TIME_RANGE", message: "End time must be after start time." }, { status: 400 });
        }

        // --- OVERLAP CHECK ---
        const overlap = await prisma.room_bookings.findFirst({
            where: {
                room_id: Number(room_id),
                status: "approved",
                OR: [
                    {
                        AND: [
                            { start_time: { lte: start } },
                            { end_time: { gt: start } }
                        ]
                    },
                    {
                        AND: [
                            { start_time: { lt: end } },
                            { end_time: { gte: end } }
                        ]
                    },
                    {
                        AND: [
                            { start_time: { gte: start } },
                            { end_time: { lte: end } }
                        ]
                    }
                ]
            }
        });

        if (overlap) {
            return NextResponse.json({ 
                error: "OVERLAP", 
                message: "This room is already booked for the selected time slot." 
            }, { status: 409 });
        }

        const booking = await prisma.room_bookings.create({
            data: {
                room_id: Number(room_id),
                emp_id,
                start_time: start,
                end_time: end,
                purpose,
                status: "approved"
            }
        });

        return NextResponse.json(booking);
    } catch (error: any) {
        console.error("[API/BOOKINGS/POST] Error:", error);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

// DELETE: Cancel a booking
export async function DELETE(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const emp_id = decoded.emp_id;
        const isAdmin = decoded.role === "admin";

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

        const booking = await prisma.room_bookings.findUnique({
            where: { id: Number(id) }
        });

        if (!booking) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        // Only owner or admin can cancel
        if (booking.emp_id !== emp_id && !isAdmin) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        await prisma.room_bookings.update({
            where: { id: Number(id) },
            data: { status: "cancelled" }
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("[API/BOOKINGS/DELETE] Error:", error);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
