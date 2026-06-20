import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { emp_id, coin_type_id, amount, description } = await request.json();

    if (!emp_id || !coin_type_id || typeof amount !== "number") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    // Wrap the operation in a transaction to ensure atomic updates
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify that the coin type exists
      const coinType = await tx.coin_types.findUnique({
        where: { id: coin_type_id },
      });

      if (!coinType) {
        throw new Error("Invalid coin type");
      }

      // 2. Add ledger entry
      const ledger = await tx.coin_ledgers.create({
        data: {
          emp_id,
          coin_type_id,
          amount,
          transaction_type: "MANUAL_AWARD",
          description: description || "Manually awarded by Admin",
        },
      });

      // 3. Update or create employee coin balance
      const currentCoin = await tx.employee_coins.findUnique({
        where: {
          emp_id_coin_type_id: {
            emp_id,
            coin_type_id,
          },
        },
      });

      let updatedBalance;

      if (currentCoin) {
        updatedBalance = await tx.employee_coins.update({
          where: { id: currentCoin.id },
          data: { balance: { increment: amount } },
        });
      } else {
        updatedBalance = await tx.employee_coins.create({
          data: {
            emp_id,
            coin_type_id,
            balance: amount,
          },
        });
      }

      return { ledger, updatedBalance };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Manual Award Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to award coins" },
      { status: 500 }
    );
  }
}
