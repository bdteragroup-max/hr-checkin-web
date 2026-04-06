import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dateStr = "2026-04-06";
    const dateKey = new Date(dateStr);
    
    // Check holiday for today
    const holiday = await prisma.holidays.findUnique({
      where: { date: dateKey }
    });
    
    // Check if the cron was actually called by checking logs or something else?
    // We don't have a log table for crons.
    
    return NextResponse.json({ 
      ok: true, 
      isTodayHoliday: !!holiday,
      holidayName: holiday?.name || null,
      message: holiday ? "Today is a holiday, which explains why the notification was skipped." : "Today is NOT a holiday, we need to investigate further."
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
