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

export async function GET(req: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const url = new URL(req.url);
        const start_date = url.searchParams.get("start_date");
        const end_date = url.searchParams.get("end_date");

        const where: any = {};
        if (start_date && end_date) {
            where.date = {
                gte: new Date(start_date),
                lte: new Date(end_date)
            };
        }

        const claims = await prisma.commission_claims.findMany({
            where,
            include: {
                employee: {
                    select: { name: true, nickname: true, emp_id: true }
                }
            },
            orderBy: { created_at: "desc" }
        });

        const formattedClaims = claims.map((c: any) => {
            const nickname = c.employee?.nickname;
            let finalName = c.employee?.name || "";
            if (nickname && !finalName.includes(`(${nickname})`)) {
                finalName = `${finalName} (${nickname})`;
            }
            return {
                ...c,
                employee: c.employee ? {
                    ...c.employee,
                    name: finalName
                } : null
            };
        });

        return NextResponse.json({ ok: true, list: formattedClaims });
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
        const { id, action, remark, per_person_commission } = body;

        const claim = await prisma.commission_claims.findUnique({
            where: { id },
            include: { employee: { select: { name: true, nickname: true, line_user_id: true } } }
        });
        if (!claim) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

        const { formatName } = await import("@/utils/formatName");
        const empDisplayName = formatName(claim.employee.name, (claim.employee as any).nickname);

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

        if (per_person_commission !== undefined) {
            const perPerson = Number(per_person_commission) || 0;
            const totalCommission = perPerson * (claim.companion_ids.length + 1);
            dataToUpdate.per_person_commission = perPerson;
            dataToUpdate.total_commission = totalCommission;
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
                    employeeName: empDisplayName,
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
                    employeeName: empDisplayName,
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
