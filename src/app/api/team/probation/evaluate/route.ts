import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { 
    calculateTotalScore, 
    calculateGrade, 
    calculateAttendanceScore 
} from "@/utils/probationCalculations";
import { sendProbationEvaluationHrAlert } from "@/utils/lineMessaging";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;
        const supervisor_id = supervisorId; // Alias for consistency with DB field if needed, or just use supervisorId

        const body = await req.json();
        const {
            emp_id,
            evaluation_no,
            period_start,
            period_end,
            scores, // { work_quality: 5, ... }
            attendance_counts, // { late: 0, sick: 0, personal: 0 }
            comment_supervisor,
            comment_improvement,
            comment_praise,
            decision,
            salary_adjust_from,
            salary_adjust_to
        } = body;

        if (!emp_id || !scores || !decision) {
            return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
        }

        // 1. Verify Supervisor Relationship (Allow Primary or Secondary)
        const emp = await prisma.employees.findUnique({
            where: { emp_id },
            select: { supervisor_id: true, secondary_supervisor_id: true, name: true }
        });
        
        const isAuthorized = emp && (emp.supervisor_id === supervisorId || emp.secondary_supervisor_id === supervisorId);
        if (!isAuthorized) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        // 2. Fetch Supervisor Name
        const supervisor = await prisma.employees.findUnique({
            where: { emp_id: supervisorId },
            select: { name: true }
        });

        // 3. Complete context for Attendance Scores
        const finalScores = { ...scores };
        if (attendance_counts) {
            finalScores.late = calculateAttendanceScore("late", attendance_counts.late || 0);
            finalScores.sick_leave = calculateAttendanceScore("sick", attendance_counts.sick || 0);
            finalScores.personal_leave = calculateAttendanceScore("personal", attendance_counts.personal || 0);
        }

        // 4. Calculate Total & Grade
        const totalScore = calculateTotalScore(finalScores);
        const grade = calculateGrade(totalScore);

        // 5. Save to DB
        const result = await prisma.probation_evaluations.create({
            data: {
                emp_id,
                supervisor_id,
                evaluation_no: Number(evaluation_no || 1),
                period_start: new Date(period_start),
                period_end: new Date(period_end),
                
                score_work_quality: scores.work_quality || 0,
                score_work_quantity: scores.work_quantity || 0,
                score_dedication: scores.dedication || 0,
                score_knowledge: scores.knowledge || 0,
                score_learning: scores.learning || 0,
                score_obedience: scores.obedience || 0,
                score_responsibility: scores.responsibility || 0,
                score_creativity: scores.creativity || 0,
                score_teamwork: scores.teamwork || 0,
                score_discipline: scores.discipline || 0,
                score_tool_maintenance: scores.tool_maintenance || 0,
                score_participation: scores.participation || 0,
                
                score_late: finalScores.late || 0,
                score_sick_leave: finalScores.sick_leave || 0,
                score_personal_leave: finalScores.personal_leave || 0,
                
                count_late: attendance_counts?.late || 0,
                count_sick_leave: attendance_counts?.sick || 0,
                count_personal_leave: attendance_counts?.personal || 0,
                
                total_score: totalScore,
                grade: grade,
                
                comment_supervisor,
                comment_improvement,
                comment_praise,
                
                decision,
                salary_adjust_from: salary_adjust_from ? Number(salary_adjust_from) : null,
                salary_adjust_to: salary_adjust_to ? Number(salary_adjust_to) : null,
                
                status: "submitted"
            }
        });

        // 6. Notify HR via LINE
        await sendProbationEvaluationHrAlert({
            empName: emp.name,
            empId: emp_id,
            supervisorName: supervisor?.name || "Unknown",
            evaluationNo: Number(evaluation_no || 1),
            grade: grade,
            totalScore: totalScore,
            decision: decision
        });

        return NextResponse.json({ ok: true, id: result.id });
    } catch (e: any) {
        console.error("[API/PROBATION/SUBMIT] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR", details: e.message }, { status: 500 });
    }
}
