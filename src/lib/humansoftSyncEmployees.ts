import { prisma } from "./prisma";
import { getAllApiKeys, getApiKey } from "./humansoft";

if (typeof process !== "undefined" && process.env) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

function getBaseUrl(): string {
    return process.env.HUMANSOFT_BASE_URL || "https://openapi.humansoft.co.th";
}

export interface HumanSoftEmployeeItem {
    employee_code: string;
    employee_name?: string;
    employee_last_name?: string;
    employee_title_name?: string;
    employee_nickname?: string;
    effective_dt?: string;
    birth_dt?: string;
    mobilephone?: string;
    emailaddress?: string;
    id_no?: string;
    bank_name?: string;
    bank_account_code?: string;
    address?: string;
    signout_flag?: string; // 'N' = Active, 'Y' = Resigned
    department_name?: string;
    position_name?: string;
    branch_name?: string;
    company_code?: string;
    company_name?: string;
    employee_gender?: string; // 'M' | 'F'
    salary?: number | string;
    [key: string]: any;
}

/**
 * Fetch all employee lists from HumanSoft Open API across all configured company API keys.
 * Endpoint: GET /api/v1/open-apis/employee/get-employee-list
 */
export async function fetchHumanSoftAllEmployeesList(apiKeyParam?: string): Promise<{
    ok: boolean;
    employees?: HumanSoftEmployeeItem[];
    error?: string;
    errors?: string[];
}> {
    const keys = apiKeyParam
        ? [{ company: "CUSTOM", key: apiKeyParam }]
        : getAllApiKeys();

    if (keys.length === 0) {
        return { ok: false, error: "NO_HUMANSOFT_API_KEYS" };
    }

    const employeeMap = new Map<string, HumanSoftEmployeeItem>();
    const errors: string[] = [];

    for (const keyConfig of keys) {
        try {
            const pageSize = 100;
            let page = 1;
            let totalRecords = 0;

            while (true) {
                const url = `${getBaseUrl()}/api/v1/open-apis/employee/get-employee-list?_PAGE=${page}&_NUMBER_PER_PAGE=${pageSize}`;
                const res = await fetch(url, {
                    method: "GET",
                    headers: {
                        "Ocp-Apim-Subscription-Key": keyConfig.key,
                        "Content-Type": "application/json"
                    },
                    signal: AbortSignal.timeout(20000)
                });

                const data = await res.json().catch(() => null);
                if (!res.ok || (data && data.code !== 200)) {
                    const errMsg = `[${keyConfig.company}] ${data?.errors || data?.message || "HTTP_" + res.status}`;
                    errors.push(errMsg);
                    break;
                }

                const payload: HumanSoftEmployeeItem[] = Array.isArray(data.payload)
                    ? data.payload
                    : Array.isArray(data.data)
                        ? data.data
                        : [];

                for (const emp of payload) {
                    if (!emp.employee_code) continue;
                    const code = emp.employee_code.trim().toUpperCase();
                    // If not already in map or if this one is active, store it
                    if (!employeeMap.has(code) || emp.signout_flag !== "Y") {
                        employeeMap.set(code, {
                            ...emp,
                            employee_code: code,
                            _sourceCompany: keyConfig.company
                        });
                    }
                }

                totalRecords = data._PAGINATION?._TOTAL_RECORDS ?? payload.length;
                if (payload.length === 0 || page * pageSize >= totalRecords) {
                    break;
                }
                page++;
                if (page > 30) break; // safety guard
            }
        } catch (err: any) {
            errors.push(`[${keyConfig.company}] ${err.message}`);
        }
    }

    return {
        ok: true,
        employees: Array.from(employeeMap.values()),
        errors: errors.length > 0 ? errors : undefined
    };
}

/**
 * Fetch detailed single employee data from HumanSoft (including salary / constants)
 * Endpoint: GET /api/v1/open-apis/employee/get-employee-data?type=all&employee_code=...
 */
