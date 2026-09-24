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
        const onlyUnder9h = url.searchParams.get("under_9h") === "1" || url.searchParams.get("only_under_9h") === "1";
        const onlyOver9h = url.searchParams.get("over_9h") === "1" || url.searchParams.get("only_over_9h") === "1";

        const teamOnly = url.searchParams.get("team") === "1";
        const subordinateFilter: any = {};
        if (auth.isSupervisorOnly || teamOnly) {
            subordinateFilter.OR = [
                { supervisor_id: auth.emp_id },
                { secondary_supervisor_id: auth.emp_id },
                { emp_id: auth.emp_id }
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
            const empWhere: any = { emp_id };
            if (auth.isSupervisorOnly || teamOnly) {
                empWhere.AND = [subordinateFilter];
            }
            const emp = await prisma.employees.findFirst({ 
                where: empWhere
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

            processEmployeeSheet(sheet, emp_id, start, end, holidayMap, checkins, leaves, travels, onlyUnder9h, onlyOver9h);

            const buffer = await workbook.xlsx.writeBuffer();
            let filterTag = "";
            if (onlyUnder9h) filterTag = "_UNDER_9H";
            else if (onlyOver9h) filterTag = "_OVER_9H";
            const filenameTag = `${emp_id}_records${filterTag}_${periodLabel}.xlsx`;
            return new Response(buffer, {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="${filenameTag}"`,
                },
            });

        } else {
            // ================== EVERYONE EXPORT ==================
            const conditions: any[] = [];
            if (auth.isSupervisorOnly || teamOnly) {
                conditions.push(subordinateFilter);
            }
            if (status === "active") {
                conditions.push({ is_active: true });
            } else if (status === "inactive") {
                conditions.push({ is_active: false });
            } else if (status === "all") {
                // all employees
            } else {
                conditions.push({
                    OR: [
                        { is_active: true },
                        { resignation_date: { gte: start, lte: end } }
                    ]
                });
            }
            const employeeWhere: any = conditions.length > 0 ? { AND: conditions } : {};

            const emps = await prisma.employees.findMany({
                where: employeeWhere,
                select: { emp_id: true, name: true, branch_id: true, is_active: true, is_checkin_exempt: true, hire_date: true, resignation_date: true },
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
                { header: "UNDER_9H_DAYS", key: "under_9h_count", width: 16 },
                { header: "OVER_9H_DAYS", key: "over_9h_count", width: 16 },
                { header: "OVER_9H_MINUTES", key: "over_9h_mins", width: 18 },
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

            const holidayDates = new Set(Array.from(holidayMap.keys()));

            // Map approved leave dates per emp_id
            const approvedLeaveEmpDates = new Set<string>();
            for (const l of leavesAll) {
                if (l.status === "approved") {
                    let cur = new Date(l.start_date);
                    const endD = new Date(l.end_date);
                    while (cur <= endD) {
                        approvedLeaveEmpDates.add(`${l.emp_id}_${cur.toISOString().split("T")[0]}`);
                        cur.setDate(cur.getDate() + 1);
                    }
                }
            }

            const stats: Record<string, { leave_days: number, pending_leave_days: number, late_count: number, late_mins: number, present_dates: Set<string>, total_work_days: number, under_9h_count: number, over_9h_count: number, over_9h_mins: number }> = {};
            
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
                        const dStr = dt.toISOString().split("T")[0];
                        if (holidayDates.has(dStr)) continue;
                        empTotalWorkDays++;
                    }
                }

                stats[e.emp_id] = { leave_days: 0, pending_leave_days: 0, late_count: 0, late_mins: 0, present_dates: new Set(), total_work_days: empTotalWorkDays, under_9h_count: 0, over_9h_count: 0, over_9h_mins: 0 };
            }

            for (const l of leavesAll) {
                if (!stats[l.emp_id]) continue;

                let daysInPeriod = 0;
                const lStart = new Date(l.start_date);
                const lEnd = new Date(l.end_date);
                const actualStart = lStart < start ? start : lStart;
                const actualEnd = lEnd > end ? end : lEnd;

                if (actualStart <= actualEnd) {
                    for (let dt = new Date(actualStart); dt <= actualEnd; dt.setUTCDate(dt.getUTCDate() + 1)) {
                        const dStr = dt.toISOString().split("T")[0];
                        if (dt.getUTCDay() !== 0 && !holidayDates.has(dStr)) {
                            daysInPeriod++;
                        }
                    }
                }
                
                let trueLeaveDuration = l.days || 0;
                if (l.days === 1 && l.minutes > 0 && l.minutes < 480) {
                    trueLeaveDuration = 0.5;
                }

                let finalDaysToAdd = daysInPeriod;
                if (trueLeaveDuration && finalDaysToAdd > trueLeaveDuration) {
                    finalDaysToAdd = trueLeaveDuration; 
                }

                if (l.status === "approved") stats[l.emp_id].leave_days += finalDaysToAdd;
                else if (l.status === "pending") stats[l.emp_id].pending_leave_days += finalDaysToAdd;
            }

            const empDailyCheckins: Record<string, Record<string, { ins: Date[]; outs: Date[] }>> = {};

            for (const r of checkinsAll) {
                if (!stats[r.emp_id]) continue;
                const d = r.date_key.toISOString().split("T")[0];

                if (!empDailyCheckins[r.emp_id]) empDailyCheckins[r.emp_id] = {};
                if (!empDailyCheckins[r.emp_id][d]) empDailyCheckins[r.emp_id][d] = { ins: [], outs: [] };

                const isOut = r.type.toLowerCase().includes("-out") || r.type === "Check-out";
                const isIn = r.type.toLowerCase().includes("-in") || r.type === "Trip-Update";

                if (isIn) {
                    stats[r.emp_id].present_dates.add(d);
                    empDailyCheckins[r.emp_id][d].ins.push(new Date(r.timestamp));
                    if (r.late_status === "late") {
                        stats[r.emp_id].late_count += 1;
                        if (r.late_min) stats[r.emp_id].late_mins += r.late_min;
                    }
                }
                if (isOut) {
                    empDailyCheckins[r.emp_id][d].outs.push(new Date(r.timestamp));
                }
            }

            for (const e of emps) {
                if (e.is_checkin_exempt) continue;
                const empDays = empDailyCheckins[e.emp_id];
                if (!empDays) continue;

                for (const [dStr, daily] of Object.entries(empDays)) {
                    if (daily.ins.length === 0 || daily.outs.length === 0) continue;
                    const dt = new Date(dStr + "T00:00:00Z");
                    const dayOfWeek = dt.getUTCDay();
                    if (dayOfWeek < 1 || dayOfWeek > 5) continue;
                    if (holidayDates.has(dStr)) continue;
                    if (approvedLeaveEmpDates.has(`${e.emp_id}_${dStr}`)) continue;

                    const firstIn = Math.min(...daily.ins.map(t => t.getTime()));
                    const lastOut = Math.max(...daily.outs.map(t => t.getTime()));
                    const diffMinutes = Math.round((lastOut - firstIn) / 60000);

                    if (diffMinutes > 0) {
                        if (diffMinutes < 540) {
                            stats[e.emp_id].under_9h_count += 1;
                        } else if (diffMinutes > 540) {
                            stats[e.emp_id].over_9h_count += 1;
                            stats[e.emp_id].over_9h_mins += (diffMinutes - 540);
                        }
                    }
                }
            }

            const empsToExport = onlyUnder9h 
                ? emps.filter(e => (stats[e.emp_id]?.under_9h_count || 0) > 0)
                : onlyOver9h
                    ? emps.filter(e => (stats[e.emp_id]?.over_9h_count || 0) > 0)
                    : emps;

            if (onlyUnder9h) {
                summarySheet.name = "Summary (Under 9h)";
            } else if (onlyOver9h) {
                summarySheet.name = "Summary (Over 9h)";
            }

            for (const e of empsToExport) {
                const s = stats[e.emp_id];
                
                let attendedWorkDatesCount = 0;
                for (const d of s.present_dates) {
                    const dt = new Date(d + 'T00:00:00Z');
                    if (dt.getUTCDay() !== 0 && !holidayDates.has(d)) {
                        attendedWorkDatesCount++;
                    }
                }

                let absences = e.is_checkin_exempt ? 0 : s.total_work_days - attendedWorkDatesCount - s.leave_days;
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
                    under_9h_count: s.under_9h_count,
                    over_9h_count: s.over_9h_count,
                    over_9h_mins: s.over_9h_mins,
                    total_days: s.total_work_days
                });
            }

            // 2. Pre-index Checkins, Leaves, and Travels
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

            // 1.5 Consolidated Under 9h Master Log Sheet
            if (onlyUnder9h) {
                const logSheet = workbook.addWorksheet("Under 9h Master Log");
                logSheet.columns = [
                    { header: "EMP_ID", key: "emp_id", width: 14 },
                    { header: "NAME", key: "name", width: 25 },
                    { header: "BRANCH", key: "branch", width: 15 },
                    { header: "DATE", key: "date", width: 14 },
                    { header: "IN_TIME", key: "in_time", width: 12 },
                    { header: "IN_LOCATION", key: "in_loc", width: 30 },
                    { header: "OUT_TIME", key: "out_time", width: 12 },
                    { header: "OUT_LOCATION", key: "out_loc", width: 30 },
                    { header: "DURATION", key: "duration", width: 16 },
                    { header: "DEFICIT", key: "deficit", width: 16 },
                ];
                logSheet.getRow(1).font = { bold: true };
                logSheet.getRow(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFE0B2' }
                };

                for (const e of empsToExport) {
                    const empDays = empDailyCheckins[e.emp_id] || {};
                    const sortedDates = Object.keys(empDays).sort();
                    for (const dStr of sortedDates) {
                        const daily = empDays[dStr];
                        if (daily.ins.length === 0 || daily.outs.length === 0) continue;
                        const dt = new Date(dStr + "T00:00:00Z");
                        const dayOfWeek = dt.getUTCDay();
                        if (dayOfWeek < 1 || dayOfWeek > 5) continue;
                        if (holidayDates.has(dStr)) continue;
                        if (approvedLeaveEmpDates.has(`${e.emp_id}_${dStr}`)) continue;

                        const firstIn = Math.min(...daily.ins.map(t => t.getTime()));
                        const lastOut = Math.max(...daily.outs.map(t => t.getTime()));
                        const diffMinutes = Math.round((lastOut - firstIn) / 60000);

                        if (diffMinutes > 0 && diffMinutes < 540) {
                            const h = Math.floor(diffMinutes / 60);
                            const m = diffMinutes % 60;
                            const dur = `${h} ชม.${m > 0 ? ` ${m} นาที` : ""}`;
                            const deficit = `ขาด ${540 - diffMinutes} นาที`;

                            const dayCheckins = (checkinsByEmp[e.emp_id] || []).filter(c => c.date_key.toISOString().split("T")[0] === dStr);
                            const inRecs = dayCheckins.filter(c => c.type.toLowerCase().includes("-in") || c.type === "Trip-Update");
                            const outRecs = dayCheckins.filter(c => c.type.toLowerCase().includes("-out") || c.type === "Check-out");
                            const inLoc = inRecs[0]?.project_name || inRecs[0]?.remark || inRecs[0]?.branch_name || "-";
                            const outLoc = outRecs[outRecs.length - 1]?.project_name || outRecs[outRecs.length - 1]?.remark || outRecs[outRecs.length - 1]?.branch_name || "-";

                            const r = logSheet.addRow({
                                emp_id: e.emp_id,
                                name: e.name,
                                branch: e.branch_id || "-",
                                date: dStr,
                                in_time: formatTime(new Date(firstIn)),
                                in_loc: inLoc,
                                out_time: formatTime(new Date(lastOut)),
                                out_loc: outLoc,
                                duration: dur,
                                deficit: deficit
                            });
                            r.eachCell(cell => {
                                cell.fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: 'FFFFF3E0' }
                                };
                            });
                        }
                    }
                }
            }

            // 1.6 Consolidated Over 9h Master Log Sheet
            if (onlyOver9h) {
                const logSheet = workbook.addWorksheet("Over 9h Master Log");
                logSheet.columns = [
                    { header: "EMP_ID", key: "emp_id", width: 14 },
                    { header: "NAME", key: "name", width: 25 },
                    { header: "BRANCH", key: "branch", width: 15 },
                    { header: "DATE", key: "date", width: 14 },
                    { header: "IN_TIME", key: "in_time", width: 12 },
                    { header: "IN_LOCATION", key: "in_loc", width: 30 },
                    { header: "OUT_TIME", key: "out_time", width: 12 },
                    { header: "OUT_LOCATION", key: "out_loc", width: 30 },
                    { header: "DURATION", key: "duration", width: 16 },
                    { header: "EXCESS", key: "excess", width: 16 },
                ];
                logSheet.getRow(1).font = { bold: true };
                logSheet.getRow(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF3E8FF' }
                };

                for (const e of empsToExport) {
                    const empDays = empDailyCheckins[e.emp_id] || {};
                    const sortedDates = Object.keys(empDays).sort();
                    for (const dStr of sortedDates) {
                        const daily = empDays[dStr];
                        if (daily.ins.length === 0 || daily.outs.length === 0) continue;
                        const dt = new Date(dStr + "T00:00:00Z");
                        const dayOfWeek = dt.getUTCDay();
                        if (dayOfWeek < 1 || dayOfWeek > 5) continue;
                        if (holidayDates.has(dStr)) continue;
                        if (approvedLeaveEmpDates.has(`${e.emp_id}_${dStr}`)) continue;

                        const firstIn = Math.min(...daily.ins.map(t => t.getTime()));
                        const lastOut = Math.max(...daily.outs.map(t => t.getTime()));
                        const diffMinutes = Math.round((lastOut - firstIn) / 60000);

                        if (diffMinutes > 540) {
                            const h = Math.floor(diffMinutes / 60);
                            const m = diffMinutes % 60;
                            const dur = `${h} ชม.${m > 0 ? ` ${m} นาที` : ""}`;
                            const excessMins = diffMinutes - 540;
                            const exH = Math.floor(excessMins / 60);
                            const exM = excessMins % 60;
                            const excess = `เกิน ${exH > 0 ? `${exH} ชม. ` : ""}${exM} นาที`;

                            const dayCheckins = (checkinsByEmp[e.emp_id] || []).filter(c => c.date_key.toISOString().split("T")[0] === dStr);
                            const inRecs = dayCheckins.filter(c => c.type.toLowerCase().includes("-in") || c.type === "Trip-Update");
                            const outRecs = dayCheckins.filter(c => c.type.toLowerCase().includes("-out") || c.type === "Check-out");
                            const inLoc = inRecs[0]?.project_name || inRecs[0]?.remark || inRecs[0]?.branch_name || "-";
                            const outLoc = outRecs[outRecs.length - 1]?.project_name || outRecs[outRecs.length - 1]?.remark || outRecs[outRecs.length - 1]?.branch_name || "-";

                            const r = logSheet.addRow({
                                emp_id: e.emp_id,
                                name: e.name,
                                branch: e.branch_id || "-",
                                date: dStr,
                                in_time: formatTime(new Date(firstIn)),
                                in_loc: inLoc,
                                out_time: formatTime(new Date(lastOut)),
                                out_loc: outLoc,
                                duration: dur,
                                excess: excess
                            });
                            r.eachCell(cell => {
                                cell.fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: 'FFF3E8FF' }
                                };
                            });
                        }
                    }
                }
            }

            for (const e of empsToExport) {
                let sheetName = `${e.emp_id} - ${e.name}`.slice(0, 31);
                const sheet = workbook.addWorksheet(sheetName);
                
                const empCheckins = checkinsByEmp[e.emp_id] || [];
                const empLeaves = leavesByEmp[e.emp_id] || [];
                const empTravels = travelsByEmp[e.emp_id] || [];
                
                processEmployeeSheet(sheet, e.emp_id, start, end, holidayMap, empCheckins, empLeaves, empTravels, false, false);
            }

            const buffer = await workbook.xlsx.writeBuffer();
            let exportTag = "ALL_";
            if (onlyUnder9h) exportTag = "UNDER_9H_";
            else if (onlyOver9h) exportTag = "OVER_9H_";
            return new Response(buffer, {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="historical_records_${exportTag}${periodLabel}.xlsx"`,
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
    travels: any[],
    filterOnlyUnder9h: boolean = false,
    filterOnlyOver9h: boolean = false
) {
    sheet.columns = [
        { header: "DATE", key: "date", width: 15 },
        { header: "IN_TIME", key: "in_time", width: 12 },
        { header: "IN_LOCATION", key: "in_loc", width: 30 },
        { header: "OUT_TIME", key: "out_time", width: 12 },
        { header: "OUT_LOCATION", key: "out_loc", width: 30 },
        { header: "DURATION", key: "duration", width: 16 },
        { header: "UNDER_9H", key: "is_under_9h", width: 16 },
        { header: "OVER_9H", key: "is_over_9h", width: 16 },
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

        const dayCheckins = checkins.filter(c => c.date_key.toISOString().split("T")[0] === dateStr);
        const inRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-in") || c.type === "Trip-Update");
        const outRecords = dayCheckins.filter(c => c.type.toLowerCase().includes("-out") || c.type === "Check-out");

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

        let durationStr = "-";
        let isUnder9hStr = "-";
        let isOver9hStr = "-";
        if (inRecord && outRecord) {
            const diff = Math.round((outRecord.timestamp.getTime() - inRecord.timestamp.getTime()) / 60000);
            if (diff > 0) {
                const h = Math.floor(diff / 60);
                const m = diff % 60;
                durationStr = `${h} ชม.${m > 0 ? ` ${m} นาที` : ""}`;
                const dayOfWeek = dt.getUTCDay();
                const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
                if (isWeekday && !holName && !leaveData) {
                    if (diff < 540) {
                        isUnder9hStr = `ใช่ (ขาด ${540 - diff} น.)`;
                    } else if (diff > 540) {
                        const ex = diff - 540;
                        const exH = Math.floor(ex / 60);
                        const exM = ex % 60;
                        isOver9hStr = `ใช่ (+${exH > 0 ? `${exH} ชม. ` : ""}${exM} น.)`;
                    } else {
                        isUnder9hStr = "ครบ 9 ชม.";
                    }
                }
            }
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

        if (filterOnlyUnder9h && !isUnder9hStr.startsWith("ใช่")) {
            continue;
        }
        if (filterOnlyOver9h && !isOver9hStr.startsWith("ใช่")) {
            continue;
        }

        const addedRow = sheet.addRow({
            date: dateStr,
            in_time: inRecord ? formatTime(inRecord.timestamp) : "-",
            in_loc: inLocs.size > 0 ? Array.from(inLocs).join(" → ") : (inRecord ? "-" : "ไม่เช็คอิน"),
            out_time: outRecord ? formatTime(outRecord.timestamp) : "-",
            out_loc: outLocs.size > 0 ? Array.from(outLocs).join(" → ") : "-",
            duration: durationStr,
            is_under_9h: isUnder9hStr,
            is_over_9h: isOver9hStr,
            late_mins: inRecord?.late_min || 0,
            status: status,
            morning: leaveData?.morning || "-",
            afternoon: leaveData?.afternoon || "-",
            weekend: isSunday ? "YES" : "NO"
        });

        if (isUnder9hStr.startsWith("ใช่")) {
            addedRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFF3E0' }
                };
            });
        } else if (isOver9hStr.startsWith("ใช่")) {
            addedRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF3E8FF' }
                };
            });
        }
    }
}
