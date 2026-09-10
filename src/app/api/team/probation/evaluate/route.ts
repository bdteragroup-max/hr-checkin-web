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
            system_attendance_counts,
            correction_remark,
            comment_supervisor,
            comment_improvement,
            comment_praise,
            score_comments,
            decision,
            salary_adjust_from,
            salary_adjust_to
        } = body;

        if (!emp_id || !scores || !decision) {
            return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
        }

        const sanitize = (val: any) => {
            if (typeof val !== 'string') return val;
            return val.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s.,\-_()\/]/g, "");
        };

        const hasValidText = (val: string) => /[a-zA-Z0-9\u0E00-\u0E7F]/.test(val || "");

        const cleanCommentSupervisor = sanitize(comment_supervisor || "");
        const cleanCommentImprovement = sanitize(comment_improvement || "");
        const cleanCommentPraise = sanitize(comment_praise || "");

        if (!hasValidText(cleanCommentSupervisor)) {
            return NextResponse.json({ 
                error: "MISSING_GRADE_JUSTIFICATION", 
                message: "กรุณาระบุเหตุผลประกอบการประเมิน (Grade Justification) ให้ครบถ้วน ห้ามเว้นว่าง" 
            }, { status: 400 });
        }

        // --- Handle Corrections Logic ---
        let finalCommentSupervisor = cleanCommentSupervisor;
        if (correction_remark && typeof correction_remark === "string" && correction_remark.trim()) {
            const cleanRemark = sanitize(correction_remark.trim());
            const auditLog = `\n\n---บันทึกการแก้ไขสถิติ---\n${cleanRemark}\n(สถิติเดิมจากระบบ: มาสาย ${system_attendance_counts?.late || 0}, ลาป่วย ${system_attendance_counts?.sick || 0}, ลากิจ ${system_attendance_counts?.personal || 0})`;
            finalCommentSupervisor += auditLog;
        }

        // 1. Verify Supervisor Relationship or Cross-Manager Evaluation
        const emp = await prisma.employees.findUnique({
            where: { emp_id },
            select: { supervisor_id: true, secondary_supervisor_id: true, name: true, nickname: true, is_on_trial: true, emp_id: true, job_positions: { select: { node_type: true, title: true } } }
        });

        if (!emp) {
            return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
        }

        const loggedInUser = await prisma.employees.findUnique({
            where: { emp_id: supervisorId },
            select: { job_positions: { select: { node_type: true, title: true } } }
        });

        const checkIsManager = (employeeInfo: any) => {
            const title = employeeInfo?.job_positions?.title?.toLowerCase() || '';
            const nodeType = employeeInfo?.job_positions?.node_type;
            return nodeType === 'executive' || 
                title.includes('mgr') || 
                title.includes('manager') || 
                title.includes('หัวหน้า') ||
                title.includes('sup.') ||
                title.includes('supervisor') ||
                title.includes('director');
        };

        const isManager = checkIsManager(loggedInUser);
        const isOtherManager = checkIsManager(emp);

        // Check if user is registered in employee_co_evaluators
        const coEvalCheck: any[] = ((await prisma.$queryRawUnsafe(
            `SELECT 1 FROM employee_co_evaluators WHERE employee_id = $1 AND evaluator_id = $2 LIMIT 1;`,
            emp_id,
            supervisorId
        ).catch(() => [])) as any[]) || [];
        const isCoEvaluator = coEvalCheck.length > 0;

        const isDirectSubordinate = emp && (
            emp.supervisor_id === supervisorId || 
            emp.secondary_supervisor_id === supervisorId ||
            isCoEvaluator
        );
        const isCrossEvaluating = isManager && isOtherManager && emp?.emp_id !== supervisorId && emp?.is_on_trial === true;
        
        const isAuthorized = isDirectSubordinate || isCrossEvaluating;
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

        // 5. Save to DB (Check if exists first for editing returned evaluations)
        const evalData = {
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
            
            count_late: Math.round(attendance_counts?.late || 0),
            count_sick_leave: Math.round(attendance_counts?.sick || 0),
            count_personal_leave: Math.round(attendance_counts?.personal || 0),
            
            total_score: totalScore,
            grade: grade,
            
            comment_supervisor: finalCommentSupervisor,
            comment_improvement: cleanCommentImprovement,
            comment_praise: cleanCommentPraise,
            score_comments: score_comments || {},
            
            decision,
            salary_adjust_from: salary_adjust_from ? Number(salary_adjust_from) : null,
            salary_adjust_to: salary_adjust_to ? Number(salary_adjust_to) : null,
            
            status: "submitted",
            return_reason: null // Clear return reason on submit
        };

        const existing = await prisma.probation_evaluations.findFirst({
            where: {
                emp_id,
                evaluation_no: Number(evaluation_no || 1),
                ...(isOtherManager ? { supervisor_id } : {})
            }
        });

        let result;
        if (existing) {
            result = await prisma.probation_evaluations.update({
                where: { id: existing.id },
                data: evalData
            });
        } else {
            result = await (prisma.probation_evaluations as any).create({
                data: evalData
            });
        }

        // 6. Notify HR via LINE
        await sendProbationEvaluationHrAlert({
            empName: emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name,
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
