import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

        // Send notifications using batch method
        let sentCount = 0;
        const now = new Date();
        const { sendWorkPlanNotificationBatch } = await import("@/utils/lineMessaging");

        // Send max 10 at a time to be consistent
        const maxBatchSize = 10;
        for (let i = 0; i < pendingPlans.length; i += maxBatchSize) {
            const batch = pendingPlans.slice(i, i + maxBatchSize);
            
            const formattedPlans = batch.map(plan => ({
                empName: plan.employees?.name || "Unknown",
                deptName: plan.employees?.departments?.name,
                morningPlan: plan.morning_plan,
                morningLoc: plan.morning_location,
                afternoonPlan: plan.afternoon_plan,
                afternoonLoc: plan.afternoon_location,
                otPlan: plan.ot_plan || undefined,
                otLoc: plan.ot_location || undefined,
                otAttendant: plan.ot_attendant || undefined
            }));

            const success = await sendWorkPlanNotificationBatch(TARGET_ID, formattedPlans);

            if (success) {
                await prisma.daily_work_plans.updateMany({
                    where: { id: { in: batch.map(p => p.id) } },
                    data: { notified_at: now }
                });
                sentCount += batch.length;
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
