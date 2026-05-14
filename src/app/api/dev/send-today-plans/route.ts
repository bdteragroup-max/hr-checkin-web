import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO } from "@/utils/time";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const todayStr = getTodayBangkokISO();
        const startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
        const endOfDay = new Date(`${todayStr}T23:59:59.999Z`);

        const plans = await prisma.daily_work_plans.findMany({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                employees: {
                    select: { name: true, departments: { select: { name: true } } }
                }
            }
        });

        if (plans.length === 0) {
            return NextResponse.json({ message: "No plans found for today." });
        }

        const { sendWorkPlanNotification } = await import("@/utils/lineMessaging");
        const groupId = process.env.LINE_WORKPLAN_GROUP_ID;

        if (!groupId) {
            return NextResponse.json({ message: "LINE_WORKPLAN_GROUP_ID is not configured in .env" });
        }

        let sentCount = 0;
        for (const plan of plans) {
            if (plan.employees) {
                await sendWorkPlanNotification(groupId, {
                    empName: plan.employees.name,
                    deptName: plan.employees.departments?.name,
                    morningPlan: plan.morning_plan,
                    morningLoc: plan.morning_location,
                    afternoonPlan: plan.afternoon_plan,
                    afternoonLoc: plan.afternoon_location,
                    otPlan: plan.ot_plan,
                    otLoc: plan.ot_location,
                    otAttendant: plan.ot_attendant
                });
                sentCount++;
            }
        }

        return NextResponse.json({ message: `Successfully sent ${sentCount} plans to the group.` });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
