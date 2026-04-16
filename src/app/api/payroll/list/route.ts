import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        let p: any;
        try {
            p = verifyToken(token);
        } catch {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        const publishedData = await prisma.monthly_payroll_data.findMany({
            where: {
                emp_id: p.emp_id,
                is_published: true
            },
            orderBy: [
                { cycle_year: "desc" },
                { cycle_month: "desc" }
            ]
        });

        const list = publishedData.map(d => ({
            month: d.cycle_month,
            year: d.cycle_year
        }));

        return NextResponse.json({ ok: true, list });
    } catch (e: any) {
        console.error("Payslip API error:", e);
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}
