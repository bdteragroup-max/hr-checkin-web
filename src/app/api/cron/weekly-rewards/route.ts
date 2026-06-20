import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBangkokWallClock } from "@/utils/time";

export async function GET(req: Request) {
    try {
        const now = getBangkokWallClock();
        
        // Find the most recent Saturday
        const lastSaturday = new Date(now);
        const day = lastSaturday.getDay(); // 0 = Sunday, 1 = Monday, 6 = Saturday
        const diffToSaturday = day === 0 ? 1 : day + 1;
        lastSaturday.setDate(lastSaturday.getDate() - diffToSaturday);
        
        // The Monday before that Saturday is 5 days prior
        const lastMonday = new Date(lastSaturday);
        lastMonday.setDate(lastSaturday.getDate() - 5);
        
        const y_m = lastMonday.getFullYear();
        const m_m = String(lastMonday.getMonth() + 1).padStart(2, '0');
        const d_m = String(lastMonday.getDate()).padStart(2, '0');
        const startDate = new Date(`${y_m}-${m_m}-${d_m}T00:00:00.000Z`);

        const y_s = lastSaturday.getFullYear();
        const m_s = String(lastSaturday.getMonth() + 1).padStart(2, '0');
        const d_s = String(lastSaturday.getDate()).padStart(2, '0');
        const endDate = new Date(`${y_s}-${m_s}-${d_s}T00:00:00.000Z`);

        const activeEmployees = await prisma.employees.findMany({
            where: { is_active: true },
            select: { emp_id: true }
        });

        let awardedCount = 0;

        for (const emp of activeEmployees) {
            const checkins = await prisma.checkins.findMany({
                where: {
                    emp_id: emp.emp_id,
                    date_key: { gte: startDate, lte: endDate },
                    type: { in: ["Check-in", "Project-In", "Offsite-In"] },
                    late_status: { in: ["ontime", "early"] }
                },
                select: { date_key: true }
            });

            // Count distinct days
            const uniqueDays = new Set(checkins.map(c => c.date_key.toISOString()));

            if (uniqueDays.size === 6) { // Full Mon-Sat week
                const sourceKey = `weekly_reward:${emp.emp_id}:${y_m}-${m_m}-${d_m}`;
                
                await prisma.$transaction(async (tx) => {
                    const existingLedger = await tx.coin_ledgers.findUnique({
                        where: { source_key: sourceKey }
                    });

                    if (!existingLedger) {
                        await tx.coin_ledgers.create({
                            data: {
                                emp_id: emp.emp_id,
                                coin_type_id: "BRONZE",
                                amount: 4,
                                transaction_type: "EARN",
                                source_key: sourceKey,
                                description: "Full Week On-Time Reward",
                            },
                        });

                        const currentCoin = await tx.employee_coins.findUnique({
                            where: { emp_id_coin_type_id: { emp_id: emp.emp_id, coin_type_id: "BRONZE" } }
                        });

                        if (currentCoin) {
                            await tx.employee_coins.update({
                                where: { id: currentCoin.id },
                                data: { balance: { increment: 4 } },
                            });
                        } else {
                            await tx.employee_coins.create({
                                data: { emp_id: emp.emp_id, coin_type_id: "BRONZE", balance: 4 }
                            });
                        }
                        awardedCount++;
                    }
                });
            }
        }

        return NextResponse.json({
            ok: true,
            evaluated_range: { start: startDate, end: endDate },
            awardedCount
        });

    } catch (e: any) {
        console.error("[CRON/WEEKLY] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
