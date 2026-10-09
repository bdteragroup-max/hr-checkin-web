import { toBangkokWallClock } from "./time";

export interface AwardCoinResult {
    checkinCoinAwarded: boolean;
    checkoutCoinAwarded: boolean;
    streak?: number;
    milestoneBonus?: number;
}

/**
 * Process coin awarding and streak tracking for a check-in or check-out record.
 * Works inside a Prisma transaction or directly with prisma instance.
 */
export async function processCheckinCoins(
    tx: any,
    params: {
        emp_id: string;
        type: string;
        timestamp: Date;
        effective_date_key: Date;
        late_status?: string | null;
    }
): Promise<AwardCoinResult> {
    const result: AwardCoinResult = {
        checkinCoinAwarded: false,
        checkoutCoinAwarded: false
    };

    const bkkDateKey = toBangkokWallClock(params.effective_date_key);
    const y = bkkDateKey.getFullYear();
    const m = String(bkkDateKey.getMonth() + 1).padStart(2, "0");
    const d = String(bkkDateKey.getDate()).padStart(2, "0");

    // 1. Check-in coin & streak logic
    if (params.type === "Check-in" || params.type === "Project-In" || params.type === "Offsite-In") {
        const sourceKey = `checkin:${params.emp_id}:${y}-${m}-${d}`;

        const existingLedger = await tx.coin_ledgers.findUnique({
            where: { source_key: sourceKey }
        });

        if (!existingLedger) {
            const employee = await tx.employees.findUnique({
                where: { emp_id: params.emp_id }
            });

            if (employee) {
                let newStreak = 0;
                const isOnTime = params.late_status === "ontime" || params.late_status === "early";

                if (isOnTime) {
                    // Calculate previous working day (skip Sunday)
                    const prevWorkingDay = new Date(params.effective_date_key);
                    prevWorkingDay.setUTCDate(prevWorkingDay.getUTCDate() - 1);
                    if (prevWorkingDay.getUTCDay() === 0) {
                        prevWorkingDay.setUTCDate(prevWorkingDay.getUTCDate() - 1);
                    }

                    const prevCheckin = await tx.checkins.findFirst({
                        where: {
                            emp_id: params.emp_id,
                            date_key: prevWorkingDay,
                            type: { in: ["Check-in", "Project-In", "Offsite-In"] }
                        },
                        orderBy: { timestamp: "asc" }
                    });

                    const wasPrevOnTime = prevCheckin && (prevCheckin.late_status === "ontime" || prevCheckin.late_status === "early");
                    newStreak = wasPrevOnTime ? (employee.current_streak || 0) + 1 : 1;
                } else {
                    newStreak = 0;
                }

                await tx.employees.update({
                    where: { emp_id: params.emp_id },
                    data: { current_streak: newStreak }
                });
                result.streak = newStreak;

                if (isOnTime) {
                    // +1 Bronze for Daily Check-in
                    await tx.coin_ledgers.create({
                        data: {
                            emp_id: params.emp_id,
                            coin_type_id: "BRONZE",
                            amount: 1,
                            transaction_type: "EARN",
                            source_key: sourceKey,
                            description: "Daily Check-in Reward"
                        }
                    });

                    // Check Milestones (7 or 30 days)
                    let milestoneBonus = 0;
                    let milestoneSourceKey = "";
                    let milestoneDesc = "";

                    if (newStreak === 7) {
                        milestoneBonus = 3;
                        milestoneSourceKey = `streak_milestone:${params.emp_id}:7:${y}-${m}-${d}`;
                        milestoneDesc = "7-Day Streak Reward";
                    } else if (newStreak === 30) {
                        milestoneBonus = 3;
                        milestoneSourceKey = `streak_milestone:${params.emp_id}:30:${y}-${m}-${d}`;
                        milestoneDesc = "30-Day Streak Reward";
                    }

                    if (milestoneBonus > 0) {
                        await tx.coin_ledgers.create({
                            data: {
                                emp_id: params.emp_id,
                                coin_type_id: "BRONZE",
                                amount: milestoneBonus,
                                transaction_type: "EARN",
                                source_key: milestoneSourceKey,
                                description: milestoneDesc
                            }
                        });
                        result.milestoneBonus = milestoneBonus;
                    }

                    const totalBonus = 1 + milestoneBonus;
                    const currentCoin = await tx.employee_coins.findUnique({
                        where: { emp_id_coin_type_id: { emp_id: params.emp_id, coin_type_id: "BRONZE" } }
                    });

                    if (currentCoin) {
                        await tx.employee_coins.update({
                            where: { id: currentCoin.id },
                            data: { balance: { increment: totalBonus } }
                        });
                    } else {
                        await tx.employee_coins.create({
                            data: { emp_id: params.emp_id, coin_type_id: "BRONZE", balance: totalBonus }
                        });
                    }
                    result.checkinCoinAwarded = true;
                }
            }
        }
    }

    // 2. Late Check-out Reward (After 18:00 Bangkok time)
    if (params.type === "Check-out" || params.type === "Project-Out" || params.type === "Offsite-Out") {
        const bkkTimestamp = toBangkokWallClock(params.timestamp);
        const checkOutHour = bkkTimestamp.getHours();

        if (checkOutHour >= 18) {
            const sourceKey = `checkout_late:${params.emp_id}:${y}-${m}-${d}`;

            const existingLedger = await tx.coin_ledgers.findUnique({
                where: { source_key: sourceKey }
            });

            if (!existingLedger) {
                const employee = await tx.employees.findUnique({
                    where: { emp_id: params.emp_id }
                });

                if (employee) {
                    await tx.coin_ledgers.create({
                        data: {
                            emp_id: params.emp_id,
                            coin_type_id: "BRONZE",
                            amount: 1,
                            transaction_type: "EARN",
                            source_key: sourceKey,
                            description: "Late Check-out Reward (After 18:00)"
                        }
                    });

                    const currentCoin = await tx.employee_coins.findUnique({
                        where: { emp_id_coin_type_id: { emp_id: params.emp_id, coin_type_id: "BRONZE" } }
                    });

                    if (currentCoin) {
                        await tx.employee_coins.update({
                            where: { id: currentCoin.id },
                            data: { balance: { increment: 1 } }
                        });
                    } else {
                        await tx.employee_coins.create({
                            data: { emp_id: params.emp_id, coin_type_id: "BRONZE", balance: 1 }
                        });
                    }
                    result.checkoutCoinAwarded = true;
                }
            }
        }
    }

    return result;
}
