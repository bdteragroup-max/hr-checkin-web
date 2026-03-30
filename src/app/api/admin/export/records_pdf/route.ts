import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadFontBytes(relPath: string) {
    const abs = path.join(process.cwd(), relPath);
    return fs.readFile(abs);
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const startMonth = url.searchParams.get("start_month");
        const endMonth = url.searchParams.get("end_month");

        if (!startMonth || !endMonth) {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        const [sy, sm] = startMonth.split("-").map(Number);
        const [ey, em] = endMonth.split("-").map(Number);
        const start = new Date(Date.UTC(sy, sm - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(ey, em, 0, 23, 59, 59, 999));

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
            const dStr = dt.toISOString().split("T")[0];
            if (holidayDates.has(dStr)) continue;
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
            const dStr = new Date(r.timestamp);
            const d = dStr.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
            if (r.type === "Check-in" || r.type === "Project-In") {
                stats[r.emp_id].present_dates.add(d);
                if (r.late_status === "late") {
                    stats[r.emp_id].late_count += 1;
                    if (r.late_min) stats[r.emp_id].late_mins += r.late_min;
                }
            }
        }

        const pdf = await PDFDocument.create();
        pdf.registerFontkit(fontkit);

        const fontRegularBytes = await loadFontBytes("public/fonts/Sarabun-Regular.ttf");
        const fontBoldBytes = await loadFontBytes("public/fonts/Sarabun-Bold.ttf").catch(() => null);

        const fontRegular = await pdf.embedFont(fontRegularBytes, { subset: true });
        const fontBold = fontBoldBytes ? await pdf.embedFont(fontBoldBytes, { subset: true }) : fontRegular;

        let page = pdf.addPage([595.28, 841.89]); // A4
        let y = 800;

        const draw = (text: string, size = 12, bold = false) => {
            if (y < 60) {
                page = pdf.addPage([595.28, 841.89]);
                y = 780;
            }
            page.drawText(text, { x: 50, y, size, font: bold ? fontBold : fontRegular });
            y -= size + 6;
        };

        draw(`Historical Records: ${startMonth} to ${endMonth}`, 18, true);
        draw(`Total Working Days: ${totalWorkDays}`, 12);

        y -= 10;

        for (const e of emps) {
            const s = stats[e.emp_id];
            let absences = totalWorkDays - s.present_dates.size - s.leave_days;
            if (absences < 0) absences = 0;

            draw(`-------------------------------------------------------------------------`, 10);
            draw(`EMP_ID: ${e.emp_id} | Name: ${e.name} | Branch: ${e.branch_id || "-"}`, 11, true);
            draw(`Present: ${s.present_dates.size} | Absent: ${absences} | Leave: ${s.leave_days} (Pending: ${s.pending_leave_days})`, 11);
            draw(`Late Count: ${s.late_count} times | Late Mins: ${s.late_mins} minutes`, 11);
        }

        const saved = await pdf.save();
        const bytes = Uint8Array.from(saved as unknown as Uint8Array);
        const body = Buffer.from(bytes) as unknown as BodyInit;

        return new Response(body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="historical_records_${startMonth}_to_${endMonth}.pdf"`,
            },
        });

    } catch (e: any) {
        if (e.message && e.message.includes("ENOENT") && e.message.includes("Sarabun")) {
            return NextResponse.json({ ok: false, error: "FONT_NOT_FOUND" }, { status: 500 });
        }
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}
