import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const start_date = url.searchParams.get("start_date");
        const end_date = url.searchParams.get("end_date");

        if (!start_date || !end_date) {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        const where: any = {
            date: {
                gte: new Date(start_date),
                lte: new Date(end_date)
            }
        };

        const claims = await prisma.travel_claims.findMany({
            where,
            include: { employee: true },
            orderBy: { date: "asc" }
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Travel Claims");

        sheet.columns = [
            { header: "DATE", key: "date", width: 12 },
            { header: "END_DATE", key: "end_date", width: 12 },
            { header: "EMP_ID", key: "emp_id", width: 12 },
            { header: "NAME", key: "name", width: 25 },
            { header: "TYPE", key: "type", width: 15 },
            { header: "SITE_NAME", key: "site", width: 30 },
            { header: "OVERNIGHT", key: "overnight", width: 12 },
            { header: "AMOUNT", key: "amount", width: 12 },
            { header: "STATUS", key: "status", width: 15 },
            { header: "APPROVED_BY", key: "approved_by", width: 20 },
            { header: "REMARK", key: "remark", width: 30 },
        ];
        sheet.getRow(1).font = { bold: true };

        claims.forEach(c => {
            sheet.addRow({
                date: c.date.toISOString().split("T")[0],
                end_date: c.end_date ? c.end_date.toISOString().split("T")[0] : "-",
                emp_id: c.emp_id,
                name: c.employee.name,
                type: c.claim_type,
                site: c.site_name,
                overnight: c.is_overnight ? "YES" : "NO",
                amount: Number(c.accommodation_amount),
                status: c.status,
                approved_by: c.approved_by || "-",
                remark: c.remark || "-"
            });
        });

        // Add Summary Sheet per Employee
        const summarySheet = workbook.addWorksheet("Summary by Employee");
        summarySheet.columns = [
            { header: "EMP_ID", key: "emp_id", width: 15 },
            { header: "NAME", key: "name", width: 25 },
            { header: "TOTAL_CLAIMS", key: "count", width: 15 },
            { header: "TOTAL_AMOUNT", key: "amount", width: 15 },
        ];
        summarySheet.getRow(1).font = { bold: true };

        const summaryMap = new Map<string, { name: string, count: number, amount: number }>();
        claims.forEach(c => {
            const current = summaryMap.get(c.emp_id) || { name: c.employee.name, count: 0, amount: 0 };
            current.count += 1;
            current.amount += Number(c.accommodation_amount);
            summaryMap.set(c.emp_id, current);
        });

        summaryMap.forEach((v, k) => {
            summarySheet.addRow({
                emp_id: k,
                name: v.name,
                count: v.count,
                amount: v.amount
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return new Response(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="travel_claims_${start_date}_to_${end_date}.xlsx"`,
            },
        });

    } catch (e: any) {
        console.error("TRAVEL EXPORT ERROR:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
