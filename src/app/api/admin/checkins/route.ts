import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { Prisma } from "@prisma/client";

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
        // ✅ ต้อง await
        await requireAdmin();

        const url = new URL(req.url);
        const date = url.searchParams.get("date") || "";     // YYYY-MM-DD
        const branchParam = url.searchParams.get("branch") || ""; // อาจเป็น id หรือชื่อสาขา

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
        // - UI บางทีส่ง branch_id แต่ checkins เก็บ branch_name
        // - เพื่อกันพัง ให้รองรับทั้งส่ง "ชื่อ" มาเลย หรือส่ง "id" มา
        if (branchParam) {
            // default: ถือว่าเป็นชื่อก่อน (ไม่ต้อง query branches ก็ใช้ได้เลย)
            let branchName = branchParam;

            // ถ้าเป็น id จริง ๆ และหาเจอค่อย map เป็น name
            // (ถ้า schema branches.id เป็น String จะทำงานได้เลย)
            // (ถ้าไม่เจอ ก็ยังใช้ branchParam เป็นชื่อได้)
            try {
                const b = await prisma.branches.findUnique({
                    where: { id: branchParam as any },
                    select: { name: true },
                });
                if (b?.name) branchName = b.name;
            } catch {
                // ignore: ถ้า id type ไม่ตรง/หาไม่ได้ ก็ใช้ branchParam เป็นชื่อสาขาแทน
            }

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
            },
        });

        const list = rows.map((r) => ({
            ...r,
            late_label: lateLabel(r.late_status, r.late_min),
        }));

        return NextResponse.json(jsonSafe({ ok: true, list }));
    } catch (e: any) {
        // ✅ ดัก Prisma ให้เห็นสาเหตุจริงใน response
        let msg = e instanceof Error ? e.message : "ERROR";
        let detail: any = undefined;

        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            detail = { prisma: "KnownRequestError", code: e.code, meta: e.meta };
            msg = `PRISMA_${e.code}`;
        } else if (e instanceof Prisma.PrismaClientValidationError) {
            detail = { prisma: "ValidationError" };
            msg = "PRISMA_VALIDATION_ERROR";
        } else if (e instanceof Prisma.PrismaClientInitializationError) {
            detail = { prisma: "InitializationError" };
            msg = "PRISMA_INIT_ERROR";
        }

        console.error("checkins error:", e);

        const status =
            msg === "UNAUTHORIZED" ? 401 :
                msg === "FORBIDDEN" ? 403 :
                    500;

        // ✅ ส่ง detail ออกไปให้ดูใน Network → Response (แก้จบได้เร็ว)
        return NextResponse.json(jsonSafe({ ok: false, error: msg, detail }), { status });
    }
}