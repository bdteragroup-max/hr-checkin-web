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
    _req: Request,
    ctx: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await requireAdmin();

        const { id } = await ctx.params;
        if (!id) return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });

        // ✅ Guard: Prevent duplicate approvals
        const existing = await prisma.leave_requests.findUnique({ where: { id }, select: { status: true } });
        if (!existing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
        if (existing.status !== "pending" && existing.status !== "pending_hr") {
            return NextResponse.json({ ok: false, error: "ALREADY_PROCESSED", current_status: existing.status }, { status: 409 });
        }

        const updated = await prisma.leave_requests.update({
            where: { id },
            data: {
                status: "approved",
                approved_by: admin.emp_id,
                approved_at: new Date(),
            },
            select: { id: true, status: true, approved_by: true, approved_at: true, emp_id: true, name: true, leave_type: true, start_at: true, end_at: true, days: true, reason: true },
        });

        // ✅ Notify employee via LINE Flex Message that HR has approved
        const employee = await prisma.employees.findUnique({
            where: { emp_id: updated.emp_id },
            select: { line_user_id: true },
        });

        if (employee?.line_user_id) {
            sendEmployeeLeaveStatusNotification(employee.line_user_id, {
                empName: updated.name,
                leaveType: updated.leave_type,
                startDate: updated.start_at.toLocaleDateString("th-TH"),
                endDate: updated.end_at.toLocaleDateString("th-TH"),
                days: updated.days,
                reason: updated.reason || "",
                status: "approved",
                approvedBy: admin.emp_id,
            }).catch(console.error);
        }

        return NextResponse.json(jsonSafe({ ok: true, updated }));
    } catch (e: any) {
        console.error("approve error:", e);
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}