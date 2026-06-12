import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Total Requests by Status
    const statusCounts = await prisma.clothing_requests.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    // 2. Total items distributed (fulfilled) by variant/item
    const fulfilledRequests = await prisma.clothing_requests.findMany({
      where: { status: 'fulfilled' },
      include: {
        variant: {
          include: { item: true }
        }
      }
    });

    const itemDistribution: Record<string, number> = {};
    for (const req of fulfilledRequests) {
      const name = `${req.variant.item.name} (${req.variant.size})`;
      itemDistribution[name] = (itemDistribution[name] || 0) + req.quantity;
    }

    // 3. Current Stock Levels (for low stock alerts)
    const stockLevels = await prisma.clothing_variants.findMany({
      include: { item: true },
      orderBy: { stock_quantity: 'asc' },
      take: 20
    });

    return NextResponse.json({
      statusCounts,
      itemDistribution,
      lowStock: stockLevels
    });
  } catch (error: any) {
    console.error("GET Admin Reports Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
