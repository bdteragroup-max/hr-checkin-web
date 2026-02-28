import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

type CreateEmployeeBody = {
    emp_id: string;
    name: string;
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
    has_telephone_allowance?: boolean;
    position_allowance?: number | null;
};

type PatchEmployeeBody = {
    emp_id: string;

    name?: string;
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
    has_telephone_allowance?: boolean;
    position_allowance?: number | null;

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
                select: { name: true, birth_date: true },
            });
            return NextResponse.json({ ok: true, list });
        }

        const list = await prisma.employees.findMany({
            orderBy: { created_at: "desc" },
            take: 500,
            select: {
                emp_id: true,
                name: true,
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
                is_on_trial: true,
                has_telephone_allowance: true,
                position_allowance: true,
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
                has_telephone_allowance: body.has_telephone_allowance ?? false,
                position_allowance: body.position_allowance != null ? Number(body.position_allowance) : 0,
            },
            select: {
                emp_id: true,
                name: true,
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
                created_at: true,
                is_on_trial: true,
                has_telephone_allowance: true,
                position_allowance: true,
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

        if (body.branch_id !== undefined) {
            const branch_id = body.branch_id ? clean(body.branch_id) : null;
            data.branch_id = branch_id;
        }

        if (body.is_active !== undefined) {
            data.is_active = Boolean(body.is_active);
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

        if (body.is_on_trial !== undefined) {
            data.is_on_trial = Boolean(body.is_on_trial);
        }

        if (body.has_telephone_allowance !== undefined) {
            data.has_telephone_allowance = Boolean(body.has_telephone_allowance);
        }

        if (body.position_allowance !== undefined) {
            data.position_allowance = body.position_allowance != null ? Number(body.position_allowance) : 0;
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
                updated_at: true,
                is_on_trial: true,
                has_telephone_allowance: true,
                position_allowance: true,
            },
        });

        return NextResponse.json({ ok: true, employee: updated });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}