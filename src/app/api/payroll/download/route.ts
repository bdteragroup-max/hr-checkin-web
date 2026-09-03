// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";
import { toBangkokWallClock } from "@/utils/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

async function loadFontBytes(relPath: string) {
    const abs = path.join(process.cwd(), relPath);
    return fs.readFile(abs);
}
const formatB = (num: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);

function ThaiBahtText(amount: number): string {
    if (amount === 0) return 'ศูนย์บาทถ้วน';
    const data = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const unit = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

    let numberStr = Math.abs(amount).toFixed(2);
    let [baht, satang] = numberStr.split('.');

    const convert = (str: string) => {
        let text = '';
        let length = str.length;
        for (let i = 0; i < length; i++) {
            const n = parseInt(str[i]);
            let p = length - i - 1;
            let u = p % 6;
            let isMillion = p > 0 && u === 0;

            if (n !== 0) {
                if (u === 0 && n === 1 && length > 1 && i > 0 && str[i - 1] !== '0') text += 'เอ็ด';
                else if (u === 1 && n === 1) text += 'สิบ';
                else if (u === 1 && n === 2) text += 'ยี่สิบ';
                else text += data[n] + unit[u];
            }
            if (isMillion && parseInt(str.substring(Math.max(0, i - 5), i + 1)) > 0) text += 'ล้าน';
        }
        return text;
    };

    let bahtText = baht === '0' || baht === '' ? 'ศูนย์' : convert(baht);
    let satangText = satang === '00' ? '' : convert(satang);

    let result = amount < 0 ? 'ลบ' : '';
    if (bahtText !== 'ศูนย์' || satangText === '') result += bahtText + 'บาท';
    if (satangText !== '') result += satangText + 'สตางค์';
    result += 'ถ้วน';
    return result;
}

