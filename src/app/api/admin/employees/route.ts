import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminOrSupervisor, getSubordinateFilter } from "@/lib/adminAuth";
import { composeEmployeeName } from "@/lib/employeeUtils";

export const runtime = "nodejs";

type CreateEmployeeBody = {
    emp_id?: string | null;
    company_id?: number | null;
    name?: string;
    title_prefix?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    nickname?: string | null;
    nationality?: string | null;
    id_document_type?: string | null;
    is_onboarding_complete?: boolean;
    is_active?: boolean;
    gender?: "M" | "F" | "O" | null;
    hire_date?: string | null; // YYYY-MM-DD
    birth_date?: string | null; // YYYY-MM-DD
    phone_number?: string | null;
    department_id?: number | null;
    job_position_id?: number | null;
    base_salary?: number | null;
    supervisor_id?: string | null;
    is_on_trial?: boolean;
    probation_end_date?: string | null; // YYYY-MM-DD
    has_telephone_allowance?: boolean;
    fixed_tax_deduction?: number | null;
    national_id_card?: string | null;
    address?: string | null;
    bank_name?: string | null;
    bank_account_no?: string | null;
    salary_type?: string | null;
    line_user_id?: string | null;
    is_checkin_exempt?: boolean;
    secondary_supervisor_id?: string | null;
    email?: string | null;
    provident_fund_rate?: number | null;
    provident_fund_amt?: number | null;
    tax_deduction_override?: number | null;
    housing_benefit?: number | null;
    car_benefit?: number | null;
    company_car?: boolean;
    company_accommodation?: boolean;
};

type PatchEmployeeBody = {
    emp_id: string;

    name?: string;
    title_prefix?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    nickname?: string | null;
    branch_id?: string | null;
    is_active?: boolean;
    nationality?: string | null;
    id_document_type?: string | null;
    is_onboarding_complete?: boolean;

    gender?: "M" | "F" | "O" | null;
    hire_date?: string | null; // YYYY-MM-DD
    birth_date?: string | null; // YYYY-MM-DD
    phone_number?: string | null;
    department_id?: number | null;
    job_position_id?: number | null;
    base_salary?: number | null;
    supervisor_id?: string | null;
    is_on_trial?: boolean;
    probation_end_date?: string | null; // YYYY-MM-DD
    has_telephone_allowance?: boolean;
    fixed_tax_deduction?: number | null;
    national_id_card?: string | null;
    address?: string | null;
    bank_name?: string | null;
    bank_account_no?: string | null;
    salary_type?: string | null;
    line_user_id?: string | null;
    is_checkin_exempt?: boolean;
    resignation_date?: string | null;
    secondary_supervisor_id?: string | null;
    email?: string | null;
    provident_fund_rate?: number | null;
    provident_fund_amt?: number | null;
    tax_deduction_override?: number | null;
    housing_benefit?: number | null;
    car_benefit?: number | null;
    company_car?: boolean;
    company_accommodation?: boolean;
    company_id?: number | null;

    // ถ้าส่ง pin มา = ตั้ง/รีเซ็ต
    pin?: string;
};

function clean(v: unknown) {
    return String(v ?? "").trim();
}

