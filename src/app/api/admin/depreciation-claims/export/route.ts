import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const STATUS_MAP: Record<string, string> = {
    PENDING_INITIAL: "รออนุมัติเบื้องต้น (คุณณัฎธินี)",
    PENDING_HR: "รอ HR อนุมัติ",
    PENDING: "รอ HR อนุมัติ",
    APPROVED: "อนุมัติแล้ว (รอรอบจ่ายเงินสิ้นเดือน)",
    PAID: "จ่ายเงินเรียบร้อยแล้ว",
    RETURNED: "ตีกลับแก้ไข"
};

interface DepreciationClaimItem {
    id: number;
    emp_id: string;
    submitted_by: string;
    amount: any;
    receipt_url: string;
    status: string;
    return_reason?: string | null;
    approved_by?: string | null;
    approved_at?: Date | null;
    claim_month: Date;
    created_at: Date;
    updated_at: Date;
    initial_approved_by?: string | null;
    initial_approved_at?: Date | null;
    claim_type?: string | null;
    paid_by?: string | null;
    paid_at?: Date | null;
    employee?: { name: string; emp_id: string; nickname: string | null } | null;
    supervisor?: { name: string; emp_id: string; nickname: string | null } | null;
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const month = searchParams.get("month");
        const supervisor_id = searchParams.get("supervisor_id");
        const claim_type = searchParams.get("claim_type");
        const status = searchParams.get("status");

        const where: any = {};
        if (status && status !== "all") {
            if (status === "PENDING") {
                where.status = { in: ["PENDING_INITIAL", "PENDING_HR", "PENDING"] };
            } else if (status === "PENDING_INITIAL") {
                where.status = { in: ["PENDING_INITIAL", "PENDING"] };
            } else if (status === "PENDING_HR") {
                where.status = "PENDING_HR";
            } else {
                where.status = status;
            }
        }

        if (claim_type && claim_type !== "all") {
            where.claim_type = claim_type;
        }

        if (supervisor_id && supervisor_id !== "all") {
            where.submitted_by = supervisor_id;
        }

        if (startDate && endDate) {
            where.claim_month = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        } else if (month) {
            const date = new Date(month);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            where.claim_month = {
                gte: startOfMonth,
                lte: endOfMonth
            };
        }

        const claims = (await prisma.sales_depreciation_claims.findMany({
            where,
            include: {
                employee: { select: { name: true, nickname: true, emp_id: true } },
                supervisor: { select: { name: true, nickname: true, emp_id: true } }
            },
            orderBy: [{ claim_month: "desc" }, { created_at: "desc" }]
        })) as unknown as DepreciationClaimItem[];

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "HR Checkin System";
        workbook.created = new Date();

        // Separate items by category
        const depClaims = claims.filter(c => c.claim_type === "DEPRECIATION" || !c.claim_type);
        const fuelClaims = claims.filter(c => c.claim_type === "FUEL");
        const awaitingPayClaims = claims.filter(c => c.status === "APPROVED");
        const paidClaims = claims.filter(c => c.status === "PAID");

        // Helper to format date
        const formatDate = (d?: Date | string | null) => d ? new Date(d).toLocaleDateString("th-TH") : "-";
        const formatMonth = (d?: Date | string | null) => d ? new Date(d).toLocaleDateString("th-TH", { month: "short", year: "2-digit" }) : "-";

        // -------------------------------------------------------------
        // Sheet 1: สรุปภาพรวม (Summary Overview)
        // -------------------------------------------------------------
        const sSummary = workbook.addWorksheet("สรุปภาพรวม", { views: [{ showGridLines: true }] });
        sSummary.columns = [
            { header: "หมวดหมู่ค่าใช้จ่าย", key: "cat", width: 28 },
            { header: "รออนุมัติ (รายการ)", key: "pending_count", width: 18 },
            { header: "รอรอบจ่ายเงิน (รายการ)", key: "approved_count", width: 22 },
            { header: "รอรอบจ่ายเงิน (บาท)", key: "approved_amt", width: 22 },
            { header: "จ่ายเงินแล้ว (รายการ)", key: "paid_count", width: 20 },
            { header: "จ่ายเงินแล้ว (บาท)", key: "paid_amt", width: 20 },
            { header: "รวมทั้งหมด (รายการ)", key: "total_count", width: 20 },
            { header: "รวมยอดเงิน (บาท)", key: "total_amt", width: 22 },
        ];

