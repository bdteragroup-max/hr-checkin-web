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
        const claims = await prisma.travel_claims.findMany({
            where: { supervisor_id: user.emp_id },
            include: { employee: true },
            orderBy: { created_at: "desc" }
        });
        const list = claims.map(c => ({
            ...c,
            employee: {
                ...c.employee,
                name: c.employee.nickname ? `${c.employee.name} (${c.employee.nickname})` : c.employee.name
            }
        }));
        return NextResponse.json({ ok: true, list });
    } catch (e: any) {
        console.error("Team travel claims GET error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const { id, status, remark } = body;

        if (!id || !status) {
            return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
        }

        // status should be 'pending_admin' (on supervisor approval) or 'rejected'
        const updateStatus = status === "approved" ? "pending_admin" : "rejected";

        const claim = await prisma.travel_claims.update({
            where: { id, supervisor_id: user.emp_id },
            data: {
                status: updateStatus,
                supervisor_remark: remark,
                supervisor_approved_at: new Date()
            },
            include: { employee: true }
        });

        // Notify Employee and HR
        try {
            const { sendTravelClaimNotification } = await import("@/utils/lineMessaging");
            
            // 1. Notify Employee
            if (claim.employee.line_user_id) {
                await sendTravelClaimNotification({
                    id: claim.id,
                    employeeName: claim.employee.nickname ? `${claim.employee.name} (${claim.employee.nickname})` : claim.employee.name,
                    claimType: claim.claim_type,
                    siteName: claim.site_name,
                    dateRange: `${claim.date.toLocaleDateString("th-TH")}${claim.end_date ? ` - ${claim.end_date.toLocaleDateString("th-TH")}` : ""}`,
                    amount: `${claim.accommodation_amount} THB`,
                    status: updateStatus === "pending_admin" ? "approved" : "rejected",
                    remark: remark,
                    reportUrl: claim.report_url,
                    hideButtons: true
                }, [claim.employee.line_user_id]);
            }

            // 2. Notify HR (if approved by supervisor)
            if (updateStatus === "pending_admin") {
                const hrLineId = process.env.HR_LINE_USER_ID;
                if (hrLineId) {
                    await sendTravelClaimNotification({
                        id: claim.id,
                        employeeName: claim.employee.nickname ? `${claim.employee.name} (${claim.employee.nickname})` : claim.employee.name,
                        claimType: claim.claim_type,
                        siteName: claim.site_name,
                        dateRange: `${claim.date.toLocaleDateString("th-TH")}${claim.end_date ? ` - ${claim.end_date.toLocaleDateString("th-TH")}` : ""}`,
                        amount: `${claim.accommodation_amount} THB`,
                        status: "pending_admin",
                        reportUrl: claim.report_url
                    }, [hrLineId]);
                }
            }
        } catch (error) {
            console.error("Supervisor decision notification error:", error);
        }

        return NextResponse.json({ ok: true, data: claim });
    } catch (e: any) {
        console.error("Team travel claims POST error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
