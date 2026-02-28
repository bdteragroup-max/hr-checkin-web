import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function ymd(d: Date) {
    return d.toISOString().slice(0, 10);
}

function monthRangeBKK(month: string) {
    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m || m < 1 || m > 12) throw new Error("INVALID_MONTH");

    const start = new Date(`${yStr}-${mStr}-01T00:00:00+07:00`);
    const lastDay = new Date(y, m, 0).getDate();
    const end = new Date(`${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}T23:59:59.999+07:00`);
    return { start, end };
}

function csvEscape(s: any) {
    const v = (s ?? "").toString();
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
}

function jsonSafe<T>(v: T): any {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(jsonSafe);
    if (v && typeof v === "object") {
        const out: any = {};
        for (const [k, val] of Object.entries(v as any)) out[k] = jsonSafe(val);
        return out;
    }
    return v;
}

function pickEmployeeName(emp: any): string {
    return (
        emp?.full_name ??
        emp?.name ??
        emp?.thai_name ??
        emp?.display_name ??
        emp?.first_name ??
        emp?.emp_name ??
        ""
    );
}

async function buildEmployeeMonth(emp_id: string, month: string) {
    const { start, end } = monthRangeBKK(month);

    const emp = await prisma.employees.findUnique({ where: { emp_id } });
    if (!emp) throw new Error("EMP_NOT_FOUND");

    const checkins = await prisma.checkins.findMany({
        where: { emp_id, timestamp: { gte: start, lte: end } },
        orderBy: { timestamp: "asc" },
        select: {
            timestamp: true,
            type: true,
            branch_name: true,
            late_status: true,
            late_min: true,
            distance: true,
            project_name: true,
            remark: true,
        },
    });

    const leaves = await prisma.leave_requests.findMany({
        where: {
            emp_id,
            start_date: { lte: end },
            end_date: { gte: start },
        },
        orderBy: { start_date: "asc" },
        select: {
            id: true,
            leave_type: true,
            start_date: true,
            end_date: true,
            reason: true,
            status: true,
            approved_by: true,
            approved_at: true,
        },
    });

    const holidaysFetch = await prisma.holidays.findMany({
        where: { date: { gte: start, lte: end } }
    });
    const holidayDates = new Set(holidaysFetch.map(h =>
        new Date(h.date).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })
    ));

    const checkInRows = checkins.filter((x) => x.type === "Check-in");

    const map: Record<string, any> = {};

    // 1. Process Check-ins
    for (const r of checkins) {
        const dStr = new Date(r.timestamp as any);
        const d = dStr.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
        map[d] ||= { date: d, note: "" };

        if (r.type === "Check-in") {
            map[d].checkIn = dStr.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
            map[d].checkInDate = dStr;
            map[d].late_status = r.late_status || null;

            let label = r.late_status === "ontime" ? "ตรงเวลา" : r.late_status === "early" ? `ออกก่อน ${r.late_min ?? 0} นาที` : r.late_status === "late" ? `สาย ${r.late_min ?? 0} นาที` : r.late_status === "ot" ? `OT` : (r.late_status || null);
            map[d].late_label = label;
            if (r.branch_name) map[d].note = r.branch_name;

            if (r.project_name || r.remark) {
                const parts = [];
                if (r.project_name) parts.push(`Prj: ${r.project_name}`);
                if (r.remark) parts.push(`Note: ${r.remark}`);
                map[d].project_string = parts.join(" | ");
            }

        } else if (r.type === "Check-out") {
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

        if (lStart < start) lStart = start;
        if (lEnd > end) lEnd = end;

        // Iterate day by day
        for (let dt = new Date(lStart); dt <= lEnd; dt.setDate(dt.getDate() + 1)) {
            const d = dt.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
            const isSunday = dt.getDay() === 0;

            if (!isSunday && !holidayDates.has(d)) {
                map[d] ||= { date: d, note: "" };
                map[d].leaveType = l.leave_type;
                map[d].note = l.reason || map[d].note || "";
            }
        }
    }

    const dailyRows = Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));

    const presentDays = dailyRows.filter(r => r.checkIn).length;
    const lateDays = dailyRows.filter(r => r.late_status === "late").length;

    return {
        emp,
        empName: pickEmployeeName(emp),
        month,
        start,
        end,
        presentDays,
        lateDays,
        dailyRows,
    };
}

