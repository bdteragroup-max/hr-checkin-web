import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
    try {
        await requireAdmin();
    } catch (e) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || new Date().getMonth().toString());
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

    // Cycle: 26th of prev month to 25th of current month
    // If month = 1 (Feb), prev month = 0 (Jan). So Jan 26 - Feb 25
    const startDate = new Date(year, month - 1, 26, 0, 0, 0);
    const endDate = new Date(year, month, 25, 23, 59, 59);

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

        // 2.10 Fetch Approved Travel & Off-Site Claims in this cycle
        const travelClaims = await prisma.travel_claims.findMany({
            where: {
                status: "approved",
                date: { gte: startDate, lte: endDate }
            }
        });

        // 3. Process each employee
        const results = employees.map(emp => {
            const baseSalary = Number(emp.base_salary) || 0;
            const hourlyWage = (baseSalary / 30) / 8;

            let isOtEligible = true;
            let otRule = "";

            if (baseSalary >= 20000) {
                isOtEligible = false;
                otRule = "ไม่เข้าเงื่อนไข (เงินเดือน ≥ 20,000)";
            } else {
                otRule = "เข้าเงื่อนไข (ตามจริง)";
            }

            const empOts = otRequests.filter((o: any) => o.emp_id === emp.emp_id);

            let normal_1_5x_hours = 0;
            let holiday_1x_hours = 0;
            let holiday_3x_hours = 0;
            let holiday_working_days = new Set<string>();

            if (isOtEligible) {
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

            // --- 4. CALCULATE ALLOWANCES (Diligence, Meal, Travel) ---
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
            let birthday_allowance = 0;
            let birthday_meal = 0;
            let travel_site_allowance = 0;
            let travel_accommodation = 0;
            let position_allowance = Number(emp.position_allowance) || 0;
            let diligence_failed_reason = "";
            let missingScanInCycle = false;

            // --- 4.2 LONG-SERVICE BENEFIT (DECEMBER ONLY) ---
            if (!isOnTrial && month === 12 && emp.hire_date) {
                const hDate = new Date(emp.hire_date);
                const yrs = endDate.getFullYear() - hDate.getFullYear();
                if (yrs >= 3 && yrs < 4) long_service_allowance = 3000;
                else if (yrs >= 4 && yrs < 5) long_service_allowance = 4000;
                else if (yrs >= 5 && yrs < 10) long_service_allowance = 10000;
                else if (yrs >= 10) long_service_allowance = 15000;
            }

            if (!isOnTrial && empWarnings.length === 0) {
                // Check Diligence Conditions for the whole cycle (Jan 26 - Feb 25)
                let hasLate = empCheckins.some(c => c.late_status === "late");
                let hasLeave = empLeaves.length > 0;

                // Count valid days for Meal & Travel
                let validWorkdaysCount = 0;

                let curr = new Date(startDate);
                while (curr <= endDate) {
                    const dateStr = fmt(curr);
                    const dayOfWeek = curr.getDay(); // 0=Sun, 6=Sat
                    const isHoliday = dayOfWeek === 0 || holidayDates.has(dateStr);

                    // Check for leave on this day (excluding Sundays and holidays implicitly, as they are not leave days)
                    const hasLeaveOnDay = !isHoliday && empLeaves.some(l => {
                        const start = fmt(l.start_date);
                        const end = fmt(l.end_date);
                        return dateStr >= start && dateStr <= end;
                    });

                    // Check for scans (Check-in/Out OR Project-In/Out)
                    const dayCheckins = empCheckins.filter(c => fmt(c.date_key) === dateStr);
                    const hasIn = dayCheckins.some(c => c.type === "Check-in" || c.type === "Project-In");
                    const hasOut = dayCheckins.some(c => c.type === "Check-out" || c.type === "Project-Out");
                    const scansComplete = hasIn && hasOut;

                    if (!isHoliday && !scansComplete) {
                        missingScanInCycle = true;
                    }

                    // Meal & Travel granted on any day worked (including holidays) if scans complete and no leave
                    if (scansComplete && !hasLeaveOnDay) {
                        validWorkdaysCount++;
                    }

                    curr.setDate(curr.getDate() + 1);
                }

                if (hasLate) diligence_failed_reason = "มีประวัติมาสาย";
                else if (hasLeave) diligence_failed_reason = "มีการลา";
                else if (missingScanInCycle) diligence_failed_reason = "ลืมสแกนนิ้วบางวัน";
                else diligence_allowance = 500;

                meal_allowance = validWorkdaysCount * 100;
                travel_allowance = validWorkdaysCount * 60;

                // --- 4.1 ACCOMMODATION ALLOWANCE ---
                // Rules: Passed probation, No warnings, Based on years of service
                if (emp.hire_date) {
                    const hDate = new Date(emp.hire_date);
                    // Years of service as of the 25th of the month
                    let yrs = endDate.getFullYear() - hDate.getFullYear();
                    const mDiff = endDate.getMonth() - hDate.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && endDate.getDate() < hDate.getDate())) {
                        yrs--;
                    }

                    if (yrs < 1) accommodation_allowance = 1500;
                    else if (yrs < 2) accommodation_allowance = 1800;
                    else if (yrs < 3) accommodation_allowance = 2100;
                    else if (yrs < 4) accommodation_allowance = 2400;
                    else if (yrs < 5) accommodation_allowance = 2700;
                    else accommodation_allowance = 3000;
                }
            } else if (isOnTrial) {
                diligence_failed_reason = "อยู่ระหว่างทดลองงาน";
            } else if (empWarnings.length > 0) {
                diligence_failed_reason = "มีใบเตือน";
            }

            // --- 4.3 TELEPHONE ALLOWANCE ---
            // Rules: No warnings, and explicitly chosen to receive allowance
            if (empWarnings.length === 0 && emp.has_telephone_allowance) {
                const pos = emp.job_positions?.title || "";
                const dept = emp.departments?.name || "";
                const hDate = emp.hire_date ? new Date(emp.hire_date) : null;

                let yrs = 0;
                if (hDate) {
                    yrs = endDate.getFullYear() - hDate.getFullYear();
                    const mDiff = endDate.getMonth() - hDate.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && endDate.getDate() < hDate.getDate())) {
                        yrs--;
                    }
                }

                if (pos.includes("ผู้จัดการ") || dept.includes("ผู้จัดการ")) telephone_allowance = 1000;
                else if (dept.includes("บุคคล") || pos.includes("บุคคล") || dept.includes("HR") || pos.includes("HR")) telephone_allowance = 800;
                else if (pos.includes("วิศว") || dept.includes("วิศว")) telephone_allowance = 500;
                else if (pos.includes("หัวหน้าช่าง") || pos.includes("ช่างอาวุโส")) telephone_allowance = 300;
                else if (pos.includes("ขับรถ") || dept.includes("ขนส่ง") || pos.toLowerCase().includes("driver")) telephone_allowance = 300;
                else { // Default to General Staff
                    if (yrs < 1) telephone_allowance = 100;
                    else if (yrs < 2) telephone_allowance = 200;
                    else telephone_allowance = 300;
                }
            }

            // --- 4.5 TRAVEL & OFF-SITE ALLOWANCE ---
            const empTravelClaims = travelClaims.filter((tc: any) => tc.emp_id === emp.emp_id);
            empTravelClaims.forEach((tc: any) => {
                let rate = 0;
                if (tc.claim_type === "upcountry") {
                    rate = 250; // All positions
                } else {
                    // Local Off-Site (Tiered)
                    const pos = emp.job_positions?.title || "";
                    if (pos.includes("ผู้จัดการ") || pos.includes("Manager")) rate = 350;
                    else if (pos.includes("วิศว") || pos.includes("Engineer")) rate = 250;
                    else if (pos.includes("หัวหน้า") || pos.includes("Supervisor") || pos.includes("ขับรถ") || pos.toLowerCase().includes("driver")) rate = 200;
                    else rate = 150; // General Staff
                }
                travel_site_allowance += rate;
                travel_accommodation += Number(tc.accommodation_amount);
            });

            const allowanceAmount = 0; // Holiday meal allowance (as per previous task)
            const totalHolidayAllowance = holiday_working_days.size * allowanceAmount;

            const normalOtPay = normal_1_5x_hours * hourlyWage * 1.5;
            const holiday1xPay = holiday_1x_hours * hourlyWage * 1;
            const holiday3xPay = holiday_3x_hours * hourlyWage * 3;

            const totalOtAmount = normalOtPay + holiday1xPay + holiday3xPay;
            const netPay = baseSalary + totalOtAmount + totalHolidayAllowance + diligence_allowance + meal_allowance + travel_allowance + accommodation_allowance + long_service_allowance + telephone_allowance + travel_site_allowance + travel_accommodation + position_allowance;

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
                net_pay: netPay,
                bank_name: (emp as any).bank_name || "Krung Thai Bank",
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
