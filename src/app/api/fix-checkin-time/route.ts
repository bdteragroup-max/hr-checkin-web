import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Search for all check-ins today
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

    if (records.length === 0) {
      return NextResponse.json({ ok: false, message: "No records found for today (2026-04-06)." });
    }

    const list = records.map(r => ({
      id: r.id.toString(),
      name: r.name,
      emp_id: r.emp_id,
      ts: r.timestamp.toISOString(),
      type: r.type,
      branch: r.branch_name
    }));

    return NextResponse.json({ ok: true, count: list.length, list });

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
