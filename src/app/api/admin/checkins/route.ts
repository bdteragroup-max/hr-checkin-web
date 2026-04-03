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

        // 🔴 ABSENT MODE
        if (statusParam === "absent") {
            const dayStart = date ? new Date(`${date}T00:00:00+07:00`) : new Date(new Date().setHours(0,0,0,0));
            const dayEnd = date ? new Date(`${date}T23:59:59.999+07:00`) : new Date(new Date().setHours(23,59,59,999));

            // Get all check-ins for the day (any type means they are not absent)
            const checkinsToday = await prisma.checkins.findMany({
                where: {
                    timestamp: { gte: dayStart, lte: dayEnd }
                },
                select: { emp_id: true }
            });

            const checkedInSet = new Set(checkinsToday.map(c => c.emp_id));

            // Get all active employees who haven't checked in
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
                .map(emp => ({
                    id: Math.random().toString(36).substring(7),
                    emp_id: emp.emp_id,
                    name: emp.name,
                    type: "ขาดงาน",
                    timestamp: dayStart.toISOString(), // proxy timestamp
                    branch_name: emp.branches?.name || "ไม่ระบุสาขา",
                    distance: null,
                    photo_url: null,
                    project_name: null,
                    remark: "ไม่มีบันทึกเข้างาน",
                    late_status: "absent",
                    late_min: null,
                    lat: null,
                    lon: null,
                }));

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

        return NextResponse.json(
            jsonSafe({
                ok: true,
                list: rows.map((r) => ({
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