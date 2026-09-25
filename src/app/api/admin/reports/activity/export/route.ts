import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toBkkDate(d: Date | string | null | undefined) {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function toBkkDateTime(d: Date | string | null | undefined) {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    return createClient(url, key);
}

function styleHeaderRow(row: ExcelJS.Row, bgArgb = "FF1E293B", fontColor = "FFFFFFFF") {
    row.font = { bold: true, color: { argb: fontColor }, size: 11, name: "Calibri" };
    row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    row.height = 28;
    row.eachCell((cell) => {
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgArgb },
        };
        cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "medium", color: { argb: "FF0F172A" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
    });
}

function styleDataRow(row: ExcelJS.Row, isEven = false) {
    row.font = { size: 10, name: "Calibri" };
    row.alignment = { vertical: "middle" };
    const bgArgb = isEven ? "FFF8FAFC" : "FFFFFFFF";
    row.eachCell((cell) => {
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgArgb },
        };
        cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
    });
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const { searchParams } = new URL(req.url);
        const startDateStr = searchParams.get("start_date");
        const endDateStr = searchParams.get("end_date");

        if (!startDateStr || !endDateStr) {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        const startInstant = new Date(`${startDateStr}T00:00:00+07:00`);
        const endInstant = new Date(`${endDateStr}T23:59:59.999+07:00`);

        // 1. Leave Requests
        const leaves = await prisma.leave_requests.findMany({
            where: { timestamp: { gte: startInstant, lte: endInstant } },
            orderBy: { timestamp: "desc" },
        });

        // 2. OT Requests
        const otRequests = await prisma.ot_requests.findMany({
            where: { created_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } } },
            orderBy: { created_at: "desc" },
        });

        // 3. Travel Claims
        const travelClaims = await prisma.travel_claims.findMany({
            where: { created_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } } },
            orderBy: { created_at: "desc" },
        });

        // 4. Clothing Requests
        const clothingRequests = await prisma.clothing_requests.findMany({
            where: { requested_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } }, variant: { include: { item: true } } },
            orderBy: { requested_at: "desc" },
        });

        // 5. Asset Borrowings
        const assetBorrowings = await prisma.asset_borrowings.findMany({
            where: { created_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } }, assets: true },
            orderBy: { created_at: "desc" },
        });

        // 6. Payment Tasks
        const paymentTasks = await prisma.payment_tasks.findMany({
            where: { createdAt: { gte: startInstant, lte: endInstant } },
            include: { jobs: { select: { jobNumber: true, customerName: true } } },
            orderBy: { createdAt: "desc" },
        });

        // 7. Commission Claims
        const commissionClaims = await prisma.commission_claims.findMany({
            where: { created_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } } },
            orderBy: { created_at: "desc" },
        });

        // 8. Storage Uploads
        const uploadedFiles: any[] = [];
        try {
            const supabase = getSupabaseClient();
            const cur = new Date(startDateStr);
            const stop = new Date(endDateStr);
            const dateList: string[] = [];
            while (cur <= stop && dateList.length <= 60) {
                dateList.push(cur.toISOString().split("T")[0]);
                cur.setDate(cur.getDate() + 1);
            }

            for (const d of dateList) {
                const { data: files } = await supabase.storage.from("uploads").list(d, {
                    limit: 200,
                    offset: 0,
                    sortBy: { column: "name", order: "asc" },
                });

                if (files && files.length > 0) {
                    files.forEach(f => {
                        const isRegularCheckin = /^[A-Z0-9]+-\d{8}-\d{6}-\d+\.(jpg|jpeg|png)$/i.test(f.name);
                        if (!isRegularCheckin) {
                            let docType = "เอกสารแนบทั่วไป";
                            if (f.name.includes("car-return") || f.name.includes("key-return") || f.name.includes("signature")) {
                                docType = "ตรวจสภาพและคืนรถยนต์";
                            } else if (f.name.includes("depreciation")) {
                                docType = "เบิกค่าเสื่อมราคาฝ่ายขาย";
                            } else if (f.name.includes("report") || f.name.includes("receipt")) {
                                docType = "รายงานหน้างาน / ใบเสร็จเดินทาง";
                            } else if (f.name.includes("asset-borrow")) {
                                docType = "เอกสารยืมทรัพย์สิน";
                            } else if (f.name.endsWith(".pdf") || f.name.includes("TE") || f.name.includes("TG") || f.name.includes("TP")) {
                                docType = "เอกสารแนบการลา / ใบรับรองแพทย์";
                            }

                            uploadedFiles.push({
                                date: d,
                                name: f.name,
                                size: f.metadata?.size || 0,
                                type: docType,
                                url: `https://uvbnlqwcdzlygykbhwhv.supabase.co/storage/v1/object/public/uploads/${d}/${f.name}`,
                            });
                        }
                    });
                }
            }
        } catch (storageErr) {
            console.error("Storage list error:", storageErr);
        }

        // Summary Breakdown by date
        const summaryByDate: Record<string, any> = {};
        const getOrInitDay = (d: string) => {
            if (!summaryByDate[d]) {
                summaryByDate[d] = {
                    date: d,
                    leaves: 0,
                    ot: 0,
                    travel: 0,
                    clothing: 0,
                    assets: 0,
                    payments: 0,
                    commission: 0,
                    uploads: 0,
                };
            }
            return summaryByDate[d];
        };

        leaves.forEach(x => { getOrInitDay(toBkkDate(x.timestamp)).leaves++; });
        otRequests.forEach(x => { getOrInitDay(toBkkDate(x.created_at)).ot++; });
        travelClaims.forEach(x => { getOrInitDay(toBkkDate(x.created_at)).travel++; });
        clothingRequests.forEach(x => { getOrInitDay(toBkkDate(x.requested_at)).clothing++; });
        assetBorrowings.forEach(x => { getOrInitDay(toBkkDate(x.created_at)).assets++; });
        paymentTasks.forEach(x => { getOrInitDay(toBkkDate(x.createdAt)).payments++; });
        commissionClaims.forEach(x => { getOrInitDay(toBkkDate(x.created_at)).commission++; });
        uploadedFiles.forEach(x => { getOrInitDay(x.date).uploads++; });

        const sortedDays = Object.values(summaryByDate).sort((a, b) => a.date.localeCompare(b.date));

        // Create Excel Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Tera Group Admin System";
        workbook.created = new Date();

        // ---------------------------------------------
        // Sheet 1: สรุปภาพรวม (Summary)
        // ---------------------------------------------
        const sSummary = workbook.addWorksheet("ภาพรวม (Summary)", { views: [{ showGridLines: true }] });
        sSummary.columns = [
            { width: 28 },
            { width: 18 },
            { width: 18 },
            { width: 18 },
            { width: 18 },
            { width: 18 },
            { width: 18 },
            { width: 18 },
            { width: 18 },
            { width: 18 },
        ];

        // Title Header
        sSummary.mergeCells("A1:J1");
        const titleCell = sSummary.getCell("A1");
        titleCell.value = "รายงานสรุปกิจกรรม คำขอ และไฟล์แนบในระบบ (Tera Group)";
        titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
        titleCell.alignment = { vertical: "middle", horizontal: "center" };
        sSummary.getRow(1).height = 36;

        sSummary.mergeCells("A2:J2");
        const subCell = sSummary.getCell("A2");
        subCell.value = `ช่วงวันที่: ${startDateStr} ถึง ${endDateStr} (เขตเวลาเอเชีย/กรุงเทพฯ)`;
        subCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };
        subCell.alignment = { vertical: "middle", horizontal: "center" };
        sSummary.getRow(2).height = 24;

        // Overview Totals Block
        sSummary.getCell("A4").value = "ประเภทคำขอ / เอกสาร";
        sSummary.getCell("B4").value = "จำนวนรายการทั้งหมด";
        styleHeaderRow(sSummary.getRow(4), "FF334155");

        const categoryStats = [
            ["1. คำขอลางาน (Leave Requests)", leaves.length],
            ["2. คำขอทำ OT (Overtime Requests)", otRequests.length],
            ["3. คำขอเบิกค่าเดินทาง / ที่พัก (Travel Claims)", travelClaims.length],
            ["4. คำขอเบิกชุดยูนิฟอร์ม (Clothing Requests)", clothingRequests.length],
            ["5. คำขอยืมทรัพย์สิน / ยานพาหนะ (Asset Borrowings)", assetBorrowings.length],
            ["6. งานสั่งจ่ายฝ่ายบัญชี (Payment Tasks)", paymentTasks.length],
            ["7. คำขอเบิกค่าคอมมิชชั่น (Commission Claims)", commissionClaims.length],
            ["8. ไฟล์เอกสารที่อัปโหลด (Uploaded Documents)", uploadedFiles.length],
        ];

        categoryStats.forEach((cat, idx) => {
            const r = sSummary.getRow(5 + idx);
            r.getCell(1).value = cat[0];
            r.getCell(2).value = cat[1];
            r.getCell(2).alignment = { horizontal: "right" };
            styleDataRow(r, idx % 2 === 1);
        });

        // Daily breakdown table
        const dailyStartRow = 15;
        sSummary.getCell(`A${dailyStartRow}`).value = "สรุปแยกตามวันที่";
        sSummary.getCell(`A${dailyStartRow}`).font = { bold: true, size: 13, name: "Calibri" };

        const dHeaderRow = sSummary.getRow(dailyStartRow + 1);
        const dailyHeaders = ["วันที่", "ลางาน", "ขอ OT", "ค่าเดินทาง", "ยูนิฟอร์ม", "ยืมทรัพย์สิน", "สั่งจ่าย", "คอมมิชชั่น", "ไฟล์แนบ", "รวม"];
        dailyHeaders.forEach((h, i) => {
            dHeaderRow.getCell(i + 1).value = h;
        });
        styleHeaderRow(dHeaderRow, "FF1E293B");

        sortedDays.forEach((d, idx) => {
            const r = sSummary.getRow(dailyStartRow + 2 + idx);
            const totalDay = d.leaves + d.ot + d.travel + d.clothing + d.assets + d.payments + d.commission + d.uploads;
            r.getCell(1).value = d.date;
            r.getCell(2).value = d.leaves;
            r.getCell(3).value = d.ot;
            r.getCell(4).value = d.travel;
            r.getCell(5).value = d.clothing;
            r.getCell(6).value = d.assets;
            r.getCell(7).value = d.payments;
            r.getCell(8).value = d.commission;
            r.getCell(9).value = d.uploads;
            r.getCell(10).value = totalDay;

            r.getCell(1).alignment = { horizontal: "center" };
            for (let c = 2; c <= 10; c++) {
                r.getCell(c).alignment = { horizontal: "right" };
            }
            styleDataRow(r, idx % 2 === 1);
        });

        // ---------------------------------------------
        // Sheet 2: การลา (Leaves)
        // ---------------------------------------------
        const sLeaves = workbook.addWorksheet("การลางาน (Leaves)", { views: [{ showGridLines: true }] });
        sLeaves.columns = [
            { header: "วันที่ยื่นคำขอ", key: "timestamp", width: 22 },
            { header: "รหัสพนักงาน", key: "emp_id", width: 14 },
            { header: "ชื่อพนักงาน", key: "name", width: 24 },
            { header: "ประเภทการลา", key: "leave_type", width: 20 },
            { header: "เริ่มต้น", key: "start_at", width: 22 },
            { header: "สิ้นสุด", key: "end_at", width: 22 },
            { header: "จำนวนวัน", key: "days", width: 12 },
            { header: "จำนวนนาที", key: "minutes", width: 12 },
            { header: "เหตุผล", key: "reason", width: 32 },
            { header: "สถานะ", key: "status", width: 14 },
            { header: "ผู้ส่งมอบงาน", key: "handover_person", width: 20 },
            { header: "ลิงก์เอกสารแนบ", key: "attachment_url", width: 45 },
        ];
        styleHeaderRow(sLeaves.getRow(1), "FF1E293B");

        leaves.forEach((lv, idx) => {
            const row = sLeaves.addRow({
                timestamp: toBkkDateTime(lv.timestamp),
                emp_id: lv.emp_id,
                name: lv.name,
                leave_type: lv.leave_type,
                start_at: toBkkDateTime(lv.start_at),
                end_at: toBkkDateTime(lv.end_at),
                days: lv.days,
                minutes: lv.minutes,
                reason: lv.reason || "-",
                status: lv.status,
                handover_person: lv.handover_person || "-",
                attachment_url: lv.attachment_url || "-",
            });
            styleDataRow(row, idx % 2 === 1);
        });

        // ---------------------------------------------
        // Sheet 3: คำขอทำ OT (Overtime)
        // ---------------------------------------------
        const sOt = workbook.addWorksheet("ขอทำ OT (Overtime)", { views: [{ showGridLines: true }] });
        sOt.columns = [
            { header: "วันที่ยื่นคำขอ", key: "created_at", width: 22 },
            { header: "วันที่ทำ OT", key: "date_for", width: 16 },
            { header: "รหัสพนักงาน", key: "emp_id", width: 14 },
            { header: "ชื่อพนักงาน", key: "emp_name", width: 24 },
            { header: "เวลาเริ่ม", key: "start_time", width: 22 },
            { header: "เวลาสิ้นสุด", key: "end_time", width: 22 },
            { header: "รวม ชม.", key: "total_hours", width: 12 },
            { header: "รายละเอียดงาน", key: "reason", width: 35 },
            { header: "สถานะ", key: "status", width: 16 },
            { header: "ลิงก์รูปหลักฐาน", key: "proof_url", width: 45 },
        ];
        styleHeaderRow(sOt.getRow(1), "FF1E293B");

        otRequests.forEach((ot, idx) => {
            const row = sOt.addRow({
                created_at: toBkkDateTime(ot.created_at),
                date_for: toBkkDate(ot.date_for),
                emp_id: ot.emp_id,
                emp_name: ot.employee ? `${ot.employee.name} (${ot.employee.nickname || ""})` : "-",
                start_time: toBkkDateTime(ot.start_time),
                end_time: toBkkDateTime(ot.end_time),
                total_hours: ot.total_hours ? Number(ot.total_hours) : 0,
                reason: ot.reason || "-",
                status: ot.status,
                proof_url: ot.proof_url || "-",
            });
            styleDataRow(row, idx % 2 === 1);
        });

        // ---------------------------------------------
        // Sheet 4: เบิกค่าเดินทาง (Travel Claims)
        // ---------------------------------------------
        const sTravel = workbook.addWorksheet("เบิกค่าเดินทาง (Travel)", { views: [{ showGridLines: true }] });
        sTravel.columns = [
            { header: "วันที่ยื่นคำขอ", key: "created_at", width: 22 },
            { header: "วันที่เดินทาง", key: "date", width: 16 },
            { header: "รหัสพนักงาน", key: "emp_id", width: 14 },
            { header: "ชื่อพนักงาน", key: "emp_name", width: 24 },
            { header: "สถานที่ / ไซต์งาน", key: "site_name", width: 30 },
            { header: "ประเภทคำขอ", key: "claim_type", width: 16 },
            { header: "ค้างคืน", key: "is_overnight", width: 12 },
            { header: "ค่าที่พัก (บาท)", key: "accommodation_amount", width: 16 },
            { header: "สถานะ", key: "status", width: 20 },
            { header: "หมายเหตุ", key: "remark", width: 30 },
            { header: "ลิงก์รายงานหน้างาน", key: "report_url", width: 45 },
            { header: "ลิงก์ใบเสร็จที่พัก", key: "accommodation_receipt_url", width: 45 },
        ];
        styleHeaderRow(sTravel.getRow(1), "FF1E293B");

        travelClaims.forEach((tc, idx) => {
            const row = sTravel.addRow({
                created_at: toBkkDateTime(tc.created_at),
                date: toBkkDate(tc.date),
                emp_id: tc.emp_id,
                emp_name: tc.employee ? `${tc.employee.name} (${tc.employee.nickname || ""})` : "-",
                site_name: tc.site_name,
                claim_type: tc.claim_type,
                is_overnight: tc.is_overnight ? "ใช่" : "ไม่ใช่",
                accommodation_amount: tc.accommodation_amount ? Number(tc.accommodation_amount) : 0,
                status: tc.status,
                remark: tc.remark || "-",
                report_url: tc.report_url || "-",
                accommodation_receipt_url: tc.accommodation_receipt_url || "-",
            });
            styleDataRow(row, idx % 2 === 1);
        });

        // ---------------------------------------------
        // Sheet 5: เบิกยูนิฟอร์ม (Clothing)
        // ---------------------------------------------
        const sCloth = workbook.addWorksheet("เบิกยูนิฟอร์ม (Clothing)", { views: [{ showGridLines: true }] });
        sCloth.columns = [
            { header: "วันที่ยื่นคำขอ", key: "requested_at", width: 22 },
            { header: "รหัสพนักงาน", key: "emp_id", width: 14 },
            { header: "ชื่อพนักงาน", key: "emp_name", width: 24 },
            { header: "รายการสินค้า", key: "item_name", width: 30 },
            { header: "ไซส์", key: "size", width: 12 },
            { header: "จำนวน (ชิ้น)", key: "quantity", width: 14 },
            { header: "เหตุผลการเบิก", key: "reason", width: 28 },
            { header: "สถานะ", key: "status", width: 16 },
            { header: "โน้ตแอดมิน", key: "admin_note", width: 28 },
        ];
        styleHeaderRow(sCloth.getRow(1), "FF1E293B");

        clothingRequests.forEach((cr, idx) => {
            const row = sCloth.addRow({
                requested_at: toBkkDateTime(cr.requested_at),
                emp_id: cr.emp_id,
                emp_name: cr.employee ? `${cr.employee.name} (${cr.employee.nickname || ""})` : "-",
                item_name: cr.variant?.item?.name || `Variant ID: ${cr.variant_id}`,
                size: cr.variant?.size || "-",
                quantity: cr.quantity,
                reason: cr.reason || "-",
                status: cr.status,
                admin_note: cr.admin_note || "-",
            });
            styleDataRow(row, idx % 2 === 1);
        });

        // ---------------------------------------------
        // Sheet 6: ยืมทรัพย์สิน (Assets)
        // ---------------------------------------------
        const sAsset = workbook.addWorksheet("ยืมทรัพย์สิน (Assets)", { views: [{ showGridLines: true }] });
        sAsset.columns = [
            { header: "วันที่ยื่นคำขอ", key: "created_at", width: 22 },
            { header: "รหัสพนักงาน", key: "emp_id", width: 14 },
            { header: "ชื่อพนักงาน", key: "emp_name", width: 24 },
            { header: "รหัสทรัพย์สิน", key: "asset_code", width: 16 },
            { header: "ชื่อทรัพย์สิน", key: "asset_name", width: 30 },
            { header: "จำนวน", key: "quantity", width: 12 },
            { header: "วันที่เริ่มยืม", key: "borrow_date", width: 22 },
            { header: "กำหนดคืน", key: "expected_return_date", width: 22 },
            { header: "วันที่คืนจริง", key: "actual_return_date", width: 22 },
            { header: "สถานที่ใช้งาน", key: "location", width: 25 },
            { header: "สถานะ", key: "status", width: 16 },
        ];
        styleHeaderRow(sAsset.getRow(1), "FF1E293B");

        assetBorrowings.forEach((ab, idx) => {
            const row = sAsset.addRow({
                created_at: toBkkDateTime(ab.created_at),
                emp_id: ab.emp_id,
                emp_name: ab.employee ? `${ab.employee.name} (${ab.employee.nickname || ""})` : "-",
                asset_code: ab.assets?.asset_id || "-",
                asset_name: ab.assets?.name || `Asset #${ab.asset_id}`,
                quantity: ab.quantity || 1,
                borrow_date: toBkkDateTime(ab.borrow_date),
                expected_return_date: toBkkDateTime(ab.expected_return_date),
                actual_return_date: toBkkDateTime(ab.actual_return_date),
                location: ab.location || "-",
                status: ab.status,
            });
            styleDataRow(row, idx % 2 === 1);
        });

        // ---------------------------------------------
        // Sheet 7: งานสั่งจ่าย (Payment Tasks)
        // ---------------------------------------------
        const sPay = workbook.addWorksheet("งานสั่งจ่าย (Payment Tasks)", { views: [{ showGridLines: true }] });
        sPay.columns = [
            { header: "วันที่สร้างรายการ", key: "createdAt", width: 22 },
            { header: "รหัสงาน/โครงการ", key: "jobNumber", width: 20 },
            { header: "ชื่อลูกค้า", key: "customerName", width: 30 },
            { header: "งวดที่", key: "installmentNo", width: 12 },
            { header: "ยอดเงิน (บาท)", key: "installmentAmount", width: 18 },
            { header: "เลขที่ใบแจ้งหนี้", key: "invoiceNumber", width: 22 },
            { header: "สถานะ", key: "status", width: 16 },
            { header: "หมายเหตุ / โน้ต", key: "note", width: 35 },
        ];
        styleHeaderRow(sPay.getRow(1), "FF1E293B");

        paymentTasks.forEach((pt, idx) => {
            const row = sPay.addRow({
                createdAt: toBkkDateTime(pt.createdAt),
                jobNumber: pt.jobs?.jobNumber || pt.jobId,
                customerName: pt.jobs?.customerName || "-",
                installmentNo: pt.installmentNo ? `${pt.installmentNo}/${pt.installmentTotal || "-"}` : "-",
                installmentAmount: pt.installmentAmount || pt.paidAmount || 0,
                invoiceNumber: pt.invoiceNumber || "-",
                status: pt.status,
                note: pt.note || "-",
            });
            styleDataRow(row, idx % 2 === 1);
        });

        // ---------------------------------------------
        // Sheet 8: ไฟล์เอกสารแนบ (Uploads)
        // ---------------------------------------------
        const sFiles = workbook.addWorksheet("ไฟล์เอกสารแนบ (Uploads)", { views: [{ showGridLines: true }] });
        sFiles.columns = [
            { header: "วันที่จัดเก็บ", key: "date", width: 16 },
            { header: "ชื่อไฟล์", key: "name", width: 45 },
            { header: "หมวดหมู่เอกสาร", key: "type", width: 32 },
            { header: "ขนาดไฟล์ (KB)", key: "size", width: 16 },
            { header: "ลิงก์ไฟล์ (URL)", key: "url", width: 65 },
        ];
        styleHeaderRow(sFiles.getRow(1), "FF1E293B");

        uploadedFiles.forEach((f, idx) => {
            const row = sFiles.addRow({
                date: f.date,
                name: f.name,
                type: f.type,
                size: f.size ? (f.size / 1024).toFixed(1) : 0,
                url: f.url,
            });
            styleDataRow(row, idx % 2 === 1);
        });

        const buffer = await workbook.xlsx.writeBuffer();

        return new Response(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="activity_report_${startDateStr}_to_${endDateStr}.xlsx"`,
            },
        });
    } catch (e: any) {
        console.error("Activity Report Export Error:", e);
        const status = e.message === "UNAUTHORIZED" ? 401 : e.message === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: e.message || "INTERNAL_ERROR" }, { status });
    }
}
