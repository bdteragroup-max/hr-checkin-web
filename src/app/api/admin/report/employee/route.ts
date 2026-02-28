import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function monthDateRange(month: string) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return { start, end };
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const emp_id = url.searchParams.get("emp_id") || "";
        const month = url.searchParams.get("month") || "";

        if (!emp_id) return NextResponse.json({ ok: false, error: "EMP_ID_REQUIRED" }, { status: 400 });
        if (!month) return NextResponse.json({ ok: false, error: "MONTH_REQUIRED" }, { status: 400 });

        const emp = await prisma.employees.findUnique({
            where: { emp_id },
            select: { is_active: true },
        });
        if (!emp) return NextResponse.json({ ok: false, error: "EMP_NOT_FOUND" }, { status: 404 });
        if (!emp.is_active) return NextResponse.json({ ok: false, error: "EMP_INACTIVE" }, { status: 403 });

        const { start, end } = monthDateRange(month);

        const rows = await prisma.checkins.findMany({
            where: { emp_id, timestamp: { gte: start, lte: end } },
            orderBy: { timestamp: "asc" },
            select: { timestamp: true, type: true, late_status: true, late_min: true, branch_name: true, project_name: true, remark: true },
        });

        const leaves = await prisma.leave_requests.findMany({
            where: {
                emp_id,
                status: "approved",
                start_date: { lte: end },
                end_date: { gte: start },
            }
        });

        const holidaysFetch = await prisma.holidays.findMany({
            where: {
                date: { gte: start, lte: end }
            }
        });
        const holidayDates = new Set(holidaysFetch.map(h =>
            new Date(h.date).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })
        ));

        const map: Record<string, any> = {};

        // 1. Process Check-ins
        for (const r of rows) {
            const dStr = new Date(r.timestamp);
            const d = dStr.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
            map[d] ||= { date: d, note: "" };

            if (r.type === "Check-in" || r.type === "Project-In") {
                if (!map[d].checkIn) {
                    map[d].checkIn = dStr.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
                    map[d].checkInDate = dStr;
                    map[d].late_status = r.late_status || null;

                    let label = r.late_status === "ontime" ? "ตรงเวลา" : r.late_status === "early" ? `ออกก่อน ${r.late_min ?? 0} นาที` : r.late_status === "late" ? `สาย ${r.late_min ?? 0} นาที` : r.late_status === "ot" ? `OT` : (r.late_status || null);
                    map[d].late_label = label;
                    if (r.branch_name) map[d].note = r.branch_name;
                }

                if (r.project_name || r.remark) {
                    const parts = [];
                    if (r.project_name) parts.push(`Prj: ${r.project_name}`);
                    if (r.remark) parts.push(`Note: ${r.remark}`);
                    map[d].project_string = map[d].project_string ? map[d].project_string + " || " + parts.join(" | ") : parts.join(" | ");
                }

            } else if (r.type === "Check-out" || r.type === "Project-Out") {
                map[d].checkOut = dStr.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
                map[d].checkOutDate = dStr;

                if (r.project_name || r.remark) {
                    const parts = [];
                    if (r.project_name) parts.push(`Prj(Out): ${r.project_name}`);
                    if (r.remark) parts.push(`Note(Out): ${r.remark}`);
                    map[d].project_string = map[d].project_string ? map[d].project_string + " || " + parts.join(" | ") : parts.join(" | ");
                }
            }
        }

        // Calculate Work Hours
        for (const k in map) {
            const row = map[k];
            if (row.checkInDate && row.checkOutDate) {
                const diffMs = row.checkOutDate.getTime() - row.checkInDate.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins > 0) {
                    const hrs = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    row.workHours = `${hrs}:${String(mins).padStart(2, "0")}`;
                }
            }
        }

        // 2. Mix in Leaves
        for (const l of leaves) {
            let lStart = new Date(l.start_date as any);
            let lEnd = new Date(l.end_date as any);

            // Limit to the requested month bounds
            if (lStart < start) lStart = start;
            if (lEnd > end) lEnd = end;

            // Iterate day by day
            for (let dt = new Date(lStart); dt <= lEnd; dt.setDate(dt.getDate() + 1)) {
                const d = dt.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
                const isSunday = dt.getDay() === 0;

                // Do not mark Sundays or public holidays as "Leave" days
                if (!isSunday && !holidayDates.has(d)) {
                    map[d] ||= { date: d, note: "" };
                    map[d].leaveType = l.leave_type;
                    map[d].note = l.reason || map[d].note || "";
                }
            }
        }

        const dailyRows = Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
        return NextResponse.json({ ok: true, dailyRows });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}