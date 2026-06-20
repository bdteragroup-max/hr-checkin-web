import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBangkokWallClock } from "@/utils/time";

export async function GET(req: Request) {
    try {
        const now = getBangkokWallClock();
        
        // Target the previous month
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = prevMonthDate.getFullYear();
        const m = prevMonthDate.getMonth(); // 0-indexed
        
        const startDate = new Date(y, m, 1);
        // Ensure to pad the month correctly for UTC string representation
        const padM = String(m + 1).padStart(2, '0');
        const startDateUTC = new Date(`${y}-${padM}-01T00:00:00.000Z`);

        const nextMonthDate = new Date(y, m + 1, 1);
        const nextM = nextMonthDate.getMonth();
        const nextY = nextMonthDate.getFullYear();
        const nextPadM = String(nextM + 1).padStart(2, '0');
        const endDateUTC = new Date(`${nextY}-${nextPadM}-01T00:00:00.000Z`); // Exclusive

        // Calculate total working days in this month (Mon-Sat)
        let totalWorkingDays = 0;
        let d = new Date(startDateUTC);
        while (d < endDateUTC) {
            if (d.getUTCDay() !== 0) { // Not Sunday
                totalWorkingDays++;
            }
            d.setUTCDate(d.getUTCDate() + 1);
        }

        const activeEmployees = await prisma.employees.findMany({
            where: { is_active: true },
            select: { emp_id: true }
        });

        let awardedCount = 0;

        for (const emp of activeEmployees) {
            // 1. Check for approved leaves in this month
            const leaves = await prisma.leave_requests.findMany({
                where: {
                    emp_id: emp.emp_id,
                    status: "approved",
                    OR: [
                        { start_date: { gte: startDateUTC, lt: endDateUTC } },
                        { end_date: { gte: startDateUTC, lt: endDateUTC } }
                    ]
                }
            });

            if (leaves.length > 0) continue; // Failed condition

            // 2. Count on-time checkins
            const checkins = await prisma.checkins.findMany({
                where: {
                    emp_id: emp.emp_id,
                    date_key: { gte: startDateUTC, lt: endDateUTC },
                    type: { in: ["Check-in", "Project-In", "Offsite-In"] },
                    late_status: { in: ["ontime", "early"] }
                },
                select: { date_key: true }
            });

            const uniqueDays = new Set(checkins.map(c => c.date_key.toISOString()));

            if (uniqueDays.size === totalWorkingDays) {
                const sourceKey = `monthly_reward:${emp.emp_id}:${y}-${padM}`;
                
                await prisma.$transaction(async (tx) => {
                    const existingLedger = await tx.coin_ledgers.findUnique({
                        where: { source_key: sourceKey }
                    });

                    if (!existingLedger) {
                        await tx.coin_ledgers.create({
                            data: {
                                emp_id: emp.emp_id,
                                coin_type_id: "BRONZE",
                                amount: 5,
                                transaction_type: "EARN",
                                source_key: sourceKey,
                                description: `Perfect Attendance Reward (${padM}/${y})`,
                            },
                        });

                        const currentCoin = await tx.employee_coins.findUnique({
                            where: { emp_id_coin_type_id: { emp_id: emp.emp_id, coin_type_id: "BRONZE" } }
                        });

                        if (currentCoin) {
                            await tx.employee_coins.update({
                                where: { id: currentCoin.id },
                                data: { balance: { increment: 5 } },
                            });
                        } else {
                            await tx.employee_coins.create({
                                data: { emp_id: emp.emp_id, coin_type_id: "BRONZE", balance: 5 }
                            });
                        }
                        awardedCount++;
                    }
                });
            }
        }

        return NextResponse.json({
            ok: true,
            evaluated_range: { start: startDateUTC, end: endDateUTC },
            totalWorkingDays,
            awardedCount
        });

    } catch (e: any) {
        console.error("[CRON/MONTHLY] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
