// @ts-nocheck
import { NextResponse } from "next/server";
import * as ExcelJS from "exceljs";

export async function POST(req: Request) {
    throw new Error("TODO: Payroll is under maintenance for allowance schema changes");
    try {
        const body = await req.json();
        const { companyTitle, month, year, data } = body;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "HR Check-in Web";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet("Payroll");

        // Define columns
        sheet.columns = [
            { header: "รหัสพนักงาน", key: "emp_id", width: 15 },
            { header: "ชื่อ-นามสกุล", key: "name", width: 25 },
            { header: "ตำแหน่ง", key: "position", width: 20 },
            { header: "แผนก/ฝ่าย", key: "department", width: 20 },
            { header: "อายุงาน", key: "service_duration", width: 15 },
            { header: "ฐานเงินเดือน", key: "base_salary", width: 15 },
            { header: "เงินประจำตำแหน่ง", key: "position_allowance", width: 15 },
            { header: "เบี้ยเลี้ยง/สวัสดิการ", key: "general_allowance", width: 15 },
            { header: "OT 1.5x (ชม.)", key: "normal_1_5x_hours", width: 15 },
            { header: "OT 1.5x (฿)", key: "normal_ot_pay", width: 15 },
            { header: "OT วันหยุด 1x (ชม.)", key: "holiday_1x_hours", width: 15 },
            { header: "OT วันหยุด 1x (฿)", key: "holiday_1x_pay", width: 15 },
            { header: "OT วันหยุด 3x (ชม.)", key: "holiday_3x_hours", width: 15 },
            { header: "OT วันหยุด 3x (฿)", key: "holiday_3x_pay", width: 15 },
            { header: "เบี้ยขยัน", key: "diligence_allowance", width: 15 },
            { header: "ค่าอาหาร", key: "meal_allowance", width: 15 },
            { header: "ค่าเดินทาง", key: "travel_allowance", width: 15 },
            { header: "ค่าที่พัก", key: "accommodation_allowance", width: 15 },
            { header: "เบี้ยเลี้ยง Off-Site", key: "travel_site_allowance", width: 15 },
            { header: "ค่าโทรศัพท์", key: "telephone_allowance", width: 15 },
            { header: "โบนัสอายุงาน", key: "long_service_allowance", width: 15 },
            { header: "คอมมิชชั่น", key: "commissions", width: 15 },
            { header: "โบนัส", key: "bonus", width: 15 },
            { header: "รายได้อื่นๆ", key: "other_benefits", width: 15 },
            { header: "ค่าเที่ยวขับรถ", key: "truck_trip_fee", width: 15 },
            { header: "สวัสดิการอื่นๆ", key: "welfare_amount", width: 15 },
            { header: "รวมรายได้สุทธิ", key: "gross_pay", width: 15 },
            { header: "หักประกันสังคม", key: "social_security", width: 15 },
            { header: "หัก กยศ.", key: "student_loan", width: 15 },
            { header: "ประกันทำงาน", key: "insurance", width: 15 },
            { header: "ขาดงาน", key: "unpaid_absenteeism", width: 15 },
            { header: "ภาษี", key: "tax", width: 15 },
            { header: "หักอื่นๆ", key: "other_deductions", width: 15 },
            { header: "รวมรับจริง (฿)", key: "net_pay", width: 15 },
            { header: "ธนาคาร", key: "bank_name", width: 15 },
            { header: "เลขบัญชี", key: "bank_account_no", width: 20 },
        ];

        // Add Header styling
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

        // Add rows
        for (const emp of data) {
            sheet.addRow({
                emp_id: emp.emp_id,
                name: emp.name,
                position: emp.position,
                department: `${emp.department} / ${emp.division}`,
                service_duration: emp.service_duration,
                base_salary: emp.base_salary,
                position_allowance: emp.position_allowance,
                general_allowance: emp.general_allowance,
                normal_1_5x_hours: emp.normal_1_5x_hours,
                normal_ot_pay: emp.normal_ot_pay,
                holiday_1x_hours: emp.holiday_1x_hours,
                holiday_1x_pay: emp.holiday_1x_pay,
                holiday_3x_hours: emp.holiday_3x_hours,
                holiday_3x_pay: emp.holiday_3x_pay,
                diligence_allowance: emp.diligence_allowance,
                meal_allowance: emp.meal_allowance,
                travel_allowance: emp.travel_allowance,
                accommodation_allowance: emp.accommodation_allowance,
                travel_site_allowance: emp.travel_site_allowance,
                telephone_allowance: emp.telephone_allowance,
                long_service_allowance: emp.long_service_allowance,
                commissions: emp.commissions,
                bonus: emp.bonus,
                other_benefits: emp.other_benefits,
                truck_trip_fee: emp.truck_trip_fee,
                welfare_amount: emp.welfare_amount,
                gross_pay: emp.gross_pay,
                social_security: emp.social_security,
                student_loan: emp.student_loan,
                insurance: emp.insurance,
                unpaid_absenteeism: emp.unpaid_absenteeism,
                tax: emp.tax,
                other_deductions: emp.other_deductions,
                net_pay: emp.net_pay,
                bank_name: emp.bank_name,
                bank_account_no: emp.bank_account_no,
            });
        }

        // Apply number formats
        const numColumns = [
            "base_salary", "position_allowance", "general_allowance", "normal_1_5x_hours", "normal_ot_pay",
            "holiday_1x_hours", "holiday_1x_pay", "holiday_3x_hours", "holiday_3x_pay", "diligence_allowance",
            "meal_allowance", "travel_allowance", "accommodation_allowance", "travel_site_allowance",
            "telephone_allowance", "long_service_allowance", "commissions", "bonus",
            "other_benefits", "truck_trip_fee", "welfare_amount", "gross_pay", "social_security", "student_loan",
            "insurance", "unpaid_absenteeism", "tax", "other_deductions", "net_pay"
        ];
        
        numColumns.forEach(key => {
            const col = sheet.getColumn(key);
            if (col) {
                col.numFmt = '#,##0.00';
            }
        });

        // Add individual employee benefit sheets
        const benefitTypes = [
            { key: "base_salary", name: "ฐานเงินเดือน" },
            { key: "position_allowance", name: "เงินประจำตำแหน่ง" },
            { key: "general_allowance", name: "เบี้ยเลี้ยงสวัสดิการ" },
            { key: "normal_ot_pay", name: "OT 1.5x (฿)" },
            { key: "holiday_1x_pay", name: "OT วันหยุด 1x (฿)" },
            { key: "holiday_3x_pay", name: "OT วันหยุด 3x (฿)" },
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
        
        const usedSheetNames = new Set<string>();
        usedSheetNames.add("Payroll");

        for (const emp of data) {
            // Override with max allowances so the Benefits section shows the full amount
            if (emp.max_meal_allowance !== undefined) emp.meal_allowance = emp.max_meal_allowance;
            if (emp.max_travel_allowance !== undefined) emp.travel_allowance = emp.max_travel_allowance;

            const empBenefits = benefitTypes.filter(b => Number(emp[b.key]) > 0);
            
            if (empBenefits.length > 0) {
                let rawName = emp.name.replace(/[\/\?\*\[\]\:]/g, "").trim();
                if (rawName.length > 25) rawName = rawName.substring(0, 25);
                
                let sheetName = rawName;
                let counter = 1;
                while (usedSheetNames.has(sheetName)) {
                    sheetName = `${rawName} (${counter})`;
                    counter++;
                }
                usedSheetNames.add(sheetName);

                const empSheet = workbook.addWorksheet(sheetName);

                empSheet.addRow(["รหัสพนักงาน:", emp.emp_id]);
                empSheet.addRow(["ชื่อ-นามสกุล:", emp.name]);
                empSheet.addRow(["ตำแหน่ง:", emp.position]);
                empSheet.addRow(["แผนก/ฝ่าย:", `${emp.department || '-'} / ${emp.division || '-'}`]);
                empSheet.addRow(["อายุงาน:", emp.service_duration || '-']);
                empSheet.addRow([]); // Empty row
                
                for (let i = 1; i <= 5; i++) {
                    empSheet.getCell(`A${i}`).font = { bold: true };
                }

                const tableHeaderRow = empSheet.addRow(["รายการสวัสดิการ", "จำนวนเงิน (฿)"]);
                tableHeaderRow.font = { bold: true };
                tableHeaderRow.alignment = { horizontal: "center" };
                
                empSheet.columns = [
                    { key: "benefit", width: 30 },
                    { key: "amount", width: 20 }
                ];

                let totalAmount = 0;
                const benefitsStartRow = empSheet.rowCount + 1;

                for (const benefit of empBenefits) {
                    const amt = Number(emp[benefit.key]);
                    totalAmount += amt;
                    empSheet.addRow({
                        benefit: benefit.name,
                        amount: amt
                    });
                }
                const benefitsEndRow = empSheet.rowCount;

                const totalRow = empSheet.addRow({ benefit: "รวมรายรับ" });
                const totalBenefitsRowNum = empSheet.rowCount;
                empSheet.getCell(`B${totalBenefitsRowNum}`).value = { 
                    formula: `SUM(B${benefitsStartRow}:B${benefitsEndRow})`, 
                    result: totalAmount 
                };
                totalRow.font = { bold: true };
                
                // Add Deductions Section
                empSheet.addRow([]); // Empty row
                
                const deductionTypes = [
                    { key: "social_security", name: "หักประกันสังคม" },
                    { key: "student_loan", name: "หัก กยศ." },
                    { key: "insurance", name: "ประกันทำงาน" },
                    { key: "unpaid_absenteeism", name: "ขาดงาน" },
                    { key: "tax", name: "ภาษี" },
                    { key: "other_deductions", name: "หักอื่นๆ" }
                ];
                
                const deductionHeaderRow = empSheet.addRow(["รายการหัก", "จำนวนเงิน (฿)"]);
                deductionHeaderRow.font = { bold: true };
                deductionHeaderRow.alignment = { horizontal: "center" };
                
                const deductionsStartRow = empSheet.rowCount + 1;
                let totalDeductions = 0;
                
                // Add explicit deductions for missed meal/travel
                const mealDed = Number(emp.meal_deduction || 0);
                const travelDed = Number(emp.travel_deduction || 0);
                
                empSheet.addRow({ benefit: "หักค่าอาหาร", amount: mealDed });
                totalDeductions += mealDed;
                
                empSheet.addRow({ benefit: "หักค่าเดินทาง", amount: travelDed });
                totalDeductions += travelDed;

                for (const ded of deductionTypes) {
                    const amt = Number(emp[ded.key]);
                    if (amt > 0) {
                        totalDeductions += amt;
                        empSheet.addRow({
                            benefit: ded.name,
                            amount: amt
                        });
                    }
                }
                const deductionsEndRow = empSheet.rowCount;
                
                const totalDedRow = empSheet.addRow({ benefit: "รวมรายการหัก" });
                const totalDeductionsRowNum = empSheet.rowCount;
                empSheet.getCell(`B${totalDeductionsRowNum}`).value = { 
                    formula: `SUM(B${deductionsStartRow}:B${deductionsEndRow})`, 
                    result: totalDeductions 
                };
                totalDedRow.font = { bold: true, color: { argb: "FFFF0000" } };
                
                // Add Net Pay
                empSheet.addRow([]);
                const netPayRow = empSheet.addRow({ benefit: "รายรับสุทธิ (Net Pay)" });
                const netPayRowNum = empSheet.rowCount;
                empSheet.getCell(`B${netPayRowNum}`).value = { 
                    formula: `B${totalBenefitsRowNum}-B${totalDeductionsRowNum}`, 
                    result: totalAmount - totalDeductions 
                };
                netPayRow.font = { bold: true, size: 14 };

                const rowCount = empSheet.rowCount;
                for (let i = 7; i <= rowCount; i++) {
                    const cell = empSheet.getCell(`B${i}`);
                    if (cell.value !== null) {
                        cell.numFmt = '#,##0.00';
                    }
                }
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const safeTitle = companyTitle.replace(/[^a-zA-Z0-9ก-๙\s]/g, "").trim().replace(/\s+/g, "_");
        const filename = `Payroll_${safeTitle}_${month}_${year}.xlsx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
            }
        });
    } catch (e) {
        console.error("Export Excel Error:", e);
        return NextResponse.json({ error: "Failed to generate Excel" }, { status: 500 });
    }
}

