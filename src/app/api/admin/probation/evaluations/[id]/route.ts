import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { 
    calculateTotalScore, 
    calculateGrade, 
    calculateAttendanceScore 
} from "@/utils/probationCalculations";

export const runtime = "nodejs";

// GET single evaluation
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const { id } = await params;

        const evaluation = await prisma.probation_evaluations.findUnique({
            where: { id: Number(id) },
            include: {
                employee: { 
                    select: { 
                        name: true, 
                        emp_id: true,
                        job_positions: { select: { title: true } },
                        departments: { select: { name: true } }
                    } 
                },
                supervisor: { select: { name: true } }
            }
        });

        if (!evaluation) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        return NextResponse.json({ ok: true, evaluation });
    } catch (e: any) {
        console.error("[API/ADMIN/PROBATION/GET] Error:", e);
        return NextResponse.json({ error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}

// PATCH update evaluation
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const { id } = await params;
        const body = await req.json();

        // HR can update scores, weights, attendance counts, remarks and decision
        const {
            scores,
            attendance_counts,
            decision,
            hr_remark,
            salary_adjust_from,
            salary_adjust_to
        } = body;

        // Fetch original to preserve un-updated fields
        const original = await prisma.probation_evaluations.findUnique({ where: { id: Number(id) } });
        if (!original) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        // Build updated scores
        // We assume 'scores' in body contains work_quality, etc.
        const updatedScores: any = { ...scores };
        
        // Recalculate attendance scores if counts changed
        if (attendance_counts) {
            updatedScores.late = calculateAttendanceScore("late", attendance_counts.late ?? original.count_late);
            updatedScores.sick_leave = calculateAttendanceScore("sick", attendance_counts.sick ?? original.count_sick_leave);
            updatedScores.personal_leave = calculateAttendanceScore("personal", attendance_counts.personal ?? original.count_personal_leave);
        }

        // Final Score & Grade
        const totalScore = calculateTotalScore(updatedScores);
        const grade = calculateGrade(totalScore);

        const result = await prisma.probation_evaluations.update({
            where: { id: Number(id) },
            data: {
                score_work_quality: updatedScores.work_quality ?? original.score_work_quality,
                score_work_quantity: updatedScores.work_quantity ?? original.score_work_quantity,
                score_dedication: updatedScores.score_dedication ?? original.score_dedication,
                score_knowledge: updatedScores.knowledge ?? original.score_knowledge,
                score_learning: updatedScores.learning ?? original.score_learning,
                score_obedience: updatedScores.obedience ?? original.score_obedience,
                score_responsibility: updatedScores.responsibility ?? original.score_responsibility,
                score_creativity: updatedScores.creativity ?? original.score_creativity,
                score_teamwork: updatedScores.teamwork ?? original.score_teamwork,
                score_discipline: updatedScores.discipline ?? original.score_discipline,
                score_tool_maintenance: updatedScores.tool_maintenance ?? original.score_tool_maintenance,
                score_participation: updatedScores.participation ?? original.score_participation,

                score_late: updatedScores.late ?? original.score_late,
                score_sick_leave: updatedScores.sick_leave ?? original.score_sick_leave,
                score_personal_leave: updatedScores.personal_leave ?? original.score_personal_leave,

                count_late: attendance_counts?.late ?? original.count_late,
                count_sick_leave: attendance_counts?.sick ?? original.count_sick_leave,
                count_personal_leave: attendance_counts?.personal ?? original.count_personal_leave,

                total_score: totalScore,
                grade: grade,

                decision: decision ?? original.decision,
                hr_remark: hr_remark ?? original.hr_remark,
                salary_adjust_from: salary_adjust_from !== undefined ? Number(salary_adjust_from) : original.salary_adjust_from,
                salary_adjust_to: salary_adjust_to !== undefined ? Number(salary_adjust_to) : original.salary_adjust_to,
                
                status: "reviewed" // Mark as reviewed by HR
            }
        });

        return NextResponse.json({ ok: true, evaluation: result });
    } catch (e: any) {
        console.error("[API/ADMIN/PROBATION/PATCH] Error:", e);
        return NextResponse.json({ error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
