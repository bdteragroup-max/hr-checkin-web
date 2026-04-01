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
        const date = url.searchParams.get("date");
        const branch = url.searchParams.get("branch");
        const statusParam = url.searchParams.get("status") || "";

        if (!date) return NextResponse.json({ ok: false, error: "MISSING_DATE" }, { status: 400 });

        const dayStart = new Date(`${date}T00:00:00+07:00`);
        const dayEnd = new Date(`${date}T23:59:59.999+07:00`);

        const whereClause: any = { timestamp: { gte: dayStart, lte: dayEnd } };

        if (branch) {
            const emps = await prisma.employees.findMany({
                where: { branch_id: branch },
                select: { emp_id: true }
            });
            whereClause.emp_id = { in: emps.map(e => e.emp_id) };
        }

        const rows = await prisma.checkins.findMany({
            where: whereClause,
            orderBy: { timestamp: "desc" }
        });

        let filteredRows: any[] = rows;

        if (statusParam === "absent") {
            const checkinsToday = await prisma.checkins.findMany({
                where: { 
                    timestamp: { gte: dayStart, lte: dayEnd },
                    type: { in: ["Check-in", "Project-In", "Offsite-In"] }
                },
                select: { emp_id: true }
            });
            const checkedInSet = new Set(checkinsToday.map(c => c.emp_id));

            const activeEmployees = await prisma.employees.findMany({
                where: {
                    is_active: true,
                    ...(branch ? { branch_id: branch } : {})
                },
                select: {
                    emp_id: true,
                    name: true,
                    branches: { select: { name: true } },
                },
                orderBy: { emp_id: "asc" }
            });

            filteredRows = activeEmployees
                .filter(emp => !checkedInSet.has(emp.emp_id))
                .map(emp => ({
                    id: Math.random().toString(36).substring(7),
                    emp_id: emp.emp_id,
                    name: emp.name,
                    type: "ขาดงาน",
                    timestamp: dayStart,
                    branch_name: emp.branches?.name || "ไม่ระบุสาขา",
                    distance: null,
                    photo_url: null,
                    project_name: null,
                    remark: "ไม่มีบันทึกเข้างาน",
                    late_status: "absent",
                    late_min: null,
                    lat: null,
                    lon: null,
                }));
        } else if (statusParam) {
            filteredRows = rows.filter(r => r.late_status === statusParam);
        }

        filteredRows.reverse(); // Chronological order

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

        draw(`Attendance Log: ${date}`, 18, true);
        if (branch) draw(`Branch Filter: ${branch}`, 12);
        draw(`Total Checkin Events: ${filteredRows.length}`, 12);
        y -= 10;

        for (const r of filteredRows) {
            let typeLabel = "ออก";
            if (r.type === "Project-In") typeLabel = "เข้า (โครงการ)";
            else if (r.type === "Project-Out") typeLabel = "ออก (โครงการ)";
            else if (r.type === "Offsite-In") typeLabel = "เข้า (นอกสถานที่)";
            else if (r.type === "Offsite-Out") typeLabel = "ออก (นอกสถานที่)";
            else if (r.type === "Check-in") typeLabel = "เข้า";
            else if (r.type === "ขาดงาน") typeLabel = "ขาดงาน";

            let locStr = r.branch_name || "";
            if (r.project_name) locStr = `Prj: ${r.project_name}`;
            if (r.remark) locStr = `${locStr} | Note: ${r.remark}`;
            
            let lateStr = r.late_status || "-";
            if (r.late_status === "late") lateStr = `สาย ${r.late_min || 0} นาที`;
            if (r.late_status === "early") lateStr = `ออกก่อน ${r.late_min || 0} นาที`;
            if (r.late_status === "ontime") lateStr = "ตรงเวลา";

            draw(`-------------------------------------------------------------------------`, 10);
            draw(`${r.emp_id} | ${r.name}`, 12, true);
            draw(`Time: ${r.type === "ขาดงาน" ? "-" : formatTime(r.timestamp)} | Type: ${typeLabel} | Loc: ${locStr}`, 11);
            draw(`Status: ${lateStr} | Distance: ${r.distance != null ? r.distance + "m" : "-"}`, 11);
        }

        const saved = await pdf.save();
        const bytes = Uint8Array.from(saved as unknown as Uint8Array);
        const body = Buffer.from(bytes) as unknown as BodyInit;

        return new Response(body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="attendance_${date}.pdf"`,
            },
        });

    } catch (e: any) {
        if (e.message && e.message.includes("ENOENT") && e.message.includes("Sarabun")) {
            return NextResponse.json({ ok: false, error: "FONT_NOT_FOUND" }, { status: 500 });
        }
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}
