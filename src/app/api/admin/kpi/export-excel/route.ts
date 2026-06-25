import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import ExcelJS from "exceljs";
import { calculateServiceLengthString, calculateServiceLengthDays } from "@/utils/time";

export const runtime = "nodejs";

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const yearParam = url.searchParams.get('year');
        const filterYear = yearParam ? parseInt(yearParam) : null;
        
        const whereClause: any = { category: "ANNUAL" };
        if (filterYear) {
            whereClause.year = filterYear;
        }

        const evaluations = await (prisma as any).kpi_evaluations.findMany({
            where: whereClause,
            include: {
                employee: {
                    include: {
                        departments: { include: { divisions: true } },
                        job_positions: true,
                    }
                }
            },
            orderBy: [
                { year: 'desc' },
                { session_name: 'desc' },
                { employee: { departments: { name: 'asc' } } }
            ]
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("KPI Evaluations");

        // Define Headers
        sheet.getRow(1).values = [
            "ลำดับ", // A: 1
            "บริษัท", // B: 2
            "สังกัด", // C: 3
            "ชื่อ - นามสกุล", // D: 4
            "ชื่อเล่น", // E: 5
            "ตำแหน่ง", // F: 6
            "ฝ่าย", // G: 7
            "วันที่เริ่มงาน", // H: 8
            "อายุงานนับจากวันเริ่มงาน", // I: 9
            "อายุงานเป็นวัน", // J: 10
            "วันที่พ้นทดลองงาน", // K: 11
            "อายุงานนับจากวันพ้นทดลองงาน", // L: 12
            "ฐานเงินเดือน", // M: 13
            "ใบเตือน (กี่ใบ) / เรื่องอะไร", // N: 14
            "ผลประเมิน", // O: 15
            "ไฟล์แนบ", // P: 16
            "มาสาย", // Q: 17 (Times/Minutes Late group)
            "", // R: 18
            "จำนวนวันที่มาสาย", // S: 19
            "ขาดลา", // T: 20 (Leave group)
            "", // U: 21
            "", // V: 22
            "", // W: 23
            "จำนวนวันทำงาน", // X: 24
            "จำนวนชั่วโมงทำงาน", // Y: 25
            "จำนวนชั่วโมงที่ลางาน" // Z: 26
        ];

        // Row 2: Sub-headers
        sheet.getRow(2).values = [
            "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
            "จำนวนครั้ง", "นาที", "", // Under มาสาย (Q, R), S is separated
            "ป่วย", "กิจ", "พักร้อน", "รวม", // Under ขาดลา (T, U, V, W)
            "", "", "" // X, Y, Z
        ];

        // Merge cells for group headers
        // A1:A2 to P1:P2 + S, X, Y, Z
        const colsToMerge = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'S', 'X', 'Y', 'Z'];
        colsToMerge.forEach(col => {
            sheet.mergeCells(`${col}1:${col}2`);
        });

        // Merge Q1:R1 (มาสาย)
        sheet.mergeCells('Q1:R1');
        // Merge T1:W1 (ขาดลา)
        sheet.mergeCells('T1:W1');

        // Style the headers
        const headerRows = [sheet.getRow(1), sheet.getRow(2)];
        headerRows.forEach(row => {
            row.eachCell(cell => {
                cell.font = { bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6E6FA' } // Light purple matching screenshot
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Set column widths
        sheet.getColumn('A').width = 8;
        sheet.getColumn('B').width = 15;
        sheet.getColumn('C').width = 15;
        sheet.getColumn('D').width = 25;
        sheet.getColumn('E').width = 10;
        sheet.getColumn('F').width = 20;
        sheet.getColumn('G').width = 15;
        sheet.getColumn('H').width = 12;
        sheet.getColumn('I').width = 18;
        sheet.getColumn('J').width = 12;
        sheet.getColumn('K').width = 12;
        sheet.getColumn('L').width = 18;
        sheet.getColumn('M').width = 12;
        sheet.getColumn('N').width = 20;
        sheet.getColumn('O').width = 15;
        sheet.getColumn('P').width = 10;
        sheet.getColumn('Q').width = 10;
        sheet.getColumn('R').width = 10;
        sheet.getColumn('S').width = 10;
        sheet.getColumn('T').width = 8;
        sheet.getColumn('U').width = 8;
        sheet.getColumn('V').width = 8;
        sheet.getColumn('W').width = 8;
        sheet.getColumn('X').width = 12;
        sheet.getColumn('Y').width = 12;
        sheet.getColumn('Z').width = 15;

        // Color specific header cells like in screenshot
        sheet.getCell('Q1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }; // Light Green for มาสาย
        sheet.getCell('T1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } }; // Light Orange for ขาดลา
        sheet.getCell('X1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCFE2F3' } }; // Light Blue for working days

        // Fetch all holidays for working days calculation
        const allHolidays = await (prisma as any).holidays.findMany({ select: { date: true } });
        const holidayDateStrings = new Set(allHolidays.map((h: any) => new Date(h.date).toISOString().split('T')[0]));

        // Process data
        const now = new Date();
        let rowIndex = 3;

        for (const ev of evaluations) {
            const emp = ev.employee;
            if (!emp) continue;

            const evalYear = ev.year || now.getFullYear();
            const periodStart = ev.period_start || new Date(evalYear, 0, 1);
            const periodEnd = ev.period_end || new Date(evalYear, 11, 31, 23, 59, 59);

            // Calculate Working Days (excluding Sundays and Holidays)
            let effectiveStart = periodStart;
            if (emp.hire_date && emp.hire_date > periodStart) {
                effectiveStart = emp.hire_date;
            }
            
            let workingDays = 0;
            let current = new Date(effectiveStart);
            current.setHours(0,0,0,0);
            const end = new Date(periodEnd);
            end.setHours(0,0,0,0);

            while (current <= end) {
                if (current.getDay() !== 0) { // Not Sunday
                    // Adjust to local timezone date string (or avoid timezone shift by doing this)
                    const year = current.getFullYear();
                    const month = String(current.getMonth() + 1).padStart(2, '0');
                    const day = String(current.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    
                    if (!holidayDateStrings.has(dateStr)) {
                        workingDays++;
                    }
                }
                current.setDate(current.getDate() + 1);
            }
            
            const workingHours = workingDays * 8;

            // Fetch Checkins (Lateness)
            const checkins = await (prisma as any).checkins.findMany({
                where: {
                    emp_id: emp.emp_id,
                    date_key: {
                        gte: periodStart,
                        lte: periodEnd
                    }
                },
                select: { type: true, late_status: true, late_min: true, date_key: true }
            });

            const lateCheckins = checkins.filter((c: any) => c.late_status === 'late' || (c.late_min && c.late_min > 0));
            const lateTimes = lateCheckins.length;
            const lateMinutes = lateCheckins.reduce((sum: number, c: any) => sum + (c.late_min || 0), 0);
            const uniqueLateDates = new Set(lateCheckins.map((c: any) => c.date_key.toISOString()));
            const lateDays = uniqueLateDates.size;

            // Fetch Leaves
            const leaves = await (prisma as any).leave_requests.findMany({
                where: {
                    emp_id: emp.emp_id,
                    status: "approved",
                    start_date: { lte: periodEnd },
                    end_date: { gte: periodStart }
                },
                select: { leave_type_id: true, minutes: true, start_date: true, end_date: true }
            });

            let sickLeaveMins = 0;
            let businessLeaveMins = 0;
            let vacationLeaveMins = 0;

            leaves.forEach((l: any) => {
                let overlapMins = 0;
                
                const lStart = new Date(l.start_date);
                const lEnd = new Date(l.end_date);
                
                // If it's a single day, use the exact minutes (handles half-days)
                if (lStart.getTime() === lEnd.getTime()) {
                    if (lStart >= periodStart && lStart <= periodEnd) {
                        overlapMins = l.minutes;
                    }
                } else {
                    // Multi-day leave, calculate overlapping valid days
                    let current = new Date(Math.max(lStart.getTime(), periodStart.getTime()));
                    current.setHours(0,0,0,0);
                    const end = new Date(Math.min(lEnd.getTime(), periodEnd.getTime()));
                    end.setHours(0,0,0,0);
                    
                    while (current <= end) {
                        if (current.getDay() !== 0) {
                            const year = current.getFullYear();
                            const month = String(current.getMonth() + 1).padStart(2, '0');
                            const day = String(current.getDate()).padStart(2, '0');
                            const dateStr = `${year}-${month}-${day}`;
                            if (!holidayDateStrings.has(dateStr)) {
                                overlapMins += 480; // 8 hours in minutes
                            }
                        }
                        current.setDate(current.getDate() + 1);
                    }
                }

                if (l.leave_type_id === "sick" || l.leave_type_id === "ลาป่วย" || l.leave_type_id === "SICK") sickLeaveMins += overlapMins;
                else if (l.leave_type_id === "personal" || l.leave_type_id === "ลากิจ" || l.leave_type_id === "PERSONAL") businessLeaveMins += overlapMins;
                else if (l.leave_type_id === "annual" || l.leave_type_id === "ลาพักร้อน" || l.leave_type_id === "VACATION" || l.leave_type_id === "vacation") vacationLeaveMins += overlapMins;
            });

            // Convert minutes to hours
            const sickLeaveHours = Number((sickLeaveMins / 60).toFixed(2));
            const businessLeaveHours = Number((businessLeaveMins / 60).toFixed(2));
            const vacationLeaveHours = Number((vacationLeaveMins / 60).toFixed(2));
            const totalLeaveHours = sickLeaveHours + businessLeaveHours + vacationLeaveHours;

            let actualWorkingHours = workingHours - totalLeaveHours;
            if (actualWorkingHours < 0) actualWorkingHours = 0;
            const actualWorkingDays = Number((actualWorkingHours / 8).toFixed(2));

            // Fetch Warnings
            const warnings = await (prisma as any).employee_warnings.findMany({
                where: {
                    emp_id: emp.emp_id,
                    date: {
                        gte: periodStart,
                        lte: periodEnd
                    }
                }
            });
            const warningText = warnings.length > 0 ? `${warnings.length} ใบ / ${warnings.map((w: any) => w.reason).join(', ')}` : "-";

            // Formatting
            const startDateStr = emp.hire_date ? emp.hire_date.toLocaleDateString('th-TH') : "-";
            
            let probationEnd = emp.hire_date ? new Date(emp.hire_date) : null;
            if (probationEnd) {
                probationEnd.setDate(probationEnd.getDate() + 90);
            }
            const probationEndDateStr = probationEnd ? probationEnd.toLocaleDateString('th-TH') : "-";

            let company = "-";
            if (emp.emp_id?.startsWith('TG')) company = "Tera Group";
            else if (emp.emp_id?.startsWith('TE')) company = "Tera Electric";
            else if (emp.emp_id?.startsWith('TP')) company = "Tera Power";

            const row = sheet.getRow(rowIndex);
            row.values = [
                rowIndex - 2,
                company,
                emp.departments?.name || "-",
                emp.name,
                emp.nickname || "-",
                emp.job_positions?.title || "-",
                emp.departments?.divisions?.name || "-",
                startDateStr,
                calculateServiceLengthString(emp.hire_date),
                calculateServiceLengthDays(emp.hire_date),
                probationEndDateStr,
                calculateServiceLengthString(probationEnd),
                emp.base_salary ? Number(emp.base_salary) : 0,
                warningText,
                ev.grade ? `Score: ${ev.total_supervisor_score} (${ev.grade})` : "-",
                "-", // KPI File not supported
                lateTimes,
                lateMinutes,
                lateDays,
                sickLeaveHours,
                businessLeaveHours,
                vacationLeaveHours,
                totalLeaveHours,
                actualWorkingDays,
                actualWorkingHours,
                totalLeaveHours // Total leave hours requested again at the end
            ];

            // Add borders to the row
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            rowIndex++;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="KPI_Export_${new Date().getTime()}.xlsx"`,
            }
        });
    } catch (e: any) {
        console.error("[API/ADMIN/KPI/EXPORT-EXCEL] Error:", e);
        if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
            return NextResponse.json({ error: e.message }, { status: 401 });
        }
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