export async function fetchHumanSoftEmployeeDetail(empCode: string, apiKeyParam?: string) {
    const apiKey = apiKeyParam || getApiKey(empCode);
    if (!apiKey) return { ok: false, error: "NO_API_KEY" };

    try {
        const url = `${getBaseUrl()}/api/v1/open-apis/employee/get-employee-data?type=all&employee_code=${encodeURIComponent(empCode)}`;
        const res = await fetch(url, {
            headers: {
                "Ocp-Apim-Subscription-Key": apiKey
            },
            signal: AbortSignal.timeout(15000)
        });

        if (!res.ok) {
            return { ok: false, status: res.status, error: "HTTP_ERROR" };
        }

        const data = await res.json().catch(() => null);
        return { ok: true, payload: data?.payload };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}

/**
 * Maps raw HumanSoft employee data and upserts into local `employees` table.
 * Resolves or creates matching departments, job_positions, branches, and companies.
 */
export async function upsertEmployeeFromHumanSoft(raw: HumanSoftEmployeeItem) {
    if (!raw.employee_code) {
        throw new Error("EMPLOYEE_CODE_MISSING");
    }

    const empId = raw.employee_code.trim().toUpperCase();
    const prefix = empId.slice(0, 2).toUpperCase();

    // Map company_id based on company prefix (TG -> 2, TE -> 3, TP -> 4) or fallback to 2
    let companyId = 2;
    if (prefix === "TE") companyId = 3;
    else if (prefix === "TP") companyId = 4;
    else if (prefix === "TG") companyId = 2;

    // Resolve Department
    let departmentId: number | null = null;
    const rawDeptName = raw.department_name?.trim();
    if (rawDeptName) {
        const foundDept = await prisma.departments.findFirst({
            where: { name: { equals: rawDeptName, mode: "insensitive" } },
            select: { id: true }
        });
        if (foundDept) {
            departmentId = foundDept.id;
        } else {
            const newDept = await prisma.departments.create({
                data: { name: rawDeptName },
                select: { id: true }
            });
            departmentId = newDept.id;
        }
    }

    // Resolve Job Position
    let jobPositionId: number | null = null;
    const rawPosTitle = raw.position_name?.trim();
    if (rawPosTitle) {
        const foundPos = await prisma.job_positions.findFirst({
            where: { title: { equals: rawPosTitle, mode: "insensitive" } },
            select: { id: true }
        });
        if (foundPos) {
            jobPositionId = foundPos.id;
        } else {
            const newPos = await prisma.job_positions.create({
                data: {
                    title: rawPosTitle,
                    department_id: departmentId,
                    is_ot_eligible: true
                },
                select: { id: true }
            });
            jobPositionId = newPos.id;
        }
    }

    // Resolve Branch (Default: BKK-HQ)
    let branchId: string = "BKK-HQ";
    const rawBranchName = (raw.branch_name || "").toLowerCase();
    if (rawBranchName) {
        const allBranches = await prisma.branches.findMany({ select: { id: true, name: true } });
        const matched = allBranches.find(b =>
            rawBranchName.includes(b.name.toLowerCase()) ||
            b.name.toLowerCase().includes(rawBranchName)
        );
        if (matched) {
            branchId = matched.id;
        }
    }

    // Compose Full Name and Titles
    const titlePrefix = raw.employee_title_name?.trim() || null;
    const firstName = raw.employee_name?.trim() || "";
    const lastName = raw.employee_last_name?.trim() || "";
    const nickname = raw.employee_nickname?.trim() || null;

    let fullName = [titlePrefix, firstName, lastName].filter(Boolean).join(" ").trim();
    if (!fullName) {
        fullName = raw.name || empId;
    }

    // Gender
    let gender: "M" | "F" | null = null;
    const rawGender = (raw.employee_gender || "").toUpperCase();
    if (rawGender === "M" || rawGender === "1" || rawGender === "ชาย") gender = "M";
    else if (rawGender === "F" || rawGender === "2" || rawGender === "หญิง") gender = "F";
    else if (titlePrefix?.includes("นาย")) gender = "M";
    else if (titlePrefix?.includes("นาง") || titlePrefix?.includes("นางสาว")) gender = "F";

    // Dates
    const hireDate = raw.effective_dt && !isNaN(Date.parse(raw.effective_dt))
        ? new Date(raw.effective_dt)
        : undefined;

    const birthDate = raw.birth_dt && !isNaN(Date.parse(raw.birth_dt))
        ? new Date(raw.birth_dt)
        : undefined;

    // Active Status: 'Y' in signout_flag means resigned/inactive
    const isActive = raw.signout_flag !== "Y";
    const resignationDate = !isActive ? (raw.resign_dt ? new Date(raw.resign_dt) : new Date()) : null;

    // Base salary (if available in raw or detail)
    const baseSalary = raw.salary != null && !isNaN(Number(raw.salary)) && Number(raw.salary) > 0
        ? Number(raw.salary)
        : undefined;

    // Check if employee already exists
    const existing = await prisma.employees.findUnique({
        where: { emp_id: empId },
        select: { emp_id: true, pin_hash: true, line_user_id: true, is_active: true }
    });

    if (existing) {
        // Update existing employee without overriding credentials
        const updated = await prisma.employees.update({
            where: { emp_id: empId },
            data: {
                name: fullName,
                title_prefix: titlePrefix,
                first_name: firstName || undefined,
                last_name: lastName || undefined,
                nickname: nickname || undefined,
                gender: gender || undefined,
                branch_id: branchId,
                company_id: companyId,
                department_id: departmentId !== null ? departmentId : undefined,
                job_position_id: jobPositionId !== null ? jobPositionId : undefined,
                hire_date: hireDate,
                birth_date: birthDate,
                phone_number: raw.mobilephone?.trim() || undefined,
                email: raw.emailaddress?.trim() || undefined,
                national_id_card: raw.id_no?.trim() || undefined,
                bank_name: raw.bank_name?.trim() || undefined,
                bank_account_no: raw.bank_account_code?.trim() || undefined,
                address: raw.address?.trim() || undefined,
                is_active: isActive,
                resignation_date: resignationDate,
                base_salary: baseSalary !== undefined ? baseSalary : undefined,
            }
        });
        return { action: "updated" as const, employee: updated };
    } else {
        // Create brand new employee
        const created = await prisma.employees.create({
            data: {
                emp_id: empId,
                name: fullName,
                title_prefix: titlePrefix,
                first_name: firstName,
                last_name: lastName,
                nickname: nickname,
                gender: gender || "M",
                branch_id: branchId,
                company_id: companyId,
                department_id: departmentId,
                job_position_id: jobPositionId,
                hire_date: hireDate,
                birth_date: birthDate,
                phone_number: raw.mobilephone?.trim() || null,
                email: raw.emailaddress?.trim() || null,
                national_id_card: raw.id_no?.trim() || null,
                bank_name: raw.bank_name?.trim() || null,
                bank_account_no: raw.bank_account_code?.trim() || null,
                address: raw.address?.trim() || null,
                is_active: isActive,
                resignation_date: resignationDate,
                base_salary: baseSalary !== undefined ? baseSalary : null,
                is_onboarding_complete: false,
                is_checkin_exempt: false,
                salary_type: "monthly"
            }
        });
        return { action: "created" as const, employee: created };
    }
}

export interface SyncResult {
    ok: boolean;
    totalHumanSoft: number;
    newCount: number;
    existingCount: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors?: string[];
    previewItems?: {
        emp_id: string;
        name: string;
        department: string;
        position: string;
        company: string;
        is_new: boolean;
        is_active: boolean;
    }[];
}

/**
 * Synchronize all employees from HumanSoft into our database.
 * If `dryRun: true`, it will preview the differences without writing to DB.
 */
export async function syncAllHumanSoftEmployees(options: { dryRun?: boolean } = {}): Promise<SyncResult> {
    const listRes = await fetchHumanSoftAllEmployeesList();
    if (!listRes.ok || !listRes.employees) {
        return {
            ok: false,
            totalHumanSoft: 0,
            newCount: 0,
            existingCount: 0,
            createdCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            errors: listRes.errors || [listRes.error || "FETCH_FAILED"]
        };
    }

    const hsEmployees = listRes.employees;

    // Load all existing employee IDs from DB
    const existingEmployees = await prisma.employees.findMany({
        select: { emp_id: true, name: true, is_active: true }
    });
    const existingMap = new Map(existingEmployees.map(e => [e.emp_id, e]));

    const previewItems = hsEmployees.map(hs => {
        const code = hs.employee_code.trim().toUpperCase();
        const exists = existingMap.has(code);
        const name = [hs.employee_title_name, hs.employee_name, hs.employee_last_name].filter(Boolean).join(" ") || code;
        return {
            emp_id: code,
            name,
            department: hs.department_name || "-",
            position: hs.position_name || "-",
            company: hs.company_name || hs.employee_code.slice(0, 2),
            is_new: !exists,
            is_active: hs.signout_flag !== "Y"
        };
    });

    const newItems = previewItems.filter(p => p.is_new);
    const existingItems = previewItems.filter(p => !p.is_new);

    if (options.dryRun) {
        return {
            ok: true,
            totalHumanSoft: hsEmployees.length,
            newCount: newItems.length,
            existingCount: existingItems.length,
            createdCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            previewItems,
            errors: listRes.errors
        };
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = listRes.errors ? [...listRes.errors] : [];

    for (const hs of hsEmployees) {
        try {
            const res = await upsertEmployeeFromHumanSoft(hs);
            if (res.action === "created") {
                createdCount++;
            } else if (res.action === "updated") {
                updatedCount++;
            }
        } catch (err: any) {
            errors.push(`[${hs.employee_code}] ${err.message}`);
            skippedCount++;
        }
    }

    return {
        ok: true,
        totalHumanSoft: hsEmployees.length,
        newCount: newItems.length,
        existingCount: existingItems.length,
        createdCount,
        updatedCount,
        skippedCount,
        errors: errors.length > 0 ? errors : undefined,
        previewItems
    };
}
