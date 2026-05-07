import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWorkPlanNotification } from "@/utils/lineMessaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const TARGET_ID = process.env.LINE_WORKPLAN_GROUP_ID || process.env.MANAGEMENT_LINE_USER_ID;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!TARGET_ID) {
        return NextResponse.json({ error: "NO_TARGET_ID" }, { status: 400 });
    }

    try {
        // Fetch plans that haven't been notified yet
        const pendingPlans = await prisma.daily_work_plans.findMany({
            where: {
                notified_at: null
            },
            include: {
                employees: {
                    select: {
                        name: true,
                        departments: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'asc'
            }
        });

        if (pendingPlans.length === 0) {
            return NextResponse.json({ ok: true, message: "No new plans to notify" });
        }

        let sentCount = 0;
        const now = new Date();

        // Send notifications individually for each employee
        for (const plan of pendingPlans) {
            const success = await sendWorkPlanNotification(TARGET_ID, {
                empName: plan.employees?.name || "Unknown",
                deptName: plan.employees?.departments?.name,
                morningPlan: plan.morning_plan,
                morningLoc: plan.morning_location,
                afternoonPlan: plan.afternoon_plan,
                afternoonLoc: plan.afternoon_location,
                otPlan: plan.ot_plan || undefined,
                otLoc: plan.ot_location || undefined,
                otAttendant: plan.ot_attendant || undefined
            });

            if (success) {
                await prisma.daily_work_plans.update({
                    where: { id: plan.id },
                    data: { notified_at: now }
                });
                sentCount++;
            }
        }

        return NextResponse.json({
            ok: true,
            sentCount,
            totalPending: pendingPlans.length
        });

    } catch (error: any) {
        console.error("[WORK PLAN CRON] Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
