import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { Prisma } from "@prisma/client";


export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function lateLabel(late_status: string | null, late_min: number | null) {
    if (!late_status) return null;
    if (late_status === "late") return `สาย ${late_min ?? 0} นาที`;
    if (late_status === "early") return `ออกก่อน ${late_min ?? 0} นาที`;
    if (late_status === "ontime") return "ตรงเวลา";
    if (late_status === "ot") return "OT";
    if (late_status === "absent") return "ขาดงาน";
    if (late_status === "leave") return "ลา";
    return late_status;
}

// ✅ แปลง BigInt/Date ให้ JSON ปลอดภัย (กัน 500 จาก serialize)
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
        const date = url.searchParams.get("date") || "";     // YYYY-MM-DD
        const branchParam = url.searchParams.get("branch") || ""; // id หรือชื่อสาขา
        const statusParam = url.searchParams.get("status") || "";

        // ✅ active employees only
        const activeEmpIds = (
            await prisma.employees.findMany({
                where: { is_active: true, is_checkin_exempt: false },
                select: { emp_id: true },
            })
        ).map((e) => e.emp_id);

        const where: any = { emp_id: { in: activeEmpIds } };

        // filter date by timestamp range (timestamptz)
        if (date) {
            const dayStart = new Date(`${date}T00:00:00+07:00`);
            const dayEnd = new Date(`${date}T23:59:59.999+07:00`);
            where.timestamp = { gte: dayStart, lte: dayEnd };
        }

        // filter branch:
        if (branchParam) {
            let branchName = branchParam;
            try {
                const b = await prisma.branches.findUnique({
                    where: { id: branchParam as any },
                    select: { name: true },
                });
                if (b?.name) branchName = b.name;
            } catch { }
            where.branch_name = branchName;
        }

        // 0) Fetch Leaves for this day (to use in both modes)
        let leaveMap = new Map<string, any>();
        if (date) {
            const dateObj = new Date(`${date}T00:00:00.000Z`);
            const leaves = await prisma.leave_requests.findMany({
                where: {
                    emp_id: { in: activeEmpIds },
                    status: { in: ["approved", "pending", "pending_hr"] },
                    start_date: { lte: dateObj },
                    end_date: { gte: dateObj },
                },
                select: {
                    emp_id: true,
                    leave_type: true,
                    reason: true,
                    status: true,
                }
            });
            leaves.forEach(l => leaveMap.set(l.emp_id, l));
        }

        // 🔴 ABSENT or LEAVE MODE
        if (statusParam === "absent" || statusParam === "leave") {
            const now = new Date();
            const todayStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
            const dayStart = date ? new Date(`${date}T00:00:00+07:00`) : new Date(`${todayStr}T00:00:00+07:00`);
            const dayEnd = date ? new Date(`${date}T23:59:59.999+07:00`) : new Date(`${todayStr}T23:59:59.999+07:00`);

            // Get all check-ins for the day (any type means they are not absent)
            const checkinsToday = await prisma.checkins.findMany({
                where: {
                    timestamp: { gte: dayStart, lte: dayEnd }
                },
                select: { emp_id: true }
            });

            const checkedInSet = new Set(checkinsToday.map(c => c.emp_id));

            // Get all active employees
            const activeEmployees = await prisma.employees.findMany({
                where: {
                    is_active: true,
                    is_checkin_exempt: false,
                    ...(branchParam ? { branch_id: branchParam as any } : {})
                },
                select: {
                    emp_id: true,
                    name: true,
                    branches: { select: { name: true } },
                },
                orderBy: { emp_id: "asc" }
            });

            const missing = activeEmployees
                .filter(emp => !checkedInSet.has(emp.emp_id))
                .map(emp => {
                    const leave = leaveMap.get(emp.emp_id);
                    // Use the date string directly to avoid UTC day-shift in front-end display
                    const virtualTimestamp = date ? `${date}T00:00:00.000Z` : dayStart.toISOString();

                    return {
                        id: `abs-${emp.emp_id}-${date}`,
                        emp_id: emp.emp_id,
                        name: emp.name,
                        type: leave ? "ลา" : "ขาดงาน",
                        timestamp: virtualTimestamp,
                        branch_name: emp.branches?.name || "ไม่ระบุสาขา",
                        distance: null,
                        photo_url: null,
                        project_name: null,
                        remark: leave 
                            ? `ลา: ${leave.leave_type}${leave.status === 'pending' ? ' (รออนุมัติ)' : ''} ${leave.reason ? ' - ' + leave.reason : ''}`
                            : "ไม่มีบันทึกเข้างาน",
                        late_status: leave ? "leave" : "absent",
                        late_min: null,
                        lat: null,
                        lon: null,
                    };
                })
                .filter(row => {
                    if (statusParam === "leave") return row.late_status === "leave";
                    return true; // if absent, show both as per previous agreement "show leave as absent"
                });

            return NextResponse.json(
                jsonSafe({
                    ok: true,
                    list: missing.map((r) => ({
                        ...r,
                        late_label: lateLabel(r.late_status, null),
                    })),
                })
            );
        }

        // 🟢 NORMAL LOG MODE
        const rows = await prisma.checkins.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: 5000,
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

        // If a date is selected and no specific status filter, include people on leave who haven't checked in
        let mergedRows = [...rows];

        // --- RE-IMPLEMENTING MERGE LOGIC ---
        // I will re-fetch leaves with employee names to make merging easier.
        const leavesWithNames = date ? await prisma.leave_requests.findMany({
            where: {
                emp_id: { in: activeEmpIds },
                status: { in: ["approved", "pending", "pending_hr"] },
                start_date: { lte: new Date(`${date}T00:00:00.000Z`) },
                end_date: { gte: new Date(`${date}T00:00:00.000Z`) },
            },
            select: {
                emp_id: true,
                name: true,
                leave_type: true,
                reason: true,
                status: true,
                employees: { select: { branches: { select: { name: true } } } }
            }
        }) : [];

        if (date && !statusParam) {
            const checkedInSet = new Set(rows.map(r => r.emp_id));
            const virtualTimestamp = `${date}T00:00:00.000Z`;

            leavesWithNames.forEach(l => {
                if (!checkedInSet.has(l.emp_id)) {
                    mergedRows.push({
                        id: `alt-${l.emp_id}-${date}` as any, // virtual id
                        emp_id: l.emp_id,
                        name: l.name,
                        type: "ลา",
                        timestamp: virtualTimestamp as any,
                        branch_name: l.employees?.branches?.name || "ไม่ระบุสาขา",
                        distance: null as any,
                        photo_url: null,
                        project_name: null,
                        remark: `ลา: ${l.leave_type}${l.status === 'pending' ? ' (รออนุมัติ)' : ''} ${l.reason ? ' - ' + l.reason : ''}`,
                        late_status: "leave",
                        late_min: null as any,
                        lat: null as any,
                        lon: null as any,
                    } as any);
                }
            });
        }

        return NextResponse.json(
            jsonSafe({
                ok: true,
                list: mergedRows.map((r) => ({
                    ...r,
                    late_label: lateLabel(r.late_status, r.late_min),
                })),
            })
        );
    } catch (e: any) {
        console.error("Checkins API Error:", e);
        return NextResponse.json(
            { ok: false, error: "FAILED", details: e.message },
            { status: 500 }
        );
    }
}