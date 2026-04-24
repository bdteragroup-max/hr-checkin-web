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
        const paramStartDate = url.searchParams.get("start_date");
        const paramEndDate = url.searchParams.get("end_date");

        if (!emp_id) {
            return NextResponse.json({ ok: false, error: "MISSING_EMP_ID" }, { status: 400 });
        }

        let startDate: Date;
        let endDate: Date;

        if (paramStartDate && paramEndDate) {
            const [sy, sm, sd] = paramStartDate.split("-").map(Number);
            const [ey, em, ed] = paramEndDate.split("-").map(Number);
            startDate = new Date(Date.UTC(sy, sm - 1, sd));
            endDate = new Date(Date.UTC(ey, em - 1, ed));
        } else if (startMonth && endMonth) {
            const [sy, sm] = startMonth.split("-").map(Number);
            const [ey, em] = endMonth.split("-").map(Number);
            startDate = new Date(Date.UTC(sy, sm - 1, 1));
            endDate = new Date(Date.UTC(ey, em, 0));
        } else {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

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

            const inRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-in"));
            const outRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-out"));

            const hasActivity = inRecords.length > 0 || outRecords.length > 0;

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

            const inRecord = inRecords.length > 0 ? inRecords[0] : null; 
            const outRecord = outRecords.length > 0 ? outRecords[outRecords.length - 1] : null;

            if (inRecord) {
                status = "มาทำงาน";
                if (inRecord.late_status === "late") {
                    status = `มาสาย`;
                }
            }

            const inLocs = new Set<string>();
            inRecords.forEach(c => {
                const loc = c.project_name || c.remark || c.branch_name;
                if (loc) inLocs.add(loc);
            });

            const outLocs = new Set<string>();
            outRecords.forEach(c => {
                const loc = c.project_name || c.remark || c.branch_name;
                if (loc) outLocs.add(loc);
            });

            reports.push({
                date: dateStr,
                in_time: inRecord ? formatTime(inRecord.timestamp) : null,
                in_loc: inLocs.size > 0 ? Array.from(inLocs).join(" → ") : null,
                out_time: outRecord ? formatTime(outRecord.timestamp) : null,
                out_loc: outLocs.size > 0 ? Array.from(outLocs).join(" → ") : null,
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
