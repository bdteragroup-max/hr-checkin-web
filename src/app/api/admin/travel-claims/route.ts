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
            include: { employee: { select: { name: true, nickname: true, line_user_id: true } } }
        });

        // Notify Employee of Final Decision
        try {
            if (claim.employee.line_user_id) {
                const { sendTravelClaimNotification } = await import("@/utils/lineMessaging");
                const { formatName } = await import("@/utils/formatName");
                await sendTravelClaimNotification({
                    id: claim.id,
                    employeeName: formatName(claim.employee.name, (claim.employee as any).nickname),
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