function makeCSV(payload: Awaited<ReturnType<typeof buildEmployeeMonth>>) {
    const lines: string[] = [];

    lines.push(["EMP_ID", "NAME", "MONTH", "PRESENT_DAYS", "LATE_DAYS"].map(csvEscape).join(","));
    lines.push(
        [payload.emp.emp_id, payload.empName, payload.month, payload.presentDays, payload.lateDays]
            .map(csvEscape)
            .join(",")
    );

    lines.push("");
    lines.push("DAILY_LOGS");
    lines.push(["DATE", "CHECK_IN", "CHECK_OUT", "WORK_HOURS", "STATUS", "NOTE", "PROJECT/REMARK"].map(csvEscape).join(","));

    for (const r of payload.dailyRows) {
        lines.push(
            [
                r.date,
                r.checkIn || "-",
                r.checkOut || "-",
                r.workHours || "-",
                r.leaveType ? `Leave: ${r.leaveType}` : (r.late_label || "-"),
                r.note || "-",
                r.project_string || "-"
            ]
                .map(csvEscape)
                .join(",")
        );
    }

    return lines.join("\n");
}

async function loadFontBytes(relPath: string) {
    const abs = path.join(process.cwd(), relPath);
    return fs.readFile(abs);
}

async function makePDF(payload: Awaited<ReturnType<typeof buildEmployeeMonth>>): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);

    // ✅ ฝังฟอนต์ไทย (Sarabun)
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

    draw("Employee Monthly Export", 18, true);
    draw(`EMP_ID: ${payload.emp.emp_id}`, 12);
    draw(`NAME: ${payload.empName || "-"}`, 12);
    draw(`MONTH: ${payload.month}`, 12);
    draw(`Present Days: ${payload.presentDays}`, 12);
    draw(`Late Days: ${payload.lateDays}`, 12);

    y -= 10;
    draw("Daily Logs:", 14, true);
    if (payload.dailyRows.length === 0) {
        draw("- none -", 12);
    } else {
        for (const r of payload.dailyRows) {
            const status = r.leaveType ? `Leave: ${r.leaveType}` : (r.late_label || "-");
            const txt = `${r.date} | In: ${r.checkIn || "-"} | Out: ${r.checkOut || "-"} | Hrs: ${r.workHours || "-"} | ${status} | Note: ${r.note || "-"} | Prj: ${r.project_string || "-"}`;
            draw(txt, 10);
        }
    }

    const saved = await pdf.save();
    return Uint8Array.from(saved as unknown as Uint8Array);
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const emp_id = url.searchParams.get("emp_id") || "";
        const month = url.searchParams.get("month") || "";
        const format = (url.searchParams.get("format") || "excel").toLowerCase(); // excel | pdf

        if (!emp_id) return NextResponse.json({ ok: false, error: "EMP_ID_REQUIRED" }, { status: 400 });
        if (!/^\d{4}-\d{2}$/.test(month))
            return NextResponse.json({ ok: false, error: "INVALID_MONTH" }, { status: 400 });

        const payload = await buildEmployeeMonth(emp_id, month);

        if (format === "pdf") {
            const bytes = await makePDF(payload);

            // ✅ ส่งเป็น Buffer กัน TS/BodyInit งอแง
            const body = Buffer.from(bytes) as unknown as BodyInit;

            return new Response(body, {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="employee_${emp_id}_${month}.pdf"`,
                },
            });
        }

        const csv = makeCSV(payload);
        return new Response(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="employee_${emp_id}_${month}.csv"`,
            },
        });
    } catch (e: any) {
        console.error("export employee error:", e);
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;

        // ถ้า font หาย จะช่วยบอกชัด ๆ
        if (msg.includes("ENOENT") && msg.includes("Sarabun")) {
            return NextResponse.json(
                { ok: false, error: "FONT_NOT_FOUND: put Sarabun-Regular.ttf in /public/fonts/" },
                { status: 500 }
            );
        }

        return NextResponse.json(jsonSafe({ ok: false, error: msg }), { status });
    }
}