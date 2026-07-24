import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        let empId = null;

        if (token) {
            try {
                const payload = verifyToken(token) as { emp_id: string };
                if (payload && payload.emp_id) {
                    empId = payload.emp_id;
                }
            } catch (e) {}
        }

        const event = await prisma.wheel_events.findFirst({
            where: { is_active: true },
            include: {
                prizes: {
                    where: { is_active: true },
                    include: {
                        tickets: true,
                        winners: {
                            include: {
                                employee: true
                            }
                        }
                    },
                    orderBy: { id: "asc" }
                }
            },
            orderBy: { id: "desc" }
        });

        if (!event) {
            return NextResponse.json({ event: null });
        }

        const formattedPrizes = event.prizes.map((prize) => {
            const totalTickets = prize.tickets.reduce((sum, t: any) => sum + t.ticket_count, 0);
            const myTickets = empId
                ? prize.tickets
                    .filter((t: any) => t.emp_id === empId)
                    .reduce((sum, t: any) => sum + t.ticket_count, 0)
                : 0;

            const uniqueParticipants = new Set(prize.tickets.map((t: any) => t.emp_id)).size;

            return {
                id: prize.id,
                name: prize.name,
                bonusAmount: prize.bonus_amount,
                quantity: prize.quantity,
                totalTickets,
                myTickets,
                uniqueParticipants,
                winners: prize.winners
            };
        });

        return NextResponse.json({
            event: {
                id: event.id,
                name: event.name,
                description: event.description,
                start_date: event.start_date,
                end_date: event.end_date
            },
            prizes: formattedPrizes
        });
    } catch (error: any) {
        console.error("[API/wheel/events/active] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
