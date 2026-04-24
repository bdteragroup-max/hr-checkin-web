import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function getAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch (e) {
        return null;
    }
}

export async function GET() {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // TODO: Check if admin role?

    try {
        const claims = await prisma.commission_claims.findMany({
            include: {
                employee: {
                    select: { name: true, emp_id: true }
                }
            },
            orderBy: { created_at: "desc" }
        });
        return NextResponse.json({ ok: true, list: claims });
    } catch (e) {
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const admin = await prisma.admins.findUnique({ where: { username: user.emp_id } });
        let adminName = admin?.full_name;
        if (!adminName) {
            const emp = await prisma.employees.findUnique({ where: { emp_id: user.emp_id }, select: { name: true } });
            adminName = emp?.name || user.emp_id;
        }
        const { id, action, remark, selling_price } = body;

        const claim = await prisma.commission_claims.findUnique({
            where: { id },
            include: { employee: true }
        });

        if (!claim) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

        let nextStatus = claim.status;
        if (action === "approve") {
            if (claim.status === "pending_supervisor") nextStatus = "pending_admin";
            else if (claim.status === "pending_admin") nextStatus = "completed";
        } else if (action === "reject") {
            nextStatus = "rejected";
        }

        let dataToUpdate: any = {
            status: nextStatus,
            approved_by: nextStatus === "completed" ? adminName : claim.approved_by,
            approved_at: nextStatus === "completed" ? new Date() : claim.approved_at,
            supervisor_approved_at: nextStatus === "pending_admin" ? new Date() : claim.supervisor_approved_at
        };

        if (selling_price !== undefined) {
            const price = Number(selling_price) || 0;
            const totalCommission = price * 0.01;
            const perPerson = totalCommission / (claim.companion_ids.length + 1);
            dataToUpdate.selling_price = price;
            dataToUpdate.total_commission = totalCommission;
            dataToUpdate.per_person_commission = perPerson;
        }

        const updated = await prisma.commission_claims.update({
            where: { id },
            data: dataToUpdate
        });

        // Notify Employee
        if (claim.employee.line_user_id) {
            try {
                const { sendCommissionClaimNotification } = await import("@/utils/lineMessaging");
                await sendCommissionClaimNotification({
                    id: claim.id,
                    employeeName: claim.employee.name,
                    customerName: claim.customer_name,
                    date: claim.date.toLocaleDateString("th-TH"),
                    totalAmount: claim.total_commission?.toLocaleString() || "0",
                    perPerson: claim.per_person_commission?.toLocaleString() || "0",
                    status: nextStatus,
                    hideButtons: true
                }, [claim.employee.line_user_id]);
            } catch (err) {
                console.error("Employee notification error:", err);
            }
        }

        // If approved by supervisor, notify HR
        if (nextStatus === "pending_admin") {
            try {
                const { sendHrCommissionNotification } = await import("@/utils/lineMessaging");
                await sendHrCommissionNotification({
                    id: claim.id,
                    employeeName: claim.employee.name,
                    customerName: claim.customer_name,
                    date: claim.date.toLocaleDateString("th-TH"),
                    totalAmount: updated.total_commission?.toLocaleString() || "รอคำนวณ",
                    perPerson: updated.per_person_commission?.toLocaleString() || "รอคำนวณ"
                });
            } catch (err) {
                console.error("HR notification error:", err);
            }
        }

        return NextResponse.json({ ok: true, data: updated });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
