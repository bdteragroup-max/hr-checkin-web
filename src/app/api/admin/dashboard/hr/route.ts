import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const startParam = url.searchParams.get('start');
        const endParam = url.searchParams.get('end');

        let now = new Date();
        let currentYear = now.getFullYear();
        let startOfRange = new Date(currentYear, 0, 1);
        let endOfRange = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        let activeCondition: any = { is_active: true };

        if (startParam && endParam) {
            startOfRange = new Date(startParam);
            startOfRange.setHours(0, 0, 0, 0);
            endOfRange = new Date(endParam);
            endOfRange.setHours(23, 59, 59, 999);
            now = endOfRange; // Contextual "now" is the end of the range
            currentYear = endOfRange.getFullYear();

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
                            { is_active: true },
                            { resignation_date: { gt: endOfRange } }
                        ]
                    }
                ]
            };
        }

        const startOfLastYear = new Date(startOfRange);
        startOfLastYear.setFullYear(startOfLastYear.getFullYear() - 1);
        const endOfLastYear = new Date(endOfRange);
        endOfLastYear.setFullYear(endOfLastYear.getFullYear() - 1);

        // 1. Total active employees
        const totalEmployees = await prisma.employees.count({
            where: activeCondition
        });

        const totalLastYear = await prisma.employees.count({
            where: {
                AND: [
                    {
                        OR: [
                            { hire_date: { lte: endOfLastYear } },
                            { hire_date: null }
                        ]
                    },
                    {
                        OR: [
                            { is_active: true },
                            { resignation_date: { gt: endOfLastYear } }
                        ]
                    }
                ]
            }
        });

        // 2. Permanent Employees (active, not on trial)
        const permanentEmployees = await prisma.employees.count({
            where: { ...activeCondition, is_on_trial: false }
        });

        // 3. Temporary / Probation Employees (active, on trial)
        const temporaryEmployees = await prisma.employees.count({
            where: { ...activeCondition, is_on_trial: true }
        });

        // 4. New Employees this period
        const newEmployeesThisYear = await prisma.employees.count({
            where: { hire_date: { gte: startOfRange, lte: endOfRange } }
        });

        const newEmployeesLastYear = await prisma.employees.count({
            where: { hire_date: { gte: startOfLastYear, lte: endOfLastYear } }
        });

        // 5. Resigned Employees this period
        const resignedThisYear = await prisma.employees.count({
            where: { resignation_date: { gte: startOfRange, lte: endOfRange } }
        });

        const resignedLastYear = await prisma.employees.count({
            where: { resignation_date: { gte: startOfLastYear, lte: endOfLastYear } }
        });

        // 6. Employees by Department
        const departmentsData = await prisma.departments.findMany({
            select: {
                name: true,
                _count: {
                    select: {
                        employees: { where: { is_active: true } }
                    }
                }
            }
        });

        let deptChartData = departmentsData
            .map(d => ({
                name: d.name,
                value: d._count.employees
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);

        if (deptChartData.length > 7) {
            const topDepts = deptChartData.slice(0, 7);
            const othersValue = deptChartData.slice(7).reduce((sum, d) => sum + d.value, 0);
            deptChartData = [...topDepts, { name: 'อื่นๆ', value: othersValue }];
        }

        // 7. Gender breakdown (active employees)
        const genderGrouped = await prisma.employees.groupBy({
            by: ['gender'],
            where: { is_active: true },
            _count: { gender: true }
        });

        const genderMap: Record<string, string> = { 'M': 'ชาย', 'F': 'หญิง' };
        const genderData = genderGrouped.map(g => ({
            name: genderMap[g.gender || ''] || 'ไม่ระบุ',
            value: g._count.gender
        }));

        // 8. Age range breakdown (active employees with birth_date)
        const employeesWithBirth = await prisma.employees.findMany({
            where: { is_active: true, birth_date: { not: null } },
            select: { birth_date: true }
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
            if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
                age--;
            }
            for (const bucket of ageBuckets) {
                if (age >= bucket.min && age <= bucket.max) {
                    bucket.count++;
                    break;
                }
            }
        }

        const ageData = ageBuckets.map(b => ({ name: b.name, value: b.count }));

        // 9. Monthly Turnover Rate (current year)
        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const endMonth = endOfRange.getMonth();
        const startMonth = startOfRange.getFullYear() === currentYear ? startOfRange.getMonth() : 0;

        const resignedEmployees = await prisma.employees.findMany({
            where: {
                resignation_date: { gte: startOfRange, lte: endOfRange }
            },
            select: { resignation_date: true }
        });

        const turnoverData = [];
        for (let m = startMonth; m <= endMonth; m++) {
            const resignedInMonth = resignedEmployees.filter(e => {
                if (!e.resignation_date) return false;
                const d = new Date(e.resignation_date);
                return d.getMonth() === m && d.getFullYear() === currentYear;
            }).length;

            const rate = totalEmployees > 0
                ? parseFloat(((resignedInMonth / totalEmployees) * 100).toFixed(2))
                : 0;

            turnoverData.push({ month: monthNames[m], rate, resigned: resignedInMonth });
        }

        // 10. Leave breakdown by month and type (approved, current year)
        const approvedLeaves = await prisma.leave_requests.findMany({
            where: {
                status: 'approved',
                start_date: { gte: startOfRange, lte: endOfRange }
            },
            select: { leave_type: true, start_date: true, days: true, emp_id: true }
        });

        const leaveTypesSet = new Set<string>();
        const monthlyLeaveMap: Record<number, Record<string, number>> = {};
        const leaveTypeSummary: Record<string, { totalDays: number, count: number, employees: Set<string> }> = {};
        for (let m = startMonth; m <= endMonth; m++) {
            monthlyLeaveMap[m] = {};
        }

        for (const l of approvedLeaves) {
            if (!l.start_date) continue;
            const d = new Date(l.start_date);
            if (d.getFullYear() !== currentYear) continue;
            const m = d.getMonth();
            if (m < startMonth || m > endMonth) continue;
            
            const type = l.leave_type;
            leaveTypesSet.add(type);
            
            if (!monthlyLeaveMap[m][type]) monthlyLeaveMap[m][type] = 0;
            monthlyLeaveMap[m][type] += l.days;

            // Summary per type
            if (!leaveTypeSummary[type]) leaveTypeSummary[type] = { totalDays: 0, count: 0, employees: new Set() };
            leaveTypeSummary[type].totalDays += l.days;
            leaveTypeSummary[type].count++;
            if (l.emp_id) leaveTypeSummary[type].employees.add(l.emp_id);
        }

        const uniqueLeaveTypes = Array.from(leaveTypesSet);
        const monthlyLeaveData = [];
        for (let m = startMonth; m <= endMonth; m++) {
            const dataPoint: any = { month: monthNames[m] };
            let hasAnyLeave = false;
            for (const type of uniqueLeaveTypes) {
                dataPoint[type] = monthlyLeaveMap[m][type] || 0;
                if (dataPoint[type] > 0) hasAnyLeave = true;
            }
            monthlyLeaveData.push(dataPoint);
        }

        // Total leave days for the year
        const totalLeaveDays = Object.values(leaveTypeSummary).reduce((sum, s) => sum + s.totalDays, 0);

        // Build type summary sorted by total days desc
        const leaveTypeSummaryArr = uniqueLeaveTypes
            .map(type => ({
                type,
                totalDays: parseFloat(leaveTypeSummary[type].totalDays.toFixed(1)),
                count: leaveTypeSummary[type].count,
                employees: leaveTypeSummary[type].employees.size,
                percentage: totalLeaveDays > 0
                    ? parseFloat(((leaveTypeSummary[type].totalDays / totalLeaveDays) * 100).toFixed(1))
                    : 0
            }))
            .sort((a, b) => b.totalDays - a.totalDays);

        const leaveData = {
            types: uniqueLeaveTypes,
            data: monthlyLeaveData,
            summary: leaveTypeSummaryArr,
            totalDays: parseFloat(totalLeaveDays.toFixed(1)),
            totalRequests: approvedLeaves.length
        };

        // 11. New Hires and Resignations per month (current year)
        const newHiresThisYearData = await prisma.employees.findMany({
            where: { hire_date: { gte: startOfRange, lte: endOfRange } },
            select: { hire_date: true }
        });

        const newResignedData = [];
        for (let m = startMonth; m <= endMonth; m++) {
            const newHires = newHiresThisYearData.filter(e => {
                if (!e.hire_date) return false;
                const d = new Date(e.hire_date);
                return d.getMonth() === m && d.getFullYear() === currentYear;
            }).length;

            const resigned = resignedEmployees.filter(e => {
                if (!e.resignation_date) return false;
                const d = new Date(e.resignation_date);
                return d.getMonth() === m && d.getFullYear() === currentYear;
            }).length;

            newResignedData.push({ month: monthNames[m], 'เข้าใหม่': newHires, 'ลาออก': resigned });
        }

        // 12. Expiring Contracts (probation)
        const onTrialEmployees = await prisma.employees.findMany({
            where: { is_active: true, is_on_trial: true },
            include: { departments: true, job_positions: true }
        });

        const expiringContractsRaw = onTrialEmployees.map(emp => {
            let endDate = emp.probation_end_date ? new Date(emp.probation_end_date) : null;
            if (!endDate && emp.hire_date) {
                // If the contract expires after a 3-month probationary period
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
        });

        expiringContractsRaw.sort((a, b) => {
            if (!a.endDateObj) return 1;
            if (!b.endDateObj) return -1;
            return a.endDateObj.getTime() - b.endDateObj.getTime();
        });
        const expiringContracts = expiringContractsRaw.slice(0, 5).map(({ endDateObj, ...rest }) => rest);

        // 13. KPI Performances (Annual for permanent employees)
        const annualKPIs = await prisma.kpi_evaluations.findMany({
            where: {
                category: 'ANNUAL',
                status: 'completed',
                year: currentYear,
                employee: {
                    is_active: true,
                    is_on_trial: false
                }
            },
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
            { grade: 'ดีเยี่ยม (A)', count: kpiCounts['A'], pct: totalKpis > 0 ? ((kpiCounts['A'] / totalKpis) * 100).toFixed(1) + '%' : '0%', badge: 'badgeA' },
            { grade: 'ดี (B)', count: kpiCounts['B'], pct: totalKpis > 0 ? ((kpiCounts['B'] / totalKpis) * 100).toFixed(1) + '%' : '0%', badge: 'badgeB' },
            { grade: 'ปานกลาง (C)', count: kpiCounts['C'], pct: totalKpis > 0 ? ((kpiCounts['C'] / totalKpis) * 100).toFixed(1) + '%' : '0%', badge: 'badgeC' },
            { grade: 'ต้องปรับปรุง (D)', count: kpiCounts['D'], pct: totalKpis > 0 ? ((kpiCounts['D'] / totalKpis) * 100).toFixed(1) + '%' : '0%', badge: 'badgeD' }
        ];

        // 14. Training & Development KPI (from employee_trainings table)
        const distinctTrainedEmployees = await prisma.employee_trainings.groupBy({
            by: ['emp_id'],
            where: {
                training_date_start: { gte: startOfRange, lte: endOfRange }
            }
        });
        const trainedCount = distinctTrainedEmployees.length;
        const trainingPercentage = totalEmployees > 0
            ? parseFloat(((trainedCount / totalEmployees) * 100).toFixed(1))
            : 0;

        // Recent trainings for the table
        const recentTrainings = await prisma.employee_trainings.findMany({
            where: {
                training_date_start: { gte: startOfRange, lte: endOfRange }
            },
            include: {
                employee: {
                    select: { name: true, job_positions: { select: { title: true } }, departments: { select: { name: true } } }
                }
            },
            orderBy: { created_at: 'desc' },
            take: 5
        });

        const trainingTableData = recentTrainings.map(t => ({
            name: t.employee?.name || t.emp_id,
            course: t.course_name,
            dept: t.employee?.departments?.name || '-',
            completion: t.completion_percentage ? Number(t.completion_percentage) : null,
            result: t.effectiveness_result || '-',
            date: t.training_date_start
                ? new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(t.training_date_start))
                : '-'
        }));

        return NextResponse.json({
            ok: true,
            kpis: {
                total: totalEmployees,
                totalDiff: newEmployeesThisYear - resignedThisYear,
                permanent: permanentEmployees,
                temporary: temporaryEmployees,
                newHires: newEmployeesThisYear,
                newHiresDiff: newEmployeesThisYear - newEmployeesLastYear,
                resigned: resignedThisYear,
                resignedDiff: resignedThisYear - resignedLastYear
            },
            charts: {
                deptData: deptChartData,
                genderData: genderData,
                ageData: ageData,
                turnoverData: turnoverData,
                leaveData: leaveData,
                newResignedData: newResignedData,
                expiringContracts: expiringContracts,
                performances: kpiPerformanceData,
                training: {
                    totalEmployees: totalEmployees,
                    trainedEmployees: trainedCount,
                    percentage: trainingPercentage,
                    recentTrainings: trainingTableData
                }
            }
        });
    } catch (error) {
        console.error("Error fetching HR KPIs:", error);
        return NextResponse.json({ ok: false, error: "Failed to load HR dashboard data" }, { status: 500 });
    }
}
