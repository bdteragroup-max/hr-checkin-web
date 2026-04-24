import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvEscape(s: any) {
    const v = (s ?? "").toString();
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
}

function formatTime(d: Date) {
    return d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const startMonth = url.searchParams.get("start_month");
        const endMonth = url.searchParams.get("end_month");
        const paramStartDate = url.searchParams.get("start_date");
        const paramEndDate = url.searchParams.get("end_date");
        const emp_id = url.searchParams.get("emp_id");

        let start: Date;
        let end: Date;
        let periodLabel = "";

        if (paramStartDate && paramEndDate) {
            const [sy, sm, sd] = paramStartDate.split("-").map(Number);
            const [ey, em, ed] = paramEndDate.split("-").map(Number);
            start = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0));
            end = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
            periodLabel = `${paramStartDate}_to_${paramEndDate}`;
        } else if (startMonth && endMonth) {
            const [sy, sm] = startMonth.split("-").map(Number);
            const [ey, em] = endMonth.split("-").map(Number);
            start = new Date(Date.UTC(sy, sm - 1, 1, 0, 0, 0));
            end = new Date(Date.UTC(ey, em, 0, 23, 59, 59, 999));
            periodLabel = `${startMonth}_to_${endMonth}`;
        } else {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        if (emp_id) {
            // ================== DETAILED INDIVIDUAL EXPORT ==================
            const emp = await prisma.employees.findUnique({ where: { emp_id } });
            if (!emp) return NextResponse.json({ ok: false, error: "EMP_NOT_FOUND" }, { status: 404 });

            const checkins = await prisma.checkins.findMany({
                where: { emp_id, timestamp: { gte: start, lte: end } },
                orderBy: { timestamp: "asc" },
            });

            const leaves = await prisma.leave_requests.findMany({
                where: { emp_id, status: "approved", start_date: { lte: end }, end_date: { gte: start } },
            });

            const holidays = await prisma.holidays.findMany({
                where: { date: { gte: start, lte: end } }
            });

            const holidayMap = new Map<string, string>();
            holidays.forEach(h => holidayMap.set(h.date.toISOString().split("T")[0], h.name));

            const leaveDays = new Set<string>();
            leaves.forEach(l => {
                let cur = new Date(l.start_date);
                const endD = new Date(l.end_date);
                while (cur <= endD) {
                    leaveDays.add(cur.toISOString().split("T")[0]);
                    cur.setDate(cur.getDate() + 1);
                }
            });

            const lines: string[] = [];
            lines.push(["DATE", "IN_TIME", "IN_LOCATION", "OUT_TIME", "OUT_LOCATION", "LATE_MINS", "STATUS", "IS_WEEKEND"].map(csvEscape).join(","));

            for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
                const dateStr = dt.toISOString().split("T")[0];
                const isSunday = dt.getUTCDay() === 0;
                const holName = holidayMap.get(dateStr);
                const isLeave = leaveDays.has(dateStr);

                const dayCheckins = checkins.filter(c => new Date(c.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }) === dateStr);
                const inRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-in"));
                const outRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-out"));

                if (isSunday && inRecords.length === 0 && outRecords.length === 0) continue;

                let status = "ขาด";
                if (isSunday) status = "วันหยุด";
                if (holName) status = `หยุดพิเศษ (${holName})`;
                if (isLeave) status = "ลา";
                
                const inRecord = inRecords.length > 0 ? inRecords[0] : null; 
                const outRecord = outRecords.length > 0 ? outRecords[outRecords.length - 1] : null;

                if (inRecord) status = inRecord.late_status === "late" ? "มาสาย" : "มาทำงาน";

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

                lines.push([
                    dateStr,
                    inRecord ? formatTime(inRecord.timestamp) : "-",
                    inLocs.size > 0 ? Array.from(inLocs).join(" → ") : "-",
                    outRecord ? formatTime(outRecord.timestamp) : "-",
                    outLocs.size > 0 ? Array.from(outLocs).join(" → ") : "-",
                    inRecord?.late_min || 0,
                    status,
                    isSunday ? "YES" : "NO"
                ].map(csvEscape).join(","));
            }

            const csv = lines.join("\n");
            const bom = "\uFEFF";
            return new Response(bom + csv, {
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${emp_id}_records_${periodLabel}.csv"`,
                },
            });

        } else {
            // ================== AGGREGATE SUMMARY EXPORT ==================
            // (Same as original code)
            const emps = await prisma.employees.findMany({
                where: { is_active: true },
                select: { emp_id: true, name: true, branch_id: true },
                orderBy: { emp_id: "asc" },
            });

            const empIds = emps.map(e => e.emp_id);
            const rows = await prisma.checkins.findMany({
                where: { emp_id: { in: empIds }, timestamp: { gte: start, lte: end } },
                select: { emp_id: true, timestamp: true, type: true, late_status: true, late_min: true },
            });

            const leaves = await prisma.leave_requests.findMany({
                where: { emp_id: { in: empIds }, start_date: { lte: end }, end_date: { gte: start } },
                select: { emp_id: true, days: true, status: true },
            });

            const holidaysFetch = await prisma.holidays.findMany({
                where: { date: { gte: start, lte: end } }
            });
            const holidayDates = new Set(holidaysFetch.map(h => new Date(h.date).toISOString().split("T")[0]));

            let totalWorkDays = 0;
            for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
                if (dt.getUTCDay() === 0) continue;
                if (holidayDates.has(dt.toISOString().split("T")[0])) continue;
                totalWorkDays++;
            }

            const stats: Record<string, { leave_days: number, pending_leave_days: number, late_count: number, late_mins: number, present_dates: Set<string> }> = {};
            for (const id of empIds) stats[id] = { leave_days: 0, pending_leave_days: 0, late_count: 0, late_mins: 0, present_dates: new Set() };

            for (const l of leaves) {
                if (!stats[l.emp_id]) continue;
                if (l.status === "approved") stats[l.emp_id].leave_days += l.days || 0;
                else if (l.status === "pending") stats[l.emp_id].pending_leave_days += l.days || 0;
            }

            for (const r of rows) {
                if (!stats[r.emp_id]) continue;
                const d = new Date(r.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
                if (r.type === "Check-in" || r.type === "Project-In" || r.type === "Offsite-In") {
                    stats[r.emp_id].present_dates.add(d);
                    if (r.late_status === "late") {
                        stats[r.emp_id].late_count += 1;
                        if (r.late_min) stats[r.emp_id].late_mins += r.late_min;
                    }
                }
            }

            const lines: string[] = [];
            lines.push(["EMP_ID", "NAME", "BRANCH", "PRESENT_DAYS", "TOTAL_ABSENT_DAYS", "APPROVED_LEAVES", "PENDING_LEAVES", "LATE_TIMES", "LATE_MINUTES", "TOTAL_WORK_DAYS"].map(csvEscape).join(","));

            for (const e of emps) {
                const s = stats[e.emp_id];
                let absences = totalWorkDays - s.present_dates.size - s.leave_days;
                if (absences < 0) absences = 0;

                lines.push([
                    e.emp_id,
                    e.name,
                    e.branch_id || "-",
                    s.present_dates.size,
                    absences,
                    s.leave_days,
                    s.pending_leave_days,
                    s.late_count,
                    s.late_mins,
                    totalWorkDays
                ].map(csvEscape).join(","));
            }

            const csv = lines.join("\n");
            const bom = "\uFEFF";
            return new Response(bom + csv, {
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="historical_records_ALL_${periodLabel}.csv"`,
                },
            });
        }
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