function isISODate(s: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function jsonError(msg: string, status: number) {
    return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrSupervisor();
        const { searchParams } = new URL(req.url);
        const minimal = searchParams.get("minimal") === "1";
        const teamOnly = searchParams.get("team") === "1";

        const q = searchParams.get("q") || "";
        const status = searchParams.get("status") || "active";
        const type = searchParams.get("type") || "all";
        const dept = searchParams.get("dept") || "all";
        const branch = searchParams.get("branch") || "all";

        const page = parseInt(searchParams.get("page") || "0", 10);
        const all = searchParams.get("all") === "1";
        const pageSize = 50;
        const isAll = all || teamOnly;
        const subordinateFilter = getSubordinateFilter(auth, teamOnly, true);

        if (minimal) {
            const minConditions: any[] = [];
            if (subordinateFilter.OR) minConditions.push(subordinateFilter);
            if (status === "active") minConditions.push({ is_active: true });
            else if (status === "inactive") minConditions.push({ is_active: false });
            else if (status === "trial") minConditions.push({ is_active: true, is_on_trial: true });

            const minWhere: any = minConditions.length > 0 ? { AND: minConditions } : {};

            const list = await prisma.employees.findMany({
                where: minWhere,
                select: { emp_id: true, name: true, nickname: true, birth_date: true, is_active: true, is_checkin_exempt: true },
            });
            const formattedList = list.map(emp => {
                let finalName = emp.name;
                if (emp.nickname && !finalName.includes(`(${emp.nickname})`)) {
                    finalName = `${finalName} (${emp.nickname})`;
                }
                return { ...emp, name: finalName };
            });
            return NextResponse.json({ ok: true, list: formattedList });
        }

        // Build where clause
        const conditions: any[] = [];
        if (subordinateFilter.OR) conditions.push(subordinateFilter);
        if (status === "active") conditions.push({ is_active: true });
        if (status === "inactive") conditions.push({ is_active: false });
        if (status === "trial") {
            conditions.push({ is_active: true, is_on_trial: true });
        }

        if (type !== "all") conditions.push({ salary_type: type });
        if (dept !== "all") conditions.push({ department_id: parseInt(dept, 10) });
        if (branch !== "all") conditions.push({ branch_id: branch });

        if (q) {
            // PostgreSQL supports mode: 'insensitive'. 
            // The DB is postgresql according to schema.prisma
            conditions.push({
                OR: [
                    { emp_id: { contains: q, mode: 'insensitive' } },
                    { name: { contains: q, mode: 'insensitive' } },
                    { nickname: { contains: q, mode: 'insensitive' } },
                    { phone_number: { contains: q } }
                ]
            });
        }

        const where: any = conditions.length > 0 ? { AND: conditions } : {};

        const countBase = (extra: any) => {
            if (subordinateFilter.OR) {
                return { AND: [subordinateFilter, extra] };
            }
            return extra;
        };

        const [list, total, activeCount, inactiveCount, trialCount, incompleteCount] = await prisma.$transaction([
            prisma.employees.findMany({
                where,
                orderBy: { created_at: "desc" },
                skip: isAll ? undefined : page * pageSize,
                take: isAll ? undefined : pageSize,
                select: {
                    emp_id: true,
                    name: true,
                    nickname: true,
                    branch_id: true,
                    is_active: true,
                    created_at: true,
                    updated_at: true,
                    gender: true,
                    hire_date: true,
                    birth_date: true,
                    phone_number: true,
                    department_id: true,
                    job_position_id: true,
                    base_salary: true,
                    departments: { select: { name: true } },
                    job_positions: { select: { title: true, is_ot_eligible: true } },
                    supervisor_id: true,
                    supervisor: { select: { name: true } },
                    secondary_supervisor_id: true,
                    secondary_supervisor: { select: { name: true } },
                    is_on_trial: true,
                    probation_end_date: true,
                    has_telephone_allowance: true,
                    fixed_tax_deduction: true,
                    national_id_card: true,
                    address: true,
                    bank_name: true,
                    bank_account_no: true,
                    line_user_id: true,
                    salary_type: true,
                    is_checkin_exempt: true,
                    resignation_date: true,
                    email: true,
                    // @ts-ignore
                    company_car: true,
                    // @ts-ignore
                    company_accommodation: true,
                    is_onboarding_complete: true,
                    nationality: true,
                    id_document_type: true,
                    company_id: true,
                    title_prefix: true,
                    first_name: true,
                    last_name: true,
                    position_allowance: true,
                    allowance_mode: true,
                },
            }),
            prisma.employees.count({ where }),
            prisma.employees.count({ where: countBase({ is_active: true }) }),
            prisma.employees.count({ where: countBase({ is_active: false }) }),
            prisma.employees.count({ where: countBase({ is_active: true, is_on_trial: true }) }),
            prisma.employees.count({ where: countBase({ is_onboarding_complete: false }) })
        ]);

        const allCoEvals: any[] = ((await prisma.$queryRawUnsafe(
            `SELECT ece.employee_id, ece.evaluator_id, ece.order_no, emp.name, emp.nickname 
             FROM employee_co_evaluators ece
             LEFT JOIN employees emp ON emp.emp_id = ece.evaluator_id
             ORDER BY ece.order_no ASC;`
        ).catch(() => [])) as any[]) || [];

        const coEvalMap = new Map<string, any[]>();
        for (const row of allCoEvals) {
            if (!coEvalMap.has(row.employee_id)) coEvalMap.set(row.employee_id, []);
            coEvalMap.get(row.employee_id)!.push({
                evaluator_id: row.evaluator_id,
                order_no: row.order_no,
                name: row.name,
                nickname: row.nickname
            });
        }

        const formattedList = list.map(emp => {
            const coEvals = coEvalMap.get(emp.emp_id) || [];
            return {
                ...emp,
                co_evaluators: coEvals,
                co_evaluator_ids: coEvals.map(c => c.evaluator_id)
            };
        });

        return NextResponse.json({
            ok: true,
            list: formattedList,
            total,
            activeCount,
            inactiveCount,
            trialCount,
            incompleteCount,
            pageSize,
            page
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireAdmin();

        const body = (await req.json().catch(() => ({}))) as CreateEmployeeBody;

        const customEmpId = body.emp_id ? clean(body.emp_id) : null;
        let company_id = Number(body.company_id);
        if (!company_id || isNaN(company_id)) {
            if (customEmpId?.toUpperCase().startsWith("TE")) company_id = 3;
            else if (customEmpId?.toUpperCase().startsWith("TP")) company_id = 4;
            else company_id = 2; // Default to Tera Group
        }

        const title_prefix = body.title_prefix ? clean(body.title_prefix) : null;
        const first_name = body.first_name ? clean(body.first_name) : null;
        const last_name = body.last_name ? clean(body.last_name) : null;

        // If 'name' is directly provided (legacy form), use it, otherwise compose it.
        const rawName = body.name ? clean(body.name) : composeEmployeeName(title_prefix, first_name, last_name);
        if (!rawName) return jsonError("NAME_REQUIRED", 400);

        const nickname = body.nickname ? clean(body.nickname) : null;

        // Ensure company exists
        const company = await prisma.company_settings.findUnique({ where: { id: company_id } });
        if (!company) return jsonError("COMPANY_NOT_FOUND", 404);

        const gender = body.gender ?? null;
        const hire_date = body.hire_date ? clean(body.hire_date) : null;
        if (hire_date && !isISODate(hire_date)) return jsonError("HIRE_DATE_INVALID", 400);

        const birth_date = body.birth_date ? clean(body.birth_date) : null;
        if (birth_date && !isISODate(birth_date)) return jsonError("BIRTH_DATE_INVALID", 400);

        // Transaction to safely generate emp_id and create the employee
        const created = await prisma.$transaction(async (tx) => {
            let newEmpId = (customEmpId && !customEmpId.includes('XXXXX')) ? customEmpId : null;
            if (newEmpId) {
                const conflict = await tx.employees.findUnique({ where: { emp_id: newEmpId } });
                if (conflict) throw new Error("EMP_ID_ALREADY_EXISTS");
            } else {
                // Find prefix for this company_id
                let prefix = 'XX';
                const prefixMap: Record<number, string> = { 2: 'TG', 3: 'TE', 4: 'TP' };
                if (prefixMap[company_id]) {
                    prefix = prefixMap[company_id];
                } else {
                    // Try to infer from existing employees
                    const existing = await tx.employees.findFirst({
                        where: { company_id },
                        select: { emp_id: true }
                    });
                    if (existing && existing.emp_id.length >= 2) {
                        prefix = existing.emp_id.substring(0, 2);
                    }
                }

                // Lock the employees table for this prefix to prevent race conditions
                const likePattern = `${prefix}%`;
                const result = await tx.$queryRaw<any[]>`
                    SELECT emp_id FROM employees 
                    WHERE emp_id LIKE ${likePattern} 
                    ORDER BY emp_id DESC 
                    LIMIT 1 
                    FOR UPDATE
                `;

                let nextNumber = 1; // Default if no employee exists yet
                if (result.length > 0 && result[0].emp_id) {
                    const maxId = result[0].emp_id as string;
                    const numPart = maxId.substring(prefix.length); // e.g., "69048"
                    if (!isNaN(Number(numPart))) {
                        nextNumber = Number(numPart) + 1;
                    }
                }

                // Format as exactly 5 digits (e.g. TG69049) if the prefix is standard 2 chars
                const numDigits = 5;
                newEmpId = `${prefix}${String(nextNumber).padStart(numDigits, '0')}`;
            }

            // Create the employee!
            return await tx.employees.create({
                data: {
                    emp_id: newEmpId,
                    company_id: company_id,
                    name: rawName,
                    title_prefix,
                    first_name,
                    last_name,
                    nickname,
                    nationality: body.nationality ? clean(body.nationality) : "THA",
                    // No PIN yet - handled in Step 3

                    gender: gender ?? undefined,
                    hire_date: hire_date ? new Date(hire_date) : undefined,
                    birth_date: birth_date ? new Date(birth_date) : undefined,
                    phone_number: body.phone_number ? clean(body.phone_number) : undefined,
                    department_id: body.department_id || null,
                    job_position_id: body.job_position_id || null,
                    base_salary: body.base_salary != null ? Number(body.base_salary) : null,
                    supervisor_id: body.supervisor_id ? clean(body.supervisor_id) : null,
                    is_on_trial: body.is_on_trial ?? false,
                    probation_end_date: (body.is_on_trial && body.probation_end_date && isISODate(body.probation_end_date))
                        ? new Date(body.probation_end_date)
                        : null,
                    has_telephone_allowance: body.has_telephone_allowance ?? false,
                    fixed_tax_deduction: body.fixed_tax_deduction != null ? Number(body.fixed_tax_deduction) : 0,
                    national_id_card: body.national_id_card ? clean(body.national_id_card) : null,
                    id_document_type: body.id_document_type ? clean(body.id_document_type) : 'national_id',
                    is_onboarding_complete: false, // ALWAYS false for Step 1 creation
                    address: body.address ? clean(body.address) : null,
                    bank_name: body.bank_name ? clean(body.bank_name) : null,
                    bank_account_no: body.bank_account_no ? clean(body.bank_account_no) : null,
                    salary_type: body.salary_type || "monthly",
                    line_user_id: body.line_user_id ? clean(body.line_user_id) : null,
                    is_checkin_exempt: body.is_checkin_exempt ?? false,
                    secondary_supervisor_id: body.secondary_supervisor_id ? clean(body.secondary_supervisor_id) : null,
                    email: body.email ? clean(body.email) : null,
                    // @ts-ignore
                    car_benefit: body.car_benefit != null ? Number(body.car_benefit) : null,
                    company_car: body.company_car ?? false,
                    // @ts-ignore
                    company_accommodation: body.company_accommodation ?? false,
                },
                select: {
                    emp_id: true,
                    name: true,
                    nickname: true,
                    branch_id: true,
                    is_active: true,
                    gender: true,
                    hire_date: true,
                    birth_date: true,
                    phone_number: true,
                    department_id: true,
                    job_position_id: true,
                    base_salary: true,
                    supervisor_id: true,
                    secondary_supervisor_id: true,
                    created_at: true,
                    is_on_trial: true,
                    probation_end_date: true,
                    has_telephone_allowance: true,
                    fixed_tax_deduction: true,
                    national_id_card: true,
                    address: true,
                    bank_name: true,
                    bank_account_no: true,
                    line_user_id: true,
                    is_checkin_exempt: true,
                    email: true,
                    company_car: true,
                    company_accommodation: true,
                    nationality: true,
                    id_document_type: true,
                    is_onboarding_complete: true,
                    company_id: true,
                }
            });
        });

        // Record creation in AuditLog
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: auth.emp_id || "admin",
                action: "CREATE_EMPLOYEE",
                resource: "employees",
                resourceId: created.emp_id,
                details: JSON.stringify({
                    targetName: created.name,
                    summary: "สร้างข้อมูลพนักงานใหม่"
                }),
                timestamp: new Date()
            }
        }).catch(console.error);

        return NextResponse.json({ ok: true, employee: created });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}

