import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const payload = verifyToken(token);
        if (!payload || !payload.emp_id) {
            return NextResponse.json({ error: "INVALID_TOKEN_PAYLOAD" }, { status: 401 });
        }

        const claims = await prisma.general_welfare_claims.findMany({
            where: { emp_id: payload.emp_id },
            orderBy: { created_at: "desc" }
        });

        return NextResponse.json({ ok: true, list: claims });
    } catch (err: any) {
        console.error("[API/WELFARE/GET] Error:", err.message);
        return NextResponse.json({ error: "INTERNAL_ERROR", message: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const payload = verifyToken(token);
        if (!payload || !payload.emp_id) {
            return NextResponse.json({ error: "INVALID_TOKEN_PAYLOAD" }, { status: 401 });
        }

        const body = await req.json();
        const { welfare_type, amount, attachment_url, remark, metadata } = body;

        if (!welfare_type || !amount) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        const claim = await prisma.general_welfare_claims.create({
            data: {
                emp_id: payload.emp_id,
                welfare_type,
                amount: Number(amount),
                attachment_url: attachment_url || null,
                remark: remark || null,
                metadata: metadata || null,
                status: "pending"
            },
            include: {
                employees: {
                    select: {
                        name: true,
                        nickname: true,
                        supervisor: {
                            select: { line_user_id: true }
                        }
                    }
                }
            }
        });

        // ── LINE NOTIFICATION ──
        const supervisorLineId = claim.employees?.supervisor?.line_user_id;
        if (supervisorLineId) {
            try {
                const { sendWelfareApprovalFlexMessage } = await import("@/utils/lineMessaging");
                const WELFARE_TITLES: any = {
                    CHILD_EDUCATION: "ทุนการศึกษาบุตร",
                    MARRIAGE: "เงินแสดงความยินดีมงคลสมรส",
                    CHILDBIRTH: "เงินรับขวัญบุตร",
                    ORDINATION: "เงินช่วยเหลืองานอุปสมบท",
                    FUNERAL: "เงินช่วยเหลืองานฌาปนกิจ"
                };
                
                const urls = claim.attachment_url ? (claim.attachment_url.startsWith('[') ? JSON.parse(claim.attachment_url) : [claim.attachment_url]) : [];

                await sendWelfareApprovalFlexMessage(supervisorLineId, {
                    id: claim.id,
                    empName: claim.employees.nickname ? `${claim.employees.name} (${claim.employees.nickname})` : claim.employees.name,
                    welfareType: WELFARE_TITLES[claim.welfare_type] || claim.welfare_type,
                    amount: Number(claim.amount).toLocaleString(),
                    createdAt: new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
                    remark: claim.remark || undefined,
                    metadata: claim.metadata as any,
                    attachmentUrls: urls
                });
            } catch (err) {
                console.error("[API/WELFARE/LINE] Error:", err);
            }
        }

        return NextResponse.json({ ok: true, data: claim });
    } catch (err: any) {
        console.error("[API/WELFARE/POST] Error:", err.message);
        return NextResponse.json({ error: "INTERNAL_ERROR", message: err.message }, { status: 500 });
    }
}
