import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const rewards = await prisma.rewards.findMany({
      where: {
        is_active: true,
      },
      orderBy: [
        { required_coin_type: 'asc' },
        { required_coins: 'asc' },
      ],
    });

    return NextResponse.json({ success: true, rewards });
  } catch (error: any) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rewards' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
