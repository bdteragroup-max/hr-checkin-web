import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO, getBangkokWallClock } from "@/utils/time";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dateStr = getTodayBangkokISO();
    const dateKey = new Date(dateStr);
    const bkk = getBangkokWallClock();
    const dayOfWeek = bkk.getDay();

    const targetEmployees = await prisma.employees.findMany({
      where: {
        is_active: true,
        is_checkin_exempt: false,
        supervisor_id: { not: null },
        supervisor: { 
          is_active: true,
          line_user_id: { not: "" } 
        }
      },
      select: {
        emp_id: true,
        name: true,
        supervisor_id: true,
        supervisor: {
          select: { line_user_id: true, name: true }
        }
      }
    });

    const employeeIds = targetEmployees.map(e => e.emp_id);
    const checkinsToday = await prisma.checkins.findMany({
      where: { 
        date_key: dateKey,
        emp_id: { in: employeeIds }
      },
      select: { emp_id: true }
    });
    const checkedInIds = new Set(checkinsToday.map(c => c.emp_id));

    return NextResponse.json({ 
      ok: true, 
      dateStr,
      dayOfWeek,
      totalSupervisedEmployees: targetEmployees.length,
      checkedInCount: checkedInIds.size,
      allSupervised: targetEmployees.map(e => ({
        id: e.emp_id,
        name: e.name,
        supervisor: e.supervisor?.name,
        hasLineId: !!e.supervisor?.line_user_id,
        checkedIn: checkedInIds.has(e.emp_id)
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
