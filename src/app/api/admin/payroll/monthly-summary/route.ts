import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { fetchMonthlyEmployeeSalaryData, generateMonthlyPayrollExcel } from "@/lib/humansoftMonthly";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const { searchParams } = new URL(req.url);
        const company = (searchParams.get("company") || "TG").toUpperCase();
        const format = searchParams.get("format") || "json";
        const refresh = searchParams.get("refresh") === "true";

        const data = await fetchMonthlyEmployeeSalaryData(company, refresh);

        if (format === "excel") {
            const buffer = await generateMonthlyPayrollExcel(data, company);
            const filename = `Monthly_Payroll_${company}_${new Date().toISOString().slice(0, 10)}.xlsx`;

            return new NextResponse(new Uint8Array(buffer), {
                status: 200,
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="${filename}"`
                }
            });
        }

        return NextResponse.json({
            ok: true,
            company,
            count: data.length,
            data
        });
    } catch (e: any) {
        console.error("[Monthly Summary API Error]:", e);
        return NextResponse.json(
            { ok: false, error: e.message || "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}
