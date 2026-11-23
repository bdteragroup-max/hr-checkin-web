import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { normalizeReportItems, derivePeriodMonthFromRow, buildCombinedSummaryFromItems } from "@/app/api/missing-checkin-reports/route";

async function getAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch {
        return null;
    }
}

export async function GET() {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // Find all subordinates
        const subordinates = await prisma.employees.findMany({
            where: {
                OR: [
                    { supervisor_id: user.emp_id },
                    { secondary_supervisor_id: user.emp_id }
                ]
            },
            select: {
                emp_id: true,
                name: true,
                nickname: true,
                departments: { select: { name: true } }
            }
        });

        const subMap = new Map(subordinates.map(s => [s.emp_id, s]));
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "missing_checkin_reports" ORDER BY "created_at" DESC`
        ).catch(() => []);

        const filtered = rows.filter(r => r.supervisor_id === user.emp_id || subMap.has(r.emp_id));

        // Fetch any missing employee records if supervisor_id matched directly
        const missingEmpIds = filtered
            .map(r => r.emp_id)
            .filter(id => !subMap.has(id));

        if (missingEmpIds.length > 0) {
            const extraEmps = await prisma.employees.findMany({
                where: { emp_id: { in: missingEmpIds } },
                select: {
                    emp_id: true,
                    name: true,
                    nickname: true,
                    departments: { select: { name: true } }
                }
            });
            extraEmps.forEach(e => subMap.set(e.emp_id, e));
        }

        const list = filtered.map(r => {
            const emp = subMap.get(r.emp_id);
            return {
                ...r,
                period_month: derivePeriodMonthFromRow(r),
                items: normalizeReportItems(r),
                employee: emp
                    ? {
                          ...emp,
                          name: emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name
                      }
                    : { emp_id: r.emp_id, name: r.emp_id }
            };
        });

        return NextResponse.json({ ok: true, list });
    } catch (e: any) {
        console.error("Team missing-checkin-reports GET error:", e);
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
            return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
        }

        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "missing_checkin_reports" WHERE "id" = $1 LIMIT 1`,
            id
        );

        const existing = rows?.[0];
        if (!existing) {
            return NextResponse.json({ ok: false, error: "ไม่พบรายการเอกสารนี้" }, { status: 404 });
        }

        const emp = await prisma.employees.findUnique({
            where: { emp_id: existing.emp_id },
            select: {
                emp_id: true,
                name: true,
                nickname: true,
                line_user_id: true,
                supervisor_id: true,
                secondary_supervisor_id: true
            }
        });

        const isSupervisor =
            existing.supervisor_id === user.emp_id ||
            emp?.supervisor_id === user.emp_id ||
            emp?.secondary_supervisor_id === user.emp_id;

        if (!isSupervisor) {
            return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์อนุมัติรายการนี้" }, { status: 403 });
        }

        const updateStatus = status === "approved" ? "pending_hr" : "rejected";

        await prisma.$executeRawUnsafe(
            `UPDATE "missing_checkin_reports"
             SET "status" = $1,
                 "supervisor_id" = $2,
                 "supervisor_remark" = $3,
                 "supervisor_approved_at" = NOW(),
                 "updated_at" = NOW()
             WHERE "id" = $4`,
            updateStatus,
            user.emp_id,
            remark || null,
            id
        );

        // Notify Employee and HR
        try {
            const { sendMissingCheckinReportNotification } = await import("@/utils/lineMessaging");
            const empDisplayName = emp?.nickname
                ? `${emp.name} (${emp.nickname})`
                : emp?.name || existing.emp_id;
            const periodMonth = derivePeriodMonthFromRow(existing);
            const items = normalizeReportItems(existing);
            const summary = buildCombinedSummaryFromItems(items, periodMonth);

            // Also send confirmation to the supervisor's LINE when approved/rejected from Web UI
            const supEmp = await prisma.employees.findUnique({
                where: { emp_id: user.emp_id },
                select: { line_user_id: true }
            });
            if (supEmp?.line_user_id) {
                const actionNotice = updateStatus === "pending_hr"
                    ? `✅ ดำเนินการอนุมัติเอกสารเลขที่ ${existing.doc_no} (${empDisplayName}) และส่งต่อให้ฝ่ายบุคคล (HR) เรียบร้อยแล้วค่ะ`
                    : `❌ ดำเนินการไม่อนุมัติเอกสารเลขที่ ${existing.doc_no} (${empDisplayName}) เรียบร้อยแล้วค่ะ`;
                await sendMissingCheckinReportNotification({
                    id: existing.id,
                    docNo: existing.doc_no,
                    employeeName: empDisplayName,
                    workDate: summary.workDateLabel,
                    checkInTime: summary.firstIn,
                    checkOutTime: summary.firstOut,
                    timeSummaryLabel: summary.timeLabel,
                    workDetails: summary.combinedDetails,
                    evidenceUrls: existing.evidence_urls,
                    status: updateStatus,
                    remark,
                    hideButtons: true,
                    actionNotice
                }, [supEmp.line_user_id]);
            }

            if (emp?.line_user_id) {
                await sendMissingCheckinReportNotification({
                    id: existing.id,
                    docNo: existing.doc_no,
                    employeeName: empDisplayName,
                    workDate: summary.workDateLabel,
                    checkInTime: summary.firstIn,
                    checkOutTime: summary.firstOut,
                    timeSummaryLabel: summary.timeLabel,
                    workDetails: summary.combinedDetails,
                    evidenceUrls: existing.evidence_urls,
                    status: updateStatus,
                    remark,
                    hideButtons: true
                }, [emp.line_user_id]);
            }

            if (updateStatus === "pending_hr" && process.env.HR_LINE_USER_ID) {
                const hrIds = process.env.HR_LINE_USER_ID.split(",").map(s => s.trim()).filter(Boolean);
                if (hrIds.length > 0) {
                    await sendMissingCheckinReportNotification({
                        id: existing.id,
                        docNo: existing.doc_no,
                        employeeName: empDisplayName,
                        workDate: summary.workDateLabel,
                        checkInTime: summary.firstIn,
                        checkOutTime: summary.firstOut,
                        timeSummaryLabel: summary.timeLabel,
                        workDetails: summary.combinedDetails,
                        evidenceUrls: existing.evidence_urls,
                        status: "pending_hr",
                        remark
                    }, hrIds);
                }
            }
        } catch (notifyErr) {
            console.error("Supervisor missing-checkin decision notification error:", notifyErr);
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("Team missing-checkin-reports POST error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
