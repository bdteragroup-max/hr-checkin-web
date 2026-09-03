import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const company_id = searchParams.get("company_id");

    const where: any = { is_active: true };
    if (company_id) {
        where.company_id = parseInt(company_id);
    }

    const employees = await prisma.employees.findMany({
      where,
      select: {
        emp_id: true,
        name: true,
        company_id: true
      },
      orderBy: { emp_id: 'asc' }
    });

    return NextResponse.json({ ok: true, data: employees });
  } catch (error) {
    console.error("[Search API] Error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
