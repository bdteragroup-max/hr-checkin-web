import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

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
function jsonSafe<T>(v: T): any {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(jsonSafe);
    if (v && typeof v === "object") {
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
            where: { is_active: true },
            select: { emp_id: true },
        });
        const activeEmpIds = activeEmployees.map((e) => e.emp_id);

        // 2) today's checkins for active only
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
            },
        });

        const presentSet = new Set(
            recentRows.filter((r) => r.type === "Check-in").map((r) => r.emp_id)
        );
        const present = presentSet.size;

        const lateSet = new Set(
            recentRows
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
        const onLeaveSet = new Set(onLeaveRows.map((x) => x.emp_id));
        const onLeave = onLeaveSet.size;

        const absent = Math.max(activeEmpIds.length - present - onLeave, 0);

        const recent = recentRows.map((r) => ({
            ...r,
            late_label: lateLabel(r.late_status, r.late_min),
        }));

        // ✅ ส่งออกแบบ safe กัน BigInt พัง
        return NextResponse.json(
            jsonSafe({ present, absent, late, onLeave, recent })
        );
    } catch (e) {
        console.error("dashboard error:", e); // ✅ ช่วยไล่ปัญหาในอนาคต
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}