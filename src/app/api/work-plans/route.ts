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

        const today = getTodayBangkokISO();
        const plan = await prisma.daily_work_plans.findFirst({
            where: {
                emp_id: payload.emp_id,
                date: new Date(today)
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

        return NextResponse.json({
            ok: true,
            plan,
            supervisors: supervisors.map(s => ({
                id: s.emp_id,
                name: s.nickname ? `${s.name} (${s.nickname})` : s.name
            }))
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
        const { morning_plan, morning_location, afternoon_plan, afternoon_location, ot_plan, ot_location, ot_attendant } = body;

        if (!morning_plan || !morning_location || !afternoon_plan || !afternoon_location) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        const today = getTodayBangkokISO();

        const plan = await prisma.daily_work_plans.upsert({
            where: {
                emp_id_date: {
                    emp_id: payload.emp_id,
                    date: new Date(today)
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
            },
            create: {
                emp_id: payload.emp_id,
                date: new Date(today),
                morning_plan,
                morning_location,
                afternoon_plan,
                afternoon_location,
                ot_plan,
                ot_location,
                ot_attendant
            }
        });

        return NextResponse.json({ ok: true, plan });
    } catch (err: any) {
        return NextResponse.json({ error: "INTERNAL_ERROR", message: err.message }, { status: 500 });
    }
}
