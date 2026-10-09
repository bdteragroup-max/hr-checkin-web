import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { syncHumanSoftAttendanceToDatabase, fetchHumanSoftAttendance } from "@/lib/humansoft";
import { getTodayBangkokISO } from "@/utils/time";

export const dynamic = "force-dynamic";

/**
 * GET: Preview or sync attendance from HumanSoft
 * Query: ?date=YYYY-MM-DD or ?date_from=...&date_to=...&dry_run=true
 */
export async function GET(req: Request) {
    try {
        await requireAdmin();

        const { searchParams } = new URL(req.url);
        const today = getTodayBangkokISO();
        const dateFrom = searchParams.get("date_from") || searchParams.get("date") || today;
        const dateTo = searchParams.get("date_to") || searchParams.get("date") || today;
        const dryRun = searchParams.get("dry_run") === "true";

        if (dryRun) {
            const preview = await fetchHumanSoftAttendance({ date_from: dateFrom, date_to: dateTo });
            return NextResponse.json(preview);
        }

        const result = await syncHumanSoftAttendanceToDatabase({ date_from: dateFrom, date_to: dateTo });
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}

/**
 * POST: Execute sync from HumanSoft into local checkins table
 * Body: { date_from?: "YYYY-MM-DD", date_to?: "YYYY-MM-DD" }
 */
export async function POST(req: Request) {
    try {
        await requireAdmin();

        const body = await req.json().catch(() => ({}));
        const today = getTodayBangkokISO();
        const dateFrom = body.date_from || body.date || today;
        const dateTo = body.date_to || body.date || today;

        const result = await syncHumanSoftAttendanceToDatabase({ date_from: dateFrom, date_to: dateTo });
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
