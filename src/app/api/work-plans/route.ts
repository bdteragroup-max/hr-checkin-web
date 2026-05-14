import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { getTodayBangkokISO } from "@/utils/time";

export async function GET() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const payload = verifyToken(token);
        if (!payload) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });

        const todayStr = getTodayBangkokISO();
        const startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
        const endOfDay = new Date(`${todayStr}T23:59:59.999Z`);

        const plan = await prisma.daily_work_plans.findFirst({
            where: {
                emp_id: payload.emp_id,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        const supervisors = await prisma.employees.findMany({
            where: {
                subordinates: { some: {} }
            },
            select: {
                emp_id: true,
                name: true,
                nickname: true
            }
        });

        const employee = await prisma.employees.findUnique({
            where: { emp_id: payload.emp_id },
            select: { branches: { select: { name: true } } }
        });

        return NextResponse.json({
            ok: true,
            plan,
            supervisors: supervisors.map(s => ({
                id: s.emp_id,
                name: s.nickname ? `${s.name} (${s.nickname})` : s.name
            })),
            defaultOffice: employee?.branches?.name || "สำนักงานใหญ่"
        });
    } catch (err: any) {
        return NextResponse.json({ error: "INTERNAL_ERROR", message: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const payload = verifyToken(token);
        if (!payload) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });

        const body = await req.json();

        const sanitize = (val: any) => {
            if (typeof val !== 'string') return val;
            return val.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s.,\-_()\/]/g, "");
        };

        const morning_plan = sanitize(body.morning_plan);
        const morning_location = sanitize(body.morning_location);
        const afternoon_plan = sanitize(body.afternoon_plan);
        const afternoon_location = sanitize(body.afternoon_location);
        const ot_plan = sanitize(body.ot_plan);
        const ot_location = sanitize(body.ot_location);
        const ot_attendant = sanitize(body.ot_attendant);

        const hasValidText = (val: string) => /[a-zA-Z0-9\u0E00-\u0E7F]/.test(val || "");

        if (!hasValidText(morning_plan) || !hasValidText(morning_location) || !hasValidText(afternoon_plan) || !hasValidText(afternoon_location)) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS", message: "Plan must contain text, not just punctuation." }, { status: 400 });
        }

        const todayStr = getTodayBangkokISO();
        const targetDate = new Date(`${todayStr}T00:00:00.000Z`);

        // Check if plan already exists so we don't spam LINE on every edit
        const existingPlan = await prisma.daily_work_plans.findUnique({
            where: {
                emp_id_date: {
                    emp_id: payload.emp_id,
                    date: targetDate
                }
            }
        });

        const now = new Date();

        const plan = await prisma.daily_work_plans.upsert({
            where: {
                emp_id_date: {
                    emp_id: payload.emp_id,
                    date: targetDate
                }
            },
            update: {
                morning_plan,
                morning_location,
                afternoon_plan,
                afternoon_location,
                ot_plan,
                ot_location,
                ot_attendant
                // We do NOT update notified_at here so we don't accidentally re-trigger cron if it was null
            },
            create: {
                emp_id: payload.emp_id,
                date: targetDate,
                morning_plan,
                morning_location,
                afternoon_plan,
                afternoon_location,
                ot_plan,
                ot_location,
                ot_attendant,
                notified_at: now
            }
        });

        // Send LINE notification only if it's a new plan
        if (!existingPlan) {
            const employee = await prisma.employees.findUnique({
                where: { emp_id: payload.emp_id },
                select: { name: true, departments: { select: { name: true } } }
            });

            if (employee) {
                const groupId = process.env.LINE_WORKPLAN_GROUP_ID;
                if (groupId) {
                    const { sendWorkPlanNotification } = await import("@/utils/lineMessaging");
                    await sendWorkPlanNotification(groupId, {
                        empName: employee.name,
                        deptName: employee.departments?.name,
                        morningPlan: morning_plan,
                        morningLoc: morning_location,
                        afternoonPlan: afternoon_plan,
                        afternoonLoc: afternoon_location,
                        otPlan: ot_plan,
                        otLoc: ot_location,
                        otAttendant: ot_attendant
                    });
                }
            }
        }

        return NextResponse.json({ ok: true, plan });
    } catch (err: any) {
        return NextResponse.json({ error: "INTERNAL_ERROR", message: err.message }, { status: 500 });
    }
}
