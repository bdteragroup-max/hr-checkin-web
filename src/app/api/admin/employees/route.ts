import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

type CreateEmployeeBody = {
    emp_id: string;
    name: string;
    nickname?: string | null;
    branch_id?: string | null;
    pin?: string;
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
    position_allowance?: number | null;
    national_id_card?: string | null;
    address?: string | null;
    bank_name?: string | null;
    bank_account_no?: string | null;
    salary_type?: string | null;
    line_user_id?: string | null;
    is_checkin_exempt?: boolean;
    secondary_supervisor_id?: string | null;
};

type PatchEmployeeBody = {
    emp_id: string;

    name?: string;
    nickname?: string | null;
    branch_id?: string | null;
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
    position_allowance?: number | null;
    national_id_card?: string | null;
    address?: string | null;
    bank_name?: string | null;
    bank_account_no?: string | null;
    salary_type?: string | null;
    line_user_id?: string | null;
    is_checkin_exempt?: boolean;
    resignation_date?: string | null;
    secondary_supervisor_id?: string | null;

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
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const minimal = searchParams.get("minimal") === "1";

        if (minimal) {
            const list = await prisma.employees.findMany({
                where: { is_active: true },
                select: { name: true, nickname: true, birth_date: true },
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

        const list = await prisma.employees.findMany({
            orderBy: { created_at: "desc" },
            take: 500,
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
                departments: true,
                job_positions: true,
                supervisor_id: true,
                supervisor: { select: { name: true } },
                secondary_supervisor_id: true,
                secondary_supervisor: { select: { name: true } },
                is_on_trial: true,
                probation_end_date: true,
                has_telephone_allowance: true,
                position_allowance: true,
                national_id_card: true,
                address: true,
                bank_name: true,
                bank_account_no: true,
                line_user_id: true,
                salary_type: true,
                is_checkin_exempt: true,
                resignation_date: true
            },
        });

        return NextResponse.json({ ok: true, list });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}

export async function POST(req: Request) {
    try {
        await requireAdmin();

        const body = (await req.json().catch(() => ({}))) as CreateEmployeeBody;

        const emp_id = clean(body.emp_id);
        const name = clean(body.name);
        const nickname = body.nickname ? clean(body.nickname) : null;
        const branch_id = body.branch_id ? clean(body.branch_id) : null;

        if (!emp_id) return jsonError("EMP_ID_REQUIRED", 400);
        if (!name) return jsonError("NAME_REQUIRED", 400);

        const exists = await prisma.employees.findUnique({ where: { emp_id } });
        if (exists) return jsonError("EMP_ID_EXISTS", 409);

        // PIN hash
        let pin_hash: string | undefined = undefined;
        const pin = body.pin ? clean(body.pin) : "";
        if (pin) {
            if (pin.length < 4) return jsonError("PIN_TOO_SHORT", 400);
            pin_hash = await bcrypt.hash(pin, 10);
        }

        const gender = body.gender ?? null;

        const hire_date = body.hire_date ? clean(body.hire_date) : null;
        if (hire_date && !isISODate(hire_date)) return jsonError("HIRE_DATE_INVALID", 400);

        const birth_date = body.birth_date ? clean(body.birth_date) : null;
        if (birth_date && !isISODate(birth_date)) return jsonError("BIRTH_DATE_INVALID", 400);

        const phone_number = body.phone_number ? clean(body.phone_number) : null;

        const created = await prisma.employees.create({
            data: {
                emp_id,
                name,
                nickname,
                branch_id,
                is_active: body.is_active ?? true,
                ...(pin_hash ? { pin_hash } : {}),

                gender: gender ?? undefined,
                hire_date: hire_date ? new Date(hire_date) : undefined,
                birth_date: birth_date ? new Date(birth_date) : undefined,
                phone_number: phone_number ?? undefined,
                department_id: body.department_id || null,
                job_position_id: body.job_position_id || null,
                base_salary: body.base_salary != null ? Number(body.base_salary) : null,
                supervisor_id: body.supervisor_id ? clean(body.supervisor_id) : null,
                is_on_trial: body.is_on_trial ?? false,
                probation_end_date: (body.is_on_trial && body.probation_end_date && isISODate(body.probation_end_date))
                    ? new Date(body.probation_end_date)
                    : null,
                has_telephone_allowance: body.has_telephone_allowance ?? false,
                position_allowance: body.position_allowance != null ? Number(body.position_allowance) : 0,
                national_id_card: body.national_id_card ? clean(body.national_id_card) : null,
                address: body.address ? clean(body.address) : null,
                bank_name: body.bank_name ? clean(body.bank_name) : null,
                bank_account_no: body.bank_account_no ? clean(body.bank_account_no) : null,
                salary_type: body.salary_type || "monthly",
                line_user_id: body.line_user_id ? clean(body.line_user_id) : null,
                is_checkin_exempt: body.is_checkin_exempt ?? false,
                secondary_supervisor_id: body.secondary_supervisor_id ? clean(body.secondary_supervisor_id) : null,
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
                position_allowance: true,
                national_id_card: true,
                address: true,
                bank_name: true,
                bank_account_no: true,
                line_user_id: true,
                is_checkin_exempt: true,
            },
        });

        return NextResponse.json({ ok: true, employee: created });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}

export async function PATCH(req: Request) {
    try {
        await requireAdmin();

        const body = (await req.json().catch(() => ({}))) as PatchEmployeeBody;

        const emp_id = clean(body.emp_id);
        if (!emp_id) return jsonError("EMP_ID_REQUIRED", 400);

        const exists = await prisma.employees.findUnique({ where: { emp_id } });
        if (!exists) return jsonError("EMP_NOT_FOUND", 404);

        const data: any = {};

        if (body.name !== undefined) {
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

        if (body.position_allowance !== undefined) {
            data.position_allowance = body.position_allowance != null ? Number(body.position_allowance) : 0;
        }

        if (body.national_id_card !== undefined) {
            data.national_id_card = body.national_id_card ? clean(body.national_id_card) : null;
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
                position_allowance: true,
                national_id_card: true,
                address: true,
                bank_name: true,
                bank_account_no: true,
                line_user_id: true,
                is_checkin_exempt: true,
                resignation_date: true,
            },
        });

        return NextResponse.json({ ok: true, employee: updated });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}