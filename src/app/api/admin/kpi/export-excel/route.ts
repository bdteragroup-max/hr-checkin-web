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
        const sessionParam = url.searchParams.get('session');
        const startDateParam = url.searchParams.get('startDate');
        const endDateParam = url.searchParams.get('endDate');
        const probationStartDateParam = url.searchParams.get('probationStartDate');
        const probationEndDateParam = url.searchParams.get('probationEndDate');
        const evalYear = yearParam ? parseInt(yearParam) : new Date().getFullYear();
        
        // 1. Fetch All Active Employees (Excluding Interns and Probationary)
        const employees = await prisma.employees.findMany({
            where: { 
                is_active: true,
                is_on_trial: false,
                NOT: {
                    job_positions: {
                        title: { contains: "นักศึกษาฝึกงาน" }
                    }
                }
            },
            include: {
                departments: { include: { divisions: true } },
                job_positions: true,
            },
            orderBy: [
                { departments: { name: 'asc' } },
                { name: 'asc' }
            ]
        });

        let filteredEmployees = employees;
        if (probationStartDateParam || probationEndDateParam) {
            filteredEmployees = employees.filter((emp: any) => {
                if (!emp.hire_date) return false;
                let probationEnd = new Date(emp.hire_date);
                probationEnd.setDate(probationEnd.getDate() + 90);
                
                let inRange = true;
                if (probationStartDateParam) {
                    const ps = new Date(probationStartDateParam);
                    ps.setHours(0,0,0,0);
                    if (probationEnd < ps) inRange = false;
                }
                if (probationEndDateParam) {
                    const pe = new Date(probationEndDateParam);
                    pe.setHours(23,59,59,999);
                    if (probationEnd > pe) inRange = false;
                }
                return inRange;
            });
        }

        // 2. Fetch Evaluations based on filter
        const whereClause: any = { category: "ANNUAL", year: evalYear };
        if (sessionParam) {
            if (sessionParam === 'Mid-Year') {
                whereClause.session_name = { contains: 'Mid-Year', mode: 'insensitive' };
            } else if (sessionParam === 'Year-End') {
                whereClause.session_name = { contains: 'Year-End', mode: 'insensitive' };
            } else {
                whereClause.session_name = sessionParam;
            }
        }

        const evaluations = await (prisma as any).kpi_evaluations.findMany({
            where: whereClause
        });
        
        // Map eval by emp_id
        const evalMap = new Map();
        evaluations.forEach((ev: any) => {
            // Keep the latest or highest score if there are duplicates
            if (!evalMap.has(ev.emp_id)) {
                evalMap.set(ev.emp_id, ev);
            }
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("KPI Evaluations");

        // Define Headers
        sheet.getRow(1).values = [
            "ลำดับ", // A: 1
            "บริษัท", // B: 2
            "รหัสพนักงาน", // C: 3
            "สังกัด", // D: 4
            "ชื่อ - นามสกุล", // E: 5
            "ชื่อเล่น", // F: 6
            "ตำแหน่ง", // G: 7
            "ฝ่าย", // H: 8
            "วันที่เริ่มงาน", // I: 9
            "อายุงานนับจากวันเริ่มงาน", // J: 10
            "อายุงานเป็นวัน", // K: 11
            "วันที่พ้นทดลองงาน", // L: 12
            "อายุงานนับจากวันพ้นทดลองงาน", // M: 13
            "ฐานเงินเดือน", // N: 14
            "ใบเตือน (กี่ใบ) / เรื่องอะไร", // O: 15
            "ผลประเมิน", // P: 16
            "รอบการประเมิน", // Q: 17
            "มาสาย", // R: 18 (Times/Minutes Late group)
            "", // S: 19
            "จำนวนวันที่มาสาย", // T: 20
            "ขาดลา", // U: 21 (Leave group)
            "", // V: 22
            "", // W: 23
            "", // X: 24
            "จำนวนวันทำงาน", // Y: 25
            "จำนวนชั่วโมงทำงาน", // Z: 26
            "จำนวนชั่วโมงที่ลางาน" // AA: 27
        ];

        // Row 2: Sub-headers
        sheet.getRow(2).values = [
            "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
            "จำนวนครั้ง", "นาที", "", // Under มาสาย (R, S), T is separated
            "ป่วย", "กิจ", "พักร้อน", "รวม", // Under ขาดลา (U, V, W, X)
            "", "", "" // Y, Z, AA
        ];

        // Merge cells for group headers
        const colsToMerge = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'T', 'Y', 'Z', 'AA'];
        colsToMerge.forEach(col => {
            sheet.mergeCells(`${col}1:${col}2`);
        });

        // Merge R1:S1 (มาสาย)
        sheet.mergeCells('R1:S1');
        // Merge U1:X1 (ขาดลา)
        sheet.mergeCells('U1:X1');

        // Style the headers
        const headerRows = [sheet.getRow(1), sheet.getRow(2)];
        headerRows.forEach(row => {
            row.eachCell(cell => {
                cell.font = { bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6E6FA' } 
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
        sheet.getColumn('D').width = 15;
        sheet.getColumn('E').width = 25;
        sheet.getColumn('F').width = 10;
        sheet.getColumn('G').width = 20;
        sheet.getColumn('H').width = 15;
        sheet.getColumn('I').width = 12;
        sheet.getColumn('J').width = 18;
        sheet.getColumn('K').width = 12;
        sheet.getColumn('L').width = 12;
        sheet.getColumn('M').width = 18;
        sheet.getColumn('N').width = 12;
        sheet.getColumn('O').width = 20;
        sheet.getColumn('P').width = 15; 
        sheet.getColumn('Q').width = 15; 
        sheet.getColumn('R').width = 10;
        sheet.getColumn('S').width = 10;
        sheet.getColumn('T').width = 10;
        sheet.getColumn('U').width = 8;
        sheet.getColumn('V').width = 8;
        sheet.getColumn('W').width = 8;
        sheet.getColumn('X').width = 8;
        sheet.getColumn('Y').width = 12;
        sheet.getColumn('Z').width = 12;
        sheet.getColumn('AA').width = 15;

        // Color specific header cells like in screenshot
        sheet.getCell('R1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }; 
        sheet.getCell('U1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } }; 
        sheet.getCell('Y1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCFE2F3' } }; 

        // Fetch all holidays for working days calculation
        const allHolidays = await (prisma as any).holidays.findMany({ select: { date: true } });
        const holidayDateStrings = new Set(allHolidays.map((h: any) => new Date(h.date).toISOString().split('T')[0]));

        // Process data
        let rowIndex = 3;

        for (const emp of filteredEmployees) {
            const ev = evalMap.get(emp.emp_id);
            
            // Determine Default Period Start/End based on session
            let periodStart = new Date(evalYear, 0, 1);
            let periodEnd = new Date(evalYear, 11, 31, 23, 59, 59);

            if (sessionParam === 'Mid-Year' || (ev && ev.session_name?.toLowerCase().includes('mid-year'))) {
                periodEnd = new Date(evalYear, 5, 30, 23, 59, 59); // June 30
            } else if (sessionParam === 'Year-End' || (ev && ev.session_name?.toLowerCase().includes('year-end'))) {
                periodStart = new Date(evalYear, 6, 1); // July 1
                periodEnd = new Date(evalYear, 11, 31, 23, 59, 59);
            }
            
            // If the DB evaluation explicitly has dates, use those instead
            if (ev?.period_start) periodStart = new Date(ev.period_start);
            if (ev?.period_end) periodEnd = new Date(ev.period_end);

            // Override with explicit date filters if provided
            if (startDateParam) {
                periodStart = new Date(startDateParam);
                periodStart.setHours(0, 0, 0, 0);
            }
            if (endDateParam) {
                periodEnd = new Date(endDateParam);
                periodEnd.setHours(23, 59, 59, 999);
            }

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
                select: { late_status: true, late_min: true, date_key: true }
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
                
                if (lStart.getTime() === lEnd.getTime()) {
                    if (lStart >= periodStart && lStart <= periodEnd) {
                        overlapMins = l.minutes;
                    }
                } else {
                    let cur = new Date(Math.max(lStart.getTime(), periodStart.getTime()));
                    cur.setHours(0,0,0,0);
                    const finish = new Date(Math.min(lEnd.getTime(), periodEnd.getTime()));
                    finish.setHours(0,0,0,0);
                    
                    while (cur <= finish) {
                        if (cur.getDay() !== 0) {
                            const y = cur.getFullYear();
                            const m = String(cur.getMonth() + 1).padStart(2, '0');
                            const d = String(cur.getDate()).padStart(2, '0');
                            if (!holidayDateStrings.has(`${y}-${m}-${d}`)) {
                                overlapMins += 480; 
                            }
                        }
                        cur.setDate(cur.getDate() + 1);
                    }
                }

                if (l.leave_type_id === "sick" || l.leave_type_id === "ลาป่วย" || l.leave_type_id === "SICK") sickLeaveMins += overlapMins;
                else if (l.leave_type_id === "personal" || l.leave_type_id === "ลากิจ" || l.leave_type_id === "PERSONAL") businessLeaveMins += overlapMins;
                else if (l.leave_type_id === "annual" || l.leave_type_id === "ลาพักร้อน" || l.leave_type_id === "VACATION" || l.leave_type_id === "vacation") vacationLeaveMins += overlapMins;
            });

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
            
            // Fallback session label if they haven't been evaluated
            const displaySessionName = ev?.session_name || (sessionParam ? sessionParam : "ยังไม่ถูกประเมิน");
            
            row.values = [
                rowIndex - 2,
                company,
                emp.emp_id,
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
                ev?.grade ? `Score: ${ev.total_supervisor_score} (${ev.grade})` : "ยังไม่ประเมิน",
                displaySessionName, 
                lateTimes,
                lateMinutes,
                lateDays,
                sickLeaveHours,
                businessLeaveHours,
                vacationLeaveHours,
                totalLeaveHours,
                actualWorkingDays,
                actualWorkingHours,
                totalLeaveHours 
            ];

            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                
                // Highlight rows that haven't been evaluated
                if (!ev?.grade) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFF2CC' } // Light yellow warning
                    };
                }
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
