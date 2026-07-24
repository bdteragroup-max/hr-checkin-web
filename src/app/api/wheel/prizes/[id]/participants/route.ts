import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        await requireAdminOrSupervisor();
        
        const params = await props.params;
        const prizeId = parseInt(params.id);

        if (isNaN(prizeId)) {
            return NextResponse.json({ error: "Invalid prize ID" }, { status: 400 });
        }

        const prize = await prisma.wheel_prizes.findUnique({
            where: { id: prizeId },
            include: {
                tickets: {
                    include: {
                        employee: true
                    }
                },
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

        const previousWinners = new Set<string>();
        for (const p of prize.event.prizes) {
            for (const w of p.winners) {
                previousWinners.add(w.emp_id);
            }
        }

        let pool: string[] = [];
        for (const t of prize.tickets) {
            if (previousWinners.has(t.emp_id)) continue;
            
            const empName = t.employee?.name || t.emp_id;
            const nickname = t.employee?.nickname ? ` (${t.employee.nickname})` : '';
            const displayName = `${empName}${nickname}`;

            for (let i = 0; i < t.ticket_count; i++) {
                pool.push(displayName);
            }
        }

        // Shuffle the pool
        pool = pool.sort(() => 0.5 - Math.random());

        // Cap to 30 visual slices so the wheel is readable, but ensure we have at least something.
        const visualSlices = pool.slice(0, 30);

        return NextResponse.json({ success: true, participants: visualSlices });
    } catch (error: any) {
        console.error("Error fetching participants:", error);
        return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 });
    }
}
