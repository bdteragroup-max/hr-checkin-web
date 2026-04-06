import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Current time in Bangkok is 10:12 AM (03:12 UTC).
    // Any record for today with TS > 07:00 UTC is definitely buggy (14:00+ Bangkok).
    const startOfDay = new Date("2026-04-06T00:00:00Z");
    const endOfDay = new Date("2026-04-06T23:59:59Z");

    const records = await prisma.checkins.findMany({
      where: {
        timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const updated = [];
    for (const record of records) {
      // If the timestamp is ahead of now (03:12 UTC) or just in the buggy range (07:00 - 10:00 UTC)
      // we shift it back.
      if (record.timestamp.getTime() > new Date("2026-04-06T07:00:00Z").getTime()) {
        const realUtc = new Date(record.timestamp.getTime() - 7 * 60 * 60 * 1000);
        
        await prisma.checkins.update({
          where: { id: record.id },
          data: {
            timestamp: realUtc,
            // Also update time_key if we can. 
            // time_key is just the time part of the wall clock.
          },
        });
        updated.push({ id: record.id.toString(), name: record.name, old: record.timestamp.toISOString(), new: realUtc.toISOString() });
      }
    }

    return NextResponse.json({ ok: true, shiftedCount: updated.length, details: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