export async function GET(request: Request) {
    throw new Error("TODO: Payroll is under maintenance for allowance schema changes");
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        let p: any;
        try {
            p = verifyToken(token);
        } catch {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get("month") || "");
        const year = parseInt(searchParams.get("year") || "");

        if (!month || !year) return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });

        // 1. Check if published and grab overrides
        const publishedData = await prisma.monthly_payroll_data.findFirst({
            where: {
                emp_id: p.emp_id,
                cycle_month: month,
                cycle_year: year,
                is_published: true
            }
        });

        if (!publishedData) {
            return NextResponse.json({ error: "PAYSLIP_NOT_FOUND_OR_NOT_PUBLISHED" }, { status: 403 });
        }

        // 2. Fetch Employee
        const emp = await prisma.employees.findUnique({
            where: { emp_id: p.emp_id },
            include: { departments: { include: { divisions: true } }, job_positions: true }
        });
        if (!emp) return NextResponse.json({ error: "EMP_NOT_FOUND" }, { status: 404 });

        // Calculate cycle range
        const startDate = new Date(year, month - 2, 26, 0, 0, 0);
        const endDate = new Date(year, month - 1, 25, 23, 59, 59);

        // Fetch dependent data to calculate exact OT and allowances (Same logic as Admin route)
        const otRequests = await prisma.ot_requests.findMany({
            where: { emp_id: p.emp_id, status: "approved", date_for: { gte: startDate, lte: endDate } }
        });
        const fmt = (d: Date) => {
            const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        };
        const publicHolidays = await prisma.holidays.findMany({ where: { date: { gte: startDate, lte: endDate } } });
        const holidayDates = new Set(publicHolidays.map(h => fmt(new Date(h.date))));
        const checkins = await prisma.checkins.findMany({ where: { emp_id: p.emp_id, date_key: { gte: startDate, lte: endDate } } });
        const leaveRequests = await prisma.leave_requests.findMany({
            where: { emp_id: p.emp_id, status: "approved", OR: [{ start_date: { gte: startDate, lte: endDate } }, { end_date: { gte: startDate, lte: endDate } }] }
        });
        const warnings = await prisma.employee_warnings.findMany({ where: { emp_id: p.emp_id, date: { gte: startDate, lte: endDate } } });
        const travelClaims = await prisma.travel_claims.findMany({ where: { emp_id: p.emp_id, status: "approved", date: { gte: startDate, lte: endDate } } });
        const welfareClaims = await prisma.general_welfare_claims.findMany({ where: { emp_id: p.emp_id, status: "approved", created_at: { gte: startDate, lte: endDate } } });
        const commissionClaims = await prisma.commission_claims.findMany({
            where: {
                status: "completed",
                approved_at: { gte: startDate, lte: endDate }
            }
        });

        const adj = publishedData;
        const isOverridden = adj.override_salary !== null && adj.override_salary !== undefined;
        const baseSalaryInput = isOverridden ? Number(adj.override_salary) : (Number(emp.base_salary) || 0);
        const isDaily = (emp as any).salary_type === "daily";
        let baseSalary = baseSalaryInput;
        let hourlyWage = isDaily ? (baseSalaryInput / 8) : ((baseSalaryInput / 30) / 8);

        let isOtEligible = true;
        if (baseSalaryInput >= 20000 && !isDaily) isOtEligible = false;
        else isOtEligible = emp.job_positions?.is_ot_eligible ?? true;

        let normal_1_5x_hours = 0, holiday_1x_hours = 0, holiday_3x_hours = 0;

        if (adj.normal_1_5x_hours_override !== null && adj.normal_1_5x_hours_override !== undefined) {
            normal_1_5x_hours = Number(adj.normal_1_5x_hours_override);
            holiday_1x_hours = Number(adj.holiday_1_x_hours_override || 0);
            holiday_3x_hours = Number(adj.holiday_3_x_hours_override || 0);
        } else if (isOtEligible) {
            otRequests.forEach((req: any) => {
                const reqDate = toBangkokWallClock(req.date_for);
                const reqDateStr = fmt(reqDate);
                const isSunday = reqDate.getDay() === 0;
                const isPublicHoliday = holidayDates.has(reqDateStr);
                const isHoliday = isSunday || isPublicHoliday;
                
                const startOT = toBangkokWallClock(req.start_time); 
                const isHolidayAtStart = isHoliday;
                const endOT = toBangkokWallClock(req.end_time);
                if (endOT <= startOT) endOT.setDate(endOT.getDate() + 1);
                
                const checkIsHoliday = (d: Date) => {
                    const ds = fmt(d);
                    return d.getDay() === 0 || holidayDates.has(ds);
                };
                
                const isSaturdayAtStart = startOT.getDay() === 6;

                const totalHrsReq = (endOT.getTime() - startOT.getTime()) / (1000 * 60 * 60);

                const lunchStart = new Date(startOT); lunchStart.setHours(12, 0, 0, 0);
                const lunchEnd = new Date(startOT); lunchEnd.setHours(13, 0, 0, 0);
                const lunchOverlapStart = Math.max(startOT.getTime(), lunchStart.getTime());
                const lunchOverlapEnd = Math.min(endOT.getTime(), lunchEnd.getTime());
                const lunchOverlapHrs = Math.max(0, lunchOverlapEnd - lunchOverlapStart) / (1000 * 60 * 60);

                const netTotalHrsReq = totalHrsReq - lunchOverlapHrs;
                const approvedHrs = req.approved_hours !== null ? Number(req.approved_hours) : netTotalHrsReq;
                const ratio = netTotalHrsReq > 0 ? approvedHrs / netTotalHrsReq : 0;

                if (fmt(startOT) === fmt(endOT)) {
                    if (!isHolidayAtStart) {
                        normal_1_5x_hours += approvedHrs;
                    } else {
                        const boundaryStart = new Date(startOT); boundaryStart.setHours(8, 0, 0, 0);
                        const boundaryEnd = new Date(startOT); boundaryEnd.setHours(isSaturdayAtStart ? 15 : 17, 0, 0, 0);
                        const overlapStart = Math.max(startOT.getTime(), boundaryStart.getTime());
                        const overlapEnd = Math.min(endOT.getTime(), boundaryEnd.getTime());
                        let overlapHrs = Math.max(0, overlapEnd - overlapStart) / (1000 * 60 * 60);
                        const lunchInNormalStart = Math.max(overlapStart, lunchStart.getTime());
                        const lunchInNormalEnd = Math.min(overlapEnd, lunchEnd.getTime());
                        overlapHrs -= Math.max(0, lunchInNormalEnd - lunchInNormalStart) / (1000 * 60 * 60);
                        const outsideHrs = netTotalHrsReq - overlapHrs;
                        holiday_1x_hours += overlapHrs * ratio;
                        holiday_3x_hours += outsideHrs * ratio;
                    }
                } else {
                    const midnight = new Date(startOT);
                    midnight.setDate(midnight.getDate() + 1);
                    midnight.setHours(0, 0, 0, 0);

                    const part1HrsTotal = (midnight.getTime() - startOT.getTime()) / (1000 * 60 * 60);
                    const part1LunchStart = Math.max(startOT.getTime(), lunchStart.getTime());
                    const part1LunchEnd = Math.min(midnight.getTime(), lunchEnd.getTime());
                    const part1NetHrs = part1HrsTotal - Math.max(0, part1LunchEnd - part1LunchStart) / (1000 * 60 * 60);

                    const part2HrsTotal = (endOT.getTime() - midnight.getTime()) / (1000 * 60 * 60);
                    const part2NetHrs = part2HrsTotal;

                    if (!isHolidayAtStart) {
                        normal_1_5x_hours += part1NetHrs * ratio;
                    } else {
                        const bStart = new Date(startOT); bStart.setHours(8, 0, 0, 0);
                        const bEnd = new Date(startOT); bEnd.setHours(isSaturdayAtStart ? 15 : 17, 0, 0, 0);
                        const oStart = Math.max(startOT.getTime(), bStart.getTime());
                        const oEnd = Math.min(midnight.getTime(), bEnd.getTime());
                        let oHrs = Math.max(0, oEnd - oStart) / (1000 * 60 * 60);
                        oHrs -= Math.max(0, part1LunchEnd - part1LunchStart) / (1000 * 60 * 60);
                        holiday_1x_hours += oHrs * ratio;
                        holiday_3x_hours += (part1NetHrs - oHrs) * ratio;
                    }

                    const isHolidayNext = checkIsHoliday(midnight);
                    if (!isHolidayNext) {
                        normal_1_5x_hours += part2NetHrs * ratio;
                    } else {
                        holiday_1x_hours += part2NetHrs * ratio;
                    }
                }
            });
        }

        const isOnTrial = (emp as any).is_on_trial || false;
        let diligence_allowance = 0, meal_allowance = 0, travel_allowance = 0, accommodation_allowance = 0;
        let long_service_allowance = 0, telephone_allowance = 0, travel_site_allowance = 0, travel_accommodation = 0, position_allowance = 0, general_allowance = 0;

        if (adj.accommodation_allowance_override !== null && adj.accommodation_allowance_override !== undefined) {
            accommodation_allowance = Number(adj.accommodation_allowance_override);
        } else if ((emp as any).company_accommodation || isDaily) {
            accommodation_allowance = 0;
        } else if (Number((emp as any).fixed_accommodation_allowance) > 0) {
            accommodation_allowance = Number((emp as any).fixed_accommodation_allowance);
        } else if (!isDaily && warnings.length === 0 && (!isOnTrial || (emp as any).probation_accommodation_allowance) && emp.hire_date) {
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
        } else if (!isDaily && warnings.length === 0 && (!isOnTrial || (emp as any).probation_accommodation_allowance) && !emp.hire_date) {
            accommodation_allowance = 1500;
        }

        if (warnings.length === 0) {
            const hasLate = checkins.some(c => c.late_status === "late");
            const hasLeave = leaveRequests.length > 0;
            let totalPaidDays = 0, validWorkdaysCount = 0;
            let curr = new Date(startDate);
            let missingScanInCycle = false;
            while (curr <= endDate) {
                const dateStr = fmt(curr);
                const isHoliday = curr.getDay() === 0 || holidayDates.has(dateStr);
                const dayCheckins = checkins.filter(c => fmt(c.date_key) === dateStr);
                const scansComplete = dayCheckins.some(c => ["Check-in", "Project-In", "Offsite-In"].includes(c.type)) && dayCheckins.some(c => ["Check-out", "Project-Out", "Offsite-Out"].includes(c.type));
                const isExempt = (emp as any).is_checkin_exempt || false;
                const isOnLeave = leaveRequests.some(l => dateStr >= fmt(l.start_date) && dateStr <= fmt(l.end_date));

                if (!isHoliday && !scansComplete) missingScanInCycle = true;
                if (scansComplete || (isExempt && !isHoliday)) {
                    totalPaidDays++;
                    if (!isOnLeave) validWorkdaysCount++;
                }
                curr.setDate(curr.getDate() + 1);
            }

            if (isDaily && !isOverridden) baseSalary = totalPaidDays * baseSalaryInput;

            if (adj.diligence_allowance_override !== null && adj.diligence_allowance_override !== undefined) diligence_allowance = Number(adj.diligence_allowance_override);
            else if (!isDaily && !hasLate && !hasLeave && !missingScanInCycle && !isOnTrial) diligence_allowance = Number((emp as any).diligence_allowance || 0) || 0;

            if (adj.meal_allowance_override !== null && adj.meal_allowance_override !== undefined) meal_allowance = Number(adj.meal_allowance_override);
            else if (Number((emp as any).fixed_meal_allowance) > 0) meal_allowance = Number((emp as any).fixed_meal_allowance);
            else if (!isDaily && (!isOnTrial || (emp as any).probation_meal_allowance)) meal_allowance = validWorkdaysCount * 100;

            if (adj.travel_allowance_override !== null && adj.travel_allowance_override !== undefined) travel_allowance = Number(adj.travel_allowance_override);
            else if (Number((emp as any).fixed_travel_allowance) > 0) travel_allowance = Number((emp as any).fixed_travel_allowance);
            else if (!isDaily && (!isOnTrial || (emp as any).probation_travel_allowance)) travel_allowance = validWorkdaysCount * 60;
        } else {
            if (adj.diligence_allowance_override !== null && adj.diligence_allowance_override !== undefined) diligence_allowance = Number(adj.diligence_allowance_override);
            if (adj.meal_allowance_override !== null && adj.meal_allowance_override !== undefined) meal_allowance = Number(adj.meal_allowance_override);
            if (adj.travel_allowance_override !== null && adj.travel_allowance_override !== undefined) travel_allowance = Number(adj.travel_allowance_override);
            if (adj.accommodation_allowance_override !== null && adj.accommodation_allowance_override !== undefined) accommodation_allowance = Number(adj.accommodation_allowance_override);
        }

        if (isDaily) {
            accommodation_allowance = 0;
            meal_allowance = 0;
            travel_allowance = 0;
            diligence_allowance = 0;
            position_allowance = 0;
            general_allowance = 0;
        }

        if ((emp as any).company_car) travel_allowance = 0;
        if ((emp as any).company_accommodation) accommodation_allowance = 0;

        position_allowance = adj.position_allowance_override !== null && adj.position_allowance_override !== undefined ? Number(adj.position_allowance_override) : (isDaily ? 0 : (Number(emp.position_allowance) || 0));
        general_allowance = adj.general_allowance_override !== null && adj.general_allowance_override !== undefined ? Number(adj.general_allowance_override) : (isDaily ? 0 : (Number((emp as any).general_allowance) || 0));
        // --- 4.3.1 TELEPHONE ALLOWANCE POLICY (Synced with Admin View) ---
        let calculatedPhoneAllowance = 0;
        if (!isDaily && emp.has_telephone_allowance && warnings.length === 0) {
            const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
            let yearsOfService = 0;
            if (hireDate) {
                yearsOfService = endDate.getFullYear() - hireDate.getFullYear();
                const mDiff = endDate.getMonth() - hireDate.getMonth();
                if (mDiff < 0 || (mDiff === 0 && endDate.getDate() < hireDate.getDate())) yearsOfService--;
            }

            const posName = (emp.job_positions?.title || "").toLowerCase();
            const divName = (emp.departments?.divisions?.name || "").toLowerCase();
            const deptName = (emp.departments?.name || "").toLowerCase();

            // 1. Manager (High Priority)
            if (posName.includes("ผู้จัดการ") || posName.includes("manager")) {
                calculatedPhoneAllowance = 1000;
            }
            // 2. HR / Admin Division
            else if (divName.includes("บุคคล") || divName.includes("admin") || divName.includes("hr")) {
                calculatedPhoneAllowance = 800;
            }
            // 3. Foreman or Driver
            else if (posName.includes("หัวหน้าช่าง") || posName.includes("foreman") || posName.includes("ขับรถ") || posName.includes("driver")) {
                calculatedPhoneAllowance = 300;
            }
            // 4. Technician / Tech
            else if (posName.includes("ช่าง") || posName.includes("technician") || posName.includes("tech")) {
                if (yearsOfService < 1) calculatedPhoneAllowance = 100;
                else if (yearsOfService < 2) calculatedPhoneAllowance = 200;
                else calculatedPhoneAllowance = 300;
            }
            // 5. Engineering Dept or Engineer Position
            else if (posName.includes("วิศวกร") || posName.includes("engineer") || deptName.includes("engineering") || deptName.includes("วิศว") || divName.includes("engineering") || divName.includes("วิศว")) {
                calculatedPhoneAllowance = 500;
            }
            else {
                // General Staff - based on years of service
                if (yearsOfService < 1) calculatedPhoneAllowance = 100;
                else if (yearsOfService < 2) calculatedPhoneAllowance = 200;
                else calculatedPhoneAllowance = 300;
            }
        }

        telephone_allowance = adj.phone_allowance_override !== null && adj.phone_allowance_override !== undefined 
            ? Number(adj.phone_allowance_override) 
            : calculatedPhoneAllowance;

        if (adj.travel_site_allowance_override !== null && adj.travel_site_allowance_override !== undefined) {
            travel_site_allowance = Number(adj.travel_site_allowance_override);
        } else if (!isDaily) {
            const posName = (emp.job_positions?.title || "").toLowerCase();
            const deptName = (emp.departments?.name || "").toLowerCase();
            const divName = (emp.departments?.divisions?.name || "").toLowerCase();
            travelClaims.forEach((tc: any) => {
                let rate = 150; // Default Staff rate
                if (posName.includes("ผู้จัดการ") || posName.includes("manager")) rate = 350;
                else if (posName.includes("วิศวกร") || posName.includes("engineer") || deptName.includes("engineering") || deptName.includes("วิศว") || divName.includes("engineering") || divName.includes("วิศว") || deptName.includes("business development") || divName.includes("business development")) rate = 250;
                else if (posName.includes("หัวหน้าช่าง") || posName.includes("foreman")) rate = 200;
                else if (posName.includes("ขับรถ") || posName.includes("driver")) rate = 200;
                else if (posName.includes("ช่าง") || posName.includes("technician") || posName.includes("tech")) rate = 150;

                // Exclude sales roles and departments
                if (posName.includes("sales") || posName.includes("ขาย") || deptName.includes("sales") || deptName.includes("ขาย") || divName.includes("sales") || divName.includes("ขาย")) rate = 0;

                const start = new Date(tc.date); const end = tc.end_date ? new Date(tc.end_date) : start;
                const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                travel_site_allowance += rate * days;
            });
        }

        if (adj.travel_accommodation_override !== null && adj.travel_accommodation_override !== undefined) {
            travel_accommodation = Number(adj.travel_accommodation_override);
        } else if (!isDaily) {
            travelClaims.forEach((tc: any) => { travel_accommodation += Number(tc.accommodation_amount) || 0; });
        }

        if (!isDaily && !isOnTrial && month === 12 && emp.hire_date) {
            const hDate = new Date(emp.hire_date);
            let yrs = endDate.getFullYear() - hDate.getFullYear();
            if (yrs >= 3 && yrs < 4) long_service_allowance = 3000;
            else if (yrs >= 4 && yrs < 5) long_service_allowance = 4000;
            else if (yrs >= 5 && yrs < 10) long_service_allowance = 10000;
            else if (yrs >= 10) long_service_allowance = 15000;
        }

        const normalOtPay = normal_1_5x_hours * hourlyWage * 1.5;
        const holiday1xPay = holiday_1x_hours * hourlyWage * 1;
        const holiday3xPay = holiday_3x_hours * hourlyWage * 3;
        const totalOtAmount = normalOtPay + holiday1xPay + holiday3xPay;

        const student_loan = Number(adj.student_loan || 0);
        const insurance = Number(adj.insurance || 0);
        const insurance_income = Number(adj.insurance_income || 0);
        const unpaid_absenteeism = Number(adj.unpaid_absenteeism || 0);
        const provident_fund = Number((adj as any).provident_fund || 0);

        let social_security = 0;
        if (adj.social_security !== null && adj.social_security !== undefined) {
            social_security = Number(adj.social_security);
        } else {
            const ssoPosAllow = (emp as any).sso_include_position_allowance ? position_allowance : 0;
            const ssoGenAllow = (emp as any).sso_include_general_allowance ? general_allowance : 0;
            const ssoFixAcc = (emp as any).sso_include_fixed_accommodation ? accommodation_allowance : 0;
            const ssoFixMeal = (emp as any).sso_include_fixed_meal ? meal_allowance : 0;
            const ssoFixTrav = (emp as any).sso_include_fixed_travel ? travel_allowance : 0;
            
            const ssoBase = Math.max(0, baseSalary + ssoPosAllow + ssoGenAllow + ssoFixAcc + ssoFixMeal + ssoFixTrav - unpaid_absenteeism);
            if (ssoBase > 1650 && !isDaily) {
                social_security = Math.round(Math.min(17500, ssoBase) * 0.05);
            }
        }

        // Extract fixed_tax_deduction from emp profile
        const tax = (adj.tax !== null && adj.tax !== undefined && Number(adj.tax) > 0)
            ? Number(adj.tax)
            : (Number((emp as any).fixed_tax_deduction) > 0 ? Number((emp as any).fixed_tax_deduction) : 0);
            
        // Calculate dynamic commissions
        const empCommissionClaimsAsMain = commissionClaims.filter(c => c.emp_id === emp.emp_id);
        const empCommissionClaimsAsCompanion = commissionClaims.filter(c => c.companion_ids && c.companion_ids.includes(emp.emp_id));
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
        const adjCommissions = adj.commissions ? Number(adj.commissions) : 0;
        const commissions = adjCommissions !== 0 ? adjCommissions : calculatedCommissions;
        const bonus = Number(adj.bonus || 0);
        const other_deductions = Number(adj.other_deductions || 0);
        const other_benefits = Number(adj.other_benefits || 0);
        const welfare_amount = welfareClaims.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

        // Combined Income Other (as requested by user)
        const totalOtherIncome = diligence_allowance + meal_allowance + travel_allowance + accommodation_allowance + long_service_allowance + telephone_allowance + travel_site_allowance + position_allowance + general_allowance + other_benefits + welfare_amount;

        // Final Pay Calculation
        const totalIncome = baseSalary + totalOtAmount + commissions + bonus + totalOtherIncome + insurance_income;
        const totalExpense = unpaid_absenteeism + tax + social_security + provident_fund + student_loan + insurance + other_deductions;
        const netPay = totalIncome - totalExpense;

        // --------- START PDF GENERATION ---------
        const pdf = await PDFDocument.create();
        pdf.registerFontkit(fontkit);

        const fontRegularBytes = await loadFontBytes("public/fonts/Sarabun-Regular.ttf");
        const fontBoldBytes = await loadFontBytes("public/fonts/Sarabun-Bold.ttf").catch(() => null);

        const fontRegular = await pdf.embedFont(fontRegularBytes, { subset: true });
        const fontBold = fontBoldBytes ? await pdf.embedFont(fontBoldBytes, { subset: true }) : fontRegular;

        // A4 Landscape size
        const page = pdf.addPage([841.89, 595.28]);

        const drawCentered = (text: string, yPos: number, size = 12, bold = false) => {
            const f = bold ? fontBold : fontRegular;
            const w = f.widthOfTextAtSize(text, size);
            page.drawText(text, { x: (841.89 - w) / 2, y: yPos, size, font: f, color: rgb(0, 0, 0) });
        };

        const drawText = (text: string, x: number, y: number, size = 12, bold = false) => {
            const f = bold ? fontBold : fontRegular;
            page.drawText(text, { x, y, size, font: f, color: rgb(0, 0, 0) });
        };

        const drawRightExt = (text: string, xEnd: number, y: number, size = 12, bold = false) => {
            const f = bold ? fontBold : fontRegular;
            const w = f.widthOfTextAtSize(text, size);
            page.drawText(text, { x: xEnd - w, y, size, font: f, color: rgb(0, 0, 0) });
        };

        // Determine Company Name
        let companyName = "บริษัท เทอรา กรุ๊ป จำกัด"; // fallback
        const empCode = emp.emp_id.toUpperCase();
        if (empCode.startsWith("TG")) companyName = "บริษัท เทอรา กรุ๊ป จำกัด";
        else if (empCode.startsWith("TE")) companyName = "บริษัท เทอรา อิเล็กทริค จำกัด";
        else if (empCode.startsWith("TP")) companyName = "บริษัท เทอรา พาวเวอร์ จำกัด";

        // Header Title
        drawCentered(companyName, 540, 16, true);
        drawCentered("PAY SLIP ใบสำคัญจ่ายเงิน", 515, 14, false);
        drawCentered(`SALARY FOR PERIOD เงินเดือนประจำเดือน${THAI_MONTHS[month - 1]} ${year + 543}`, 490, 12, false);

        // Subheader Info
        drawText(`ชื่อ / สกุล :    ${emp.name}`, 40, 440, 12, false);
        drawText(`ตำแหน่ง :      ${emp.job_positions?.title || "-"}`, 40, 415, 12, false);

        // Output National ID number (centered)
        drawCentered(emp.national_id_card || "-", 440, 12, false);

        // --- GRID CONFIGURATION ---
        const startY = 390;
        const colWidths = [86, 68, 76, 70, 86, 86, 76, 76, 177]; // Total width = 801 (9 cols)
        
        const totalW = 801;
        const startX = (841.89 - totalW) / 2;
        let cX = startX;
        const X = [cX];
        for (const w of colWidths) { cX += w; X.push(cX); }

        const rowHeights = [30, 30, 30, 30]; // 4 rows inside grid (Income H, Income V, Exp H, Exp V) + summary
        const Y = [startY, startY - 30, startY - 60, startY - 90, startY - 120];

        // Draw Horizontals
        for (const yLine of Y) {
            page.drawLine({ start: { x: startX, y: yLine }, end: { x: X[9], y: yLine }, thickness: 1, color: rgb(0, 0, 0) });
        }
        // Additional horizontals for Summary bottom
        page.drawLine({ start: { x: startX, y: Y[4] - 40 }, end: { x: X[9], y: Y[4] - 40 }, thickness: 1, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: startX, y: Y[4] - 80 }, end: { x: X[9], y: Y[4] - 80 }, thickness: 1, color: rgb(0, 0, 0) });

        // Draw Verticals
        for (let i = 0; i < X.length; i++) {
            const xLine = X[i];
            const endY = i === 1 ? Y[2] : Y[4]; // X[1] stops at Y[2] so Col0 and Col1 merge in bottom rows
            page.drawLine({ start: { x: xLine, y: startY }, end: { x: xLine, y: endY }, thickness: 1, color: rgb(0, 0, 0) });
        }
        // Vertical dividers for Summary ROW
        page.drawLine({ start: { x: startX, y: Y[4] }, end: { x: startX, y: Y[4] - 40 }, thickness: 1, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: X[4], y: Y[4] }, end: { x: X[4], y: Y[4] - 40 }, thickness: 1, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: X[9], y: Y[4] }, end: { x: X[9], y: Y[4] - 40 }, thickness: 1, color: rgb(0, 0, 0) });

        // Vertical dividers for Signature ROW
        page.drawLine({ start: { x: startX, y: Y[4] - 40 }, end: { x: startX, y: Y[4] - 80 }, thickness: 1, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: X[2], y: Y[4] - 40 }, end: { x: X[2], y: Y[4] - 80 }, thickness: 1, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: X[4], y: Y[4] - 40 }, end: { x: X[4], y: Y[4] - 80 }, thickness: 1, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: X[9], y: Y[4] - 40 }, end: { x: X[9], y: Y[4] - 80 }, thickness: 1, color: rgb(0, 0, 0) });

        // --- ROW 1: Income Headers ---
        const drawCell = (text1: string, text2: string, colIdx: number, rowY: number, colSpan = 1) => {
            const wCol = X[colIdx + colSpan] - X[colIdx];
            const cx = X[colIdx] + wCol / 2;
            const f = fontRegular;

            let size1 = 10;
            while (f.widthOfTextAtSize(text1, size1) > wCol - 4 && size1 > 5) size1 -= 0.5;
            page.drawText(text1, { x: cx - f.widthOfTextAtSize(text1, size1) / 2, y: rowY - 12, size: size1, font: f });

            let size2 = 10;
            while (f.widthOfTextAtSize(text2, size2) > wCol - 4 && size2 > 5) size2 -= 0.5;
            page.drawText(text2, { x: cx - f.widthOfTextAtSize(text2, size2) / 2, y: rowY - 24, size: size2, font: f });
        };
        const drawVal = (val: string, colIdx: number, rowY: number, colSpan = 1) => {
            const rx = X[colIdx + colSpan] - 5;
            page.drawText(val, { x: rx - fontRegular.widthOfTextAtSize(val, 10), y: rowY - 18, size: 10, font: fontRegular });
        };

        drawCell("Salary", "เงินเดือน", 0, Y[0]);
        drawCell("OT 1.5", "ล่วงเวลา", 1, Y[0]);
        drawCell("ทำงาน/OT 3.0", "วันหยุด", 2, Y[0]);
        drawCell("Travel Allowance", "เบี้ยเลี้ยง", 3, Y[0]);
        drawCell("Commission", "คอมมิชชั่น", 4, Y[0]);
        drawCell("Insurance", "ประกันทำงาน", 5, Y[0]);
        drawCell("Bonus", "โบนัส", 6, Y[0]);
        drawCell("Other", "อื่นๆ", 7, Y[0]);
        drawCell("Total Income", "ยอดรายรับ", 8, Y[0]);

        // --- ROW 2: Income Values ---
        const ot23 = holiday1xPay + holiday3xPay;
        const allowanceAmount = travel_site_allowance;
        const otherIncomeRemaining = telephone_allowance + position_allowance + general_allowance + other_benefits + welfare_amount + long_service_allowance + diligence_allowance + meal_allowance + travel_allowance + accommodation_allowance;

        drawVal(formatB(baseSalary), 0, Y[1]);
        drawVal(normalOtPay > 0 ? formatB(normalOtPay) : "-", 1, Y[1]);
        drawVal(ot23 > 0 ? formatB(ot23) : "-", 2, Y[1]);
        drawVal(allowanceAmount > 0 ? formatB(allowanceAmount) : "-", 3, Y[1]);
        drawVal(commissions > 0 ? formatB(commissions) : "-", 4, Y[1]);
        drawVal(insurance_income > 0 ? formatB(insurance_income) : "-", 5, Y[1]);
        drawVal(bonus > 0 ? formatB(bonus) : "-", 6, Y[1]);
        drawVal(otherIncomeRemaining > 0 ? formatB(otherIncomeRemaining) : "-", 7, Y[1]);
        drawVal(formatB(totalIncome), 8, Y[1]);

        // --- ROW 3: Expense Headers ---
        drawCell("Absent Not Paid", "ขาดงานไม่จ่ายค่าจ้าง", 0, Y[2], 2);
        drawCell("Tax", "ภาษี", 2, Y[2]);
        drawCell("Social Security", "ประกันสังคม", 3, Y[2]);
        drawCell("Provident Fund", "กองทุนสำรองฯ", 4, Y[2]);
        drawCell("Insurance", "ประกันทำงาน", 5, Y[2]);
        drawCell("Student Loan", "กยศ.", 6, Y[2]);
        drawCell("Other", "อื่นๆ", 7, Y[2]);
        drawCell("Total Expenses", "ยอดเงินหัก", 8, Y[2]);

        // --- ROW 4: Expense Values ---
        const otherDedRemaining = other_deductions;
        
        drawVal(unpaid_absenteeism > 0 ? formatB(unpaid_absenteeism) : "-", 0, Y[3], 2);
        drawVal(tax > 0 ? formatB(tax) : "-", 2, Y[3]);
        drawVal(social_security > 0 ? formatB(social_security) : "-", 3, Y[3]);
        drawVal(provident_fund > 0 ? formatB(provident_fund) : "-", 4, Y[3]);
        drawVal(insurance > 0 ? formatB(insurance) : "-", 5, Y[3]);
        drawVal(student_loan > 0 ? formatB(student_loan) : "-", 6, Y[3]);
        drawVal(otherDedRemaining > 0 ? formatB(otherDedRemaining) : "-", 7, Y[3]);
        drawVal(formatB(totalExpense), 8, Y[3]);

        // --- SUMMARY ROWS ---
        drawText("Bahts:", startX + 5, Y[4] - 14, 10);
        drawText(`จำนวนเงิน:   ${ThaiBahtText(netPay)}`, startX + 5, Y[4] - 28, 10);

        drawText("Net Income (Baht)", X[4] + 5, Y[4] - 14, 10);
        drawText("รายรับสุทธิ (บาท)", X[4] + 5, Y[4] - 28, 10);
        drawRightExt(formatB(netPay), X[9] - 5, Y[4] - 20, 11, true);

        // Bottom Sigs
        drawText("Signature:", startX + 5, Y[4] - 54, 10);
        drawText("ลายเซ็นพนักงาน:", startX + 5, Y[4] - 68, 10);

        drawText("Date:", X[2] + 5, Y[4] - 54, 10);
        drawText("วันที่:", X[2] + 5, Y[4] - 68, 10);
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        drawRightExt(`${lastDayOfMonth}/${month}/${year + 543}`, X[4] - 5, Y[4] - 68, 10);

        drawText("Employer Signature", X[4] + 5, Y[4] - 54, 10);
        drawText("ลายเซ็นนายจ้าง", X[4] + 5, Y[4] - 68, 10);

        const saved = await pdf.save();
        const bytes = Uint8Array.from(saved as unknown as Uint8Array);
        const body = Buffer.from(bytes) as unknown as BodyInit;

        return new Response(body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="payslip_${month}_${year}.pdf"`,
            },
        });

    } catch (e: any) {
        console.error("PDF Generate Error", e);
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
}

