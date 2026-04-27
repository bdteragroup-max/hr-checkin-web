import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch (e) {
        return null;
    }
}

export async function GET(req: Request) {
    try {
        const user = await getAuth();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

        const claims = await prisma.commission_claims.findMany({
            where,
            include: { employee: true },
            orderBy: { date: "asc" }
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Commission Claims");

        sheet.columns = [
            { header: "DATE", key: "date", width: 12 },
            { header: "EMP_ID", key: "emp_id", width: 12 },
            { header: "NAME", key: "name", width: 25 },
            { header: "CUSTOMER", key: "customer", width: 30 },
            { header: "SELLING_PRICE", key: "selling_price", width: 15 },
            { header: "COMMISSION_RATE", key: "rate", width: 15 },
            { header: "TOTAL_COMMISSION", key: "total", width: 15 },
            { header: "PER_PERSON", key: "per_person", width: 15 },
            { header: "STATUS", key: "status", width: 15 },
            { header: "APPROVED_BY", key: "approved_by", width: 20 },
            { header: "APPROVED_AT", key: "approved_at", width: 20 },
        ];
        sheet.getRow(1).font = { bold: true };

        claims.forEach(c => {
            sheet.addRow({
                date: c.date.toISOString().split("T")[0],
                emp_id: c.emp_id,
                name: c.employee.name,
                customer: c.customer_name,
                selling_price: c.selling_price ? Number(c.selling_price) : 0,
                rate: c.commission_rate ? `${(Number(c.commission_rate) * 100).toFixed(2)}%` : "1.00%",
                total: c.total_commission ? Number(c.total_commission) : 0,
                per_person: c.per_person_commission ? Number(c.per_person_commission) : 0,
                status: c.status,
                approved_by: c.approved_by || "-",
                approved_at: c.approved_at ? c.approved_at.toISOString() : "-"
            });
        });

        // Summary Sheet per Employee
        const summarySheet = workbook.addWorksheet("Summary by Employee");
        summarySheet.columns = [
            { header: "EMP_ID", key: "emp_id", width: 15 },
            { header: "NAME", key: "name", width: 25 },
            { header: "TOTAL_CLAIMS", key: "count", width: 15 },
            { header: "TOTAL_COMMISSION", key: "amount", width: 15 },
        ];
        summarySheet.getRow(1).font = { bold: true };

        const summaryMap = new Map<string, { name: string, count: number, amount: number }>();
        claims.forEach(c => {
            if (c.status !== "completed") return;
            const current = summaryMap.get(c.emp_id) || { name: c.employee.name, count: 0, amount: 0 };
            current.count += 1;
            current.amount += Number(c.per_person_commission || 0);
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
                "Content-Disposition": `attachment; filename="commission_claims_${start_date}_to_${end_date}.xlsx"`,
            },
        });

    } catch (e: any) {
        console.error("COMMISSION EXPORT ERROR:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