export async function PATCH(req: Request) {
    try {
        const auth = await requireAdmin();

        const body = (await req.json().catch(() => ({}))) as PatchEmployeeBody;

        const emp_id = clean(body.emp_id);
        if (!emp_id) return jsonError("EMP_ID_REQUIRED", 400);

        const exists = await prisma.employees.findUnique({ where: { emp_id } });
        if (!exists) return jsonError("EMP_NOT_FOUND", 404);

        const data: any = {};

        // If any of the new name components are provided, we should save them and re-compose the name.
        if (body.title_prefix !== undefined || body.first_name !== undefined || body.last_name !== undefined) {
            if (body.title_prefix !== undefined) data.title_prefix = body.title_prefix ? clean(body.title_prefix) : null;
            if (body.first_name !== undefined) data.first_name = body.first_name ? clean(body.first_name) : null;
            if (body.last_name !== undefined) data.last_name = body.last_name ? clean(body.last_name) : null;

            // Re-compose the name using either the provided fields or existing fields from DB
            const existingTitle = data.title_prefix !== undefined ? data.title_prefix : exists.title_prefix;
            const existingFirst = data.first_name !== undefined ? data.first_name : exists.first_name;
            const existingLast = data.last_name !== undefined ? data.last_name : exists.last_name;

            const composedName = composeEmployeeName(existingTitle, existingFirst, existingLast);
            if (composedName) {
                data.name = composedName;
            }
        } else if (body.name !== undefined) {
            // Legacy fallback if only 'name' is provided
            const name = clean(body.name);
            if (!name) return jsonError("NAME_REQUIRED", 400);
            data.name = name;
        }

        if (body.nickname !== undefined) {
            data.nickname = body.nickname ? clean(body.nickname) : null;
        }

        if (body.branch_id !== undefined) {
            const branch_id = body.branch_id ? clean(body.branch_id) : null;
            data.branch_id = branch_id;
        }

        if (body.is_active !== undefined) {
            data.is_active = Boolean(body.is_active);
            // If reactivating (is_active: true), clear resignation date
            if (data.is_active) {
                data.resignation_date = null;
            }
        }

        if (body.resignation_date !== undefined) {
            const rd = body.resignation_date ? clean(body.resignation_date) : null;
            if (rd && !isISODate(rd)) return jsonError("RESIGNATION_DATE_INVALID", 400);
            data.resignation_date = rd ? new Date(rd) : null;
        }

        if (body.gender !== undefined) {
            data.gender = body.gender ?? null;
        }

        if (body.hire_date !== undefined) {
            const hire_date = body.hire_date ? clean(body.hire_date) : null;
            if (hire_date && !isISODate(hire_date)) return jsonError("HIRE_DATE_INVALID", 400);
            data.hire_date = hire_date ? new Date(hire_date) : null;
        }

        if (body.birth_date !== undefined) {
            const birth_date = body.birth_date ? clean(body.birth_date) : null;
            if (birth_date && !isISODate(birth_date)) return jsonError("BIRTH_DATE_INVALID", 400);
            data.birth_date = birth_date ? new Date(birth_date) : null;
        }

        if (body.phone_number !== undefined) {
            data.phone_number = body.phone_number ? clean(body.phone_number) : null;
        }

        if (body.department_id !== undefined) {
            data.department_id = body.department_id || null;
        }

        if (body.job_position_id !== undefined) {
            data.job_position_id = body.job_position_id || null;
        }

        if (body.base_salary !== undefined) {
            data.base_salary = body.base_salary != null ? Number(body.base_salary) : null;
        }

        if (body.supervisor_id !== undefined) {
            data.supervisor_id = body.supervisor_id ? clean(body.supervisor_id) : null;
        }
        if (body.secondary_supervisor_id !== undefined) {
            data.secondary_supervisor_id = body.secondary_supervisor_id ? clean(body.secondary_supervisor_id) : null;
        }

        if (body.is_on_trial !== undefined) {
            data.is_on_trial = Boolean(body.is_on_trial);
            if (!data.is_on_trial) data.probation_end_date = null;
        }

        if (body.probation_end_date !== undefined) {
            const ped = body.probation_end_date ? clean(body.probation_end_date) : null;
            if (ped && !isISODate(ped)) return jsonError("PROBATION_END_DATE_INVALID", 400);
            data.probation_end_date = ped ? new Date(ped) : null;
        }

        if (body.has_telephone_allowance !== undefined) {
            data.has_telephone_allowance = Boolean(body.has_telephone_allowance);
        }
        if (body.fixed_tax_deduction !== undefined) {
            data.fixed_tax_deduction = body.fixed_tax_deduction != null ? Number(body.fixed_tax_deduction) : 0;
        }

        if (body.national_id_card !== undefined) {
            data.national_id_card = body.national_id_card ? clean(body.national_id_card) : null;
        }
        if (body.nationality !== undefined) {
            data.nationality = body.nationality ? clean(body.nationality) : 'THA';
        }
        if (body.id_document_type !== undefined) {
            data.id_document_type = body.id_document_type ? clean(body.id_document_type) : 'national_id';
        }
        if (body.is_onboarding_complete !== undefined) {
            data.is_onboarding_complete = Boolean(body.is_onboarding_complete);
        }
        if (body.address !== undefined) {
            data.address = body.address ? clean(body.address) : null;
        }
        if (body.bank_name !== undefined) {
            data.bank_name = body.bank_name ? clean(body.bank_name) : null;
        }
        if (body.bank_account_no !== undefined) {
            data.bank_account_no = body.bank_account_no ? clean(body.bank_account_no) : null;
        }
        if (body.salary_type !== undefined) {
            data.salary_type = body.salary_type || "monthly";
        }
        if (body.line_user_id !== undefined) {
            data.line_user_id = body.line_user_id ? clean(body.line_user_id) : null;
        }
        if (body.is_checkin_exempt !== undefined) {
            data.is_checkin_exempt = Boolean(body.is_checkin_exempt);
        }
        if (body.email !== undefined) {
            data.email = body.email ? clean(body.email) : null;
        }
        if (body.company_car !== undefined) {
            // @ts-ignore
            data.company_car = Boolean(body.company_car);
        }
        if (body.company_accommodation !== undefined) {
            // @ts-ignore
            data.company_accommodation = Boolean(body.company_accommodation);
        }
        if (body.company_id !== undefined) {
            data.company_id = body.company_id ? Number(body.company_id) : null;
        }

        // pin: ถ้าส่งมาเป็น string ว่าง = ไม่แก้
        if (body.pin !== undefined) {
            const pin = clean(body.pin);
            if (pin) {
                if (pin.length < 4) return jsonError("PIN_TOO_SHORT", 400);
                data.pin_hash = await bcrypt.hash(pin, 10);
            }
        }

        const updated = await prisma.employees.update({
            where: { emp_id },
            data,
            select: {
                emp_id: true,
                company_id: true,
                name: true,
                nickname: true,
                branch_id: true,
                is_active: true,
                gender: true,
                hire_date: true,
                birth_date: true,
                phone_number: true,
                department_id: true,
                job_position_id: true,
                base_salary: true,
                supervisor_id: true,
                secondary_supervisor_id: true,
                updated_at: true,
                is_on_trial: true,
                probation_end_date: true,
                has_telephone_allowance: true,
                fixed_tax_deduction: true,
                national_id_card: true,
                address: true,
                bank_name: true,
                bank_account_no: true,
                line_user_id: true,
                is_checkin_exempt: true,
                resignation_date: true,
                email: true,
                company_car: true,
                company_accommodation: true,
                nationality: true,
                id_document_type: true,
                is_onboarding_complete: true,
                position_allowance: true,
                allowance_mode: true,
            },
        });

        // If employee was deactivated or has resignation_date, trigger supervisor succession
        if (data.is_active === false || data.resignation_date) {
            await handleSupervisorResignation(emp_id);
        }

        // Record update in AuditLog
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: auth.emp_id || "admin",
                action: "UPDATE_EMPLOYEE_BASIC",
                resource: "employees",
                resourceId: emp_id,
                details: JSON.stringify({
                    targetName: updated.name,
                    summary: "แก้ไขข้อมูลพนักงาน"
                }),
                timestamp: new Date()
            }
        }).catch(console.error);

        return NextResponse.json({ ok: true, employee: updated });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}

