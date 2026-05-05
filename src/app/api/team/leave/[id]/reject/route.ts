import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const runtime = "nodejs";

type TokenPayload = { emp_id: string; role: "employee" | "admin" };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        let p: TokenPayload;
        try {
            p = verifyToken(token) as TokenPayload;
        } catch {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        const { id } = await params;
        if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

        const body = await req.json().catch(() => ({}));
        const rejectReason = body.reason ? String(body.reason).trim() : null;

        const leave = await prisma.leave_requests.findUnique({ where: { id } });
        if (!leave) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        if (leave.supervisor_id !== p.emp_id) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        if (leave.status !== "pending_supervisor") {
            return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
        }

        const updated = await prisma.leave_requests.update({
            where: { id },
            data: {
                status: "rejected",
                supervisor_approved_at: new Date(),
                // Append supervisor reject reason to main reason for HR visibility
                reason: rejectReason ? `${leave.reason || ""} (หัวหน้าไม่อนุมัติ: ${rejectReason})`.trim() : `${leave.reason || ""} (หัวหน้าไม่อนุมัติ)`,
            },
            include: {
                employees: { select: { name: true, nickname: true, line_user_id: true } },
            },
        });

        // ✅ Notify Employee
        if (updated.employees?.line_user_id) {
            const { sendEmployeeLeaveStatusNotification } = await import("@/utils/lineMessaging");
            const { formatName } = await import("@/utils/formatName");
            
            const supervisor = await prisma.employees.findUnique({
                where: { emp_id: p.emp_id },
                select: { name: true },
            });

            sendEmployeeLeaveStatusNotification(updated.employees.line_user_id, {
                empName: formatName(updated.employees.name, (updated.employees as any).nickname),
                leaveType: updated.leave_type,
                startDate: updated.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                endDate: updated.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                minutes: updated.minutes,
                reason: updated.reason || "",
                handoverPerson: (updated as any).handover_person || "",
                status: "rejected",
                approvedBy: supervisor?.name || "หัวหน้างาน",
                rejectionReason: rejectReason || "หัวหน้างานไม่อนุมัติ",
            }).catch(console.error);
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("team leave reject error:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
