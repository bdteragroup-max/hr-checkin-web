import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

const COIN_RATES: Record<string, { coinsRequired: number, ticketsPerUnit: number }> = {
    "BRONZE": { coinsRequired: 20, ticketsPerUnit: 1 }, 
    "SILVER": { coinsRequired: 1, ticketsPerUnit: 2 }, 
    "TASK": { coinsRequired: 1, ticketsPerUnit: 3 }, 
    "EVENT": { coinsRequired: 1, ticketsPerUnit: 5 }, 
    "GOLD": { coinsRequired: 1, ticketsPerUnit: 25 }, 
    "KPI": { coinsRequired: 1, ticketsPerUnit: 40 },
};

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const prizeId = parseInt(params.id);
        const { coinType, coinAmount } = await req.json();

        if (isNaN(prizeId) || !coinType || !coinAmount || coinAmount <= 0) {
            return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
        }

        const rate = COIN_RATES[coinType];
        if (!rate) {
            return NextResponse.json({ error: "Invalid coin type" }, { status: 400 });
        }

        const tickets = Math.floor(coinAmount / rate.coinsRequired) * rate.ticketsPerUnit;
        if (tickets <= 0) {
            return NextResponse.json({ error: "Amount not enough for 1 ticket" }, { status: 400 });
        }

        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        let empId = null;
        try {
            const payload = verifyToken(token) as { emp_id: string };
            empId = payload.emp_id;
            
            const emp = await prisma.employees.findUnique({ where: { emp_id: empId } });
            if (!emp || !emp.is_active) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user has the coin type (we need the actual coin_type ID from the db, assuming it matches the key)
        const coinTypeId = coinType; 

        // Perform in transaction
        await prisma.$transaction(async (tx) => {
            // Load prize and event to ensure they are still active
            const prize = await tx.wheel_prizes.findUnique({
                where: { id: prizeId },
                include: { event: true }
            });

            if (!prize || !prize.is_active || !prize.event.is_active) {
                throw new Error("Event or prize is closed");
            }

            if (prize.event.end_date && new Date() > new Date(prize.event.end_date)) {
                throw new Error("This event has expired");
            }

            const empCoin = await tx.employee_coins.findUnique({
                where: { emp_id_coin_type_id: { emp_id: empId, coin_type_id: coinTypeId } }
            });

            if (!empCoin || empCoin.balance < coinAmount) {
                throw new Error("Insufficient coins");
            }

            await tx.employee_coins.update({
                where: { emp_id_coin_type_id: { emp_id: empId, coin_type_id: coinTypeId } },
                data: { balance: { decrement: coinAmount } }
            });

            await tx.coin_ledgers.create({
                data: {
                    emp_id: empId,
                    coin_type_id: coinTypeId,
                    amount: -coinAmount,
                    transaction_type: "WHEEL_REDEEM",
                    description: `Redeemed ${tickets} tickets for ${prize.name}`,
                }
            });

            await tx.wheel_tickets.create({
                data: {
                    emp_id: empId,
                    prize_id: prizeId,
                    coin_type_used: coinTypeId,
                    coins_spent: coinAmount,
                    ticket_count: tickets
                }
            });
        });

        return NextResponse.json({ success: true, tickets });
    } catch (error: any) {
        console.error("[API/wheel/redeem] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
