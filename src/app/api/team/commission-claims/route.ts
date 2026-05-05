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

    try {
        // Find claims where this user is the supervisor
        const claims = await prisma.commission_claims.findMany({
            where: { supervisor_id: user.emp_id },
            include: {
                employee: {
                    select: { name: true, nickname: true }
                }
            },
            orderBy: { date: "desc" }
        });

        const list = claims.map(c => ({
            ...c,
            employee: {
                ...c.employee,
                name: c.employee.nickname ? `${c.employee.name} (${c.employee.nickname})` : c.employee.name
            }
        }));
        
        return NextResponse.json({ ok: true, list });
    } catch (e) {
        console.error("Team commission fetch error:", e);
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const { id, action } = body;

        const claim = await prisma.commission_claims.findUnique({
            where: { id },
            include: { employee: { select: { name: true, nickname: true, line_user_id: true } } }
        });

        if (!claim) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

        // Ensure this user is the supervisor for this claim
        if (claim.supervisor_id !== user.emp_id) {
            return NextResponse.json({ ok: false, error: "Forbidden: Not your subordinate" }, { status: 403 });
        }

        let nextStatus = claim.status;
        if (action === "approve") {
            if (claim.status === "pending_supervisor") nextStatus = "pending_admin";
        } else if (action === "reject") {
            nextStatus = "rejected";
        }

        if (nextStatus === claim.status) {
            return NextResponse.json({ ok: false, error: "Invalid action for current status" }, { status: 400 });
        }

        const updated = await prisma.commission_claims.update({
            where: { id },
            data: {
                status: nextStatus,
                supervisor_approved_at: nextStatus === "pending_admin" ? new Date() : claim.supervisor_approved_at
            }
        });

        // Notify Employee
        if (claim.employee.line_user_id) {
            try {
                const { sendCommissionClaimNotification } = await import("@/utils/lineMessaging");
                await sendCommissionClaimNotification({
                    id: claim.id,
                    employeeName: claim.employee.nickname ? `${claim.employee.name} (${claim.employee.nickname})` : claim.employee.name,
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

        // If approved, notify HR
        if (nextStatus === "pending_admin") {
            try {
                const { sendHrCommissionNotification } = await import("@/utils/lineMessaging");
                await sendHrCommissionNotification({
                    id: claim.id,
                    employeeName: claim.employee.nickname ? `${claim.employee.name} (${claim.employee.nickname})` : claim.employee.name,
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
        console.error("Team commission update error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
