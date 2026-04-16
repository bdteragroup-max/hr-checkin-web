import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        await requireAdmin();
        const body = await req.json();

        const {
            emp_id, cycle_month, cycle_year,
            social_security, student_loan, insurance, insurance_income, unpaid_absenteeism, tax, commissions, bonus, other_deductions, other_benefits, override_salary,
            normal_1_5x_hours_override, holiday_1_x_hours_override, holiday_3_x_hours_override,
            diligence_allowance_override, meal_allowance_override, travel_allowance_override,
            accommodation_allowance_override, phone_allowance_override, position_allowance_override,
            travel_site_allowance_override, travel_accommodation_override
        } = body;

        if (!emp_id || !cycle_month || !cycle_year) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const clean = (val: any) => (val === "" || val === null || val === undefined) ? null : Number(val);

        const dataInput = {
            social_security: clean(social_security) || 0,
            student_loan: clean(student_loan) || 0,
            insurance: clean(insurance) || 0,
            insurance_income: clean(insurance_income) || 0,
            unpaid_absenteeism: clean(unpaid_absenteeism) || 0,
            tax: clean(tax) || 0,
            commissions: clean(commissions) || 0,
            bonus: clean(bonus) || 0,
            other_deductions: clean(other_deductions) || 0,
            other_benefits: clean(other_benefits) || 0,
            override_salary: clean(override_salary),
            normal_1_5x_hours_override: clean(normal_1_5x_hours_override),
            holiday_1_x_hours_override: clean(holiday_1_x_hours_override),
            holiday_3_x_hours_override: clean(holiday_3_x_hours_override),
            diligence_allowance_override: clean(diligence_allowance_override),
            meal_allowance_override: clean(meal_allowance_override),
            travel_allowance_override: clean(travel_allowance_override),
            accommodation_allowance_override: clean(accommodation_allowance_override),
            phone_allowance_override: clean(phone_allowance_override),
            position_allowance_override: clean(position_allowance_override),
            travel_site_allowance_override: clean(travel_site_allowance_override),
            travel_accommodation_override: clean(travel_accommodation_override),
        };

        const data = await prisma.monthly_payroll_data.upsert({
            where: {
                emp_id_cycle_month_cycle_year: {
                    emp_id,
                    cycle_month: Number(cycle_month),
                    cycle_year: Number(cycle_year)
                }
            },
            update: {
                ...dataInput,
                updated_at: new Date()
            },
            create: {
                emp_id,
                cycle_month: Number(cycle_month),
                cycle_year: Number(cycle_year),
                ...dataInput
            }
        });

        return NextResponse.json({ success: true, data });
    } catch (e: any) {
        console.error("Payroll Adjustments API Error:", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
