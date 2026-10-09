import { NextResponse } from "next/server";
import { syncHumanSoftAttendanceToDatabase } from "@/lib/humansoft";
import { getTodayBangkokISO } from "@/utils/time";

export const dynamic = "force-dynamic";

/**
 * GET: Cron job to sync HumanSoft attendance records for today.
 * Can be called by Cloud Scheduler or Vercel Cron periodically (e.g. every 10-15 minutes).
 */
export async function GET(req: Request) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            const authHeader = req.headers.get("authorization");
            if (authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
            }
        }

        const today = getTodayBangkokISO();
        const result = await syncHumanSoftAttendanceToDatabase({
            date_from: today,
            date_to: today
        });

        return NextResponse.json({
            cron: "humansoft-sync",
            timestamp: new Date().toISOString(),
            ...result
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message || "CRON_ERROR" }, { status: 500 });
    }
}
