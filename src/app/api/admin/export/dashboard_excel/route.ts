import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const startParam = url.searchParams.get('start');
        const endParam = url.searchParams.get('end');

        let now = new Date();
        let currentYear = now.getFullYear();
        let startOfRange = new Date(currentYear, 0, 1);
        let endOfRange = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        let activeCondition: any = {};

        if (startParam && endParam) {
            startOfRange = new Date(startParam);
            startOfRange.setHours(0, 0, 0, 0);
            endOfRange = new Date(endParam);
            endOfRange.setHours(23, 59, 59, 999);
            now = endOfRange;
            currentYear = endOfRange.getFullYear();
        }

        activeCondition = {
            AND: [
                {
                    OR: [
                        { hire_date: { lte: endOfRange } },
                        { hire_date: null }
                    ]
                },
                {
                    OR: [
                        { 
                            AND: [
                                { is_active: true },
                                { 
                                    OR: [
                                        { resignation_date: null },
                                        { resignation_date: { gt: endOfRange } }
                                    ]
                                }
                            ] 
                        },
                        {
                            AND: [
                                { is_active: false },
                                { resignation_date: { gt: endOfRange } }
                            ]
                        }
                    ]
                }
            ]
        };

        const startOfLastYear = new Date(startOfRange);
        startOfLastYear.setFullYear(startOfLastYear.getFullYear() - 1);
        const endOfLastYear = new Date(endOfRange);
        endOfLastYear.setFullYear(endOfLastYear.getFullYear() - 1);

        // --- Fetch Data (same as HR Dashboard) ---
        const totalEmployees = await prisma.employees.count({ where: activeCondition });
        const totalLastYearCondition: any = {
            AND: [
                {
                    OR: [
                        { hire_date: { lte: endOfLastYear } },
                        { hire_date: null }
                    ]
                },
                {
                    OR: [
                        { 
                            AND: [
                                { is_active: true },
                                { 
                                    OR: [
                                        { resignation_date: null },
                                        { resignation_date: { gt: endOfLastYear } }
                                    ]
                                }
                            ] 
                        },
                        {
                            AND: [
                                { is_active: false },
                                { resignation_date: { gt: endOfLastYear } }
                            ]
                        }
                    ]
                }
            ]
        };

        const totalLastYear = await prisma.employees.count({
            where: totalLastYearCondition
        });

        const permanentEmployees = await prisma.employees.count({ where: { ...activeCondition, is_on_trial: false } });
        const temporaryEmployees = await prisma.employees.count({ where: { ...activeCondition, is_on_trial: true } });

        const newEmployeesThisYear = await prisma.employees.count({ where: { hire_date: { gte: startOfRange, lte: endOfRange } } });
        const newEmployeesLastYear = await prisma.employees.count({ where: { hire_date: { gte: startOfLastYear, lte: endOfLastYear } } });

        const resignedThisYear = await prisma.employees.count({ where: { resignation_date: { gte: startOfRange, lte: endOfRange } } });
        const resignedLastYear = await prisma.employees.count({ where: { resignation_date: { gte: startOfLastYear, lte: endOfLastYear } } });

        // Departments
        const departmentsData = await prisma.departments.findMany({
            select: { name: true, _count: { select: { employees: { where: { is_active: true } } } } }
        });
        const deptChartData = departmentsData
            .map(d => ({ name: d.name, value: d._count.employees }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);

        // Gender
        const genderGrouped = await prisma.employees.groupBy({
            by: ['gender'], where: { is_active: true }, _count: { gender: true }
        });
        const genderMap: Record<string, string> = { 'M': 'ชาย', 'F': 'หญิง' };
        const genderData = genderGrouped.map(g => ({
            name: genderMap[g.gender || ''] || 'ไม่ระบุ', value: g._count.gender
        }));

        // Age
        const employeesWithBirth = await prisma.employees.findMany({
            where: { is_active: true, birth_date: { not: null } }, select: { birth_date: true }
        });
        const ageBuckets = [
            { name: '< 25 ปี', min: 0, max: 24, count: 0 },
            { name: '25-34 ปี', min: 25, max: 34, count: 0 },
            { name: '35-44 ปี', min: 35, max: 44, count: 0 },
            { name: '45-54 ปี', min: 45, max: 54, count: 0 },
            { name: '55+ ปี', min: 55, max: 999, count: 0 },
        ];
        for (const emp of employeesWithBirth) {
            if (!emp.birth_date) continue;
            const birthDate = new Date(emp.birth_date);
            let age = now.getFullYear() - birthDate.getFullYear();
            const monthDiff = now.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age--;
            for (const bucket of ageBuckets) {
                if (age >= bucket.min && age <= bucket.max) { bucket.count++; break; }
            }
        }
        const ageData = ageBuckets.map(b => ({ name: b.name, value: b.count }));

        // Turnover & New/Resigned
        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const endMonth = endOfRange.getMonth();
        const startMonth = startOfRange.getFullYear() === currentYear ? startOfRange.getMonth() : 0;

        const resignedEmployees = await prisma.employees.findMany({
            where: { resignation_date: { gte: startOfRange, lte: endOfRange } }, select: { resignation_date: true }
        });
        const newHiresThisYearData = await prisma.employees.findMany({
            where: { hire_date: { gte: startOfRange, lte: endOfRange } }, select: { hire_date: true }
        });

        const monthlyStats = [];
        for (let m = startMonth; m <= endMonth; m++) {
            const resigned = resignedEmployees.filter(e => {
                if (!e.resignation_date) return false;
                const d = new Date(e.resignation_date);
                return d.getMonth() === m && d.getFullYear() === currentYear;
            }).length;

            const newHires = newHiresThisYearData.filter(e => {
                if (!e.hire_date) return false;
                const d = new Date(e.hire_date);
                return d.getMonth() === m && d.getFullYear() === currentYear;
            }).length;

            const rate = totalEmployees > 0 ? parseFloat(((resigned / totalEmployees) * 100).toFixed(2)) : 0;
            monthlyStats.push({ month: monthNames[m], rate, resigned, newHires });
        }

        // Leave
        const approvedLeaves = await prisma.leave_requests.findMany({
            where: { status: 'approved', start_date: { gte: startOfRange, lte: endOfRange } },
            select: { leave_type: true, start_date: true, days: true, emp_id: true }
        });

        const leaveTypeSummary: Record<string, { totalDays: number, count: number, employees: Set<string> }> = {};
        for (const l of approvedLeaves) {
            if (!l.start_date) continue;
            const d = new Date(l.start_date);
            if (d.getFullYear() !== currentYear) continue;
            const m = d.getMonth();
            if (m < startMonth || m > endMonth) continue;

            const type = l.leave_type;
            if (!leaveTypeSummary[type]) leaveTypeSummary[type] = { totalDays: 0, count: 0, employees: new Set() };
            leaveTypeSummary[type].totalDays += l.days;
            leaveTypeSummary[type].count++;
            if (l.emp_id) leaveTypeSummary[type].employees.add(l.emp_id);
        }

        const totalLeaveDays = Object.values(leaveTypeSummary).reduce((sum, s) => sum + s.totalDays, 0);
        const leaveSummaryArr = Object.keys(leaveTypeSummary)
            .map(type => ({
                type,
                totalDays: parseFloat(leaveTypeSummary[type].totalDays.toFixed(1)),
                count: leaveTypeSummary[type].count,
                percentage: totalLeaveDays > 0 ? parseFloat(((leaveTypeSummary[type].totalDays / totalLeaveDays) * 100).toFixed(1)) : 0
            }))
            .sort((a, b) => b.totalDays - a.totalDays);

        // Contracts
        const onTrialEmployees = await prisma.employees.findMany({
            where: { is_active: true, is_on_trial: true },
            include: { departments: true, job_positions: true }
        });

        const expiringContracts = onTrialEmployees.map(emp => {
            let endDate = emp.probation_end_date ? new Date(emp.probation_end_date) : null;
            if (!endDate && emp.hire_date) {
                endDate = new Date(emp.hire_date);
                endDate.setMonth(endDate.getMonth() + 3);
            }
            return {
                name: emp.name,
                role: emp.job_positions?.title || 'ไม่ระบุตำแหน่ง',
                dept: emp.departments?.name || 'ไม่ระบุแผนก',
                endDateObj: endDate,
                date: endDate ? new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(endDate) : 'ไม่ระบุ'
            };
        }).sort((a, b) => {
            if (!a.endDateObj) return 1;
            if (!b.endDateObj) return -1;
            return a.endDateObj.getTime() - b.endDateObj.getTime();
        });

        // KPI
        const latestAnnualKPI = await prisma.kpi_evaluations.findFirst({
            where: { category: 'ANNUAL', status: { in: ['completed', 'APPROVED'] } },
            orderBy: { updated_at: 'desc' },
            select: { year: true, session_name: true }
        });

        const kpiWhereClause: any = {
            category: 'ANNUAL',
            status: { in: ['completed', 'APPROVED'] },
            employee: {
                is_active: true,
                is_on_trial: false
            }
        };

        if (latestAnnualKPI) {
            kpiWhereClause.year = latestAnnualKPI.year;
            if (latestAnnualKPI.session_name) {
                kpiWhereClause.session_name = latestAnnualKPI.session_name;
            }
        } else {
            kpiWhereClause.year = currentYear;
        }

        const annualKPIs = await prisma.kpi_evaluations.findMany({
            where: kpiWhereClause,
            select: { grade: true }
        });
        const kpiCounts = { 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
        let totalKpis = 0;
        for (const kpi of annualKPIs) {
            if (kpi.grade && kpiCounts[kpi.grade as keyof typeof kpiCounts] !== undefined) {
                kpiCounts[kpi.grade as keyof typeof kpiCounts]++;
                totalKpis++;
            }
        }
        const kpiPerformanceData = [
            { grade: 'ดีเยี่ยม (A)', count: kpiCounts['A'], pct: totalKpis > 0 ? ((kpiCounts['A'] / totalKpis) * 100).toFixed(1) + '%' : '0%' },
            { grade: 'ดี (B)', count: kpiCounts['B'], pct: totalKpis > 0 ? ((kpiCounts['B'] / totalKpis) * 100).toFixed(1) + '%' : '0%' },
            { grade: 'ปานกลาง (C)', count: kpiCounts['C'], pct: totalKpis > 0 ? ((kpiCounts['C'] / totalKpis) * 100).toFixed(1) + '%' : '0%' },
            { grade: 'ต้องปรับปรุง (D)', count: kpiCounts['D'], pct: totalKpis > 0 ? ((kpiCounts['D'] / totalKpis) * 100).toFixed(1) + '%' : '0%' }
        ];

        // Training
        const distinctTrainedEmployees = await prisma.employee_trainings.groupBy({
            by: ['emp_id'], where: { training_date_start: { gte: startOfRange, lte: endOfRange } }
        });
        const trainedCount = distinctTrainedEmployees.length;
        const trainingPercentage = totalEmployees > 0 ? parseFloat(((trainedCount / totalEmployees) * 100).toFixed(1)) : 0;
        const recentTrainings = await prisma.employee_trainings.findMany({
            where: { training_date_start: { gte: startOfRange, lte: endOfRange } },
            include: { employee: { select: { name: true, job_positions: { select: { title: true } }, departments: { select: { name: true } } } } },
            orderBy: { created_at: 'desc' }
        });


        // --- Generate Excel ---
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "HR System";
        workbook.created = new Date();

        const addHeader = (sheet: ExcelJS.Worksheet, headers: string[]) => {
            sheet.addRow(headers);
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        };

        // 1. Summary KPIs
        const sheetSummary = workbook.addWorksheet("Summary KPIs");
        addHeader(sheetSummary, ["รายการ", "ค่า", "เปรียบเทียบจากปีก่อน"]);
        sheetSummary.addRows([
            ["พนักงานทั้งหมด", totalEmployees, totalEmployees - totalLastYear],
            ["พนักงานประจำ", permanentEmployees, ""],
            ["พนักงานชั่วคราว / ทดลองงาน", temporaryEmployees, ""],
            ["พนักงานเข้าใหม่ (ช่วงเวลานี้)", newEmployeesThisYear, newEmployeesThisYear - newEmployeesLastYear],
            ["พนักงานลาออก (ช่วงเวลานี้)", resignedThisYear, resignedThisYear - resignedLastYear]
        ]);
        sheetSummary.getColumn(1).width = 30;
        sheetSummary.getColumn(2).width = 15;
        sheetSummary.getColumn(3).width = 25;

        // 2. Departments & Demographics
        const sheetDepts = workbook.addWorksheet("Departments & Demographics");
        addHeader(sheetDepts, ["หมวดหมู่", "กลุ่ม", "จำนวนคน"]);
        deptChartData.forEach(d => sheetDepts.addRow(["แผนก", d.name, d.value]));
        genderData.forEach(d => sheetDepts.addRow(["เพศ", d.name, d.value]));
        ageData.forEach(d => sheetDepts.addRow(["ช่วงอายุ", d.name, d.value]));
        sheetDepts.getColumn(1).width = 20;
        sheetDepts.getColumn(2).width = 30;
        sheetDepts.getColumn(3).width = 15;

        // 3. Monthly Stats
        const sheetMonthly = workbook.addWorksheet("Monthly Stats");
        addHeader(sheetMonthly, ["เดือน", "อัตรา Turnover (%)", "เข้าใหม่", "ลาออก"]);
        monthlyStats.forEach(m => sheetMonthly.addRow([m.month, m.rate, m.newHires, m.resigned]));
        sheetMonthly.getColumn(1).width = 15;
        sheetMonthly.getColumn(2).width = 20;
        sheetMonthly.getColumn(3).width = 15;
        sheetMonthly.getColumn(4).width = 15;

        // 4. Leave Summary
        const sheetLeave = workbook.addWorksheet("Leave Summary");
        addHeader(sheetLeave, ["ประเภทการลา", "จำนวนวัน", "จำนวนครั้ง", "สัดส่วน (%)"]);
        leaveSummaryArr.forEach(l => sheetLeave.addRow([l.type, l.totalDays, l.count, l.percentage]));
        sheetLeave.getColumn(1).width = 25;
        sheetLeave.getColumn(2).width = 15;
        sheetLeave.getColumn(3).width = 15;
        sheetLeave.getColumn(4).width = 15;

        // 5. Training & Contracts
        const sheetContracts = workbook.addWorksheet("Expiring Contracts");
        addHeader(sheetContracts, ["ชื่อ-สกุล", "ตำแหน่ง", "แผนก", "ครบสัญญา"]);
        expiringContracts.forEach(c => sheetContracts.addRow([c.name, c.role, c.dept, c.date]));
        sheetContracts.columns.forEach(c => { if (c) c.width = 25; });

        const sheetTrainingSummary = workbook.addWorksheet("Training Summary");
        addHeader(sheetTrainingSummary, ["รายการ", "ค่า"]);
        sheetTrainingSummary.addRows([
            ["พนักงานที่ผ่านการอบรม (คน)", trainedCount],
            ["คิดเป็นร้อยละ (%)", trainingPercentage],
            ["เป้าหมาย", "80%"]
        ]);
        sheetTrainingSummary.getColumn(1).width = 30;
        sheetTrainingSummary.getColumn(2).width = 20;

        const sheetTrainings = workbook.addWorksheet("Training Records");
        addHeader(sheetTrainings, ["ชื่อ-สกุล", "แผนก", "หลักสูตร", "วันที่", "สำเร็จ (%)", "ผล"]);
        recentTrainings.forEach(t => {
            const dateStr = t.training_date_start ? new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(t.training_date_start)) : '-';
            sheetTrainings.addRow([
                t.employee?.name || t.emp_id,
                t.employee?.departments?.name || '-',
                t.course_name,
                dateStr,
                t.completion_percentage !== null ? Number(t.completion_percentage) : '-',
                t.effectiveness_result || '-'
            ]);
        });
        sheetTrainings.columns.forEach(c => { if (c) c.width = 25; });

        // 6. Performance
        const sheetPerf = workbook.addWorksheet("Performance");
        addHeader(sheetPerf, ["ระดับผลประเมิน", "จำนวน (คน)", "สัดส่วน"]);
        kpiPerformanceData.forEach(p => sheetPerf.addRow([p.grade, p.count, p.pct]));
        sheetPerf.getColumn(1).width = 25;
        sheetPerf.getColumn(2).width = 15;
        sheetPerf.getColumn(3).width = 15;

        // Output to Buffer
        const buffer = await workbook.xlsx.writeBuffer();

        const reportName = `dashboard_export_${startParam && endParam ? `${startParam}_to_${endParam}` : 'all_time'}.xlsx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${reportName}"`,
            },
        });

    } catch (e: any) {
        console.error("Error generating dashboard excel:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
