import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function monthDateRange(month: string) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return { start, end };
}

async function loadFontBytes(relPath: string) {
    const abs = path.join(process.cwd(), relPath);
    return fs.readFile(abs);
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const month = url.searchParams.get("month") || "";
        const branchId = url.searchParams.get("branch") || "";

        if (!month) return NextResponse.json({ ok: false, error: "MONTH_REQUIRED" }, { status: 400 });

        const { start, end } = monthDateRange(month);

        const empWhere: any = { is_active: true };
        if (branchId) empWhere.branch_id = branchId;

        const emps = await prisma.employees.findMany({
            where: empWhere,
            select: { emp_id: true, name: true, branch_id: true },
            orderBy: { emp_id: "asc" },
        });
        const empIds = emps.map((e) => e.emp_id);

        const rows = await prisma.checkins.findMany({
            where: {
                emp_id: { in: empIds },
                timestamp: { gte: start, lte: end },
            },
            select: { emp_id: true, timestamp: true, type: true, late_status: true, late_min: true },
        });

        const monthStart = new Date(`${month}-01T00:00:00.000Z`);
        const monthEnd = new Date(`${month}-31T00:00:00.000Z`);

        const leaves = await prisma.leave_requests.findMany({
            where: {
                emp_id: { in: empIds },
                status: "approved",
                start_date: { lte: monthEnd },
                end_date: { gte: monthStart },
            },
            select: { emp_id: true, days: true },
        });

        const holidaysFetch = await prisma.holidays.findMany({
            where: {
                date: {
                    gte: monthStart,
                    lte: monthEnd
                }
            }
        });

        const holidayDates = new Set(holidaysFetch.map(h =>
            new Date(h.date).toISOString().split("T")[0]
        ));

        let workDays = 0;
        const totalDaysInMonth = end.getDate();
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
            if (d.getUTCDay() === 0) continue;
            const dStr = d.toISOString().split("T")[0];
            if (holidayDates.has(dStr)) continue;
            workDays++;
        }

        const leaveDaysByEmp: Record<string, number> = {};
        for (const l of leaves) leaveDaysByEmp[l.emp_id] = (leaveDaysByEmp[l.emp_id] || 0) + (l.days || 0);

        const presentDaysSetByEmp: Record<string, Set<string>> = {};
        const lateTimesByEmp: Record<string, number> = {};
        const otMinByEmp: Record<string, number> = {};
        const workMinByEmp: Record<string, number> = {};
        const dailyPairs: Record<string, Record<string, { in?: Date, out?: Date }>> = {};

        for (const id of empIds) {
            presentDaysSetByEmp[id] = new Set();
            lateTimesByEmp[id] = 0;
            otMinByEmp[id] = 0;
            workMinByEmp[id] = 0;
            dailyPairs[id] = {};
        }

        for (const r of rows) {
            const dStr = new Date(r.timestamp);
            const d = dStr.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

            if (!dailyPairs[r.emp_id][d]) dailyPairs[r.emp_id][d] = {};

            if (r.type === "Check-in") {
                presentDaysSetByEmp[r.emp_id]?.add(d);
                if (r.late_status === "late") lateTimesByEmp[r.emp_id] = (lateTimesByEmp[r.emp_id] || 0) + 1;

                const currentIn = dailyPairs[r.emp_id][d].in;
                if (!currentIn || r.timestamp.getTime() < currentIn.getTime()) {
                    dailyPairs[r.emp_id][d].in = r.timestamp;
                }
            } else if (r.type === "Check-out") {
                if (r.late_status === "ot" && r.late_min) {
                    otMinByEmp[r.emp_id] += r.late_min;
                }

                const currentOut = dailyPairs[r.emp_id][d].out;
                if (!currentOut || r.timestamp.getTime() > currentOut.getTime()) {
                    dailyPairs[r.emp_id][d].out = r.timestamp;
                }
            }
        }

        for (const emp_id of empIds) {
            const days = dailyPairs[emp_id];
            let empTotalMin = 0;
            for (const date in days) {
                const p = days[date];
                if (p.in && p.out && p.out > p.in) {
                    const diffMs = p.out.getTime() - p.in.getTime();
                    empTotalMin += Math.floor(diffMs / 60000);
                }
            }
            workMinByEmp[emp_id] = empTotalMin;
        }

        const employees = emps.map((e) => {
            const present = presentDaysSetByEmp[e.emp_id]?.size || 0;
            const leavesCount = leaveDaysByEmp[e.emp_id] || 0;
            const absents = Math.max(0, workDays - present - leavesCount);
            const otHoursText = otMinByEmp[e.emp_id] > 0 ? (Math.round((otMinByEmp[e.emp_id] / 60) * 10) / 10).toString() : "0";

            const wMins = workMinByEmp[e.emp_id];
            const wHoursText = wMins > 0 ? `${Math.floor(wMins / 60)}h ${wMins % 60}m` : "—";

            return {
                emp_id: e.emp_id,
                name: e.name,
                branch: e.branch_id || "-",
                presentDays: present,
                lateTimes: lateTimesByEmp[e.emp_id] || 0,
                otHours: otHoursText,
                leaveDays: leavesCount,
                absentDays: absents,
                workHours: wHoursText,
            };
        });

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

        draw(`Global Monthly Export: ${month}${branchId ? " (Branch: " + branchId + ")" : ""}`, 18, true);
        draw(`Total Working Days: ${workDays}`, 12);

        y -= 10;

        for (const e of employees) {
            draw(`-------------------------------------------------------------------------`, 10);
            draw(`EMP_ID: ${e.emp_id} | Name: ${e.name} | Branch: ${e.branch}`, 11, true);
            draw(`Present: ${e.presentDays} | Late: ${e.lateTimes} | OT: ${e.otHours} h | Leave: ${e.leaveDays} | Absent: ${e.absentDays} | Work: ${e.workHours}`, 11);
        }

        const saved = await pdf.save();
        const bytes = Uint8Array.from(saved as unknown as Uint8Array);
        const body = Buffer.from(bytes) as unknown as BodyInit;

        return new Response(body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="monthly_report_${month}${branchId ? "_" + branchId : ""}.pdf"`,
            },
        });

    } catch (e: any) {
        console.error("export pdf error:", e);
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;

        if (msg.includes("ENOENT") && msg.includes("Sarabun")) {
            return NextResponse.json(
                { ok: false, error: "FONT_NOT_FOUND: put Sarabun-Regular.ttf in /public/fonts/" },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}
