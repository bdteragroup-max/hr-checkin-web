import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import {
    normalizeReportItems,
    derivePeriodMonthFromRow,
    formatPeriodMonthThai,
    formatDateDMYThai
} from "@/app/api/missing-checkin-reports/route";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function statusLabelThai(status: string): string {
    if (status === "approved") return "HR อนุมัติแล้ว";
    if (status === "pending_hr") return "รอ HR ตรวจสอบ (หัวหน้าอนุมัติแล้ว)";
    if (status === "pending_supervisor") return "รอหัวหน้างานอนุมัติ";
    if (status === "rejected") return "ไม่อนุมัติ";
    return status || "-";
}

function formatDateTimeThai(dt: any): string {
    if (!dt) return "-";
    const d = new Date(dt);
    if (isNaN(d.getTime())) return "-";
    const datePart = d.toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
    const timePart = d.toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
    return `${datePart} ${timePart}`;
}

export async function GET(req: Request) {
    try {
        await requireAdmin();
        const url = new URL(req.url);
        const start_date = url.searchParams.get("start_date") || "";
        const end_date = url.searchParams.get("end_date") || "";
        const statusFilter = url.searchParams.get("status") || "all";
        const searchQuery = (url.searchParams.get("q") || "").trim().toLowerCase();

        let rows: any[] = [];
        try {
            rows = await prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM "missing_checkin_reports" ORDER BY "created_at" DESC`
            );
        } catch {
            rows = [];
        }

        const empIds = Array.from(new Set([
            ...rows.map(r => r.emp_id),
            ...rows.map(r => r.supervisor_id)
        ].filter(Boolean)));

        const emps = empIds.length > 0
            ? await prisma.employees.findMany({
                  where: { emp_id: { in: empIds } },
                  select: {
                      emp_id: true,
                      name: true,
                      nickname: true,
                      branch_id: true,
                      departments: { select: { name: true } },
                      job_positions: { select: { title: true } }
                  }
              })
            : [];

        const empMap = new Map(emps.map(e => [
            e.emp_id,
            {
                ...e,
                displayName: e.nickname && !e.name.includes(`(${e.nickname})`)
                    ? `${e.name} (${e.nickname})`
                    : e.name
            }
        ]));

        // Filter reports matching UI criteria
        const filteredRows = rows.filter(r => {
            const items = normalizeReportItems(r);
            if (start_date && end_date) {
                const inRange = items.some(it => it.work_date >= start_date && it.work_date <= end_date);
                if (!inRange) return false;
            }
            if (statusFilter && statusFilter !== "all" && r.status !== statusFilter) {
                return false;
            }
            if (searchQuery) {
                const emp = empMap.get(r.emp_id);
                const matchDoc = (r.doc_no || "").toLowerCase().includes(searchQuery);
                const matchEmpId = (r.emp_id || "").toLowerCase().includes(searchQuery);
                const matchEmpName = (emp?.displayName || "").toLowerCase().includes(searchQuery);
                const matchDetails = (r.work_details || "").toLowerCase().includes(searchQuery);
                if (!matchDoc && !matchEmpId && !matchEmpName && !matchDetails) return false;
            }
            return true;
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "TERA GROUP HR System";
        workbook.created = new Date();

        const thinBorder: Partial<ExcelJS.Borders> = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };

        // ══════════════════════════════════════════════════════════════════
        // SHEET 1: รายละเอียดรายวัน (สำหรับนำเข้าเวลาใน HumanSoft)
        // ══════════════════════════════════════════════════════════════════
        const detailSheet = workbook.addWorksheet("รายละเอียดรายวัน (HumanSoft)", {
            views: [{ state: "frozen", xSplit: 3, ySplit: 1 }]
        });

        detailSheet.columns = [
            { header: "เลขที่เอกสาร", key: "doc_no", width: 18 },
            { header: "ประจำรอบเดือน", key: "period_month_thai", width: 18 },
            { header: "รหัสพนักงาน", key: "emp_id", width: 14 },
            { header: "ชื่อ-นามสกุล", key: "emp_name", width: 28 },
            { header: "แผนก", key: "department", width: 22 },
            { header: "ตำแหน่ง", key: "position", width: 24 },
            { header: "วันที่ไม่ได้ลงเวลา (วว/ดด/ปปปป)", key: "work_date_dmy", width: 24 },
            { header: "เวลาเข้างาน", key: "check_in_time", width: 14 },
            { header: "เวลาออกงาน", key: "check_out_time", width: 14 },
            { header: "รายละเอียดงานที่ทำในวันนั้น", key: "work_details", width: 42 },
            { header: "สถานะเอกสาร", key: "status_label", width: 26 },
            { header: "หัวหน้างานผู้อนุมัติ", key: "supervisor_name", width: 24 },
            { header: "หมายเหตุหัวหน้างาน", key: "supervisor_remark", width: 22 },
            { header: "HR ผู้อนุมัติ", key: "hr_approved_by", width: 18 },
            { header: "หมายเหตุ HR", key: "hr_remark", width: 22 },
            { header: "ลิงก์หลักฐานการทำงาน", key: "evidence_urls", width: 45 },
            { header: "วันที่ส่งเอกสาร", key: "created_at", width: 18 }
        ];

        const detailHeader = detailSheet.getRow(1);
        detailHeader.height = 28;
        detailHeader.eachCell(cell => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.border = thinBorder;
        });

        for (const r of filteredRows) {
            const emp = empMap.get(r.emp_id);
            const sup = r.supervisor_id ? empMap.get(r.supervisor_id) : null;
            const periodMonth = derivePeriodMonthFromRow(r);
            const periodThai = formatPeriodMonthThai(periodMonth);
            const items = normalizeReportItems(r);

            for (const it of items) {
                const row = detailSheet.addRow({
                    doc_no: r.doc_no,
                    period_month_thai: periodThai,
                    emp_id: r.emp_id,
                    emp_name: emp?.displayName || r.emp_id,
                    department: emp?.departments?.name || "-",
                    position: emp?.job_positions?.title || "-",
                    work_date_dmy: formatDateDMYThai(it.work_date),
                    check_in_time: it.check_in_time,
                    check_out_time: it.check_out_time,
                    work_details: it.work_details,
                    status_label: statusLabelThai(r.status),
                    supervisor_name: sup?.displayName || r.supervisor_id || "-",
                    supervisor_remark: r.supervisor_remark || "-",
                    hr_approved_by: r.hr_approved_by || "-",
                    hr_remark: r.hr_remark || "-",
                    evidence_urls: (r.evidence_urls || "").split(",").join("\n"),
                    created_at: formatDateTimeThai(r.created_at)
                });

                row.eachCell((cell, colNumber) => {
                    cell.border = thinBorder;
                    cell.alignment = {
                        vertical: "middle",
                        horizontal: [1, 2, 3, 7, 8, 9, 11, 17].includes(colNumber) ? "center" : "left",
                        wrapText: true
                    };
                });
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // SHEET 2: สรุปรายเอกสาร (1 แถว ต่อ 1 เอกสารประจำเดือน)
        // ══════════════════════════════════════════════════════════════════
        const summarySheet = workbook.addWorksheet("สรุปรายเอกสารประจำเดือน", {
            views: [{ state: "frozen", xSplit: 3, ySplit: 1 }]
        });

        summarySheet.columns = [
            { header: "เลขที่เอกสาร", key: "doc_no", width: 18 },
            { header: "ประจำรอบเดือน", key: "period_month_thai", width: 18 },
            { header: "รหัสพนักงาน", key: "emp_id", width: 14 },
            { header: "ชื่อ-นามสกุล", key: "emp_name", width: 28 },
            { header: "แผนก", key: "department", width: 22 },
            { header: "จำนวนวันที่แจ้ง (วัน)", key: "days_count", width: 18 },
            { header: "วันที่ไม่ได้ลงเวลาทั้งหมด", key: "all_dates", width: 32 },
            { header: "รายละเอียดรวม", key: "work_details", width: 50 },
            { header: "สถานะ", key: "status_label", width: 26 },
            { header: "หัวหน้างานผู้อนุมัติ", key: "supervisor_name", width: 24 },
            { header: "วันที่หัวหน้าอนุมัติ", key: "supervisor_approved_at", width: 18 },
            { header: "HR ผู้อนุมัติ", key: "hr_approved_by", width: 18 },
            { header: "วันที่ HR อนุมัติ", key: "hr_approved_at", width: 18 },
            { header: "ลิงก์หลักฐาน", key: "evidence_urls", width: 45 }
        ];

        const sumHeader = summarySheet.getRow(1);
        sumHeader.height = 28;
        sumHeader.eachCell(cell => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.border = thinBorder;
        });

        for (const r of filteredRows) {
            const emp = empMap.get(r.emp_id);
            const sup = r.supervisor_id ? empMap.get(r.supervisor_id) : null;
            const periodMonth = derivePeriodMonthFromRow(r);
            const periodThai = formatPeriodMonthThai(periodMonth);
            const items = normalizeReportItems(r);

            const row = summarySheet.addRow({
                doc_no: r.doc_no,
                period_month_thai: periodThai,
                emp_id: r.emp_id,
                emp_name: emp?.displayName || r.emp_id,
                department: emp?.departments?.name || "-",
                days_count: items.length,
                all_dates: items.map(it => `${formatDateDMYThai(it.work_date)} (${it.check_in_time}-${it.check_out_time})`).join("\n"),
                work_details: r.work_details,
                status_label: statusLabelThai(r.status),
                supervisor_name: sup?.displayName || r.supervisor_id || "-",
                supervisor_approved_at: formatDateTimeThai(r.supervisor_approved_at),
                hr_approved_by: r.hr_approved_by || "-",
                hr_approved_at: formatDateTimeThai(r.hr_approved_at),
                evidence_urls: (r.evidence_urls || "").split(",").join("\n")
            });

            row.eachCell((cell, colNumber) => {
                cell.border = thinBorder;
                cell.alignment = {
                    vertical: "middle",
                    horizontal: [1, 2, 3, 6, 9, 11, 13].includes(colNumber) ? "center" : "left",
                    wrapText: true
                };
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const fileTag = start_date && end_date ? `${start_date}_to_${end_date}` : new Date().toISOString().slice(0, 10);

        return new Response(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="missing_checkin_reports_${fileTag}.xlsx"`
            }
        });
    } catch (e: any) {
        console.error("EXPORT MISSING CHECKIN EXCEL ERROR:", e);
        return NextResponse.json({ ok: false, error: e.message || "EXPORT_ERROR" }, { status: 500 });
    }
}
