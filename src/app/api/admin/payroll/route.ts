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
        const employees = await prisma.employees.findMany({
            where: {
                OR: [
                    { is_active: true },
                    { resignation_date: { gte: startDate } }
                ]
            },
            include: {
                departments: {
                    include: {
                        divisions: true
                    }
                },
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

        // 2.11.1 Fetch Previous Month Adjustments (for carrying over Tax)
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear--;
        }
        const prevAdjustments = await prisma.monthly_payroll_data.findMany({
            where: { cycle_month: prevMonth, cycle_year: prevYear }
        });

        // 2.10 Fetch Approved Travel & Off-Site Claims in this cycle
        const travelClaims = await prisma.travel_claims.findMany({
            where: {
                status: "approved",
                date: { gte: startDate, lte: endDate }
            }
        });

        // 2.12 Fetch Approved Welfare Claims in this cycle
        const welfareClaims = await prisma.general_welfare_claims.findMany({
            where: {
                status: "approved",
                approved_at: { gte: startDate, lte: endDate }
            }
        });

        // 2.13 Fetch Approved Commission Claims in this cycle
        const commissionClaims = await prisma.commission_claims.findMany({
            where: {
                status: "completed",
                OR: [
                    { approved_at: { gte: startDate, lte: endDate } },
                    { date: { gte: startDate, lte: endDate } }
                ]
            }
        });

        // 3. Process each employee
        const results = employees.map(emp => {
            const adj = adjustments.find(a => a.emp_id === emp.emp_id);
            const prevAdj = prevAdjustments.find(a => a.emp_id === emp.emp_id);
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
                    const isHolidayAtStart = isHoliday;
                    const endOT = new Date(req.end_time);
                    if (endOT <= startOT) endOT.setDate(endOT.getDate() + 1); // handle overnight shift

                    // Helper to check holiday for a specific datetime
                    const checkIsHoliday = (d: Date) => {
                        const ds = fmt(d);
                        return d.getDay() === 0 || holidayDates.has(ds);
                    };

                    const isSaturdayAtStart = startOT.getDay() === 6;

                    // Split logic for overnight crossing midnight
                    const totalHrsReq = (endOT.getTime() - startOT.getTime()) / (1000 * 60 * 60);
                    const lunchStart = new Date(startOT); lunchStart.setHours(12, 0, 0, 0);
                    const lunchEnd = new Date(startOT); lunchEnd.setHours(13, 0, 0, 0);
                    const lunchOverlapStart = Math.max(startOT.getTime(), lunchStart.getTime());
                    const lunchOverlapEnd = Math.min(endOT.getTime(), lunchEnd.getTime());
                    const lunchOverlapHrs = Math.max(0, lunchOverlapEnd - lunchOverlapStart) / (1000 * 60 * 60);
                    const netTotalHrsReq = totalHrsReq - lunchOverlapHrs;
                    const approvedHrs = req.approved_hours !== null ? Number(req.approved_hours) : netTotalHrsReq;
                    const ratio = netTotalHrsReq > 0 ? approvedHrs / netTotalHrsReq : 0;

                    // If it stays within the same day
                    if (fmt(startOT) === fmt(endOT)) {
                        if (!isHolidayAtStart) {
                            normal_1_5x_hours += approvedHrs;
                        } else {
                            holiday_working_days.add(fmt(startOT));
                            const boundaryStart = new Date(startOT); boundaryStart.setHours(8, 0, 0, 0);
                            const boundaryEnd = new Date(startOT); boundaryEnd.setHours(isSaturdayAtStart ? 15 : 17, 0, 0, 0);
                            const overlapStart = Math.max(startOT.getTime(), boundaryStart.getTime());
                            const overlapEnd = Math.min(endOT.getTime(), boundaryEnd.getTime());
                            let overlapHrsTotal = Math.max(0, overlapEnd - overlapStart) / (1000 * 60 * 60);
                            const lunchInNormalStart = Math.max(overlapStart, lunchStart.getTime());
                            const lunchInNormalEnd = Math.min(overlapEnd, lunchEnd.getTime());
                            overlapHrsTotal -= Math.max(0, lunchInNormalEnd - lunchInNormalStart) / (1000 * 60 * 60);
                            const outsideHrs = netTotalHrsReq - overlapHrsTotal;
                            holiday_1x_hours += overlapHrsTotal * ratio;
                            holiday_3x_hours += outsideHrs * ratio;
                        }
                    } else {
                        // CROSSES MIDNIGHT - Split at 00:00:00
                        const midnight = new Date(startOT);
                        midnight.setDate(midnight.getDate() + 1);
                        midnight.setHours(0, 0, 0, 0);

                        const part1HrsTotal = (midnight.getTime() - startOT.getTime()) / (1000 * 60 * 60);
                        const part1LunchStart = Math.max(startOT.getTime(), lunchStart.getTime());
                        const part1LunchEnd = Math.min(midnight.getTime(), lunchEnd.getTime());
                        const part1NetHrs = part1HrsTotal - Math.max(0, part1LunchEnd - part1LunchStart) / (1000 * 60 * 60);

                        const part2HrsTotal = (endOT.getTime() - midnight.getTime()) / (1000 * 60 * 60);
                        const part2NetHrs = part2HrsTotal; // Usually no lunch at midnight+

                        // Part 1 logic
                        if (!isHolidayAtStart) {
                            normal_1_5x_hours += part1NetHrs * ratio;
                        } else {
                            holiday_working_days.add(fmt(startOT));
                            const bStart = new Date(startOT); bStart.setHours(8, 0, 0, 0);
                            const bEnd = new Date(startOT); bEnd.setHours(isSaturdayAtStart ? 15 : 17, 0, 0, 0);
                            const oStart = Math.max(startOT.getTime(), bStart.getTime());
                            const oEnd = Math.min(midnight.getTime(), bEnd.getTime());
                            let oHrs = Math.max(0, oEnd - oStart) / (1000 * 60 * 60);
                            oHrs -= Math.max(0, part1LunchEnd - part1LunchStart) / (1000 * 60 * 60);
                            holiday_1x_hours += oHrs * ratio;
                            holiday_3x_hours += (part1NetHrs - oHrs) * ratio;
                        }

                        // Part 2 logic (Next Day)
                        const isHolidayNext = checkIsHoliday(midnight);
                        if (!isHolidayNext) {
                            normal_1_5x_hours += part2NetHrs * ratio;
                        } else {
                            holiday_working_days.add(fmt(midnight));
                            // Usually midnight shifts are non-normal hours (3x)
                            holiday_3x_hours += part2NetHrs * ratio;
                        }
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
            let general_allowance = 0;
            let diligence_failed_reason = "";
            let missingScanInCycle = false;
            const hasWarnings = empWarnings.length > 0;

            // 4.1 ACCOMMODATION (Auto-calc only if not overridden)
            if (adj?.accommodation_allowance_override !== null && adj?.accommodation_allowance_override !== undefined) {
                accommodation_allowance = Number(adj.accommodation_allowance_override);
            } else if (Number((emp as any).fixed_accommodation_allowance) > 0) {
                accommodation_allowance = Number((emp as any).fixed_accommodation_allowance);
            } else if (!isDaily && empWarnings.length === 0 && (!isOnTrial || (emp as any).probation_accommodation_allowance) && emp.hire_date) {
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

            // 4.2 Attendance, Meal, Travel (Calculated for all active employees)
            let totalPaidDays = 0;
            let mealWorkdays = 0;
            let travelWorkdays = 0;

            let curr = new Date(startDate);
            while (curr <= endDate) {
                const dateStr = fmt(curr);
                const isHoliday = curr.getDay() === 0 || holidayDates.has(dateStr);
                const dayCheckins = empCheckins.filter(c => fmt(c.date_key) === dateStr);
                
                const hasIn = dayCheckins.some(c => ["Check-in", "Project-In", "Offsite-In"].includes(c.type));
                const hasOut = dayCheckins.some(c => ["Check-out", "Project-Out", "Offsite-Out"].includes(c.type));
                const scansComplete = hasIn && hasOut;

                const isExempt = (emp as any).is_checkin_exempt || false;
                const empResignationDate = (emp as any).resignation_date ? new Date((emp as any).resignation_date) : null;
                const isResigned = empResignationDate && curr > empResignationDate;

                if (isResigned) {
                    curr.setDate(curr.getDate() + 1);
                    continue;
                }

                const isOnLeave = empLeaves.some(l => dateStr >= fmt(l.start_date) && dateStr <= fmt(l.end_date));
                
                if (scansComplete || (isExempt && !isHoliday)) {
                    totalPaidDays++;
                }

                // Meal and Travel should be paid for ANY day worked, even holidays
                if (!isOnLeave) {
                    if (scansComplete) {
                        if (!hasWarnings) {
                            if (!isOnTrial || (emp as any).probation_meal_allowance) mealWorkdays++;
                            if (!isOnTrial || (emp as any).probation_travel_allowance) travelWorkdays++;
                        }
                    } else if (isExempt) {
                        if (!hasWarnings) {
                            if (!isOnTrial || (emp as any).probation_meal_allowance) mealWorkdays++;
                            if (!isOnTrial || (emp as any).probation_travel_allowance) travelWorkdays++;
                        }
                    } else if (!isHoliday && !scansComplete) {
                        missingScanInCycle = true;
                    }
                }

                curr.setDate(curr.getDate() + 1);
            }

            if (isDaily && !isOverridden) {
                baseSalary = totalPaidDays * baseSalaryInput;
            }

            // 4.2.1 Diligence Allowance (Requires passing probation and NO warnings)
            if (!isOnTrial && empWarnings.length === 0) {
                if (adj?.diligence_allowance_override !== null && adj?.diligence_allowance_override !== undefined) {
                    diligence_allowance = Number(adj.diligence_allowance_override);
                } else if (!isDaily && mealWorkdays >= 20 && !missingScanInCycle) {
                    diligence_allowance = Number((emp as any).diligence_allowance || 0) || 0;
                }
            } else {
                if (isOnTrial) diligence_failed_reason = "อยู่ระหว่างทดลองงาน";
                else if (empWarnings.length > 0) diligence_failed_reason = "มีใบเตือนในรอบเดือนนี้";
            }

            if (adj?.meal_allowance_override !== null && adj?.meal_allowance_override !== undefined) {
                meal_allowance = Number(adj.meal_allowance_override);
            } else if (Number((emp as any).fixed_meal_allowance) > 0) {
                meal_allowance = Number((emp as any).fixed_meal_allowance);
            } else if (!isDaily) {
                meal_allowance = mealWorkdays * 100;
            }

            if (adj?.travel_allowance_override !== null && adj?.travel_allowance_override !== undefined) {
                travel_allowance = Number(adj.travel_allowance_override);
            } else if (Number((emp as any).fixed_travel_allowance) > 0) {
                travel_allowance = Number((emp as any).fixed_travel_allowance);
            } else if (!isDaily) {
                travel_allowance = travelWorkdays * 60;
            }
            // 4.3 Position & Phone & Travel Claims
            position_allowance = adj?.position_allowance_override !== null && adj?.position_allowance_override !== undefined
                ? Number(adj.position_allowance_override)
                : (isDaily ? 0 : (Number(emp.position_allowance) || 0));

            general_allowance = adj?.general_allowance_override !== null && adj?.general_allowance_override !== undefined
                ? Number(adj.general_allowance_override)
                : (isDaily ? 0 : (Number((emp as any).general_allowance) || 0));

            // --- 4.3.1 TELEPHONE ALLOWANCE POLICY (New Rules) ---
            let calculatedPhoneAllowance = 0;
            if (!isDaily && emp.has_telephone_allowance) {
                const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
                let yearsOfService = 0;
                if (hireDate) {
                    yearsOfService = endDate.getFullYear() - hireDate.getFullYear();
                    const mDiff = endDate.getMonth() - hireDate.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && endDate.getDate() < hireDate.getDate())) yearsOfService--;
                }

                const deptName = (emp.departments?.name || "").toLowerCase();
                const posName = (emp.job_positions?.title || "").toLowerCase();
                const divName = (emp.departments?.divisions?.name || "").toLowerCase();

                // 1. Manager (High Priority)
                if (posName.includes("ผู้จัดการ") || posName.includes("manager")) {
                    calculatedPhoneAllowance = 1000;
                }
                // 2. HR / Admin Division
                else if (divName.includes("บุคคล") || divName.includes("admin") || divName.includes("hr")) {
                    calculatedPhoneAllowance = 800;
                }
                // 3. Engineering Dept or Engineer Position
                else if (posName.includes("วิศวกร") || posName.includes("engineer") || deptName.includes("engineering") || deptName.includes("วิศว") || divName.includes("engineering") || divName.includes("วิศว")) {
                    calculatedPhoneAllowance = 500;
                }
                // 4. Foreman or Driver
                else if (posName.includes("หัวหน้าช่าง") || posName.includes("foreman") || posName.includes("ขับรถ") || posName.includes("driver")) {
                    calculatedPhoneAllowance = 300;
                }
                else {
                    // General Staff - based on years of service
                    if (yearsOfService < 1) calculatedPhoneAllowance = 100;
                    else if (yearsOfService < 2) calculatedPhoneAllowance = 200;
                    else calculatedPhoneAllowance = 300;
                }
            }

            // Warning Letter Rule: No allowances if warned in this month
            if (empWarnings.length > 0) {
                calculatedPhoneAllowance = 0;
            }

            telephone_allowance = adj?.phone_allowance_override !== null && adj?.phone_allowance_override !== undefined
                ? Number(adj.phone_allowance_override)
                : calculatedPhoneAllowance;

            if (adj?.travel_site_allowance_override !== null && adj?.travel_site_allowance_override !== undefined) {
                travel_site_allowance = Number(adj.travel_site_allowance_override);
            } else if (!isDaily) {
                const posName = (emp.job_positions?.title || "").toLowerCase();
                const empTravelClaims = travelClaims.filter((tc: any) => tc.emp_id === emp.emp_id);
                const deptName = (emp.departments?.name || "").toLowerCase();
                const divName = (emp.departments?.divisions?.name || "").toLowerCase();
                empTravelClaims.forEach((tc: any) => {
                    let rate = 150; // Default Staff rate
                    if (posName.includes("ผู้จัดการ") || posName.includes("manager")) rate = 350;
                    else if (posName.includes("วิศวกร") || posName.includes("engineer") || deptName.includes("engineering") || deptName.includes("วิศว") || divName.includes("engineering") || divName.includes("วิศว") || deptName.includes("business development") || divName.includes("business development")) rate = 250;
                    else if (posName.includes("หัวหน้าช่าง") || posName.includes("foreman")) rate = 200;
                    else if (posName.includes("ขับรถ") || posName.includes("driver")) rate = 200;

                    // Exclude sales roles and departments
                    if (posName.includes("sales") || posName.includes("ขาย") || deptName.includes("sales") || deptName.includes("ขาย") || divName.includes("sales") || divName.includes("ขาย")) rate = 0;

                    const start = new Date(tc.date);
                    const end = tc.end_date ? new Date(tc.end_date) : start;
                    const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

            // 4.5 General Welfare Claims
            const empWelfare = welfareClaims.filter(w => w.emp_id === emp.emp_id);
            const welfare_amount = empWelfare.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
            const normalOtPay = normal_1_5x_hours * hourlyWage * 1.5;
            const holiday1xPay = holiday_1x_hours * hourlyWage * 1;
            const holiday3xPay = holiday_3x_hours * hourlyWage * 3;
            const totalOtAmount = normalOtPay + holiday1xPay + holiday3xPay;

            // 4.6 Commission Claims
            const empCommissionClaimsAsMain = commissionClaims.filter(c => c.emp_id === emp.emp_id);
            const empCommissionClaimsAsCompanion = commissionClaims.filter(c => c.companion_ids && c.companion_ids.includes(emp.emp_id));
            // Deduplicate claims by customer_name and date
            const uniqueClaimsMap = new Map<string, number>();
            const addClaim = (c: any) => {
                try {
                    const dateStr = new Date(c.date).toISOString().split('T')[0];
                    const customerName = (c.customer_name || "").toLowerCase().trim();
                    const key = `${customerName}-${dateStr}`;
                    const amount = Number(c.per_person_commission || 0);
                    if (!uniqueClaimsMap.has(key) || uniqueClaimsMap.get(key)! < amount) {
                        uniqueClaimsMap.set(key, amount);
                    }
                } catch (e) {
                    uniqueClaimsMap.set(c.id, Number(c.per_person_commission || 0));
                }
            };
            
            empCommissionClaimsAsMain.forEach(addClaim);
            empCommissionClaimsAsCompanion.forEach(addClaim);
            
            const calculatedCommissions = Array.from(uniqueClaimsMap.values()).reduce((a, b) => a + b, 0);

            const totalHolidayAllowance = 0;
            const netPayCalculated = baseSalary + totalOtAmount + totalHolidayAllowance + diligence_allowance + meal_allowance + travel_allowance + accommodation_allowance + long_service_allowance + telephone_allowance + travel_site_allowance + travel_accommodation + position_allowance + general_allowance + welfare_amount;

            const student_loan = Number(adj?.student_loan || 0);

            // 5. AUTOMATED UNPAID LEAVE DEDUCTION
            let auto_unpaid_deduction = 0;
            if (!isDaily) {
                // For monthly staff, sum up approved unpaid leave days
                const unpaidLeaves = empLeaves.filter(l => l.leave_type_id === "unpaid");
                let unpaidDaysCount = 0;
                unpaidLeaves.forEach(l => {
                    // Intersection of leave dates and cycle
                    let currL = new Date(l.start_date);
                    const endL = new Date(l.end_date);
                    while (currL <= endL) {
                        if (currL >= startDate && currL <= endDate) {
                            unpaidDaysCount++;
                        }
                        currL.setDate(currL.getDate() + 1);
                    }
                });
                auto_unpaid_deduction = Math.round(unpaidDaysCount * (Number(emp.base_salary || 0) / 30));
            }

            const unpaid_absenteeism = adj?.unpaid_absenteeism !== null && adj?.unpaid_absenteeism !== undefined
                ? Number(adj.unpaid_absenteeism)
                : auto_unpaid_deduction;

            // --- 5. SOCIAL SECURITY (SSO) FORMULA (2026 Rules) ---
            let social_security = 0;
            if (adj?.social_security !== null && adj?.social_security !== undefined) {
                social_security = Number(adj.social_security);
            } else {
                // Per user: This deduction will not apply to daily wage earners.
                if (!isDaily) {
                    // SSO is calculated on Base Salary + Position Allowance
                    const ssoBase = Math.max(0, baseSalary + position_allowance - unpaid_absenteeism);
                    
                    // 2026 Adjusted Rules: Max deduction 875 THB for earnings >= 17,500 THB
                    if (ssoBase >= 1650) {
                        const cappedBase = Math.min(17500, ssoBase);
                        social_security = Math.round(cappedBase * 0.05);
                    }
                }
            }

            const insurance = Number(adj?.insurance || 0);

            // Use manual override if entered (> 0), otherwise use fixed profile deduction, otherwise fallback to prev month
            const tax = (adj?.tax !== null && adj?.tax !== undefined && Number(adj.tax) > 0) 
                ? Number(adj.tax) 
                : (Number((emp as any).fixed_tax_deduction) > 0 ? Number((emp as any).fixed_tax_deduction) : Number(prevAdj?.tax || 0));
            const adjCommissions = adj?.commissions ? Number(adj.commissions) : 0;
            const commissions = adjCommissions !== 0 ? adjCommissions : calculatedCommissions;
            
            if (emp.emp_id === "TP02211") {
                console.log("DEBUG TP02211 commissions:", commissions, "calculated:", calculatedCommissions, "adj:", adj?.commissions);
            }

            const bonus = Number(adj?.bonus || 0);
            const other_deductions = Number(adj?.other_deductions || 0);
            const other_benefits = Number(adj?.other_benefits || 0);

            const grossPay = netPayCalculated + commissions + bonus + other_benefits;
            const finalNetPay = grossPay - social_security - student_loan - insurance - other_deductions - unpaid_absenteeism - tax;

            return {
                emp_id: emp.emp_id,
                name: emp.name,
                department: emp.departments?.name || "N/A",
                division: emp.departments?.divisions?.name || "N/A",
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
                general_allowance,

                total_ot_hours: normal_1_5x_hours + holiday_1x_hours + holiday_3x_hours,
                ot_amount: totalOtAmount,
                social_security,
                student_loan,
                insurance,
                unpaid_absenteeism,
                tax,
                commissions,
                bonus,
                other_deductions,
                other_benefits,
                welfare_amount,
                gross_pay: grossPay,
                net_pay: finalNetPay,
                bank_name: (emp as any).bank_name || "-",
                bank_account_no: (emp as any).bank_account_no || "-",
                is_published: adj?.is_published || false,
                raw_adjustments: adj || null,
            };
        });

        const isPublished = adjustments.length > 0 ? adjustments[0].is_published : false;

        return NextResponse.json({
            cycle: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                month,
                year,
                is_published: isPublished
            },
            list: results
        });

    } catch (error: any) {
        console.error("Payroll API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
