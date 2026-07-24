import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const prizeId = parseInt(params.id);

        if (isNaN(prizeId)) {
            return NextResponse.json({ error: "Invalid prize ID" }, { status: 400 });
        }

        try {
            await requireAdminOrSupervisor();
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 401 });
        }

        const prize = await prisma.wheel_prizes.findUnique({
            where: { id: prizeId },
            include: {
                tickets: true,
                winners: true,
                event: {
                    include: {
                        prizes: {
                            include: {
                                winners: true
                            }
                        }
                    }
                }
            }
        });

        if (!prize) {
            return NextResponse.json({ error: "Prize not found" }, { status: 404 });
        }

        if (prize.winners.length > 0) {
            return NextResponse.json({ error: "Winners have already been drawn for this prize" }, { status: 400 });
        }

        const quantity = prize.quantity;
        
        // Get all previous winners for this entire event to enforce "one prize per event per person"
        const previousWinners = new Set<string>();
        for (const p of prize.event.prizes) {
            for (const w of p.winners) {
                previousWinners.add(w.emp_id);
            }
        }

        // Group tickets by user, excluding those who already won a prize in this event
        const userTickets: Record<string, number> = {};
        for (const ticket of prize.tickets) {
            if (previousWinners.has(ticket.emp_id)) continue;
            userTickets[ticket.emp_id] = (userTickets[ticket.emp_id] || 0) + ticket.ticket_count;
        }

        const pool: string[] = [];
        for (const [empId, count] of Object.entries(userTickets)) {
            for (let i = 0; i < count; i++) {
                pool.push(empId);
            }
        }

        if (pool.length === 0) {
            return NextResponse.json({ error: "No tickets in the pool" }, { status: 400 });
        }

        const winners: string[] = [];
        
        // Draw up to `quantity` unique winners
        while (winners.length < quantity && pool.length > 0) {
            const randomIndex = Math.floor(Math.random() * pool.length);
            const selectedUser = pool[randomIndex];
            
            winners.push(selectedUser);
            
            // Remove all tickets of the selected user from the pool to ensure unique winners
            for (let i = pool.length - 1; i >= 0; i--) {
                if (pool[i] === selectedUser) {
                    pool.splice(i, 1);
                }
            }
        }

        // Save winners
        const winnerRecords = winners.map((empId) => ({
            prize_id: prizeId,
            emp_id: empId,
            status: "pending"
        }));

        await prisma.wheel_winners.createMany({
            data: winnerRecords
        });

        const createdWinners = await prisma.wheel_winners.findMany({
            where: {
                prize_id: prizeId,
                emp_id: { in: winners }
            },
            include: {
                employee: true
            }
        });

        return NextResponse.json({ success: true, winners: createdWinners });
    } catch (error: any) {
        console.error("[API/wheel/spin] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
