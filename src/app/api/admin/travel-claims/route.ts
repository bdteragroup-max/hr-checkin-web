import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        await requireAdmin();
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

        const claims = await prisma.travel_claims.findMany({
            where,
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
                    id: claim.id,
                    employeeName: claim.employee.name,
                    claimType: claim.claim_type,
                    siteName: claim.site_name,
                    dateRange: `${claim.date.toLocaleDateString("th-TH")}${claim.end_date ? ` - ${claim.end_date.toLocaleDateString("th-TH")}` : ""}`,
                    amount: `${claim.accommodation_amount} THB`,
                    status: status === "approved" ? "completed" : "rejected",
                    remark: remark,
                    reportUrl: claim.report_url,
                    hideButtons: true
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
