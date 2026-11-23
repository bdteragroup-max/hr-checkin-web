import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { normalizeReportItems, derivePeriodMonthFromRow, buildCombinedSummaryFromItems } from "@/app/api/missing-checkin-reports/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        await requireAdmin();
        const url = new URL(req.url);
        const start_date = url.searchParams.get("start_date");
        const end_date = url.searchParams.get("end_date");

        let rows: any[] = [];
        try {
            rows = await prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM "missing_checkin_reports" ORDER BY "created_at" DESC`
            );
            if (start_date && end_date) {
                rows = rows.filter(r => {
                    const items = normalizeReportItems(r);
                    return items.some(it => it.work_date >= start_date && it.work_date <= end_date);
                });
            }
        } catch {
            rows = [];
        }

        const empIds = Array.from(new Set([
            ...rows.map(r => r.emp_id),
            ...rows.map(r => r.supervisor_id)
        ].filter(Boolean)));

        const emps = empIds.length > 0
            ? await prisma.employees.findMany({
                  where: { emp_id: { in: empIds } },
                  select: {
                      emp_id: true,
                      name: true,
                      nickname: true,
                      departments: { select: { name: true } }
                  }
              })
            : [];

        const empMap = new Map(emps.map(e => [
            e.emp_id,
            {
                ...e,
                name: e.nickname && !e.name.includes(`(${e.nickname})`)
                    ? `${e.name} (${e.nickname})`
                    : e.name
            }
        ]));

        const formattedReports = rows.map(r => ({
            ...r,
            period_month: derivePeriodMonthFromRow(r),
            items: normalizeReportItems(r),
            employee: empMap.get(r.emp_id) || { emp_id: r.emp_id, name: r.emp_id },
            supervisor: r.supervisor_id ? empMap.get(r.supervisor_id) || { emp_id: r.supervisor_id, name: r.supervisor_id } : null
        }));

        return NextResponse.json({ ok: true, list: formattedReports });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Unauthorized" }, { status: 401 });
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

        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "missing_checkin_reports" WHERE "id" = $1 LIMIT 1`,
            id
        );
        const existing = rows?.[0];
        if (!existing) {
            return NextResponse.json({ ok: false, error: "ไม่พบรายการเอกสารนี้" }, { status: 404 });
        }

        await prisma.$executeRawUnsafe(
            `UPDATE "missing_checkin_reports"
             SET "status" = $1,
                 "hr_remark" = $2,
                 "hr_approved_by" = $3,
                 "hr_approved_at" = NOW(),
                 "updated_at" = NOW()
             WHERE "id" = $4`,
            status,
            remark || null,
            admin.emp_id,
            id
        );

        // Notify Employee of HR Final Decision
        try {
            const emp = await prisma.employees.findUnique({
                where: { emp_id: existing.emp_id },
                select: { name: true, nickname: true, line_user_id: true }
            });
            if (emp?.line_user_id) {
                const { sendMissingCheckinReportNotification } = await import("@/utils/lineMessaging");
                const { formatName } = await import("@/utils/formatName");
                const periodMonth = derivePeriodMonthFromRow(existing);
                const items = normalizeReportItems(existing);
                const summary = buildCombinedSummaryFromItems(items, periodMonth);
                await sendMissingCheckinReportNotification({
                    id: existing.id,
                    docNo: existing.doc_no,
                    employeeName: formatName(emp.name, emp.nickname),
                    workDate: summary.workDateLabel,
                    checkInTime: summary.firstIn,
                    checkOutTime: summary.firstOut,
                    timeSummaryLabel: summary.timeLabel,
                    workDetails: summary.combinedDetails,
                    evidenceUrls: existing.evidence_urls,
                    status,
                    remark,
                    hideButtons: true
                }, [emp.line_user_id]);
            }
        } catch (error) {
            console.error("Admin missing-checkin decision notification error:", error);
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("Admin missing-checkin report error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
