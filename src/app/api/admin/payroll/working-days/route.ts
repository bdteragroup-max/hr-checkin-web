import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateWorkingDays } from "@/lib/allowances";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    
    // Default to current payroll cycle if not provided
    const now = new Date();
    const cycleYear = now.getFullYear();
    const cycleMonth = now.getMonth() + 1; // 1-12
    
    const startDate = startDateStr ? new Date(startDateStr) : new Date(cycleYear, cycleMonth - 2, 26, 0, 0, 0);
    const endDate = endDateStr ? new Date(endDateStr) : new Date(cycleYear, cycleMonth - 1, 25, 23, 59, 59);

    const fmt = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const holidaysList = await prisma.holidays.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      }
    });

    const holidayDates = new Set<string>();
    for (const h of holidaysList) {
      if (h.date) holidayDates.add(fmt(new Date(h.date)));
    }

    const maxWorkdays = calculateWorkingDays(startDate, endDate, holidayDates);

    return NextResponse.json({
        ok: true,
        maxWorkdays,
        startDate: fmt(startDate),
        endDate: fmt(endDate)
    });
  } catch (error) {
    console.error("[Working Days API] Error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
