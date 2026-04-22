import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { calculateAttendanceStats } from "@/lib/attendanceCalculator";

export const runtime = "nodejs";

export async function GET(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        verifyToken(token);
        const { searchParams } = new URL(req.url);
        const emp_id = searchParams.get("emp_id");
        const startStr = searchParams.get("start");
        const endStr = searchParams.get("end");

        if (!emp_id || !startStr || !endStr) {
            return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
        }

        const stats = await calculateAttendanceStats(
            emp_id,
            new Date(startStr),
            new Date(endStr)
        );

        return NextResponse.json({ ok: true, stats });
    } catch (e: any) {
        console.error("[API/TEAM/KPI/ATTENDANCE] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
