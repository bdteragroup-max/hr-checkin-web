import { NextResponse } from "next/server";
import * as ExcelJS from "exceljs";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { month, year, data } = body;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "HR Check-in Web";
        workbook.created = new Date();

        const benefitTypes = [
            { key: "position_allowance", name: "เงินประจำตำแหน่ง" },
            { key: "general_allowance", name: "เบี้ยเลี้ยงสวัสดิการ" },
            { key: "diligence_allowance", name: "เบี้ยขยัน" },
            { key: "meal_allowance", name: "ค่าอาหาร" },
            { key: "travel_allowance", name: "ค่าเดินทาง" },
            { key: "accommodation_allowance", name: "ค่าที่พัก" },
            { key: "travel_site_allowance", name: "เบี้ยเลี้ยง Off-Site" },
            { key: "telephone_allowance", name: "ค่าโทรศัพท์" },
            { key: "long_service_allowance", name: "โบนัสอายุงาน" },
            { key: "commissions", name: "คอมมิชชั่น" },
            { key: "bonus", name: "โบนัส" },
            { key: "other_benefits", name: "รายได้อื่นๆ" },
            { key: "welfare_amount", name: "สวัสดิการอื่นๆ" }
        ];

        let hasAnyData = false;
        
        // Track sheet names to avoid duplicates (Excel max sheet name length is 31)
        const usedSheetNames = new Set<string>();

        for (const emp of data) {
            // Check if employee has any benefits
            const empBenefits = benefitTypes.filter(b => Number(emp[b.key]) > 0);
            
            if (empBenefits.length > 0) {
                hasAnyData = true;
                
                // Create a valid sheet name from employee name (max 31 chars, no special chars)
                let rawName = emp.name.replace(/[\/\?\*\[\]\:]/g, "").trim();
                if (rawName.length > 25) {
                    rawName = rawName.substring(0, 25);
                }
                
                let sheetName = rawName;
                let counter = 1;
                while (usedSheetNames.has(sheetName)) {
                    sheetName = `${rawName} (${counter})`;
                    counter++;
                }
                usedSheetNames.add(sheetName);

                const sheet = workbook.addWorksheet(sheetName);

                // Add header info
                sheet.addRow(["รหัสพนักงาน:", emp.emp_id]);
                sheet.addRow(["ชื่อ-นามสกุล:", emp.name]);
                sheet.addRow(["ตำแหน่ง:", emp.position]);
                sheet.addRow(["แผนก/ฝ่าย:", `${emp.department || '-'} / ${emp.division || '-'}`]);
                sheet.addRow([]); // Empty row
                
                // Style header info
                for (let i = 1; i <= 4; i++) {
                    sheet.getCell(`A${i}`).font = { bold: true };
                }

                // Table headers
                const tableHeaderRow = sheet.addRow(["รายการสวัสดิการ", "จำนวนเงิน (฿)"]);
                tableHeaderRow.font = { bold: true };
                tableHeaderRow.alignment = { horizontal: "center" };
                
                sheet.columns = [
                    { key: "benefit", width: 30 },
                    { key: "amount", width: 20 }
                ];

                let totalAmount = 0;

                // Add benefits
                for (const benefit of empBenefits) {
                    const amt = Number(emp[benefit.key]);
                    totalAmount += amt;
                    sheet.addRow({
                        benefit: benefit.name,
                        amount: amt
                    });
                }

                // Add total row
                const totalRow = sheet.addRow({
                    benefit: "รวมทั้งสิ้น",
                    amount: totalAmount
                });
                totalRow.font = { bold: true };

                // Apply number format to amount column (start from row 7 to end)
                const rowCount = sheet.rowCount;
                for (let i = 7; i <= rowCount; i++) {
                    sheet.getCell(`B${i}`).numFmt = '#,##0.00';
                }
            }
        }

        if (!hasAnyData) {
            const sheet = workbook.addWorksheet("ไม่มีข้อมูลสวัสดิการ");
            sheet.addRow(["ไม่มีข้อมูลสวัสดิการในรอบนี้สำหรับพนักงานทุกคน"]);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `Employee_Benefits_Summary_${month}_${year}.xlsx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
            }
        });
    } catch (e) {
        console.error("Export Benefits Excel Error:", e);
        return NextResponse.json({ error: "Failed to generate Excel" }, { status: 500 });
    }
}
