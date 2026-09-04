import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function clean(v: unknown) {
    return String(v ?? "").trim();
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const emp_id = (await params).id;

        const employee = await prisma.employees.findUnique({
            where: { emp_id },
            include: {
                departments: true,
                job_positions: true,
                branches: true,
            }
        });

        if (!employee) {
            return NextResponse.json({ ok: false, error: "EMP_NOT_FOUND" }, { status: 404 });
        }

        // Fetch existing employee allowances
        const allowances = await prisma.employee_allowances.findMany({
            where: { employee_id: emp_id },
            include: {
                allowance_type: true
            }
        });

        // Determine effective position allowance (fallback to ค่าตำแหน่ง allowance if employee column was 0)
        let position_allowance = employee.position_allowance;
        if (!position_allowance || Number(position_allowance) === 0) {
            const posRow = allowances.find(a => a.allowance_type?.name?.includes("ค่าตำแหน่ง"));
            if (posRow && Number(posRow.amount) > 0) {
                position_allowance = posRow.amount;
            }
        }

        // Fetch co-evaluators
        const coEvaluators: any[] = ((await prisma.$queryRawUnsafe(
            `SELECT evaluator_id, order_no FROM employee_co_evaluators WHERE employee_id = $1 ORDER BY order_no ASC;`,
            emp_id
        ).catch(() => [])) as any[]) || [];

        return NextResponse.json({
            ok: true,
            employee: {
                ...employee,
                position_allowance: position_allowance != null ? Number(position_allowance) : 0,
                allowances,
                co_evaluator_ids: coEvaluators.map((c: any) => c.evaluator_id)
            }
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        const emp_id = (await params).id;

        const body = await req.json().catch(() => ({}));
        const step = body.step;

        const exists = await prisma.employees.findUnique({ where: { emp_id } });
        if (!exists) {
            return NextResponse.json({ ok: false, error: "EMP_NOT_FOUND" }, { status: 404 });
        }

        if (step === 2) {
            // STEP 2: Allowances & Tax & SSO
            const allowance_mode = body.allowance_mode === 'lump_sum' ? 'lump_sum' : 'itemized';
            const fixed_tax_deduction = body.fixed_tax_deduction != null ? Number(body.fixed_tax_deduction) : 0;
            
            // Transaction for updating employee and inserting allowances
            await prisma.$transaction(async (tx) => {
                const empUpdateData: any = {
                    allowance_mode,
                    fixed_tax_deduction,
                    has_telephone_allowance: Boolean(body.has_telephone_allowance),
                };

                if (body.base_salary !== undefined) {
                    empUpdateData.base_salary = body.base_salary !== "" && body.base_salary !== null ? Number(body.base_salary) : null;
                }
                if (body.salary_type !== undefined) {
                    empUpdateData.salary_type = body.salary_type || "monthly";
                }
                if (body.position_allowance !== undefined) {
                    empUpdateData.position_allowance = body.position_allowance !== "" && body.position_allowance !== null ? Number(body.position_allowance) : 0;
                }

                // พนักงานรายวันไม่ได้รับสวัสดิการ ค่าตำแหน่ง และค่าโทรศัพท์
                if (empUpdateData.salary_type === "daily") {
                    empUpdateData.position_allowance = 0;
                    empUpdateData.has_telephone_allowance = false;
                }

                // Update employee
                await tx.employees.update({
                    where: { emp_id },
                    data: empUpdateData
                });

                // Clear old allowances
                await tx.employee_allowances.deleteMany({
                    where: { employee_id: emp_id }
                });

                // Insert new allowances (ยกเว้นพนักงานรายวัน ไม่บันทึกสวัสดิการใดๆ)
                if (empUpdateData.salary_type !== "daily" && Array.isArray(body.allowances) && body.allowances.length > 0) {
                    const allTypes = await tx.allowance_types.findMany();
                    const isLumpSumType = (typeId: number) => {
                        const t = allTypes.find(at => at.id === typeId);
                        return t?.name?.includes("เหมาจ่าย") || t?.name?.toLowerCase().includes("lump");
                    };
                    const isExcludedAllowanceType = (typeId: number) => {
                        const t = allTypes.find(at => at.id === typeId);
                        return t?.name?.includes("ค่าที่พัก") || t?.name?.includes("ค่าอาหาร") || t?.name?.includes("ค่าเดินทาง");
                    };

                    const hasLumpSum = allowance_mode === "lump_sum" || body.allowances.some((a: any) => isLumpSumType(Number(a.allowance_type_id)));

                    const validAllowances = body.allowances
                        .filter((a: any) => {
                            if (!a.allowance_type_id || a.amount === "") return false;
                            const typeId = Number(a.allowance_type_id);
                            // หากพนักงานได้รับเงินช่วยเหลือเหมาจ่าย จะไม่ได้รับค่าอาหาร ค่าที่พัก และค่าเดินทาง
                            if (hasLumpSum && isExcludedAllowanceType(typeId)) {
                                return false;
                            }
                            return true;
                        })
                        .map((a: any) => ({
                            employee_id: emp_id,
                            allowance_type_id: Number(a.allowance_type_id),
                            amount: Number(a.amount) || 0,
                            calc_basis: a.calc_basis || 'fixed_monthly',
                            applies_to: a.applies_to || 'always',
                            sso_included: Boolean(a.sso_included),
                            tax_included: a.tax_included !== undefined ? Boolean(a.tax_included) : true,
                            void_on_warning: Boolean(a.void_on_warning)
                        }));

                    if (validAllowances.length > 0) {
                        await tx.employee_allowances.createMany({
                            data: validAllowances
                        });
                    }
                }
            });

            // Record revision to AuditLog
            await prisma.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: auth.emp_id || "admin",
                    action: "UPDATE_EMPLOYEE_SALARY",
                    resource: "employees",
                    resourceId: emp_id,
                    details: JSON.stringify({
                        targetName: exists.name,
                        step: 2,
                        summary: "แก้ไขข้อมูลเงินเดือนและสวัสดิการ"
                    }),
                    timestamp: new Date()
                }
            }).catch(console.error);

            return NextResponse.json({ ok: true, emp_id });

        } else if (step === 3) {
            // STEP 3: Onboarding Finalization
            const phone_number = body.phone_number ? clean(body.phone_number) : null;
            const email = body.email ? clean(body.email) : null;
            const line_user_id = body.line_user_id ? clean(body.line_user_id) : null;
            const supervisor_id = body.supervisor_id ? clean(body.supervisor_id) : null;
            const rawCoEvaluators = Array.isArray(body.co_evaluator_ids) ? body.co_evaluator_ids : [];
            const co_evaluator_ids: string[] = Array.from<string>(new Set(
                rawCoEvaluators
                    .map((id: any) => clean(id))
                    .filter((id: any): id is string => Boolean(id && id !== supervisor_id && id !== emp_id))
            )).slice(0, 5);

            const secondary_supervisor_id = co_evaluator_ids[0] || (body.secondary_supervisor_id ? clean(body.secondary_supervisor_id) : null);
            const company_accommodation = Boolean(body.company_accommodation);
            const company_car = Boolean(body.company_car);
            
            const pin = body.pin ? clean(body.pin) : "";
            const isEdit = Boolean(body.mode === "edit" || body.isEdit);
            let pin_hash: string | undefined = undefined;

            if (pin) {
                if (pin.length < 4) {
                    return NextResponse.json({ ok: false, error: "PIN_TOO_SHORT" }, { status: 400 });
                }
                pin_hash = await bcrypt.hash(pin, 10);
            } else if (!isEdit) {
                return NextResponse.json({ ok: false, error: "PIN_REQUIRED" }, { status: 400 });
            }

            const updated = await prisma.$transaction(async (tx) => {
                const empUpdateData: any = {
                    phone_number,
                    email,
                    line_user_id,
                    supervisor_id,
                    secondary_supervisor_id,
                    company_accommodation,
                    company_car,
                    is_onboarding_complete: true // Mark as complete!
                };

                if (pin_hash) {
                    empUpdateData.pin_hash = pin_hash;
                }

                const empUpdated = await tx.employees.update({
                    where: { emp_id },
                    data: empUpdateData
                });

                // Clear old co-evaluators
                await tx.$executeRawUnsafe(
                    `DELETE FROM employee_co_evaluators WHERE employee_id = $1;`,
                    emp_id
                );

                // Insert new co-evaluators
                for (let i = 0; i < co_evaluator_ids.length; i++) {
                    await tx.$executeRawUnsafe(
                        `INSERT INTO employee_co_evaluators (employee_id, evaluator_id, order_no) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`,
                        emp_id,
                        co_evaluator_ids[i],
                        i + 1
                    );
                }

                return empUpdated;
            });

            // Record revision to AuditLog
            await prisma.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: auth.emp_id || "admin",
                    action: "UPDATE_EMPLOYEE_ONBOARDING",
                    resource: "employees",
                    resourceId: emp_id,
                    details: JSON.stringify({
                        targetName: exists.name,
                        step: 3,
                        summary: "แก้ไขการตั้งค่าระบบและผู้ประเมิน"
                    }),
                    timestamp: new Date()
                }
            }).catch(console.error);

            return NextResponse.json({ ok: true, employee: updated });
        } else {
            return NextResponse.json({ ok: false, error: "INVALID_STEP" }, { status: 400 });
        }

    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}
