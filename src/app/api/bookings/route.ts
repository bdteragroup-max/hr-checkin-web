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
                start_time: { lt: new Date(end) },
                end_time: { gt: new Date(start) },
                ...(roomId ? { room_id: Number(roomId) } : {}),
                status: "approved"
            },
            include: {
                employee: {
                    select: { name: true, emp_id: true }
                },
                room: {
                    select: { name: true, floor: true }
                },
                attendees: {
                    include: {
                        employee: {
                            select: { name: true, emp_id: true }
                        }
                    }
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
        const { room_id, start_time, end_time, purpose, attendee_ids } = body;

        console.log("[API/BOOKINGS/POST] Data:", { room_id, start_time, end_time, attendee_ids });

        if (!room_id || isNaN(Number(room_id))) {
            return NextResponse.json({ error: "MISSING_ROOM", message: "Please select a meeting room." }, { status: 400 });
        }
        if (!start_time || !end_time) {
            return NextResponse.json({ error: "MISSING_TIME", message: "Please select both start and end times." }, { status: 400 });
        }

        const start = new Date(start_time.includes("Z") || start_time.includes("+") ? start_time : `${start_time}+07:00`);
        const end = new Date(end_time.includes("Z") || end_time.includes("+") ? end_time : `${end_time}+07:00`);

        if (start >= end) {
            return NextResponse.json({ error: "INVALID_TIME_RANGE", message: "End time must be after start time." }, { status: 400 });
        }

        // --- OVERLAP CHECK ---
        const overlap = await prisma.room_bookings.findFirst({
            where: {
                room_id: Number(room_id),
                status: "approved",
                start_time: { lt: end },
                end_time: { gt: start }
            }
        });

        if (overlap) {
            return NextResponse.json({ 
                error: "OVERLAP", 
                message: "This room is already booked for the selected time slot." 
            }, { status: 409 });
        }

        // Verify all attendees exist to avoid foreign key errors
        if (attendee_ids && attendee_ids.length > 0) {
            const existingEmployees = await prisma.employees.findMany({
                where: { emp_id: { in: attendee_ids } },
                select: { emp_id: true }
            });
            const existingIds = existingEmployees.map(e => e.emp_id);
            const invalidIds = attendee_ids.filter((id: string) => !existingIds.includes(id));
            
            if (invalidIds.length > 0) {
                return NextResponse.json({ 
                    error: "INVALID_ATTENDEES", 
                    message: `Invalid employee IDs: ${invalidIds.join(", ")}` 
                }, { status: 400 });
            }
        }

        console.log("[API/BOOKINGS/POST] Creating booking in Prisma...");
        const booking = await prisma.room_bookings.create({
            data: {
                room_id: Number(room_id),
                emp_id,
                start_time: start,
                end_time: end,
                purpose,
                status: "approved",
                attendees: {
                    create: (attendee_ids || []).map((id: string) => ({
                        emp_id: id
                    }))
                }
            },
            include: {
                employee: true,
                room: true,
                attendees: {
                    include: { employee: true }
                }
            }
        });

        // --- LINE NOTIFICATION ---
        try {
            const { sendMeetingBookingNotification } = await import("@/utils/lineMessaging");
            const attendeeNames = booking.attendees.map(a => a.employee.name);
            const attendeeLineIds = booking.attendees
                .map(a => a.employee.line_user_id)
                .filter(id => !!id) as string[];

            const startTimeStr = new Date(booking.start_time).toLocaleString("th-TH", { 
                timeZone: "Asia/Bangkok", 
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit' 
            });
            const endTimeStr = new Date(booking.end_time).toLocaleString("th-TH", { 
                timeZone: "Asia/Bangkok", 
                hour: '2-digit', minute: '2-digit' 
            });

            await sendMeetingBookingNotification({
                roomName: booking.room.name,
                floor: booking.room.floor,
                startTime: startTimeStr,
                endTime: endTimeStr,
                purpose: booking.purpose || "-",
                bookerName: booking.employee.name,
                attendees: attendeeNames
            }, attendeeLineIds);
        } catch (error) {
            console.error("[API/BOOKINGS/POST] Notification failed:", error);
        }

        return NextResponse.json(booking);
    } catch (error: any) {
        console.error("[API/BOOKINGS/POST] Error:", error);
        return NextResponse.json({ 
            error: "INTERNAL_ERROR", 
            message: error.message || "An unexpected error occurred." 
        }, { status: 500 });
    }
}

// DELETE: Cancel a booking
export async function DELETE(req: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const adminToken = cookieStore.get("admin_token")?.value;

    if (!token && !adminToken) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        let emp_id: string | undefined;
        let isAdmin = false;

        if (adminToken) {
            try {
                const decoded = verifyToken(adminToken);
                if (decoded.role === "admin") isAdmin = true;
            } catch {}
        }

        if (!isAdmin && token) {
            const decoded = verifyToken(token);
            emp_id = decoded.emp_id;
        }

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

// PATCH: Update meeting booking details
export async function PATCH(req: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const adminToken = cookieStore.get("admin_token")?.value;

    if (!token && !adminToken) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        let emp_id: string | undefined;
        let isAdmin = false;

        if (adminToken) {
            try {
                const decoded = verifyToken(adminToken);
                if (decoded.role === "admin") isAdmin = true;
            } catch {}
        }

        if (!isAdmin && token) {
            const decoded = verifyToken(token);
            emp_id = decoded.emp_id;
        }

        const body = await req.json();
        const { id, room_id, start_time, end_time, purpose, attendee_ids, minutes } = body;

        if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

        const booking = await prisma.room_bookings.findUnique({
            where: { id: Number(id) }
        });

        if (!booking) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        // Booker or Admin can update
        if (booking.emp_id !== emp_id && !isAdmin) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const start = new Date(start_time.includes("Z") || start_time.includes("+") ? start_time : `${start_time}+07:00`);
        const end = new Date(end_time.includes("Z") || end_time.includes("+") ? end_time : `${end_time}+07:00`);

        // Check overlap if time or room changed
        if (room_id || start_time || end_time) {
            const overlap = await prisma.room_bookings.findFirst({
                where: {
                    id: { not: Number(id) },
                    room_id: room_id ? Number(room_id) : booking.room_id,
                    status: "approved",
                    start_time: { lt: end },
                    end_time: { gt: start }
                }
            });

            if (overlap) {
                return NextResponse.json({ 
                    error: "OVERLAP", 
                    message: "The new time slot overlaps with an existing booking." 
                }, { status: 409 });
            }
        }

        const updated = await prisma.room_bookings.update({
            where: { id: Number(id) },
            data: {
                room_id: room_id ? Number(room_id) : undefined,
                start_time: start_time ? start : undefined,
                end_time: end_time ? end : undefined,
                purpose: purpose !== undefined ? purpose : undefined,
                minutes: minutes !== undefined ? minutes : undefined,
                attendees: attendee_ids ? {
                    deleteMany: {},
                    create: attendee_ids.map((id: string) => ({ emp_id: id }))
                } : undefined
            }
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("[API/BOOKINGS/PATCH] Error:", error);
        return NextResponse.json({ 
            error: "INTERNAL_ERROR", 
            message: error.message || "An unexpected error occurred." 
        }, { status: 500 });
    }
}