        sSummary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        sSummary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
        sSummary.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

        const getStats = (list: typeof claims) => {
            const pendingList = list.filter(c => ["PENDING", "PENDING_INITIAL", "PENDING_HR"].includes(c.status));
            const approvedList = list.filter(c => c.status === "APPROVED");
            const paidList = list.filter(c => c.status === "PAID");

            const approvedAmt = approvedList.reduce((acc, c) => acc + Number(c.amount), 0);
            const paidAmt = paidList.reduce((acc, c) => acc + Number(c.amount), 0);
            const totalAmt = list.reduce((acc, c) => acc + Number(c.amount), 0);

            return {
                pendingCount: pendingList.length,
                approvedCount: approvedList.length,
                approvedAmt,
                paidCount: paidList.length,
                paidAmt,
                totalCount: list.length,
                totalAmt
            };
        };

        const depStats = getStats(depClaims);
        const fuelStats = getStats(fuelClaims);
        const totalStats = getStats(claims);

        const rDep = sSummary.addRow({
            cat: "ค่าเสื่อมสภาพรถ (Depreciation)",
            pending_count: depStats.pendingCount,
            approved_count: depStats.approvedCount,
            approved_amt: depStats.approvedAmt,
            paid_count: depStats.paidCount,
            paid_amt: depStats.paidAmt,
            total_count: depStats.totalCount,
            total_amt: depStats.totalAmt,
        });
        rDep.getCell("approved_amt").numFmt = "#,##0.00";
        rDep.getCell("paid_amt").numFmt = "#,##0.00";
        rDep.getCell("total_amt").numFmt = "#,##0.00";

        const rFuel = sSummary.addRow({
            cat: "ค่าน้ำมัน (Fuel Costs)",
            pending_count: fuelStats.pendingCount,
            approved_count: fuelStats.approvedCount,
            approved_amt: fuelStats.approvedAmt,
            paid_count: fuelStats.paidCount,
            paid_amt: fuelStats.paidAmt,
            total_count: fuelStats.totalCount,
            total_amt: fuelStats.totalAmt,
        });
        rFuel.getCell("approved_amt").numFmt = "#,##0.00";
        rFuel.getCell("paid_amt").numFmt = "#,##0.00";
        rFuel.getCell("total_amt").numFmt = "#,##0.00";

        const rTotal = sSummary.addRow({
            cat: "รวมทั้งหมด (Grand Total)",
            pending_count: totalStats.pendingCount,
            approved_count: totalStats.approvedCount,
            approved_amt: totalStats.approvedAmt,
            paid_count: totalStats.paidCount,
            paid_amt: totalStats.paidAmt,
            total_count: totalStats.totalCount,
            total_amt: totalStats.totalAmt,
        });
        rTotal.font = { bold: true };
        rTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
        rTotal.getCell("approved_amt").numFmt = "#,##0.00";
        rTotal.getCell("paid_amt").numFmt = "#,##0.00";
        rTotal.getCell("total_amt").numFmt = "#,##0.00";

