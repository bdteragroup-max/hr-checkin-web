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
        const adminPayload = await requireAdmin();
        const adminUser = await prisma.admins.findUnique({
            where: { username: adminPayload.emp_id },
            select: { full_name: true }
        });
        const adminName = adminUser?.full_name || adminPayload.emp_id;

        const { id } = await ctx.params;
        if (!id) return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });

        const body = await req.json().catch(() => ({} as any));
        const noteRaw = body?.reason ?? body?.note ?? null;
        const note = noteRaw ? String(noteRaw).trim() : "";

        // ✅ Guard: Prevent duplicate rejections
        const leaveBeforeUpdate = await prisma.leave_requests.findUnique({
            where: { id },
            select: { emp_id: true, name: true, leave_type: true, start_at: true, end_at: true, days: true, minutes: true, reason: true, status: true, handover_person: true },
        });
        if (!leaveBeforeUpdate) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
        if (leaveBeforeUpdate.status !== "pending" && leaveBeforeUpdate.status !== "pending_hr" && leaveBeforeUpdate.status !== "pending_management") {
            return NextResponse.json({ ok: false, error: "ALREADY_PROCESSED", current_status: leaveBeforeUpdate.status }, { status: 409 });
        }

        const updated = await prisma.leave_requests.update({
            where: { id },
            data: {
                status: "rejected",
                approved_by: adminPayload.emp_id,
                approved_at: new Date(),
                ...(note ? { reason: note } : {}),
            },
            select: { id: true, status: true, approved_by: true, approved_at: true, reason: true },
        });

        // ✅ Notify employee via LINE Flex Message that HR has rejected
        if (leaveBeforeUpdate) {
            const employee = await prisma.employees.findUnique({
                where: { emp_id: leaveBeforeUpdate.emp_id },
                select: { line_user_id: true, nickname: true },
            });
            const { formatName } = await import("@/utils/formatName");
            const empDisplayName = formatName(leaveBeforeUpdate.name, employee?.nickname);

            if (employee?.line_user_id) {
                await sendEmployeeLeaveStatusNotification(employee.line_user_id, {
                    empName: empDisplayName,
                    leaveType: leaveBeforeUpdate.leave_type,
                    startDate: leaveBeforeUpdate.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                    endDate: leaveBeforeUpdate.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                    minutes: leaveBeforeUpdate.minutes,
                    reason: leaveBeforeUpdate.reason || "",
                    handoverPerson: (leaveBeforeUpdate as any).handover_person || "",
                    status: "rejected",
                    approvedBy: adminName,
                    rejectionReason: note || undefined,
                });
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