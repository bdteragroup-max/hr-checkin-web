import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        await requireAdmin();
    } catch (e) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const ots = await prisma.ot_requests.findMany({
            orderBy: { created_at: "desc" },
            include: {
                employee: {
                    select: { name: true, departments: { select: { name: true } } }
                }
            }
        });

        // Fetch supervisor names manually since there is no direct relation mapping
        const supervisorIds = [...new Set(ots.map(o => o.supervisor_id).filter(Boolean))] as string[];
        const supervisors = await prisma.employees.findMany({
            where: { emp_id: { in: supervisorIds } },
            select: { emp_id: true, name: true }
        });
        const supMap = Object.fromEntries(supervisors.map(s => [s.emp_id, s.name]));

        const resData = ots.map(o => ({
            ...o,
            supervisor_name: o.supervisor_id ? supMap[o.supervisor_id] : null
        }));

        return NextResponse.json(resData);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const adminPayload = await requireAdmin();
    const adminUser = await prisma.admins.findUnique({
        where: { username: adminPayload.emp_id },
        select: { full_name: true }
    });
    const adminName = adminUser?.full_name || adminPayload.emp_id;

    try {
        const body = await request.json();
        const { id, status, approved_hours, remark } = body;

        if (!id || !status) {
            return NextResponse.json({ ok: false, error: "Missing ID or status" }, { status: 400 });
        }

        const updateData: any = {
            status,
            supervisor_remark: remark,
            updated_at: new Date()
        };

        if (status === "approved" && approved_hours !== undefined) {
            updateData.approved_hours = Number(approved_hours);
            updateData.approved_at = new Date();
        }

        const updated = await prisma.ot_requests.update({
            where: { id: Number(id) },
            data: updateData,
            include: { employee: true }
        });

        // ✅ LINE Notification to employee
        if (updated.employee.line_user_id) {
            const { sendEmployeeOtStatusNotification } = await import("@/utils/lineMessaging");
            sendEmployeeOtStatusNotification(updated.employee.line_user_id, {
                empName: updated.employee.name,
                dateFor: updated.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                startTime: updated.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                endTime: updated.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                totalHours: Number(updated.total_hours),
                reason: updated.reason || "",
                status: status as any, // "approved" or "rejected"
                approvedBy: adminName
            }).catch(console.error);
        }

        // ✅ Notify Management if Approved
        if (status === "approved") {
            const { sendManagementOtSummary } = await import("@/utils/lineMessaging");
            const supervisor = await prisma.employees.findUnique({
                where: { emp_id: updated.supervisor_id || "" },
                select: { name: true }
            });

            sendManagementOtSummary({
                empName: updated.employee.name,
                dateFor: updated.date_for.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                startTime: updated.start_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                endTime: updated.end_time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }),
                totalHours: Number(updated.total_hours),
                reason: updated.reason || "",
                supervisorName: supervisor?.name || "ไม่ได้ระบุ",
                hrName: adminName
            }).catch(console.error);
        }

        return NextResponse.json({ ok: true, data: updated });
    } catch (e: any) {
        console.error("OT Update Error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
