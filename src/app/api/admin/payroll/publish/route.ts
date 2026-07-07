import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { sendPayslipNotification } from "@/utils/lineMessaging";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json();
        const { month, year, emp_id, is_published, tax, social_security, provident_fund, taxable_income, housing_benefit, car_benefit } = body;

        if (!month || !year || !emp_id) {
            return NextResponse.json({ error: "Missing month, year, or emp_id" }, { status: 400 });
        }

        const dataInput = {
            is_published,
            ...(tax !== undefined && { tax }),
            ...(social_security !== undefined && { social_security }),
            ...(provident_fund !== undefined && { provident_fund }),
            ...(taxable_income !== undefined && { taxable_income }),
            ...(housing_benefit !== undefined && { housing_benefit }),
            ...(car_benefit !== undefined && { car_benefit })
        };

        await prisma.monthly_payroll_data.upsert({
            where: {
                emp_id_cycle_month_cycle_year: {
                    emp_id: emp_id,
                    cycle_month: month,
                    cycle_year: year
                }
            },
            update: dataInput,
            create: {
                emp_id: emp_id,
                cycle_month: month,
                cycle_year: year,
                ...dataInput
            }
        });

        if (is_published) {
            const emp = await prisma.employees.findFirst({
                where: { 
                    emp_id: {
                        equals: emp_id,
                        mode: 'insensitive'
                    }
                },
                select: { emp_id: true, name: true, line_user_id: true }
            });

            if (emp) {
                if (emp.line_user_id) {
                    console.log(`[PUBLISH] Sending payslip notification to ${emp.emp_id} (${emp.name})`);
                    sendPayslipNotification(emp.line_user_id, {
                        empName: emp.name,
                        month,
                        year
                    }).catch(e => console.error(`[PUBLISH] Line notification error for ${emp.emp_id}:`, e));
                } else {
                    console.warn(`[PUBLISH] Employee ${emp.emp_id} found but has no line_user_id. skipping notification.`);
                }
            } else {
                console.error(`[PUBLISH] Employee ID ${emp_id} not found in employees table. notification skipped.`);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("Publish error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
