import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor } from "@/lib/adminAuth";
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
        const auth = await requireAdminOrSupervisor();

        const url = new URL(req.url);
        const startMonth = url.searchParams.get("start_month");
        const endMonth = url.searchParams.get("end_month");
        const paramStartDate = url.searchParams.get("start_date");
        const paramEndDate = url.searchParams.get("end_date");
        const emp_id = url.searchParams.get("emp_id");

        const teamOnly = url.searchParams.get("team") === "1";
        const subordinateFilter: any = {};
        if (auth.isSupervisorOnly || teamOnly) {
            subordinateFilter.OR = [
                { supervisor_id: auth.emp_id },
                { secondary_supervisor_id: auth.emp_id }
            ];
        }

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

        const PAGE_WIDTH = 841.89;
        const PAGE_HEIGHT = 595.28;
        const MARGIN = 40;
        
        let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        let y = PAGE_HEIGHT - MARGIN;

        const checkNewPage = (heightNeeded: number) => {
            if (y - heightNeeded < MARGIN) {
                page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                y = PAGE_HEIGHT - MARGIN;
                return true;
            }
            return false;
        };

        const drawText = (text: string, x: number, yPos: number, size = 12, bold = false, color = rgb(0, 0, 0)) => {
            page.drawText(text, { x, y: yPos, size, font: bold ? fontBold : fontRegular, color });
        };

        const truncate = (text: string, font: any, size: number, maxWidth: number) => {
            if (!text) return "";
            let width = font.widthOfTextAtSize(text, size);
            if (width <= maxWidth) return text;
            
            let truncated = text;
            while (width > maxWidth - 10 && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
                width = font.widthOfTextAtSize(truncated + "...", size);
            }
            return truncated + "...";
        };

        if (emp_id) {
            const emp = await prisma.employees.findUnique({ 
                where: { 
                    emp_id,
                    ...subordinateFilter
                } as any
            });
            if (!emp) return NextResponse.json({ ok: false, error: "EMP_NOT_FOUND" }, { status: 404 });

            drawText(`Detailed Attendance Log: ${emp.name} (${emp_id})`, MARGIN, y, 16, true);
            y -= 20;
            drawText(`Period: ${periodLabel}`, MARGIN, y, 12);
            y -= 30;

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

            const leaveDaysMap = new Map<string, string>();
            leaves.forEach(l => {
                let cur = new Date(l.start_date);
                const endD = new Date(l.end_date);
                while (cur <= endD) {
                    leaveDaysMap.set(cur.toISOString().split("T")[0], l.leave_type);
                    cur.setDate(cur.getDate() + 1);
                }
            });

            const colWidths = [80, 50, 200, 50, 200, 150];
            const headers = ["วันที่", "เข้า", "สถานที่เช็คอิน", "ออก", "สถานที่เช็คเอาท์", "สถานะ"];
            
            const drawHeader = (currY: number) => {
                let currX = MARGIN;
                page.drawRectangle({
                    x: MARGIN,
                    y: currY - 5,
                    width: PAGE_WIDTH - MARGIN * 2,
                    height: 20,
                    color: rgb(0.9, 0.9, 0.9),
                });
                
                headers.forEach((h, i) => {
                    drawText(h, currX + 5, currY, 10, true);
                    currX += colWidths[i];
                });
                return currY - 25;
            };

            const travels = await prisma.travel_claims.findMany({
                where: { 
                    emp_id, 
                    status: "approved", 
                    date: { lte: end }, 
                    OR: [
                        { end_date: { gte: start } },
                        { end_date: null, date: { gte: start } }
                    ]
                },
            });


            const travelDaysMap = new Set<string>();
            travels.forEach((t: any) => {
                let cur = new Date(t.date);
                const endD = t.end_date ? new Date(t.end_date) : new Date(t.date);
                while (cur <= endD) {
                    travelDaysMap.add(cur.toISOString().split("T")[0]);
                    cur.setDate(cur.getDate() + 1);
                }
            });

            y = drawHeader(y);

            for (let dt = new Date(start); dt <= end; dt.setUTCDate(dt.getUTCDate() + 1)) {
                const dateStr = dt.toISOString().split("T")[0];
                const isSunday = dt.getUTCDay() === 0;
                const holName = holidayMap.get(dateStr);
                const leaveType = leaveDaysMap.get(dateStr);
                const isTravel = travelDaysMap.has(dateStr);

                const dayCheckins = checkins.filter(c => new Date(c.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }) === dateStr);
                const inRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-in") || c.type === "Trip-Update");
                const outRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-out") || c.type === "Check-out");

                if (isSunday && inRecords.length === 0 && outRecords.length === 0) continue;

                let status = "ขาด";
                if (isSunday) status = "วันหยุด";
                if (holName) status = `หยุดพิเศษ (${holName})`;
                if (leaveType) status = leaveType;
                else if (isTravel) status = "ออกต่างจังหวัด";
                
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

                const inLocStr = Array.from(inLocs).join(", ");
                const outLocStr = Array.from(outLocs).join(", ");
                const lateStr = (inRecord?.late_min || 0) > 0 ? ` [สาย ${inRecord?.late_min} นาที]` : "";
                const finalStatus = `${status}${lateStr}`;

                if (checkNewPage(20)) {
                    y = drawHeader(y);
                }

                let currX = MARGIN;
                const rowData = [
                    dateStr,
                    inRecord ? formatTime(inRecord.timestamp) : "-",
                    inLocStr || "-",
                    outRecord ? formatTime(outRecord.timestamp) : "-",
                    outLocStr || "-",
                    finalStatus
                ];

                rowData.forEach((text, i) => {
                    const truncatedText = truncate(text, fontRegular, 9, colWidths[i] - 10);
                    drawText(truncatedText, currX + 5, y, 9);
                    currX += colWidths[i];
                });

                page.drawLine({
                    start: { x: MARGIN, y: y - 5 },
                    end: { x: PAGE_WIDTH - MARGIN, y: y - 5 },
                    thickness: 0.5,
                    color: rgb(0.8, 0.8, 0.8),
                });

                y -= 20;
            }

        } else {
            page = pdf.addPage([595.28, 841.89]);
            y = 800;

            const drawPortrait = (text: string, size = 12, bold = false, color: any = rgb(0,0,0)) => {
                if (y < 60) {
                    page = pdf.addPage([595.28, 841.89]);
                    y = 800;
                }
                page.drawText(text, { x: 50, y, size, font: bold ? fontBold : fontRegular, color });
                y -= size + 6;
            };

            drawPortrait(`Historical Records: ${periodLabel}`, 18, true);
            const employeeWhere: any = {
                ...subordinateFilter,
                OR: [
                    { is_active: true },
                    { resignation_date: { gte: start, lte: end } }
                ]
            };

            const emps = await prisma.employees.findMany({
                where: employeeWhere,
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

            drawPortrait(`Total Working Days: ${totalWorkDays}`, 12);
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

                drawPortrait(`-------------------------------------------------------------------------`, 10);
                drawPortrait(`EMP_ID: ${e.emp_id} | Name: ${e.name} | Branch: ${e.branch_id || "-"}`, 11, true);
                drawPortrait(`Present: ${s.present_dates.size} | Absent: ${absences} | Leave: ${s.leave_days} (Pending: ${s.pending_leave_days})`, 11);
                drawPortrait(`Late Count: ${s.late_count} times | Late Mins: ${s.late_mins} minutes`, 11);
            }
        }

        const saved = await pdf.save();
        const bytes = Uint8Array.from(saved as unknown as Uint8Array);
        const body = Buffer.from(bytes) as unknown as BodyInit;
        let filename = emp_id ? `${emp_id}_records_${periodLabel.replace(/ /g, "_")}.pdf` : `historical_records_ALL_${periodLabel.replace(/ /g, "_")}.pdf`;

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
