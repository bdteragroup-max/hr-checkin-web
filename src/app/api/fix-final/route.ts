import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const startRange = new Date("2026-04-06T00:00:00Z");
    const endRange = new Date("2026-04-06T23:59:59Z");

    const records = await prisma.checkins.findMany({
      where: {
        timestamp: {
          gte: startRange,
          lte: endRange,
        },
      },
    });

    return NextResponse.json({ 
      ok: true, 
      count: records.length, 
      list: records.map(r => ({ 
        id: r.id.toString(), 
        ts: r.timestamp.toISOString(),
        time_key: (r as any).time_key ? (r as any).time_key.toISOString() : null,
        name: r.name,
        branch: r.branch_name,
        type: r.type 
      })) 
    });

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