        // Helper to populate detail table sheets
        const populateDetailSheet = (sheet: ExcelJS.Worksheet, items: DepreciationClaimItem[], headerColor: string, showTypeCol: boolean = false) => {
            const cols = [
                { header: "ลำดับ", key: "idx", width: 8 },
                ...(showTypeCol ? [{ header: "ประเภท", key: "type", width: 18 }] : []),
                { header: "รหัสพนักงาน", key: "emp_id", width: 14 },
                { header: "ชื่อพนักงาน", key: "emp_name", width: 26 },
                { header: "ชื่อเล่น", key: "emp_nick", width: 12 },
                { header: "หัวหน้าผู้ส่ง", key: "supervisor", width: 24 },
                { header: "เดือนที่ขอเบิก", key: "month", width: 16 },
                { header: "จำนวนเงิน (บาท)", key: "amount", width: 18 },
                { header: "สถานะ", key: "status", width: 28 },
                { header: "อนุมัติเบื้องต้น", key: "initial_approver", width: 16 },
                { header: "ผู้อนุมัติ HR", key: "approver", width: 16 },
                { header: "วันที่อนุมัติ", key: "approved_at", width: 16 },
                { header: "สถานะจ่ายเงิน", key: "pay_status", width: 18 },
                { header: "วันที่จ่ายเงิน", key: "paid_at", width: 16 },
                { header: "ผู้บันทึกจ่ายเงิน", key: "paid_by", width: 16 },
                { header: "ลิงก์เอกสารแนบ", key: "receipt_url", width: 40 },
            ];

            sheet.columns = cols;
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
            headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
            headerRow.alignment = { vertical: "middle", horizontal: "center" };

            let sumAmount = 0;

            items.forEach((c, i) => {
                const amt = Number(c.amount);
                sumAmount += amt;

                const rowData: any = {
                    idx: i + 1,
                    emp_id: c.emp_id,
                    emp_name: c.employee?.name || "-",
                    emp_nick: c.employee?.nickname || "-",
                    supervisor: c.supervisor?.name || c.submitted_by,
                    month: formatMonth(c.claim_month),
                    amount: amt,
                    status: STATUS_MAP[c.status] || c.status,
                    initial_approver: c.initial_approved_by || "-",
                    approver: c.approved_by || "-",
                    approved_at: formatDate(c.approved_at),
                    pay_status: c.status === "PAID" ? "จ่ายเงินแล้ว" : (c.status === "APPROVED" ? "รอจ่ายเงินรอบสิ้นเดือน" : "-"),
                    paid_at: formatDate(c.paid_at),
                    paid_by: c.paid_by || "-",
                    receipt_url: c.receipt_url || "-"
                };

                if (showTypeCol) {
                    rowData.type = c.claim_type === "FUEL" ? "ค่าน้ำมัน" : "ค่าเสื่อมสภาพรถ";
                }

                const r = sheet.addRow(rowData);
                r.getCell("amount").numFmt = "#,##0.00";
            });

            // Summary row at the bottom
            const summaryRowData: any = {
                idx: "รวม",
                amount: sumAmount
            };
            const sumRow = sheet.addRow(summaryRowData);
            sumRow.font = { bold: true };
            sumRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
            sumRow.getCell("amount").numFmt = "#,##0.00";
        };

        // -------------------------------------------------------------
        // Sheet 2: ค่าเสื่อมสภาพรถ (Depreciation)
        // -------------------------------------------------------------
        const sDep = workbook.addWorksheet("ค่าเสื่อมสภาพรถ", { views: [{ showGridLines: true }] });
        populateDetailSheet(sDep, depClaims, "FF2563EB", false);

        // -------------------------------------------------------------
        // Sheet 3: ค่าน้ำมัน (Fuel Costs)
        // -------------------------------------------------------------
        const sFuel = workbook.addWorksheet("ค่าน้ำมัน", { views: [{ showGridLines: true }] });
        populateDetailSheet(sFuel, fuelClaims, "FFD97706", false);

        // -------------------------------------------------------------
        // Sheet 4: รอบเบิกจ่ายสิ้นเดือน (Awaiting Payment)
        // -------------------------------------------------------------
        const sAwaiting = workbook.addWorksheet("รอบจ่ายเงินสิ้นเดือน", { views: [{ showGridLines: true }] });
        populateDetailSheet(sAwaiting, awaitingPayClaims, "FF059669", true);

        // -------------------------------------------------------------
        // Sheet 5: ประวัติการจ่ายเงินแล้ว (Paid History)
        // -------------------------------------------------------------
        const sPaid = workbook.addWorksheet("จ่ายเงินแล้ว", { views: [{ showGridLines: true }] });
        populateDetailSheet(sPaid, paidClaims, "FF10B981", true);

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `depreciation_fuel_report_${new Date().toISOString().split("T")[0]}.xlsx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`
            }
        });
    } catch (e: any) {
        console.error("Export Depreciation/Fuel Claims Error:", e);
        return NextResponse.json({ error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
