import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";


export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function todayISO_BKK() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
}

function lateLabel(late_status: string | null, late_min: number | null) {
    if (!late_status) return null;
    if (late_status === "late") return `สาย ${late_min ?? 0} นาที`;
    if (late_status === "early") return `ออกก่อน ${late_min ?? 0} นาที`;
    if (late_status === "ontime") return "ตรงเวลา";
    if (late_status === "ot") return "OT";
    return late_status;
}


// ✅ แปลง BigInt ให้เป็น string แบบ recursive (กันพังทุกเคส)
function jsonSafe(v: any): any {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(jsonSafe);
    if (v && typeof v === "object") {
        // Special case for Prisma Decimal (Decimal.js)
        if (typeof v.toNumber === "function") return v.toNumber();
        const out: any = {};
        for (const [k, val] of Object.entries(v as any)) out[k] = jsonSafe(val);
        return out;
    }
    return v;
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const date = url.searchParams.get("date") || todayISO_BKK();

        const dayStart = new Date(`${date}T00:00:00+07:00`);
        const dayEnd = new Date(`${date}T23:59:59.999+07:00`);

        // 1) active employees base
        const activeEmployees = await prisma.employees.findMany({
            where: { is_active: true, is_checkin_exempt: false },
            select: { emp_id: true, name: true, nickname: true },
        });
        const activeEmpIds = activeEmployees.map((e) => e.emp_id);
        const nicknameMap = new Map(activeEmployees.map(e => [e.emp_id, e.nickname]));
        const nameMap = new Map(activeEmployees.map(e => [e.emp_id, e.name]));

        // 2) Fetch ALL check-ins for this day to calculate accurate counters
        const allDayCheckins = await prisma.checkins.findMany({
            where: {
                emp_id: { in: activeEmpIds },
                timestamp: { gte: dayStart, lte: dayEnd },
            },
            select: { emp_id: true, type: true, late_status: true, timestamp: true },
        });

        // 3) recentRows for the UI feed only (limit 40)
        const recentRows = await prisma.checkins.findMany({
            where: {
                emp_id: { in: activeEmpIds },
                timestamp: { gte: dayStart, lte: dayEnd },
            },
            orderBy: { timestamp: "desc" },
            take: 40,
            select: {
                id: true,
                emp_id: true,
                name: true,
                type: true,
                timestamp: true,
                branch_name: true,
                distance: true,
                photo_url: true,
                project_name: true,
                remark: true,
                late_status: true,
                late_min: true,
                lat: true,
                lon: true,
            },
        });

        // 4) Calculate Stats from allDayCheckins (not truncated recentRows)
        const presentSet = new Set(
            allDayCheckins.filter((r) => ["Check-in", "Project-In", "Offsite-In"].includes(r.type)).map((r) => r.emp_id)
        );
        const present = presentSet.size;

        const lateSet = new Set(
            allDayCheckins
                .filter((r) => r.type === "Check-in" && r.late_status === "late")
                .map((r) => r.emp_id)
        );
        const late = lateSet.size;

        // leave_requests.start_date/end_date เป็น @db.Date
        const dateObj = new Date(`${date}T00:00:00.000Z`);
        const onLeaveRows = await prisma.leave_requests.findMany({
            where: {
                emp_id: { in: activeEmpIds },
                status: "approved",
                start_date: { lte: dateObj },
                end_date: { gte: dateObj },
            },
            select: { emp_id: true },
        });
        const onLeaveSet = new Set(onLeaveRows.map((r) => r.emp_id));
        const onLeave = onLeaveSet.size;

        const [travelRows, holiday] = await Promise.all([
            prisma.travel_claims.findMany({
                where: {
                    emp_id: { in: activeEmpIds },
                    status: "approved",
                    date: { lte: dateObj },
                    OR: [
                        { end_date: { gte: dateObj } },
                        { end_date: null, date: { gte: dateObj } }
                    ]
                },
                select: { emp_id: true },
            }),
            prisma.holidays.findFirst({
                where: { date: dateObj }
            })
        ]);
        const onTravel = new Set(travelRows.map((r) => r.emp_id)).size;

        const absent = activeEmpIds.length - present - onLeave - onTravel;

        // 5) Calculate employees who worked less than 9 hours (Monday-Friday only)
        const [dy, dm, dd] = date.split("-").map(Number);
        const dayOfWeek = new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        const isHoliday = Boolean(holiday);

        const empCheckinMap: Record<string, { ins: Date[]; outs: Date[] }> = {};
        for (const c of allDayCheckins) {
            if (!empCheckinMap[c.emp_id]) {
                empCheckinMap[c.emp_id] = { ins: [], outs: [] };
            }
            const isOut = c.type.toLowerCase().includes("-out") || c.type === "Check-out";
            const isIn = c.type.toLowerCase().includes("-in") || c.type === "Trip-Update";
            if (isIn) empCheckinMap[c.emp_id].ins.push(new Date(c.timestamp));
            if (isOut) empCheckinMap[c.emp_id].outs.push(new Date(c.timestamp));
        }

        const under9HoursList: any[] = [];
        if (isWeekday && !isHoliday) {
            for (const [empId, times] of Object.entries(empCheckinMap)) {
                if (onLeaveSet.has(empId)) continue;
                if (times.ins.length > 0 && times.outs.length > 0) {
                    const firstIn = new Date(Math.min(...times.ins.map(t => t.getTime())));
                    const lastOut = new Date(Math.max(...times.outs.map(t => t.getTime())));
                    const diffMins = Math.round((lastOut.getTime() - firstIn.getTime()) / 60000);

                    if (diffMins > 0 && diffMins < 540) {
                        const h = Math.floor(diffMins / 60);
                        const m = diffMins % 60;
                        const nickname = nicknameMap.get(empId);
                        let finalName = nameMap.get(empId) || empId;
                        if (nickname && !finalName.includes(`(${nickname})`)) {
                            finalName = `${finalName} (${nickname})`;
                        }

                        under9HoursList.push({
                            emp_id: empId,
                            name: finalName,
                            in_time: firstIn.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }),
                            out_time: lastOut.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }),
                            duration_mins: diffMins,
                            duration_display: `${h} ชม.${m > 0 ? ` ${m} นาที` : ""}`,
                            diff_mins: 540 - diffMins,
                        });
                    }
                }
            }
        }

        return NextResponse.json(
            jsonSafe({
                ok: true,
                present,
                absent: Math.max(0, absent),
                late,
                onLeave,
                onTravel,
                under9Hours: under9HoursList.length,
                under9HoursList,
                recent: recentRows.map((r) => {
                    const nickname = nicknameMap.get(r.emp_id);
                    let finalName = r.name || "";
                    if (nickname && !finalName.includes(`(${nickname})`)) {
                        finalName = `${finalName} (${nickname})`;
                    }
                    return {
                        ...r,
                        name: finalName,
                        late_label: lateLabel(r.late_status, r.late_min),
                    };
                }),
            })
        );
    } catch (error: any) {
        console.error("Dashboard API Error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}