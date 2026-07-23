import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor } from "@/lib/adminAuth";
import { adjustCheckinsForLeaves } from "@/utils/checkin";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function formatTime(d: Date) {
    return d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
}

export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrSupervisor();

        const url = new URL(req.url);
        const startMonth = url.searchParams.get("start_month");
        const endMonth = url.searchParams.get("end_month");
        const paramStartDate = url.searchParams.get("start_date");
        const paramEndDate = url.searchParams.get("end_date");
        const emp_id = url.searchParams.get("emp_id");
        const status = url.searchParams.get("status");

        const teamOnly = url.searchParams.get("team") === "1";
        const subordinateFilter: any = {};
        if (auth.isSupervisorOnly || teamOnly) {
            subordinateFilter.OR = [
                { supervisor_id: auth.emp_id },
                { secondary_supervisor_id: auth.emp_id }
            ];
        }

        let start: Date;
        let end: Date;
        let periodLabel = "";

        if (paramStartDate && paramEndDate) {
            const [sy, sm, sd] = paramStartDate.split("-").map(Number);
            const [ey, em, ed] = paramEndDate.split("-").map(Number);
            start = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0));
            end = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
            periodLabel = `${paramStartDate}_to_${paramEndDate}`;
        } else if (startMonth && endMonth) {
            const [sy, sm] = startMonth.split("-").map(Number);
            const [ey, em] = endMonth.split("-").map(Number);
            start = new Date(Date.UTC(sy, sm - 1, 1, 0, 0, 0));
            end = new Date(Date.UTC(ey, em, 0, 23, 59, 59, 999));
            periodLabel = `${startMonth}_to_${endMonth}`;
        } else {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        const workbook = new ExcelJS.Workbook();

        const holidays = await prisma.holidays.findMany({
            where: { date: { gte: start, lte: end } }
        });
        const holidayMap = new Map<string, string>();
        holidays.forEach(h => holidayMap.set(h.date.toISOString().split("T")[0], h.name));

        if (emp_id) {
            // ================== INDIVIDUAL EXPORT ==================
            const emp = await prisma.employees.findUnique({ 
                where: { 
                    emp_id,
                    ...subordinateFilter
                } as any
            });
            if (!emp) return NextResponse.json({ ok: false, error: "EMP_NOT_FOUND" }, { status: 404 });

            const sheet = workbook.addWorksheet("Attendance Details");
            let checkins = await prisma.checkins.findMany({
                where: { emp_id, timestamp: { gte: start, lte: end } },
                orderBy: { timestamp: "asc" },
            });
            const leaves = await prisma.leave_requests.findMany({
                where: { emp_id, start_date: { lte: end }, end_date: { gte: start } },
            });
            checkins = adjustCheckinsForLeaves(checkins, leaves);
            const travels = await prisma.travel_claims.findMany({
                where: { 
                    emp_id, 
                    status: "approved", 
                    date: { lte: end }, 
                    OR: [
                        { end_date: { gte: start } },
                        { end_date: null, date: { gte: start } }
                    ]
                },
            });

            processEmployeeSheet(sheet, emp_id, start, end, holidayMap, checkins, leaves, travels);

            const buffer = await workbook.xlsx.writeBuffer();
            return new Response(buffer, {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="${emp_id}_records_${periodLabel}.xlsx"`,
                },
            });

        } else {
            // ================== EVERYONE EXPORT ==================
            const employeeWhere: any = {
                is_checkin_exempt: false,
                ...subordinateFilter,
            };
            if (status === "active") {
                employeeWhere.is_active = true;
            } else if (status === "inactive") {
                employeeWhere.is_active = false;
            } else {
                employeeWhere.OR = [
                    { is_active: true },
                    { resignation_date: { gte: start, lte: end } }
                ];
            }

            const emps = await prisma.employees.findMany({
                where: employeeWhere,
                select: { emp_id: true, name: true, branch_id: true, is_active: true, hire_date: true, resignation_date: true },
                orderBy: { emp_id: "asc" },
            });

            const empIds = emps.map(e => e.emp_id);
            
            // 1. Summary Sheet
            const summarySheet = workbook.addWorksheet("Summary Report");
            summarySheet.columns = [
                { header: "EMP_ID", key: "emp_id", width: 15 },
                { header: "NAME", key: "name", width: 25 },
                { header: "BRANCH", key: "branch", width: 15 },
                { header: "STATUS", key: "status", width: 15 },
                { header: "PRESENT_DAYS", key: "present", width: 15 },
                { header: "ABSENT_DAYS", key: "absent", width: 15 },
                { header: "APPROVED_LEAVES", key: "leave", width: 15 },
                { header: "PENDING_LEAVES", key: "pending", width: 15 },
                { header: "LATE_TIMES", key: "late_count", width: 15 },
                { header: "LATE_MINUTES", key: "late_mins", width: 15 },
                { header: "TOTAL_WORK_DAYS", key: "total_days", width: 15 },
            ];
            summarySheet.getRow(1).font = { bold: true };

            let checkinsAll = await prisma.checkins.findMany({
                where: { emp_id: { in: empIds }, timestamp: { gte: start, lte: end } },
                orderBy: { timestamp: "asc" },
            });

            const leavesAll = await prisma.leave_requests.findMany({
                where: { emp_id: { in: empIds }, start_date: { lte: end }, end_date: { gte: start } },
            });

            checkinsAll = adjustCheckinsForLeaves(checkinsAll, leavesAll);

            const travelsAll = await prisma.travel_claims.findMany({
                where: { 
                    emp_id: { in: empIds }, 
                    status: "approved", 
                    date: { lte: end }, 
                    OR: [
                        { end_date: { gte: start } },
                        { end_date: null, date: { gte: start } }
                    ]
                },
            });

            // const holidayDates = new Set(Array.from(holidayMap.keys()));

            const stats: Record<string, { leave_days: number, pending_leave_days: number, late_count: number, late_mins: number, present_dates: Set<string>, total_work_days: number }> = {};
            
            for (const e of emps) {
                let empStartDate = start;
                if (e.hire_date && e.hire_date > start) {
                    empStartDate = e.hire_date;
                }
                
                let empEndDate = end;
                if (e.resignation_date && e.resignation_date < end) {
                    empEndDate = e.resignation_date;
                }

                let empTotalWorkDays = 0;
                if (empStartDate <= empEndDate) {
                    for (let dt = new Date(empStartDate); dt <= empEndDate; dt.setUTCDate(dt.getUTCDate() + 1)) {
                        if (dt.getUTCDay() === 0) continue;
                        empTotalWorkDays++;
                    }
                }

                stats[e.emp_id] = { leave_days: 0, pending_leave_days: 0, late_count: 0, late_mins: 0, present_dates: new Set(), total_work_days: empTotalWorkDays };
            }

            for (const l of leavesAll) {
                if (!stats[l.emp_id]) continue;
                if (l.status === "approved") stats[l.emp_id].leave_days += l.days || 0;
                else if (l.status === "pending") stats[l.emp_id].pending_leave_days += l.days || 0;
            }

            for (const r of checkinsAll) {
                if (!stats[r.emp_id]) continue;
                const d = new Date(r.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
                if (r.type === "Check-in" || r.type === "Project-In" || r.type === "Offsite-In") {
                    stats[r.emp_id].present_dates.add(d);
                    if (r.late_status === "late") {
                        stats[r.emp_id].late_count += 1;
                        if (r.late_min) stats[r.emp_id].late_mins += r.late_min;
                    }
                }
            }

            for (const e of emps) {
                const s = stats[e.emp_id];
                let absences = s.total_work_days - s.present_dates.size - s.leave_days;
                if (absences < 0) absences = 0;

                summarySheet.addRow({
                    emp_id: e.emp_id,
                    name: e.name,
                    branch: e.branch_id || "-",
                    status: e.is_active ? "Active" : "Inactive",
                    present: s.present_dates.size,
                    absent: absences,
                    leave: s.leave_days,
                    pending: s.pending_leave_days,
                    late_count: s.late_count,
                    late_mins: s.late_mins,
                    total_days: s.total_work_days
                });
            }

            // 2. Individual Sheets
            const checkinsByEmp = checkinsAll.reduce((acc, curr) => {
                acc[curr.emp_id] = acc[curr.emp_id] || [];
                acc[curr.emp_id].push(curr);
                return acc;
            }, {} as Record<string, any[]>);

            const leavesByEmp = leavesAll.reduce((acc, curr) => {
                acc[curr.emp_id] = acc[curr.emp_id] || [];
                acc[curr.emp_id].push(curr);
                return acc;
            }, {} as Record<string, any[]>);

            const travelsByEmp = travelsAll.reduce((acc, curr) => {
                acc[curr.emp_id] = acc[curr.emp_id] || [];
                acc[curr.emp_id].push(curr);
                return acc;
            }, {} as Record<string, any[]>);

            for (const e of emps) {
                let sheetName = `${e.emp_id} - ${e.name}`.slice(0, 31);
                const sheet = workbook.addWorksheet(sheetName);
                
                const empCheckins = checkinsByEmp[e.emp_id] || [];
                const empLeaves = leavesByEmp[e.emp_id] || [];
                const empTravels = travelsByEmp[e.emp_id] || [];
                
                processEmployeeSheet(sheet, e.emp_id, start, end, holidayMap, empCheckins, empLeaves, empTravels);
            }

            const buffer = await workbook.xlsx.writeBuffer();
            return new Response(buffer, {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="historical_records_ALL_${periodLabel}.xlsx"`,
                },
            });
        }

    } catch (e: any) {
        console.error("EXPORT EXCEL ERROR:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}

function processEmployeeSheet(
    sheet: ExcelJS.Worksheet, 
    emp_id: string, 
    start: Date, 
    end: Date, 
    holidayMap: Map<string, string>,
    checkins: any[],
    leaves: any[],
    travels: any[]
) {
    sheet.columns = [
        { header: "DATE", key: "date", width: 15 },
        { header: "IN_TIME", key: "in_time", width: 12 },
        { header: "IN_LOCATION", key: "in_loc", width: 30 },
        { header: "OUT_TIME", key: "out_time", width: 12 },
        { header: "OUT_LOCATION", key: "out_loc", width: 30 },
        { header: "LATE_MINS", key: "late_mins", width: 12 },
        { header: "STATUS", key: "status", width: 25 },
        { header: "MORNING", key: "morning", width: 15 },
        { header: "AFTERNOON", key: "afternoon", width: 15 },
        { header: "WEEKEND", key: "weekend", width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };

    const leaveDaysMap = new Map<string, { type: string, morning: string, afternoon: string }>();
    leaves.forEach((l: any) => {
        if (l.status !== "approved") return;
        let cur = new Date(l.start_date);
        const endD = new Date(l.end_date);
        while (cur <= endD) {
            let leaveTypeStr = l.leave_type;
            let morning = "-";
            let afternoon = "-";
            
            // A leave is considered half-day if minutes < 480 (or explicitly days === 0.5 just in case)
            if ((l.days === 0.5 || (l.days === 1 && l.minutes > 0 && l.minutes < 480)) && l.start_at) {
                const bkkHour = parseInt(new Date(l.start_at).toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", hour12: false }));
                if (bkkHour < 12) {
                    leaveTypeStr += " (ครึ่งเช้า 08:00-12:00)";
                    morning = l.leave_type;
                } else {
                    leaveTypeStr += " (ครึ่งบ่าย 13:00-17:00)";
                    afternoon = l.leave_type;
                }
            } else {
                morning = l.leave_type;
                afternoon = l.leave_type;
            }
            leaveDaysMap.set(cur.toISOString().split("T")[0], { type: leaveTypeStr, morning, afternoon });
            cur.setDate(cur.getDate() + 1);
        }
    });

    const travelDaysMap = new Set<string>();
    travels.forEach((t: any) => {
        if (t.status !== "approved") return;
        let cur = new Date(t.date);
        const endD = t.end_date ? new Date(t.end_date) : new Date(t.date);
        while (cur <= endD) {
            travelDaysMap.add(cur.toISOString().split("T")[0]);
            cur.setDate(cur.getDate() + 1);
        }
    });

    for (let dt = new Date(start); dt <= end; dt.setUTCDate(dt.getUTCDate() + 1)) {
        const dateStr = dt.toISOString().split("T")[0];
        const isSunday = dt.getUTCDay() === 0;
        const holName = holidayMap.get(dateStr);
        const leaveData = leaveDaysMap.get(dateStr);
        const isTravel = travelDaysMap.has(dateStr);

        const dayCheckins = checkins.filter(c => new Date(c.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }) === dateStr);
        const inRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-in") || c.type === "Trip-Update");
        const outRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-out") || c.type === "Check-out");

        // if (isSunday && inRecords.length === 0 && outRecords.length === 0) continue;

        let status = "ขาด";
        if (isSunday) status = "วันหยุด";
        if (holName) status = `หยุดพิเศษ (${holName})`;
        if (leaveData) status = leaveData.type;
        else if (isTravel) status = "ออกต่างจังหวัด";
        
        const inRecord = inRecords.length > 0 ? inRecords[0] : null; 
        const outRecord = outRecords.length > 0 ? outRecords[outRecords.length - 1] : null;

        if (inRecord) {
            status = inRecord.late_status === "late" ? "มาสาย" : "มาทำงาน";
            if (leaveData) {
                status += ` + ${leaveData.type}`;
            } else if (isTravel) {
                status += ` (ตจว.)`;
            }
        } else if (outRecord) {
            status = "ไม่เช็คอิน";
        }

        const inLocs = new Set<string>();
        inRecords.forEach(c => {
            const loc = c.project_name || c.remark || c.branch_name;
            if (loc) inLocs.add(loc);
        });
        const outLocs = new Set<string>();
        outRecords.forEach(c => {
            const loc = c.project_name || c.remark || c.branch_name;
            if (loc) outLocs.add(loc);
        });

        sheet.addRow({
            date: dateStr,
            in_time: inRecord ? formatTime(inRecord.timestamp) : "-",
            in_loc: inLocs.size > 0 ? Array.from(inLocs).join(" → ") : (inRecord ? "-" : "ไม่เช็คอิน"),
            out_time: outRecord ? formatTime(outRecord.timestamp) : "-",
            out_loc: outLocs.size > 0 ? Array.from(outLocs).join(" → ") : "-",
            late_mins: inRecord?.late_min || 0,
            status: status,
            morning: leaveData?.morning || "-",
            afternoon: leaveData?.afternoon || "-",
            weekend: isSunday ? "YES" : "NO"
        });
    }
}
