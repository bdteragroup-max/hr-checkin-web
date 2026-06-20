import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function requireEmployee() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    try {
        const payload = verifyToken(token) as { emp_id: string };
        const emp = await prisma.employees.findUnique({ where: { emp_id: payload.emp_id } });
        if (!emp || !emp.is_active) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
        return { emp };
    } catch {
        return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    }
}

export async function POST(request: Request) {
    const auth = await requireEmployee();
    if ("error" in auth) return auth.error;

    try {
        const body = await request.json();
        const { from_coin_type, to_coin_type, amount_to_exchange } = body;

        if (!from_coin_type || !to_coin_type || typeof amount_to_exchange !== "number" || amount_to_exchange <= 0) {
            return NextResponse.json({ error: "Invalid exchange parameters" }, { status: 400 });
        }

        // Query exchange rate from database for flexibility
        const rateRecord = await prisma.coin_exchange_rates.findUnique({
            where: {
                from_coin_type_to_coin_type: {
                    from_coin_type,
                    to_coin_type
                }
            }
        });

        if (!rateRecord || !rateRecord.is_active) {
            return NextResponse.json({ error: "Exchange route not allowed" }, { status: 400 });
        }

        const exchangeRate = rateRecord.exchange_rate;

        if (amount_to_exchange % exchangeRate !== 0) {
            return NextResponse.json({ 
                error: `Amount must be a multiple of ${exchangeRate} to exchange for 1 ${to_coin_type}` 
            }, { status: 400 });
        }

        const to_amount = amount_to_exchange / exchangeRate;

        // Perform transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Check current balance
            const currentCoin = await tx.employee_coins.findUnique({
                where: {
                    emp_id_coin_type_id: {
                        emp_id: auth.emp.emp_id,
                        coin_type_id: from_coin_type,
                    },
                },
            });

            if (!currentCoin || currentCoin.balance < amount_to_exchange) {
                throw new Error("ยอดเหรียญไม่เพียงพอสำหรับการแลกเปลี่ยน");
            }

            // 2. Deduct from_coin
            await tx.employee_coins.update({
                where: { id: currentCoin.id },
                data: { balance: { decrement: amount_to_exchange } },
            });

            // 3. Increment to_coin
            const targetCoin = await tx.employee_coins.findUnique({
                where: { emp_id_coin_type_id: { emp_id: auth.emp.emp_id, coin_type_id: to_coin_type } },
            });

            if (targetCoin) {
                await tx.employee_coins.update({
                    where: { id: targetCoin.id },
                    data: { balance: { increment: to_amount } },
                });
            } else {
                await tx.employee_coins.create({
                    data: {
                        emp_id: auth.emp.emp_id,
                        coin_type_id: to_coin_type,
                        balance: to_amount,
                    },
                });
            }

            // 4. Ledger entry for deduction
            await tx.coin_ledgers.create({
                data: {
                    emp_id: auth.emp.emp_id,
                    coin_type_id: from_coin_type,
                    amount: -amount_to_exchange,
                    transaction_type: "EXCHANGE",
                    description: `Exchanged for ${to_amount} ${to_coin_type}`,
                },
            });

            // 5. Ledger entry for addition
            await tx.coin_ledgers.create({
                data: {
                    emp_id: auth.emp.emp_id,
                    coin_type_id: to_coin_type,
                    amount: to_amount,
                    transaction_type: "EXCHANGE",
                    description: `Exchanged from ${amount_to_exchange} ${from_coin_type}`,
                },
            });

            // 6. Record in coin_exchanges table
            const exchangeRecord = await tx.coin_exchanges.create({
                data: {
                    emp_id: auth.emp.emp_id,
                    from_coin_type,
                    to_coin_type,
                    from_amount: amount_to_exchange,
                    to_amount,
                },
            });

            return exchangeRecord;
        });

        return NextResponse.json({ ok: true, data: result });
    } catch (error: any) {
        console.error("Coin Exchange Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to exchange coins" },
            { status: error.message === "ยอดเหรียญไม่เพียงพอสำหรับการแลกเปลี่ยน" ? 400 : 500 }
        );
    }
}
