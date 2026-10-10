import { NextResponse } from "next/server";
import { syncHumanSoftAttendanceToDatabase } from "@/lib/humansoft";
import { getTodayBangkokISO, getYesterdayBangkokISO } from "@/utils/time";

export const dynamic = "force-dynamic";

/**
 * GET: Cron job to sync HumanSoft attendance records for yesterday and today.
 * Can be called by Cloud Scheduler or Vercel Cron periodically (e.g. every 10-15 minutes).
 */
export async function GET(req: Request) {
    try {
        const cronSecret = process.env.CRON_SECRET || "hr-checkin-secret-123";
        const { searchParams } = new URL(req.url);
        const querySecret = searchParams.get("secret");
        const authHeader = req.headers.get("authorization");

        if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        const today = getTodayBangkokISO();
        const yesterday = getYesterdayBangkokISO();
        const result = await syncHumanSoftAttendanceToDatabase({
            date_from: yesterday,
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
