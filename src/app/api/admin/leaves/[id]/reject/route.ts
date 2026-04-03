import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { sendEmployeeLeaveStatusNotification } from "@/utils/lineMessaging";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

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

export async function POST(
    req: Request,
    ctx: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await requireAdmin();

        const { id } = await ctx.params;
        if (!id) return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });

        const body = await req.json().catch(() => ({} as any));
        const noteRaw = body?.reason ?? body?.note ?? null;
        const note = noteRaw ? String(noteRaw).trim() : "";

        // ✅ Guard: Prevent duplicate rejections
        const leaveBeforeUpdate = await prisma.leave_requests.findUnique({
            where: { id },
            select: { emp_id: true, name: true, leave_type: true, start_at: true, end_at: true, days: true, minutes: true, reason: true, status: true },
        });
        if (!leaveBeforeUpdate) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
        if (leaveBeforeUpdate.status !== "pending" && leaveBeforeUpdate.status !== "pending_hr") {
            return NextResponse.json({ ok: false, error: "ALREADY_PROCESSED", current_status: leaveBeforeUpdate.status }, { status: 409 });
        }

        const updated = await prisma.leave_requests.update({
            where: { id },
            data: {
                status: "rejected",
                approved_by: admin.emp_id,
                approved_at: new Date(),
                ...(note ? { reason: note } : {}),
            },
            select: { id: true, status: true, approved_by: true, approved_at: true, reason: true },
        });

        // ✅ Notify employee via LINE Flex Message that HR has rejected
        if (leaveBeforeUpdate) {
            const employee = await prisma.employees.findUnique({
                where: { emp_id: leaveBeforeUpdate.emp_id },
                select: { line_user_id: true },
            });

            if (employee?.line_user_id) {
                sendEmployeeLeaveStatusNotification(employee.line_user_id, {
                    empName: leaveBeforeUpdate.name,
                    leaveType: leaveBeforeUpdate.leave_type,
                    startDate: leaveBeforeUpdate.start_at.toLocaleDateString("th-TH"),
                    endDate: leaveBeforeUpdate.end_at.toLocaleDateString("th-TH"),
                    minutes: leaveBeforeUpdate.minutes,
                    reason: leaveBeforeUpdate.reason || "",
                    status: "rejected",
                    approvedBy: admin.emp_id,
                    rejectionReason: note || undefined,
                }).catch(console.error);
            }
        }

        return NextResponse.json(jsonSafe({ ok: true, updated }));
    } catch (e: any) {
        console.error("reject error:", e);
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json(jsonSafe({ ok: false, error: msg }), { status });
    }
}