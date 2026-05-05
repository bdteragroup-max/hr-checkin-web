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
                status: "pending_hr",
                supervisor_approved_at: new Date(),
            },
            include: {
                employees: { select: { name: true, nickname: true, line_user_id: true } },
            },
        });

        const supervisor = await prisma.employees.findUnique({
            where: { emp_id: p.emp_id },
            select: { name: true },
        });

        // ✅ 1. Notify HR Officer
        const { sendHrLeaveNotification, sendEmployeeLeaveStatusNotification } = await import("@/utils/lineMessaging");
        const { formatName } = await import("@/utils/formatName");
        const empDisplayName = formatName(updated.employees?.name || updated.name, (updated.employees as any)?.nickname);
        
        sendHrLeaveNotification({
            id: updated.id,
            empName: empDisplayName,
            leaveType: updated.leave_type,
            startDate: updated.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
            endDate: updated.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
            minutes: updated.minutes,
            reason: updated.reason || "",
            handoverPerson: (updated as any).handover_person || "",
            supervisorName: supervisor?.name || "หัวหน้างาน",
        }).catch(console.error);

        // ✅ 2. Notify Employee (Transition to Pending HR)
        if (updated.employees?.line_user_id) {
            sendEmployeeLeaveStatusNotification(updated.employees.line_user_id, {
                empName: empDisplayName,
                leaveType: updated.leave_type,
                startDate: updated.start_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                endDate: updated.end_at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                minutes: updated.minutes,
                reason: updated.reason || "",
                handoverPerson: (updated as any).handover_person || "",
                status: "pending_hr",
                approvedBy: supervisor?.name || "หัวหน้างาน",
            }).catch(console.error);
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("team leave approve error:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
