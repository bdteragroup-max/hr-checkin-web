import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
export async function POST(request: Request) {
  try {
    const { emp_id, reward_id, quantity } = await request.json();

    if (!emp_id || !reward_id || !quantity || quantity <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid input parameters' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the reward and check if enough stock exists
      const reward = await tx.rewards.findUnique({
        where: { id: reward_id }
      });

      if (!reward || !reward.is_active) {
        throw new Error('Reward not found or inactive');
      }
      
      if (reward.stock_quantity < quantity) {
        throw new Error('Insufficient stock available');
      }

      const totalCost = reward.required_coins * quantity;

      // 2. Decrement stock_quantity atomically using a highly robust update query
      const stockUpdate = await tx.rewards.updateMany({
        where: {
          id: reward_id,
          stock_quantity: { gte: quantity } // Double check atomic condition
        },
        data: {
          stock_quantity: { decrement: quantity }
        }
      });

      if (stockUpdate.count === 0) {
        throw new Error('Concurrency error: Item ran out of stock during checkout');
      }

      // 3. Deduct Employee Balance Atomically for all required costs
      // Fallback to legacy fields if costs array is missing
      const rewardData: any = reward;
      const costs = rewardData.costs && Array.isArray(rewardData.costs) && rewardData.costs.length > 0 
        ? rewardData.costs 
        : [{ coin_type: reward.required_coin_type, amount: reward.required_coins }];

      const totalCosts = costs.map((c: any) => ({
        coin_type: c.coin_type.toUpperCase(),
        amount: c.amount * quantity
      }));

      for (const cost of totalCosts) {
        const balanceUpdate = await tx.employee_coins.updateMany({
          where: {
            emp_id: emp_id,
            coin_type_id: cost.coin_type,
            balance: { gte: cost.amount }
          },
          data: {
            balance: { decrement: cost.amount },
            updated_at: new Date()
          }
        });

        if (balanceUpdate.count === 0) {
          throw new Error(`ยอดเหรียญ ${cost.coin_type} ไม่เพียงพอสำหรับการแลกรางวัล`);
        }

        // 4. Create Ledger Entry
        await tx.coin_ledgers.create({
          data: {
            emp_id: emp_id,
            coin_type_id: cost.coin_type,
            amount: -cost.amount,
            transaction_type: 'REDEEM',
            source_key: `redeem_${reward_id}_${cost.coin_type}_${uuidv4()}`,
            description: `Redeemed ${quantity}x ${reward.name}`
          }
        });
      }

      // 5. Create Redemption Record
      const redemption = await tx.reward_redemptions.create({
        data: {
          emp_id: emp_id,
          reward_id: reward_id,
          quantity: quantity,
          points_spent: totalCosts[0].amount, // Legacy fallback
          coin_type_id: totalCosts[0].coin_type, // Legacy fallback
          costs: totalCosts, // Save actual multi-coin breakdown
          status: 'pending' // pending HR fulfillment
        } as any
      });

      return redemption;
    });

    return NextResponse.json({ success: true, redemption: result });
  } catch (error: any) {
    console.error('Error redeeming reward:', error.message);
    // Determine status based on error type
    const status = error.message.includes('ยอดเหรียญ') && error.message.includes('ไม่เพียงพอ') ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to redeem reward' },
      { status: status }
    );
  }
}
