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
        const date = url.searchParams.get("date");
        const branch = url.searchParams.get("branch");
        const statusParam = url.searchParams.get("status") || "";

        if (!date) {
            return NextResponse.json({ ok: false, error: "MISSING_DATE" }, { status: 400 });
        }

        const dayStart = new Date(`${date}T00:00:00+07:00`);
        const dayEnd = new Date(`${date}T23:59:59.999+07:00`);

        const whereClause: any = {
            timestamp: { gte: dayStart, lte: dayEnd },
        };

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

        const lines: string[] = [];
        lines.push(["รหัส", "ชื่อ", "ประเภท", "เวลา", "สถานที่/โครงการ", "ระยะ(m)", "สถานะ", "หมายเหตุ"].map(csvEscape).join(","));

        for (const r of filteredRows) {
            let typeLabel = "ออก";
            if (r.type === "Project-In") typeLabel = "เข้า (โครงการ)";
            else if (r.type === "Project-Out") typeLabel = "ออก (โครงการ)";
            else if (r.type === "Offsite-In") typeLabel = "เข้า (นอกสถานที่)";
            else if (r.type === "Offsite-Out") typeLabel = "ออก (นอกสถานที่)";
            else if (r.type === "Check-in") typeLabel = "เข้า";
            else if (r.type === "ขาดงาน") typeLabel = "ขาดงาน";

            let locStr = r.branch_name || "";
            if (r.project_name) locStr = `โครงการ: ${r.project_name}`;
            
            let lateStr = r.late_status || "-";
            if (r.late_status === "late") lateStr = `สาย ${r.late_min || 0} นาที`;
            if (r.late_status === "early") lateStr = `ออกก่อน ${r.late_min || 0} นาที`;
            if (r.late_status === "ontime") lateStr = "ตรงเวลา";

            lines.push([
                r.emp_id,
                r.name,
                typeLabel,
                r.type === "ขาดงาน" ? "-" : formatTime(r.timestamp),
                locStr,
                r.distance != null ? r.distance : "-",
                lateStr,
                r.remark || "-"
            ].map(csvEscape).join(","));
        }

        const csv = lines.join("\n");
        // BOM for Excel UTF-8
        const bom = "\uFEFF";
        
        return new Response(bom + csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="attendance_${date}.csv"`,
            },
        });

    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