/**
 * Automatically handles supervisor succession when a supervisor resigns or becomes inactive.
 * For all active subordinates of this supervisor:
 * - Promotes the 1st active co-evaluator to become the new supervisor.
 * - Removes the promoted evaluator from employee_co_evaluators and re-sequences the remaining co-evaluators.
 * - Updates secondary_supervisor_id to the new 1st co-evaluator (or null).
 * - If no co-evaluator exists, sets supervisor_id to null (so future requests route directly to HR).
 */
export async function handleSupervisorResignation(resignedSupervisorId: string) {
    try {
        const subordinates = await prisma.employees.findMany({
            where: {
                supervisor_id: resignedSupervisorId,
                is_active: true
            },
            select: {
                emp_id: true,
                name: true,
                secondary_supervisor_id: true
            }
        });

        for (const sub of subordinates) {
            // Find active co-evaluators ordered by order_no ASC
            const coEvals: any[] = ((await prisma.$queryRawUnsafe(
                `SELECT ece.evaluator_id, ece.order_no, emp.is_active 
                 FROM employee_co_evaluators ece
                 JOIN employees emp ON emp.emp_id = ece.evaluator_id
                 WHERE ece.employee_id = $1 AND emp.is_active = true
                 ORDER BY ece.order_no ASC;`,
                sub.emp_id
            ).catch(() => [])) as any[]) || [];

            let newSupervisorId: string | null = null;
            if (coEvals.length > 0) {
                newSupervisorId = coEvals[0].evaluator_id;
            } else if (sub.secondary_supervisor_id) {
                const secEmp = await prisma.employees.findUnique({
                    where: { emp_id: sub.secondary_supervisor_id },
                    select: { is_active: true }
                });
                if (secEmp?.is_active) {
                    newSupervisorId = sub.secondary_supervisor_id;
                }
            }

            if (newSupervisorId) {
                // Delete promoted co-evaluator from co-evaluators table
                await prisma.$executeRawUnsafe(
                    `DELETE FROM employee_co_evaluators WHERE employee_id = $1 AND evaluator_id = $2;`,
                    sub.emp_id,
                    newSupervisorId
                ).catch(() => { });

                // Re-sequence remaining co-evaluators
                const remaining: any[] = ((await prisma.$queryRawUnsafe(
                    `SELECT evaluator_id FROM employee_co_evaluators WHERE employee_id = $1 ORDER BY order_no ASC;`,
                    sub.emp_id
                ).catch(() => [])) as any[]) || [];

                for (let i = 0; i < remaining.length; i++) {
                    await prisma.$executeRawUnsafe(
                        `UPDATE employee_co_evaluators SET order_no = $1 WHERE employee_id = $2 AND evaluator_id = $3;`,
                        i + 1,
                        sub.emp_id,
                        remaining[i].evaluator_id
                    ).catch(() => { });
                }

                const newSecondaryId = remaining[0]?.evaluator_id || null;

                await prisma.employees.update({
                    where: { emp_id: sub.emp_id },
                    data: {
                        supervisor_id: newSupervisorId,
                        secondary_supervisor_id: newSecondaryId
                    }
                });
                console.log(`[SUPERVISOR SUCCESSION] Subordinate ${sub.emp_id} promoted co-evaluator ${newSupervisorId} to supervisor.`);
            } else {
                // No co-evaluator available, set supervisor_id to null so it falls back to HR
                await prisma.employees.update({
                    where: { emp_id: sub.emp_id },
                    data: {
                        supervisor_id: null,
                        secondary_supervisor_id: null
                    }
                });
                console.log(`[SUPERVISOR SUCCESSION] Subordinate ${sub.emp_id} has no co-evaluators. Supervisor cleared (routes to HR).`);
            }
        }
    } catch (err) {
        console.error("[SUPERVISOR SUCCESSION ERROR]", err);
    }
}
