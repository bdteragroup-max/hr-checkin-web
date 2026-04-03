import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/adminAuth";


export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        await requireAdmin();
    } catch (e) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

    // Cycle: 26th of prev month to 25th of current month
    // Example: If month = 3 (March), cycle = Feb 26 - March 25
    const startDate = new Date(year, month - 2, 26, 0, 0, 0);
    const endDate = new Date(year, month - 1, 25, 23, 59, 59);

    try {
        // 1. Fetch all active employees
        const employees = await prisma.employees.findMany({
            where: { is_active: true },
            include: {
                departments: true,
                job_positions: true,
            }
        });

        // 2. Fetch approved OT requests in this cycle
        const otRequests = await prisma.ot_requests.findMany({
            where: {
                status: "approved",
                date_for: { gte: startDate, lte: endDate }
            }
        });

        // Helper to get local YYYY-MM-DD string
        const fmt = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        };

        // 2.5 Fetch Public Holidays in this cycle
        const publicHolidays = await prisma.holidays.findMany({
            where: {
                date: { gte: startDate, lte: endDate }
            }
        });
        const holidayDates = new Set(publicHolidays.map(h => fmt(new Date(h.date))));

        // 2.6 Fetch All Checkins for the cycle to check for late/missed scans
        const checkins = await prisma.checkins.findMany({
            where: {
                date_key: { gte: startDate, lte: endDate }
            }
        });

        // 2.7 Fetch All Approved Leave Requests for the cycle
        const leaveRequests = await prisma.leave_requests.findMany({
            where: {
                status: "approved",
                OR: [
                    { start_date: { gte: startDate, lte: endDate } },
                    { end_date: { gte: startDate, lte: endDate } }
                ]
            }
        });

        // 2.8 Fetch All Warnings for the cycle
        const warnings = await prisma.employee_warnings.findMany({
            where: {
                date: { gte: startDate, lte: endDate }
            }
        });

        // 2.11 Fetch Adjustments
        const adjustments = await prisma.monthly_payroll_data.findMany({
            where: { cycle_month: month, cycle_year: year }
        });

        // 2.10 Fetch Approved Travel & Off-Site Claims in this cycle
        const travelClaims = await prisma.travel_claims.findMany({
            where: {
                status: "approved",
                date: { gte: startDate, lte: endDate }
            }
        });

        // 3. Process each employee
        const results = employees.map(emp => {
            const adj = adjustments.find(a => a.emp_id === emp.emp_id);
            const isOverridden = adj?.override_salary !== null && adj?.override_salary !== undefined;
            const baseSalaryInput = isOverridden ? Number(adj.override_salary) : (Number(emp.base_salary) || 0);
            const isDaily = (emp as any).salary_type === "daily";
            let baseSalary = baseSalaryInput;
            let hourlyWage = isDaily ? (baseSalaryInput / 8) : ((baseSalaryInput / 30) / 8);

            let isOtEligible = true;
            let otRule = "";

            if (baseSalary >= 20000 && !isDaily) {
                isOtEligible = false;
                otRule = "ไม่เข้าเงื่อนไข (เงินเดือน ≥ 20,000)";
            } else {
                isOtEligible = emp.job_positions?.is_ot_eligible ?? true;
                otRule = (emp.job_positions?.is_ot_eligible ?? true) ? "ได้รับ OT ตามปกติ" : "ไม่ได้รับ OT (ตามฐานข้อมูล)";
            }

            const empOts = otRequests.filter((o: any) => o.emp_id === emp.emp_id);

            let normal_1_5x_hours = 0;
            let holiday_1x_hours = 0;
            let holiday_3x_hours = 0;
            let holiday_working_days = new Set<string>();

            if (adj?.normal_1_5x_hours_override !== null && adj?.normal_1_5x_hours_override !== undefined) {
                normal_1_5x_hours = Number(adj.normal_1_5x_hours_override);
                holiday_1x_hours = Number(adj.holiday_1_x_hours_override || 0);
                holiday_3x_hours = Number(adj.holiday_3_x_hours_override || 0);
                // Note: when overriding hours, holiday_working_days remains empty (summing total sum)
            } else if (isOtEligible) {
                empOts.forEach((req: any) => {
                    const reqDate = new Date(req.date_for);
                    const reqDateStr = fmt(reqDate);

                    const isSunday = reqDate.getDay() === 0;
                    const isPublicHoliday = holidayDates.has(reqDateStr);
                    const isHoliday = isSunday || isPublicHoliday;

                    // Parse times properly based on the date_for
                    const startOT = new Date(req.start_time);
                    const endOT = new Date(req.end_time);
                    if (endOT <= startOT) endOT.setDate(endOT.getDate() + 1); // handle overnight shift

                    const totalHrsReq = (endOT.getTime() - startOT.getTime()) / (1000 * 60 * 60);

                    // --- EXCLUDE LUNCH BREAK (12:00 - 13:00) ---
                    const lunchStart = new Date(startOT);
                    lunchStart.setHours(12, 0, 0, 0);
                    const lunchEnd = new Date(startOT);
                    lunchEnd.setHours(13, 0, 0, 0);

                    const lunchOverlapStart = Math.max(startOT.getTime(), lunchStart.getTime());
                    const lunchOverlapEnd = Math.min(endOT.getTime(), lunchEnd.getTime());
                    const lunchOverlapHrs = Math.max(0, lunchOverlapEnd - lunchOverlapStart) / (1000 * 60 * 60);

                    const netTotalHrsReq = totalHrsReq - lunchOverlapHrs;
                    const approvedHrs = req.approved_hours !== null ? Number(req.approved_hours) : netTotalHrsReq;

                    // Ratio to scale down if approved < total net request
                    const ratio = netTotalHrsReq > 0 ? approvedHrs / netTotalHrsReq : 0;

                    if (!isHoliday) {
                        normal_1_5x_hours += approvedHrs;
                    } else {
                        holiday_working_days.add(reqDateStr);

                        const isSaturday = reqDate.getDay() === 6;

                        // Boundary for normal hours on the day of startOT
                        const boundaryStart = new Date(startOT);
                        boundaryStart.setHours(8, 0, 0, 0);
                        const boundaryEnd = new Date(startOT);
                        boundaryEnd.setHours(isSaturday ? 15 : 17, 0, 0, 0);

                        // Calculate intersect with normal hours
                        const overlapStart = Math.max(startOT.getTime(), boundaryStart.getTime());
                        const overlapEnd = Math.min(endOT.getTime(), boundaryEnd.getTime());
                        let overlapHrs = Math.max(0, overlapEnd - overlapStart) / (1000 * 60 * 60);

                        // Exclude lunch break from the normal hours overlap (since 12-13 is within normal hours)
                        const lunchInNormalStart = Math.max(overlapStart, lunchStart.getTime());
                        const lunchInNormalEnd = Math.min(overlapEnd, lunchEnd.getTime());
                        const lunchInNormalHrs = Math.max(0, lunchInNormalEnd - lunchInNormalStart) / (1000 * 60 * 60);

                        overlapHrs -= lunchInNormalHrs;

                        // Outside normal hours
                        const outsideHrs = netTotalHrsReq - overlapHrs;

                        // Apply the ratio if supervisor adjusted hours
                        holiday_1x_hours += overlapHrs * ratio;
                        holiday_3x_hours += outsideHrs * ratio;
                    }
                });
            }

            // --- 4. ALLOWANCES ---
            const empCheckins = checkins.filter(c => c.emp_id === emp.emp_id);
            const empLeaves = leaveRequests.filter(l => l.emp_id === emp.emp_id);
            const empWarnings = warnings.filter(w => w.emp_id === emp.emp_id);

            const isOnTrial = (emp as any).is_on_trial || false;
            let diligence_allowance = 0;
            let meal_allowance = 0;
            let travel_allowance = 0;
            let accommodation_allowance = 0;
            let long_service_allowance = 0;
            let telephone_allowance = 0;
            let travel_site_allowance = 0;
            let travel_accommodation = 0;
            let position_allowance = 0;
            let diligence_failed_reason = "";
            let missingScanInCycle = false;

            // 4.1 ACCOMMODATION (Auto-calc only if not overridden)
            if (adj?.accommodation_allowance_override !== null && adj?.accommodation_allowance_override !== undefined) {
                accommodation_allowance = Number(adj.accommodation_allowance_override);
            } else if (!isDaily && empWarnings.length === 0 && !isOnTrial && emp.hire_date) {
                const hDate = new Date(emp.hire_date);
                let yrs = endDate.getFullYear() - hDate.getFullYear();
                const mDiff = endDate.getMonth() - hDate.getMonth();
                if (mDiff < 0 || (mDiff === 0 && endDate.getDate() < hDate.getDate())) yrs--;

                if (yrs < 1) accommodation_allowance = 1500;
                else if (yrs < 2) accommodation_allowance = 1800;
                else if (yrs < 3) accommodation_allowance = 2100;
                else if (yrs < 4) accommodation_allowance = 2400;
                else if (yrs < 5) accommodation_allowance = 2700;
                else accommodation_allowance = 3000;
            }

            // 4.2 Diligence, Meal, Travel (Auto-calc only if not overridden)
            if (!isOnTrial && empWarnings.length === 0) {
                const hasLate = empCheckins.some(c => c.late_status === "late");
                const hasLeave = empLeaves.length > 0;
                let totalPaidDays = 0;
                let validWorkdaysCount = 0;

                let curr = new Date(startDate);
                while (curr <= endDate) {
                    const dateStr = fmt(curr);
                    const isHoliday = curr.getDay() === 0 || holidayDates.has(dateStr);
                    const dayCheckins = empCheckins.filter(c => fmt(c.date_key) === dateStr);
                    const scansComplete = dayCheckins.some(c => ["Check-in", "Project-In", "Offsite-In"].includes(c.type)) && dayCheckins.some(c => ["Check-out", "Project-Out", "Offsite-Out"].includes(c.type));

                    // ✅ Check-in Exemption Logic
                    const isExempt = (emp as any).is_checkin_exempt || false;
                    const isOnLeave = empLeaves.some(l => dateStr >= fmt(l.start_date) && dateStr <= fmt(l.end_date));

                    if (!isHoliday && !scansComplete) missingScanInCycle = true;

                    if (scansComplete) {
                        totalPaidDays++;
                        if (!isOnLeave) {
                            validWorkdaysCount++;
                        }
                    } else if (isExempt && !isHoliday) {
                        // ✅ For exempt employees, count working days even without scans
                        totalPaidDays++;
                        if (!isOnLeave) {
                            validWorkdaysCount++;
                        }
                    }
                    curr.setDate(curr.getDate() + 1);
                }

                if (isDaily && !isOverridden) {
                    baseSalary = totalPaidDays * baseSalaryInput;
                }

                if (adj?.diligence_allowance_override !== null && adj?.diligence_allowance_override !== undefined) {
                    diligence_allowance = Number(adj.diligence_allowance_override);
                } else if (!isDaily && !hasLate && !hasLeave && !missingScanInCycle) {
                    diligence_allowance = Number((emp as any).diligence_allowance || 0) || 0;
                }

                if (adj?.meal_allowance_override !== null && adj?.meal_allowance_override !== undefined) {
                    meal_allowance = Number(adj.meal_allowance_override);
                } else if (!isDaily) {
                    meal_allowance = validWorkdaysCount * 100;
                }

                if (adj?.travel_allowance_override !== null && adj?.travel_allowance_override !== undefined) {
                    travel_allowance = Number(adj.travel_allowance_override);
                } else if (!isDaily) {
                    travel_allowance = validWorkdaysCount * 60;
                }
            } else {
                if (isOnTrial) diligence_failed_reason = "อยู่ระหว่างทดลองงาน";
                else if (empWarnings.length > 0) diligence_failed_reason = "มีใบเตือน";

                // Still allow overrides even if probation/warning
                if (adj?.diligence_allowance_override !== null && adj?.diligence_allowance_override !== undefined) diligence_allowance = Number(adj.diligence_allowance_override);
                if (adj?.meal_allowance_override !== null && adj?.meal_allowance_override !== undefined) meal_allowance = Number(adj.meal_allowance_override);
                if (adj?.travel_allowance_override !== null && adj?.travel_allowance_override !== undefined) travel_allowance = Number(adj.travel_allowance_override);
                if (adj?.accommodation_allowance_override !== null && adj?.accommodation_allowance_override !== undefined) accommodation_allowance = Number(adj.accommodation_allowance_override);
            }

            // 4.3 Position & Phone & Travel Claims
            position_allowance = adj?.position_allowance_override !== null && adj?.position_allowance_override !== undefined
                ? Number(adj.position_allowance_override)
                : (isDaily ? 0 : (Number(emp.position_allowance) || 0));

            telephone_allowance = adj?.phone_allowance_override !== null && adj?.phone_allowance_override !== undefined
                ? Number(adj.phone_allowance_override)
                : ((!isDaily && empWarnings.length === 0 && emp.has_telephone_allowance) ? 300 : 0);

            if (adj?.travel_site_allowance_override !== null && adj?.travel_site_allowance_override !== undefined) {
                travel_site_allowance = Number(adj.travel_site_allowance_override);
            } else if (!isDaily) {
                const empTravelClaims = travelClaims.filter((tc: any) => tc.emp_id === emp.emp_id);
                empTravelClaims.forEach((tc: any) => {
                    let rate = 0;
                    if (tc.claim_type === "upcountry") rate = 250;
                    else rate = 150;
                    const start = new Date(tc.date);
                    const end = tc.end_date ? new Date(tc.end_date) : start;
                    const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    travel_site_allowance += rate * days;
                });
            }

            if (adj?.travel_accommodation_override !== null && adj?.travel_accommodation_override !== undefined) {
                travel_accommodation = Number(adj.travel_accommodation_override);
            } else if (!isDaily) {
                const empTravelClaims = travelClaims.filter((tc: any) => tc.emp_id === emp.emp_id);
                empTravelClaims.forEach((tc: any) => { travel_accommodation += Number(tc.accommodation_amount) || 0; });
            }

            // 4.4 Long-service (December)
            if (!isDaily && !isOnTrial && month === 12 && emp.hire_date) {
                const hDate = new Date(emp.hire_date);
                let yrs = endDate.getFullYear() - hDate.getFullYear();
                if (yrs >= 3 && yrs < 4) long_service_allowance = 3000;
                else if (yrs >= 4 && yrs < 5) long_service_allowance = 4000;
                else if (yrs >= 5 && yrs < 10) long_service_allowance = 10000;
                else if (yrs >= 10) long_service_allowance = 15000;
            }

            const totalHolidayAllowance = 0;
            const normalOtPay = normal_1_5x_hours * hourlyWage * 1.5;
            const holiday1xPay = holiday_1x_hours * hourlyWage * 1;
            const holiday3xPay = holiday_3x_hours * hourlyWage * 3;
            const totalOtAmount = normalOtPay + holiday1xPay + holiday3xPay;

            const netPayCalculated = baseSalary + totalOtAmount + totalHolidayAllowance + diligence_allowance + meal_allowance + travel_allowance + accommodation_allowance + long_service_allowance + telephone_allowance + travel_site_allowance + travel_accommodation + position_allowance;

            const student_loan = Number(adj?.student_loan || 0);
            const unpaid_absenteeism = Number(adj?.unpaid_absenteeism || 0);

            // --- 5. SOCIAL SECURITY (SSO) FORMULA ---
            let social_security = 0;
            if (adj?.social_security !== null && adj?.social_security !== undefined) {
                social_security = Number(adj.social_security);
            } else {
                const ssoBase = Math.max(0, baseSalary - unpaid_absenteeism);
                if (ssoBase > 1650 && !isDaily) {
                    const cappedBase = Math.min(17500, ssoBase);
                    social_security = Math.round(cappedBase * 0.05);
                }
            }

            const tax = Number(adj?.tax || 0);
            const commissions = Number(adj?.commissions || 0);
            const bonus = Number(adj?.bonus || 0);
            const other_deductions = Number(adj?.other_deductions || 0);
            const other_benefits = Number(adj?.other_benefits || 0);

            const grossPay = netPayCalculated + commissions + bonus + other_benefits;
            const finalNetPay = grossPay - social_security - student_loan - other_deductions - unpaid_absenteeism - tax;

            return {
                emp_id: emp.emp_id,
                name: emp.name,
                department: emp.departments?.name || "N/A",
                position: emp.job_positions?.title || "N/A",
                base_salary: baseSalary,
                hourly_wage: hourlyWage,
                is_ot_eligible: isOtEligible,
                ot_rule: otRule,
                is_on_trial: isOnTrial,

                normal_1_5x_hours,
                normal_ot_pay: normalOtPay,

                holiday_1x_hours,
                holiday_1x_pay: holiday1xPay,

                holiday_3x_hours,
                holiday_3x_pay: holiday3xPay,

                holiday_working_days: holiday_working_days.size,
                holiday_allowance: totalHolidayAllowance,

                diligence_allowance,
                diligence_failed_reason,
                meal_allowance,
                travel_allowance,
                accommodation_allowance,
                long_service_allowance,
                telephone_allowance,
                travel_site_allowance,
                travel_accommodation,
                position_allowance,

                total_ot_hours: normal_1_5x_hours + holiday_1x_hours + holiday_3x_hours,
                ot_amount: totalOtAmount,
                social_security,
                student_loan,
                unpaid_absenteeism,
                tax,
                commissions,
                bonus,
                other_deductions,
                other_benefits,
                gross_pay: grossPay,
                net_pay: finalNetPay,
                bank_name: (emp as any).bank_name || "-",
                bank_account_no: (emp as any).bank_account_no || "-",
            };
        });

        return NextResponse.json({
            cycle: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                month,
                year
            },
            list: results
        });

    } catch (error: any) {
        console.error("Payroll API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
