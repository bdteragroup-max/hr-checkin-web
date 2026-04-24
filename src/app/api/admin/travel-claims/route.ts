import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";


export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
        const claims = await prisma.travel_claims.findMany({
            include: { employee: true },
            orderBy: { created_at: "desc" }
        });
        return NextResponse.json({ ok: true, list: claims });
    } catch (e) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function POST(request: Request) {
    try {
        const admin = await requireAdmin();
        const body = await request.json();
        const { id, status, remark } = body;

        if (!id || !status) {
            return NextResponse.json({ ok: false, error: "Missing ID or status" }, { status: 400 });
        }

        const claim = await prisma.travel_claims.update({
            where: { id, status: "pending_admin" },
            data: {
                status,
                remark,
                approved_by: admin.emp_id,
                approved_at: new Date()
            },
            include: { employee: true }
        });

        // Notify Employee of Final Decision
        try {
            if (claim.employee.line_user_id) {
                const { sendTravelClaimNotification } = await import("@/utils/lineMessaging");
                await sendTravelClaimNotification({
                    employeeName: claim.employee.name,
                    claimType: claim.claim_type,
                    siteName: claim.site_name,
                    dateRange: `${claim.date.toLocaleDateString("th-TH")}${claim.end_date ? ` - ${claim.end_date.toLocaleDateString("th-TH")}` : ""}`,
                    amount: `${claim.accommodation_amount} THB`,
                    status: status === "approved" ? "completed" : "rejected",
                    remark: remark,
                    reportUrl: claim.report_url
                }, [claim.employee.line_user_id]);
            }
        } catch (error) {
            console.error("Admin final decision notification error:", error);
        }

        return NextResponse.json({ ok: true, data: claim });
    } catch (e: any) {
        console.error("Admin travel claim error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
