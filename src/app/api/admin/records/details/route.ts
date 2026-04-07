import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatTime(d: Date) {
    return d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const emp_id = url.searchParams.get("emp_id");
        const startMonth = url.searchParams.get("start_month");
        const endMonth = url.searchParams.get("end_month");

        if (!emp_id || !startMonth || !endMonth) {
            return NextResponse.json({ ok: false, error: "MISSING_PARAMS" }, { status: 400 });
        }

        const [sy, sm] = startMonth.split("-").map(Number);
        const [ey, em] = endMonth.split("-").map(Number);

        // Start of month (00:00 local Bangkok, stored as UTC in Prisma for @db.Date if handled correctly)
        // More robust: use strings for @db.Date comparisons in Prisma if possible, 
        // or ensure the Date object represents midnight UTC.
        const startDate = new Date(Date.UTC(sy, sm - 1, 1));
        const endDate = new Date(Date.UTC(ey, em, 0)); // Last day of endMonth

        const emp = await prisma.employees.findUnique({ where: { emp_id } });
        if (!emp) return NextResponse.json({ ok: false, error: "EMP_NOT_FOUND" }, { status: 404 });

        const checkins = await prisma.checkins.findMany({
            where: {
                emp_id,
                date_key: { gte: startDate, lte: endDate },
            },
            orderBy: { timestamp: "asc" },
        });

        const leaves = await prisma.leave_requests.findMany({
            where: {
                emp_id,
                status: "approved",
                start_date: { lte: endDate },
                end_date: { gte: startDate },
            },
        });

        const holidays = await prisma.holidays.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        });

        const holidayMap = new Map<string, string>();
        holidays.forEach(h => holidayMap.set(h.date.toISOString().split("T")[0], h.name));

        const reports: any[] = [];

        // Build a map of dates that fall under approved leaves
        const leaveDays = new Set<string>();
        leaves.forEach(l => {
            let cur = new Date(l.start_date);
            const endD = new Date(l.end_date);
            while (cur <= endD) {
                const ds = cur.toISOString().split("T")[0];
                leaveDays.add(ds);
                cur.setDate(cur.getDate() + 1);
            }
        });

        // Guard: Today's date in Bangkok for future date handling
        const nowBKK = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const todayDate = new Date(Date.UTC(nowBKK.getFullYear(), nowBKK.getMonth(), nowBKK.getDate()));
        const effectiveEnd = endDate < todayDate ? endDate : todayDate;

        // Loop over every day using UTC methods to avoid local server timezone shifts
        for (let dt = new Date(startDate); dt <= effectiveEnd; dt.setUTCDate(dt.getUTCDate() + 1)) {
            const dateStr = dt.toISOString().split("T")[0];
            const isSunday = dt.getUTCDay() === 0;
            const holName = holidayMap.get(dateStr);
            const isLeave = leaveDays.has(dateStr);

            // Match by date_key string comparison
            const dayCheckins = checkins.filter(c => {
                const checkInDateStr = c.date_key.toISOString().split("T")[0];
                return checkInDateStr === dateStr;
            });

            const inRecord = dayCheckins.find(c => c.type.includes("In"));
            const outRecord = dayCheckins.find(c => c.type.includes("Out"));

            const hasActivity = !!inRecord || !!outRecord;

            // Skip Sunday if NO activity
            if (isSunday && !hasActivity) continue; 

            // Calculate Status
            let status = "ขาด"; // Default Absent
            if (isSunday) {
                status = "วันหยุด";
            }
            if (holName) {
                status = `หยุดพิเศษ (${holName})`;
            }
            if (isLeave) {
                status = "ลา";
            }

            if (inRecord) {
                status = "มาทำงาน";
                if (inRecord.late_status === "late") {
                    status = `มาสาย`;
                }
            }

            reports.push({
                date: dateStr,
                in_time: inRecord ? formatTime(inRecord.timestamp) : null,
                in_loc: inRecord ? (inRecord.project_name || inRecord.remark || inRecord.branch_name) : null,
                out_time: outRecord ? formatTime(outRecord.timestamp) : null,
                out_loc: outRecord ? (outRecord.project_name || outRecord.remark || outRecord.branch_name) : null,
                late_mins: inRecord?.late_min || 0,
                status,
                is_weekend: isSunday,
            });
        }

        return NextResponse.json({ ok: true, details: reports, emp_name: emp.name });
    } catch (e: any) {
        console.error("DETAILS ERROR:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
