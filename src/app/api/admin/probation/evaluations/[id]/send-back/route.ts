import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const adminData = await requireAdmin();
        const adminId = typeof adminData === 'string' ? adminData : (adminData as any)?.emp_id || "ADMIN";
        const { id } = await params;
        
        const body = await req.json();
        const { return_reason } = body;

        if (!return_reason) {
            return NextResponse.json({ error: "RETURN_REASON_REQUIRED" }, { status: 400 });
        }

        // Fetch original evaluation
        const evaluation = await prisma.probation_evaluations.findUnique({
            where: { id: Number(id) }
        });

        if (!evaluation) {
            return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }

        if (evaluation.status !== "submitted") {
            return NextResponse.json({ error: "INVALID_STATUS", message: "Only submitted evaluations can be returned" }, { status: 400 });
        }

        // Create revision snapshot
        await prisma.probation_evaluation_revisions.create({
            data: {
                evaluation_id: evaluation.id,
                emp_id: evaluation.emp_id,
                supervisor_id: evaluation.supervisor_id,
                return_reason: return_reason,
                returned_by: adminId,
                snapshot: evaluation as any
            }
        });

        // Update evaluation
        const updated = await prisma.probation_evaluations.update({
            where: { id: evaluation.id },
            data: {
                status: "returned",
                return_reason: return_reason
            }
        });

        // Send LINE Notification to Supervisor
        try {
            const supervisor = await prisma.employees.findUnique({
                where: { emp_id: evaluation.supervisor_id },
                select: { line_user_id: true, name: true }
            });
            
            const emp = await prisma.employees.findUnique({
                where: { emp_id: evaluation.emp_id },
                select: { name: true, nickname: true }
            });

            if (supervisor?.line_user_id && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
                const empName = emp?.nickname ? `${emp.name} (${emp.nickname})` : (emp?.name || evaluation.emp_id);
                const shortReason = return_reason.length > 50 ? return_reason.substring(0, 50) + "..." : return_reason;
                const link = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://hr-checkin-web.vercel.app'}/team/probation/evaluate/${evaluation.emp_id}`;
                
                const message = `⚠️ แจ้งเตือน: แบบประเมินถูกตีกลับ\n\nแบบประเมินทดลองงานของ ${empName} (ครั้งที่ ${evaluation.evaluation_no}) ถูกส่งกลับให้แก้ไข\n\n💬 เหตุผลเบื้องต้น: ${shortReason}\n\n👉 กรุณาตรวจสอบและแก้ไขได้ที่: ${link}`;

                await fetch("https://api.line.me/v2/bot/message/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
                    },
                    body: JSON.stringify({
                        to: supervisor.line_user_id,
                        messages: [{ type: "text", text: message }]
                    })
                });
            }
        } catch (lineErr) {
            console.error("[LINE NOTIFY ERROR]", lineErr);
        }

        return NextResponse.json({ ok: true, evaluation: updated });

    } catch (e: any) {
        console.error("[API/ADMIN/PROBATION/SEND_BACK] Error:", e);
        return NextResponse.json({ error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
