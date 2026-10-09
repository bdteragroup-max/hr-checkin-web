import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { sendAttendanceToHumanSoft, getHumanSoftLocations } from "@/lib/humansoft";
import { getNowBangkok } from "@/utils/time";

export const dynamic = "force-dynamic";

/**
 * GET: Test API Key & Fetch HumanSoft registered locations (with their Base64 location_id)
 */
export async function GET() {
    try {
        await requireAdmin();

        const result = await getHumanSoftLocations();
        return NextResponse.json({
            has_api_key: Boolean(process.env.HUMANSOFT_SUBSCRIPTION_KEY || process.env.HUMANSOFT_API_KEY),
            ...result
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}

/**
 * POST: Submit a test attendance record to HumanSoft
 */
export async function POST(req: Request) {
    try {
        await requireAdmin();

        const body = await req.json().catch(() => ({}));
        const emp_id = body.emp_id || "EMP001";
        const type = body.type || "Check-in";

        const now = getNowBangkok();
        const result = await sendAttendanceToHumanSoft({
            emp_id,
            type,
            timestamp: now,
            effective_date_key: now,
            lat: 13.7563,
            lon: 100.5018,
            remark: "ทดสอบเชื่อมต่อระบบ HumanSoft Open API",
            branch_name: "สำนักงานใหญ่",
            location_id: body.location_id
        });

        return NextResponse.json({
            ok: result.ok,
            result,
            has_api_key: Boolean(process.env.HUMANSOFT_SUBSCRIPTION_KEY || process.env.HUMANSOFT_API_KEY)
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
