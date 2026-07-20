import { NextResponse } from "next/server";
import * as ExcelJS from "exceljs";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { data, status } = body;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "HR Check-in Web";
        workbook.created = new Date();

        const sheetName = status === 'pending' ? 'Pending Redemptions' : 'History Redemptions';
        const sheet = workbook.addWorksheet(sheetName);

        // Define columns
        sheet.columns = [
            { header: "วันที่แลก", key: "redeemed_at", width: 20 },
            { header: "รหัสพนักงาน", key: "emp_id", width: 15 },
            { header: "ชื่อพนักงาน", key: "employee_name", width: 25 },
            { header: "ของรางวัล", key: "reward_name", width: 30 },
            { header: "จำนวน", key: "quantity", width: 10 },
            { header: "เหรียญที่ใช้", key: "points_spent", width: 15 },
            { header: "สถานะ", key: "status", width: 15 },
            { header: "ผู้ประมวลผล", key: "processor_name", width: 25 },
            { header: "เหตุผลที่ยกเลิก", key: "cancelled_reason", width: 30 }
        ];

        // Style headers
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE5E7EB' }
        };

        // Add rows
        for (const r of (data || [])) {
            sheet.addRow({
                redeemed_at: new Date(r.redeemed_at).toLocaleString(),
                emp_id: r.emp_id,
                employee_name: r.employee?.name || "",
                reward_name: r.reward?.name || "",
                quantity: r.quantity,
                points_spent: `${r.points_spent} ${r.coin_type_id || r.reward?.required_coin_type || ''}`,
                status: r.status === 'pending' ? 'รออนุมัติ' : r.status === 'fulfilled' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว',
                processor_name: r.processor?.name || "-",
                cancelled_reason: r.cancelled_reason || "-"
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer as ArrayBuffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="redemptions_${status}_${new Date().toISOString().slice(0, 10)}.xlsx"`
            }
        });
    } catch (e: any) {
        console.error("Export Redemptions Error:", e);
        return NextResponse.json({ error: e.message || "Failed to export" }, { status: 500 });
    }
}
