import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supervisors = await prisma.employees.findMany({
      where: {
        is_active: true,
        // Employees who ARE supervisors for others
      },
      select: {
        emp_id: true,
        name: true,
        line_user_id: true,
        is_active: true,
        subordinates: {
          where: { is_active: true },
          select: { emp_id: true, name: true }
        }
      }
    });

    // Filter to only those with subordinates
    const activeSupervisors = supervisors.filter(s => s.subordinates.length > 0);

    return NextResponse.json({ 
      ok: true, 
      count: activeSupervisors.length,
      supervisors: activeSupervisors.map(s => ({
        id: s.emp_id,
        name: s.name,
        line_id: s.line_user_id,
        active: s.is_active,
        subCount: s.subordinates.length
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
