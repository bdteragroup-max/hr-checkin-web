import { prisma } from "./prisma";
import ExcelJS from "exceljs";

export interface MonthlyPayrollItem {
    emp_id: string;
    name: string;
    position: string;
    department: string;
    education: string;
    level: "Staff" | "Manager" | string;
    hire_date_thai: string;
    work_ages: string;
    base_salary: number;
    housing_allowance: number;
    meal_allowance: number;
    travel_allowance: number;
    phone_allowance: number;
    position_allowance: number;
    per_diem_allowance: number;
    has_commission: boolean;
    total_income: number;
}

const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

export function formatThaiDate(dateStr?: string | Date | null): string {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = d.getDate();
    const month = THAI_MONTHS[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
}

export function getCompanyApiKey(company: string): string | null {
    const code = company.toUpperCase();
    if (code === "TG") return process.env.HUMANSOFT_SUBSCRIPTION_KEY_TG || null;
    if (code === "TP") return process.env.HUMANSOFT_SUBSCRIPTION_KEY_TP || null;
    if (code === "TE") return process.env.HUMANSOFT_SUBSCRIPTION_KEY_TE || null;
    return process.env.HUMANSOFT_SUBSCRIPTION_KEY || process.env.HUMANSOFT_SUBSCRIPTION_KEY_TG || null;
}

// Server in-memory cache to ensure sub-second response times
interface CacheRecord {
    timestamp: number;
    data: MonthlyPayrollItem[];
}
const cacheStore: Record<string, CacheRecord> = {};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetch and merge employee compensation structure from HumanSoft API + Local DB
 */
export async function fetchMonthlyEmployeeSalaryData(
    company: string = "TG",
    forceRefresh: boolean = false
): Promise<MonthlyPayrollItem[]> {
    const compCode = company.toUpperCase();
    const cacheKey = compCode;

    if (!forceRefresh && cacheStore[cacheKey] && Date.now() - cacheStore[cacheKey].timestamp < CACHE_TTL_MS) {
        return cacheStore[cacheKey].data;
    }

    const apiKey = getCompanyApiKey(compCode);
    if (!apiKey) {
        throw new Error(`No API key configured for company ${compCode}`);
    }

    const baseUrl = process.env.HUMANSOFT_BASE_URL || "https://openapi.humansoft.co.th";

    // 1. Load active real employees for this company from DB (exclude test/admin accounts)
    const dbEmployees = await prisma.employees.findMany({
        where: {
            emp_id: { startsWith: compCode },
            is_active: true,
            is_onboarding_complete: true,
            NOT: {
                emp_id: { in: ["TG00000", "TG00001", "TP00000", "TP00001", "TE00000", "TE00001"] }
            }
        },
        include: {
            departments: true,
            job_positions: true,
            employee_allowances: {
                include: { allowance_type: true }
            }
        },
        orderBy: { emp_id: "asc" }
    });

    if (dbEmployees.length === 0) {
        return [];
    }

    // 2. Fetch HumanSoft type=all for each employee with concurrency limit = 10
    const results: MonthlyPayrollItem[] = [];
    const concurrency = 10;

    for (let i = 0; i < dbEmployees.length; i += concurrency) {
        const batch = dbEmployees.slice(i, i + concurrency);
        const batchPromises = batch.map(async (emp) => {
            let hsPayload: any = null;
            try {
                const res = await fetch(`${baseUrl}/api/v1/open-apis/employee/get-employee-data?type=all&employee_code=${emp.emp_id}`, {
                    headers: { "Ocp-Apim-Subscription-Key": apiKey }
                });
                if (res.ok) {
                    const data = await res.json().catch(() => null);
                    hsPayload = data?.payload;
                }
            } catch (err) {
                console.warn(`[HumanSoft] Error fetching ${emp.emp_id}:`, err);
            }

            const basic = hsPayload?.basic || {};
            const financial = hsPayload?.financial || {};
            const profile = hsPayload?.profile || {};

            // Constants from HumanSoft
            const constants = financial.constant_lists || [];
            const getHsConstAmt = (namePart: string): number => {
                const found = constants.find((c: any) =>
                    (c.salary_type_name || "").includes(namePart) && c.employee_constant_amt != null
                );
                return found ? Number(found.employee_constant_amt) : 0;
            };

            // Allowances from DB fallback
            const getDbAllowance = (namePart: string): number => {
                const found = emp.employee_allowances.find((a: any) =>
                    a.allowance_type.name.includes(namePart)
                );
                return found ? Number(found.amount) : 0;
            };

            // Full Name
            const name = basic.employee_name
                ? `${basic.employee_title_name || ""}${basic.employee_name} ${basic.employee_last_name || ""}`.trim()
                : emp.name;

            // Position & Department
            const position = basic.position_name || emp.job_positions?.title || "-";
            const department = basic.department_name || emp.departments?.name || "-";

            // Level: Staff or Manager
            const posLower = position.toLowerCase();
            const isManager = posLower.includes("mgr") ||
                              posLower.includes("manager") ||
                              posLower.includes("managing") ||
                              posLower.includes("director") ||
                              posLower.includes("executive") ||
                              position.includes("ผู้จัดการ") ||
                              position.includes("ผู้อำนวยการ") ||
                              position.includes("หัวหน้า");
            const level = isManager ? "Manager" : "Staff";

            // Education degree
            let education = profile.education_lists?.[0]?.degree_name || "-";

            // Hire date & work ages
            const hireDateRaw = basic.effective_dt || emp.hire_date;
            const hireDateThai = formatThaiDate(hireDateRaw);

            let workAges = (basic.work_ages || "").replace(/\s+/g, "");
            if (!workAges && hireDateRaw) {
                const start = new Date(hireDateRaw);
                const now = new Date();
                let y = now.getFullYear() - start.getFullYear();
                let m = now.getMonth() - start.getMonth();
                let d = now.getDate() - start.getDate();
                if (d < 0) {
                    m--;
                    d += 30;
                }
                if (m < 0) {
                    y--;
                    m += 12;
                }
                workAges = `${y}ปี${m}เดือน${d}วัน`;
            }

            // Real Base Salary from HumanSoft or DB
            const hsSalary = Number(basic.salary || 0);
            const dbSalary = Number(emp.base_salary || 0);
            const baseSalary = hsSalary > 0 ? hsSalary : dbSalary;

            // Housing Allowance (ค่าที่พัก)
            let housing = getHsConstAmt("ที่พัก");
            if (housing === 0) housing = getDbAllowance("ที่พัก") || Number(emp.housing_benefit || 0);

            // Phone Allowance (ค่าโทรศัพท์)
            let phone = getHsConstAmt("โทรศัพท์");
            if (phone === 0) phone = getDbAllowance("โทรศัพท์") || Number(emp.has_telephone_allowance ? 300 : 0);

            // Meal Allowance (ค่าอาหาร)
            let meal = getHsConstAmt("อาหาร");
            if (meal === 0) {
                const dbMeal = getDbAllowance("อาหาร");
                if (dbMeal > 0) {
                    meal = dbMeal <= 200 ? dbMeal * 26 : dbMeal;
                } else {
                    meal = isManager ? 1260 : 2600; // 100/day * 26 days = 2600
                }
            }

            // Travel Allowance (ค่าเดินทาง)
            let travel = getHsConstAmt("เดินทาง");
            if (travel === 0) {
                const dbTravel = getDbAllowance("เดินทาง");
                if (dbTravel > 0) {
                    travel = dbTravel <= 200 ? dbTravel * 26 : dbTravel;
                } else {
                    travel = isManager ? 0 : 1560; // 60/day * 26 days = 1560
                }
            }

            // Position Allowance (ค่าตำแหน่ง)
            let posAllowance = getHsConstAmt("ตำแหน่ง") || Number(emp.position_allowance || 0) || getDbAllowance("ตำแหน่ง");

            // Per Diem Allowance (ค่าเบี้ยเลี้ยง)
            let perDiem = getHsConstAmt("เบี้ยเลี้ยง") || getDbAllowance("เบี้ยเลี้ยง");

            // Commission Checkbox: True if in sales, marketing, manager or auto checked
            const hasCommission = Boolean(
                financial.salary_auto_checked_lists?.length > 0 ||
                position.toLowerCase().includes("sales") ||
                position.includes("ขาย")
            );

            // Total Income
            const totalIncome = baseSalary + housing + meal + travel + phone + posAllowance + perDiem;

            return {
                emp_id: emp.emp_id,
                name,
                position,
                department,
                education,
                level,
                hire_date_thai: hireDateThai,
                work_ages: workAges,
                base_salary: baseSalary,
                housing_allowance: housing,
                meal_allowance: meal,
                travel_allowance: travel,
                phone_allowance: phone,
                position_allowance: posAllowance,
                per_diem_allowance: perDiem,
                has_commission: hasCommission,
                total_income: totalIncome
            };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    cacheStore[cacheKey] = {
        timestamp: Date.now(),
        data: results
    };

    return results;
}

/**
 * Generate Excel file matching the user's template exactly
 */
export async function generateMonthlyPayrollExcel(items: MonthlyPayrollItem[], company: string = "TG"): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HR Check-in System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`${company}_Monthly_Payroll`, {
        views: [{ state: "frozen", xSplit: 2, ySplit: 1 }]
    });

    // Column definitions
    sheet.columns = [
        { header: "รหัสพนักงาน", key: "emp_id", width: 14 },
        { header: "ชื่อ  นามสกุล", key: "name", width: 26 },
        { header: "ตำแหน่ง", key: "position", width: 24 },
        { header: "ฝ่าย", key: "department", width: 22 },
        { header: "วุฒิการศึกษา", key: "education", width: 14 },
        { header: "ระดับ", key: "level", width: 12 },
        { header: "วันที่เริ่มงาน", key: "hire_date_thai", width: 20 },
        { header: "อายุงาน", key: "work_ages", width: 16 },
        { header: "ฐานเงินเดือน", key: "base_salary", width: 16 },
        { header: "ค่าที่พัก", key: "housing_allowance", width: 14 },
        { header: "ค่าอาหาร", key: "meal_allowance", width: 14 },
        { header: "ค่าเดินทาง", key: "travel_allowance", width: 14 },
        { header: "ค่าโทรศัพท์", key: "phone_allowance", width: 14 },
        { header: "ค่าตำแหน่ง", key: "position_allowance", width: 14 },
        { header: "ค่าเบี้ยเลี้ยง", key: "per_diem_allowance", width: 14 },
        { header: "ค่าคอม", key: "has_commission", width: 10 },
        { header: "รายได้รวม", key: "total_income", width: 18 }
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 32;

    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FFB0C4DE" } },
        left: { style: "thin", color: { argb: "FFB0C4DE" } },
        bottom: { style: "thin", color: { argb: "FFB0C4DE" } },
        right: { style: "thin", color: { argb: "FFB0C4DE" } }
    };

    // Style Header
    headerRow.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.font = { name: "Sarabun", size: 10, bold: true, color: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };

        if (colNumber === 9) {
            // ฐานเงินเดือน -> Soft purple/pink header
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE8D7EA" }
            };
        } else {
            // General Soft Sky Blue Header
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFD0EBF9" }
            };
        }
    });

    // Populate Data Rows
    items.forEach((item, index) => {
        const rowNumber = index + 2;
        const row = sheet.addRow({
            emp_id: item.emp_id,
            name: item.name,
            position: item.position,
            department: item.department,
            education: item.education,
            level: item.level,
            hire_date_thai: item.hire_date_thai,
            work_ages: item.work_ages,
            base_salary: item.base_salary,
            housing_allowance: item.housing_allowance > 0 ? item.housing_allowance : "-",
            meal_allowance: item.meal_allowance > 0 ? item.meal_allowance : "-",
            travel_allowance: item.travel_allowance > 0 ? item.travel_allowance : "-",
            phone_allowance: item.phone_allowance > 0 ? item.phone_allowance : "-",
            position_allowance: item.position_allowance > 0 ? item.position_allowance : "-",
            per_diem_allowance: item.per_diem_allowance > 0 ? item.per_diem_allowance : "-",
            has_commission: item.has_commission ? "☑" : "☐",
            total_income: item.total_income
        });

        row.height = 24;

        row.eachCell((cell, colNumber) => {
            cell.border = thinBorder;
            cell.font = { name: "Sarabun", size: 9.5 };

            // Column Alignments & Formatting
            if (colNumber === 1 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 16) {
                cell.alignment = { vertical: "middle", horizontal: "center" };
            } else if (colNumber === 2 || colNumber === 3 || colNumber === 4) {
                cell.alignment = { vertical: "middle", horizontal: "left" };
            } else {
                // Currency columns (Col 9 to 15, and 17)
                cell.alignment = { vertical: "middle", horizontal: "right" };
                if (typeof cell.value === "number") {
                    cell.numFmt = "#,##0.00";
                }
            }

            // Column 9 (ฐานเงินเดือน): Soft Pink Background for the entire column
            if (colNumber === 9) {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF9EEF7" }
                };
            }

            // Commission Checkbox
            if (colNumber === 16) {
                cell.font = { name: "Arial", size: 12, bold: true, color: { argb: item.has_commission ? "FF000000" : "FF94A3B8" } };
            }
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
