import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadFontBytes(relPath: string) {
    const abs = path.join(process.cwd(), relPath);
    return fs.readFile(abs);
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
            periodLabel = `${paramStartDate} to ${paramEndDate}`;
        } else if (startMonth && endMonth) {
            const [sy, sm] = startMonth.split("-").map(Number);
            const [ey, em] = endMonth.split("-").map(Number);
            start = new Date(Date.UTC(sy, sm - 1, 1, 0, 0, 0));
            end = new Date(Date.UTC(ey, em, 0, 23, 59, 59, 999));
            periodLabel = `${startMonth} to ${endMonth}`;
        } else {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        const pdf = await PDFDocument.create();
        pdf.registerFontkit(fontkit);

        const fontRegularBytes = await loadFontBytes("public/fonts/Sarabun-Regular.ttf");
        const fontBoldBytes = await loadFontBytes("public/fonts/Sarabun-Bold.ttf").catch(() => null);

        const fontRegular = await pdf.embedFont(fontRegularBytes, { subset: true });
        const fontBold = fontBoldBytes ? await pdf.embedFont(fontBoldBytes, { subset: true }) : fontRegular;

        let page = pdf.addPage([595.28, 841.89]); // A4
        let y = 800;

        const draw = (text: string, size = 12, bold = false, color: any = rgb(0,0,0)) => {
            if (y < 60) {
                page = pdf.addPage([595.28, 841.89]);
                y = 800;
            }
            page.drawText(text, { x: 50, y, size, font: bold ? fontBold : fontRegular, color });
            y -= size + 6;
        };

        if (emp_id) {
            // ================== DETAILED INDIVIDUAL EXPORT ==================
            const emp = await prisma.employees.findUnique({ where: { emp_id } });
            if (!emp) return NextResponse.json({ ok: false, error: "EMP_NOT_FOUND" }, { status: 404 });

            draw(`Detailed Attendance Log: ${emp.name} (${emp_id})`, 16, true);
            draw(`Period: ${periodLabel}`, 12);
            y -= 10;

            const checkins = await prisma.checkins.findMany({
                where: { emp_id, timestamp: { gte: start, lte: end } },
                orderBy: { timestamp: "asc" },
            });
            const leaves = await prisma.leave_requests.findMany({
                where: { emp_id, status: "approved", start_date: { lte: end }, end_date: { gte: start } },
            });
            const holidays = await prisma.holidays.findMany({ where: { date: { gte: start, lte: end } } });

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

                const inStr = inRecord ? `${formatTime(inRecord.timestamp)} (${Array.from(inLocs).join(" → ") || "-"})` : "-";
                const outStr = outRecord ? `${formatTime(outRecord.timestamp)} (${Array.from(outLocs).join(" → ") || "-"})` : "-";
                const lateStr = (inRecord?.late_min || 0) > 0 ? ` [สาย ${inRecord?.late_min} นาที]` : "";

                draw(`${dateStr} | ${status}${lateStr}`, 11, true);
                draw(`  IN: ${inStr}  |  OUT: ${outStr}`, 10);
                y -= 4; // slight padding between days
            }

        } else {
            // ================== AGGREGATE SUMMARY EXPORT ==================
            // (Same as original code)
            draw(`Historical Records: ${periodLabel}`, 18, true);
            
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

            draw(`Total Working Days: ${totalWorkDays}`, 12);
            y -= 10;

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

            for (const e of emps) {
                const s = stats[e.emp_id];
                let absences = totalWorkDays - s.present_dates.size - s.leave_days;
                if (absences < 0) absences = 0;

                draw(`-------------------------------------------------------------------------`, 10);
                draw(`EMP_ID: ${e.emp_id} | Name: ${e.name} | Branch: ${e.branch_id || "-"}`, 11, true);
                draw(`Present: ${s.present_dates.size} | Absent: ${absences} | Leave: ${s.leave_days} (Pending: ${s.pending_leave_days})`, 11);
                draw(`Late Count: ${s.late_count} times | Late Mins: ${s.late_mins} minutes`, 11);
            }
        }

        const saved = await pdf.save();
        const bytes = Uint8Array.from(saved as unknown as Uint8Array);
        const body = Buffer.from(bytes) as unknown as BodyInit;
        let filename = emp_id ? `${emp_id}_records_${periodLabel.replace(/ to /g, "_")}.pdf` : `historical_records_ALL_${periodLabel.replace(/ to /g, "_")}.pdf`;

        return new Response(body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });

    } catch (e: any) {
        if (e.message && e.message.includes("ENOENT") && e.message.includes("Sarabun")) {
            return NextResponse.json({ ok: false, error: "FONT_NOT_FOUND" }, { status: 500 });
        }
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}
