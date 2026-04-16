import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { sendPayslipNotification } from "@/utils/lineMessaging";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json();
        const { month, year, emp_id, is_published } = body;

        if (!month || !year || !emp_id) {
            return NextResponse.json({ error: "Missing month, year, or emp_id" }, { status: 400 });
        }

        await prisma.monthly_payroll_data.upsert({
            where: {
                emp_id_cycle_month_cycle_year: {
                    emp_id: emp_id,
                    cycle_month: month,
                    cycle_year: year
                }
            },
            update: {
                is_published: is_published
            },
            create: {
                emp_id: emp_id,
                cycle_month: month,
                cycle_year: year,
                is_published: is_published
            }
        });

        if (is_published) {
            const emp = await prisma.employees.findUnique({
                where: { emp_id },
                select: { name: true, line_user_id: true }
            });
            if (emp && emp.line_user_id) {
                // Fire and forget
                sendPayslipNotification(emp.line_user_id, {
                    empName: emp.name,
                    month,
                    year
                }).catch(e => console.error("Line notification error:", e));
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("Publish error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
