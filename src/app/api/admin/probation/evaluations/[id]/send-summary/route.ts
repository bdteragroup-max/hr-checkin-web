import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { sendProbationSummaryToManagement } from "@/utils/lineMessaging";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const decodedAdmin = await requireAdmin();
        const { id: idStr } = await params;
        const id = parseInt(idStr);

        const evalData = await prisma.probation_evaluations.findUnique({
            where: { id },
            include: {
                employee: { select: { name: true } }
            }
        });

        if (!evalData) return NextResponse.json({ error: "EVALUATION_NOT_FOUND" }, { status: 404 });

        // Update status or flag
        await prisma.probation_evaluations.update({
            where: { id },
            data: { is_sent_to_management: true }
        });

        // Trigger LINE notification
        const success = await sendProbationSummaryToManagement({
            empName: evalData.employee.name,
            totalScore: evalData.total_score,
            grade: evalData.grade || "-",
            decision: evalData.decision,
            comment: evalData.comment_supervisor || "-",
            hrName: (decodedAdmin as any).name || "HR Admin"
        });

        return NextResponse.json({ ok: true, success });
    } catch (e: any) {
        console.error("[API/ADMIN/PROBATION/SEND] Error:", e);
        return NextResponse.json({ error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
