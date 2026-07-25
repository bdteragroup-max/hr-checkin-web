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
        const { receiver_emp_id, amount, message } = body;

        // Validation
        if (!receiver_emp_id || typeof amount !== "number" || amount <= 0) {
            return NextResponse.json({ error: "Invalid transfer parameters" }, { status: 400 });
        }

        if (auth.emp.emp_id === receiver_emp_id) {
            return NextResponse.json({ error: "Cannot transfer coins to yourself" }, { status: 400 });
        }

        // --- TODO #3: Transfer Cap per transaction ---
        const MAX_TRANSFER_PER_TX = 5;
        if (amount > MAX_TRANSFER_PER_TX) {
            return NextResponse.json({ 
                error: `Transfer limit exceeded. You can only transfer up to ${MAX_TRANSFER_PER_TX} Bronze coins per transaction.` 
            }, { status: 400 });
        }

        // Perform transactional transfer
        const result = await prisma.$transaction(async (tx) => {
            // 1. Check if receiver exists
            const receiver = await tx.employees.findUnique({
                where: { emp_id: receiver_emp_id },
            });
            if (!receiver || !receiver.is_active) {
                throw new Error("Receiver not found or inactive");
            }

            // 2. Check sender's bronze balance
            const senderCoin = await tx.employee_coins.findUnique({
                where: {
                    emp_id_coin_type_id: {
                        emp_id: auth.emp.emp_id,
                        coin_type_id: "BRONZE",
                    },
                },
            });
            if (!senderCoin || senderCoin.balance < amount) {
                throw new Error("Insufficient Bronze coin balance");
            }

            // 3. Check sender's transfer budget
            let transferBudget = await tx.transfer_budgets.findUnique({
                where: { emp_id: auth.emp.emp_id },
            });
            
            if (!transferBudget) {
                // Initialize default budget if not exists
                transferBudget = await tx.transfer_budgets.create({
                    data: {
                        emp_id: auth.emp.emp_id,
                        balance: 20, // default budget
                        monthly_topup: 20,
                    }
                });
            }

            if (transferBudget.balance < amount) {
                throw new Error(`Insufficient transfer budget. You have ${transferBudget.balance} remaining budget.`);
            }

            // 4. Deduct budget
            await tx.transfer_budgets.update({
                where: { id: transferBudget.id },
                data: { balance: { decrement: amount } },
            });

            // 5. Deduct sender coins
            await tx.employee_coins.update({
                where: { id: senderCoin.id },
                data: { balance: { decrement: amount } },
            });

            // 6. Increment receiver coins
            const receiverCoin = await tx.employee_coins.findUnique({
                where: { emp_id_coin_type_id: { emp_id: receiver_emp_id, coin_type_id: "BRONZE" } },
            });

            if (receiverCoin) {
                await tx.employee_coins.update({
                    where: { id: receiverCoin.id },
                    data: { balance: { increment: amount } },
                });
            } else {
                await tx.employee_coins.create({
                    data: {
                        emp_id: receiver_emp_id,
                        coin_type_id: "BRONZE",
                        balance: amount,
                    },
                });
            }

            // 7. Ledger entries (Sender & Receiver)
            await tx.coin_ledgers.create({
                data: {
                    emp_id: auth.emp.emp_id,
                    coin_type_id: "BRONZE",
                    amount: -amount,
                    transaction_type: "TRANSFER",
                    description: `Transferred to ${receiver.name} ${message ? `(${message})` : ''}`,
                },
            });

            await tx.coin_ledgers.create({
                data: {
                    emp_id: receiver_emp_id,
                    coin_type_id: "BRONZE",
                    amount: amount,
                    transaction_type: "TRANSFER",
                    description: `Received from ${auth.emp.name} ${message ? `(${message})` : ''}`,
                },
            });

            // 8. Record in coin_transfers table
            const transferRecord = await tx.coin_transfers.create({
                data: {
                    sender_emp_id: auth.emp.emp_id,
                    receiver_emp_id: receiver_emp_id,
                    amount,
                    message,
                },
            });

            return transferRecord;
        });

        return NextResponse.json({ ok: true, data: result });
    } catch (error: any) {
        const isValidation = error.message && (
            error.message.includes("Insufficient") || 
            error.message.includes("not found") || 
            error.message.includes("limit") ||
            error.message.includes("exceeded")
        );
        
        if (!isValidation) {
            console.error("Coin Transfer Error:", error);
        } else {
            console.warn(`Coin Transfer Validation: ${error.message}`);
        }
        
        return NextResponse.json(
            { error: error.message || "Failed to transfer coins" },
            { status: isValidation ? 400 : 500 }
        );
    }
}
