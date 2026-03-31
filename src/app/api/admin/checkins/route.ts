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

        // ✅ active employees only
        const activeEmpIds = (
            await prisma.employees.findMany({
                where: { is_active: true },
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