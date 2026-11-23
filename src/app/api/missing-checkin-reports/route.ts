import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import crypto from "crypto";

export interface MissingCheckinDayItem {
    work_date: string;      // YYYY-MM-DD
    check_in_time: string;  // HH:mm
    check_out_time: string; // HH:mm
    work_details: string;
}

const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

export function formatPeriodMonthThai(periodMonth: string): string {
    if (!periodMonth || !periodMonth.includes("-")) return periodMonth || "-";
    const [y, m] = periodMonth.split("-").map(Number);
    if (!y || !m) return periodMonth;
    return `${THAI_MONTHS[m - 1] || m} ${y + 543}`;
}

export function getDefaultCyclePeriodMonth(d = new Date()): string {
    const bkk = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    let year = bkk.getFullYear();
    let month = bkk.getMonth() + 1;
    // Payroll cycle ends on the 25th of each month (26th prev month - 25th current month)
    if (bkk.getDate() > 25) {
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return `${year}-${String(month).padStart(2, "0")}`;
}

export function normalizeReportItems(row: any): MissingCheckinDayItem[] {
    if (row?.report_items) {
        try {
            const parsed = typeof row.report_items === "string"
                ? JSON.parse(row.report_items)
                : row.report_items;
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((it: any) => ({
                    work_date: String(it.work_date || "").slice(0, 10),
                    check_in_time: String(it.check_in_time || "08:00"),
                    check_out_time: String(it.check_out_time || "17:00"),
                    work_details: String(it.work_details || "").trim()
                }));
            }
        } catch {
            // fallback to legacy single columns
        }
    }
    const wd = row?.work_date
        ? (row.work_date instanceof Date ? row.work_date.toISOString().slice(0, 10) : String(row.work_date).slice(0, 10))
        : "";
    return [{
        work_date: wd,
        check_in_time: row?.check_in_time || "08:00",
        check_out_time: row?.check_out_time || "17:00",
        work_details: row?.work_details || ""
    }];
}

export function derivePeriodMonthFromRow(row: any): string {
    if (row?.period_month) return String(row.period_month);
    if (row?.doc_no && /^MCR-\d{6}-/.test(row.doc_no)) {
        const ym = row.doc_no.slice(4, 10);
        return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
    }
    const items = normalizeReportItems(row);
    if (items[0]?.work_date) {
        const dt = new Date(`${items[0].work_date}T00:00:00+07:00`);
        if (!isNaN(dt.getTime())) return getDefaultCyclePeriodMonth(dt);
    }
    return getDefaultCyclePeriodMonth();
}

export function formatDateDMYThai(dateStr: string): string {
    const clean = String(dateStr || "").slice(0, 10);
    const parts = clean.split("-");
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const yearNum = parseInt(y, 10);
    if (isNaN(yearNum)) return dateStr;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${yearNum + 543}`;
}

export function buildCombinedSummaryFromItems(items: MissingCheckinDayItem[], periodMonth: string) {
    const sorted = [...items].sort((a, b) => a.work_date.localeCompare(b.work_date));
    const firstDate = sorted[0]?.work_date || `${periodMonth}-25`;
    const firstIn = sorted[0]?.check_in_time || "08:00";
    const firstOut = sorted[0]?.check_out_time || "17:00";

    const lines = sorted.map((it, idx) => {
        const dStr = formatDateDMYThai(it.work_date);
        return `${idx + 1}. ${dStr} (${it.check_in_time}-${it.check_out_time} น.): ${it.work_details}`;
    });

    const workDateLabel = `เดือน${formatPeriodMonthThai(periodMonth)}`;

    const timeLabel = sorted.length === 1
        ? `${formatDateDMYThai(sorted[0].work_date)} (${firstIn} - ${firstOut} น.)`
        : `รวม ${sorted.length} วัน (ตัดรอบวันที่ 25)`;

    return {
        firstDate,
        firstIn,
        firstOut,
        combinedDetails: lines.join("\n"),
        workDateLabel,
        timeLabel,
        sortedItems: sorted
    };
}

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

async function ensureTableExists() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "missing_checkin_reports" (
                "id" TEXT NOT NULL,
                "doc_no" VARCHAR(50) NOT NULL,
                "emp_id" VARCHAR(20) NOT NULL,
                "period_month" VARCHAR(7),
                "report_items" TEXT,
                "work_date" DATE NOT NULL,
                "check_in_time" VARCHAR(10) NOT NULL,
                "check_out_time" VARCHAR(10) NOT NULL,
                "work_details" TEXT NOT NULL,
                "evidence_urls" TEXT NOT NULL,
                "status" VARCHAR(30) NOT NULL DEFAULT 'pending_supervisor',
                "supervisor_id" VARCHAR(20),
                "supervisor_approved_at" TIMESTAMPTZ(6),
                "supervisor_remark" TEXT,
                "hr_approved_by" VARCHAR(100),
                "hr_approved_at" TIMESTAMPTZ(6),
                "hr_remark" TEXT,
                "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "missing_checkin_reports_pkey" PRIMARY KEY ("id")
            );
        `);
        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "missing_checkin_reports_doc_no_key" ON "missing_checkin_reports"("doc_no");
        `);
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "missing_checkin_reports" ADD COLUMN IF NOT EXISTS "period_month" VARCHAR(7);
        `);
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "missing_checkin_reports" ADD COLUMN IF NOT EXISTS "report_items" TEXT;
        `);
    } catch (e) {
        console.error("ensureTableExists warning:", e);
    }
}

async function generateDocNo(periodMonth?: string): Promise<string> {
    const now = new Date();
    let yyyy = String(now.getFullYear());
    let mm = String(now.getMonth() + 1).padStart(2, "0");
    if (periodMonth && /^\d{4}-\d{2}$/.test(periodMonth)) {
        const parts = periodMonth.split("-");
        yyyy = parts[0];
        mm = parts[1];
    }
    const prefix = `MCR-${yyyy}${mm}-`;

    try {
        const rows = await prisma.$queryRawUnsafe<Array<{ doc_no: string }>>(
            `SELECT "doc_no" FROM "missing_checkin_reports" WHERE "doc_no" LIKE $1 ORDER BY "doc_no" DESC LIMIT 1`,
            `${prefix}%`
        );

        let nextSeq = 1;
        if (rows && rows.length > 0 && rows[0].doc_no) {
            const parts = rows[0].doc_no.split("-");
            const lastNum = parseInt(parts[2] || "0", 10);
            if (!isNaN(lastNum)) nextSeq = lastNum + 1;
        }
        return `${prefix}${String(nextSeq).padStart(4, "0")}`;
    } catch {
        return `${prefix}0001`;
    }
}

export async function GET() {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await ensureTableExists();
        const defaultPeriod = getDefaultCyclePeriodMonth();
        const [rows, nextDocNo, emp] = await Promise.all([
            prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM "missing_checkin_reports" WHERE "emp_id" = $1 ORDER BY "created_at" DESC`,
                user.emp_id
            ),
            generateDocNo(defaultPeriod),
            prisma.employees.findUnique({
                where: { emp_id: user.emp_id },
                select: {
                    name: true,
                    nickname: true,
                    supervisor_id: true,
                    supervisor: { select: { name: true, nickname: true, emp_id: true } }
                }
            })
        ]);

        const formattedList = (rows || []).map(r => ({
            ...r,
            period_month: derivePeriodMonthFromRow(r),
            items: normalizeReportItems(r)
        }));

        return NextResponse.json({
            ok: true,
            list: formattedList,
            next_doc_no: nextDocNo,
            default_period_month: defaultPeriod,
            employee: emp
        });
    } catch (e: any) {
        console.error("GET missing-checkin-reports error:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await ensureTableExists();
        const body = await request.json();
        const periodMonth: string = (body.period_month && /^\d{4}-\d{2}$/.test(body.period_month))
            ? body.period_month
            : getDefaultCyclePeriodMonth();

        // Parse items array (or legacy single item fields)
        let rawItems: MissingCheckinDayItem[] = [];
        if (Array.isArray(body.items) && body.items.length > 0) {
            rawItems = body.items.map((it: any) => ({
                work_date: String(it.work_date || "").trim(),
                check_in_time: String(it.check_in_time || "").trim(),
                check_out_time: String(it.check_out_time || "").trim(),
                work_details: String(it.work_details || "").trim()
            }));
        } else if (body.work_date) {
            rawItems = [{
                work_date: String(body.work_date).trim(),
                check_in_time: String(body.check_in_time || "").trim(),
                check_out_time: String(body.check_out_time || "").trim(),
                work_details: String(body.work_details || "").trim()
            }];
        }

        const evidence_urls = String(body.evidence_urls || "").trim();

        if (rawItems.length === 0 || !evidence_urls) {
            return NextResponse.json({ ok: false, error: "กรุณาระบุรายการวันที่ไม่ได้ลงเวลาและแนบหลักฐานให้ครบถ้วน" }, { status: 400 });
        }

        for (let i = 0; i < rawItems.length; i++) {
            const it = rawItems[i];
            if (!it.work_date || !it.check_in_time || !it.check_out_time || !it.work_details) {
                return NextResponse.json({
                    ok: false,
                    error: `กรุณากรอกวันที่ เวลาเข้า-ออก และรายละเอียดงานให้ครบถ้วน (รายการที่ ${i + 1})`
                }, { status: 400 });
            }
        }

        // Enforce 1 submission per employee per month (except if previous submission was rejected)
        const existingRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "missing_checkin_reports" WHERE "emp_id" = $1 ORDER BY "created_at" DESC`,
            user.emp_id
        );
        const duplicateInMonth = (existingRows || []).find(r => {
            if (r.status === "rejected") return false;
            const rPeriod = derivePeriodMonthFromRow(r);
            return rPeriod === periodMonth;
        });

        if (duplicateInMonth) {
            return NextResponse.json({
                ok: false,
                error: `คุณได้ส่งเอกสารรายงานการทำงานของรอบเดือน ${formatPeriodMonthThai(periodMonth)} ไปแล้ว (เลขที่ ${duplicateInMonth.doc_no}) — กำหนดให้ 1 คนแจ้งรวมรายการได้ 1 ครั้งต่อเดือน (หากยังไม่อนุมัติ สามารถกด "แก้ไข" ที่เอกสารเดิมเพื่อเพิ่มหรือแก้ไขรายการวันได้)`
            }, { status: 400 });
        }

        const emp = await prisma.employees.findUnique({
            where: { emp_id: user.emp_id },
            select: {
                name: true,
                nickname: true,
                line_user_id: true,
                supervisor_id: true,
                secondary_supervisor_id: true,
                supervisor: { select: { name: true, nickname: true, line_user_id: true } },
                secondary_supervisor: { select: { name: true, nickname: true, line_user_id: true } }
            }
        });

        const id = crypto.randomUUID();
        const docNo = await generateDocNo(periodMonth);
        const initialStatus = emp?.supervisor_id ? "pending_supervisor" : "pending_hr";
        const supervisorId = emp?.supervisor_id || null;

        const summary = buildCombinedSummaryFromItems(rawItems, periodMonth);
        const reportItemsJson = JSON.stringify(summary.sortedItems);

        await prisma.$executeRawUnsafe(
            `INSERT INTO "missing_checkin_reports"
             ("id", "doc_no", "emp_id", "period_month", "report_items", "work_date", "check_in_time", "check_out_time", "work_details", "evidence_urls", "status", "supervisor_id", "created_at", "updated_at")
             VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
            id,
            docNo,
            user.emp_id,
            periodMonth,
            reportItemsJson,
            summary.firstDate,
            summary.firstIn,
            summary.firstOut,
            summary.combinedDetails,
            evidence_urls,
            initialStatus,
            supervisorId
        );

        const report = {
            id,
            doc_no: docNo,
            emp_id: user.emp_id,
            period_month: periodMonth,
            items: summary.sortedItems,
            work_date: summary.firstDate,
            check_in_time: summary.firstIn,
            check_out_time: summary.firstOut,
            work_details: summary.combinedDetails,
            evidence_urls,
            status: initialStatus,
            supervisor_id: supervisorId
        };

        // Notify Supervisor (or HR if no supervisor) & Employee via LINE
        try {
            const { sendMissingCheckinReportNotification } = await import("@/utils/lineMessaging");
            const { formatName } = await import("@/utils/formatName");
            const empDisplayName = formatName(emp?.name || user.emp_id, emp?.nickname);

            const supervisorLineIds: string[] = [];
            if (emp?.supervisor?.line_user_id) supervisorLineIds.push(emp.supervisor.line_user_id);
            if (emp?.secondary_supervisor?.line_user_id) supervisorLineIds.push(emp.secondary_supervisor.line_user_id);

            if (initialStatus === "pending_supervisor" && supervisorLineIds.length > 0) {
                await sendMissingCheckinReportNotification({
                    id: report.id,
                    docNo: report.doc_no,
                    employeeName: empDisplayName,
                    workDate: summary.workDateLabel,
                    checkInTime: summary.firstIn,
                    checkOutTime: summary.firstOut,
                    timeSummaryLabel: summary.timeLabel,
                    workDetails: summary.combinedDetails,
                    evidenceUrls: evidence_urls,
                    status: "pending_supervisor"
                }, supervisorLineIds);
            } else if (initialStatus === "pending_hr" && process.env.HR_LINE_USER_ID) {
                const hrIds = process.env.HR_LINE_USER_ID.split(",").map(s => s.trim()).filter(Boolean);
                await sendMissingCheckinReportNotification({
                    id: report.id,
                    docNo: report.doc_no,
                    employeeName: empDisplayName,
                    workDate: summary.workDateLabel,
                    checkInTime: summary.firstIn,
                    checkOutTime: summary.firstOut,
                    timeSummaryLabel: summary.timeLabel,
                    workDetails: summary.combinedDetails,
                    evidenceUrls: evidence_urls,
                    status: "pending_hr"
                }, hrIds);
            }

            if (emp?.line_user_id) {
                await sendMissingCheckinReportNotification({
                    id: report.id,
                    docNo: report.doc_no,
                    employeeName: empDisplayName,
                    workDate: summary.workDateLabel,
                    checkInTime: summary.firstIn,
                    checkOutTime: summary.firstOut,
                    timeSummaryLabel: summary.timeLabel,
                    workDetails: summary.combinedDetails,
                    evidenceUrls: evidence_urls,
                    status: initialStatus,
                    hideButtons: true
                }, [emp.line_user_id]);
            }
        } catch (notifyErr) {
            console.error("Missing check-in report notification error:", notifyErr);
        }

        return NextResponse.json({ ok: true, data: report });
    } catch (e: any) {
        console.error("POST missing-checkin-reports error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await ensureTableExists();
        const body = await request.json();
        const { id, evidence_urls } = body;

        if (!id || !evidence_urls) {
            return NextResponse.json({ ok: false, error: "กรุณากรอกข้อมูลและแนบหลักฐานให้ครบถ้วน" }, { status: 400 });
        }

        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "missing_checkin_reports" WHERE "id" = $1 AND "emp_id" = $2 LIMIT 1`,
            id,
            user.emp_id
        );
        const existing = rows?.[0];

        if (!existing) {
            return NextResponse.json({ ok: false, error: "ไม่พบรายการเอกสารที่ต้องการแก้ไข" }, { status: 404 });
        }

        if (existing.status !== "pending_supervisor") {
            return NextResponse.json({ ok: false, error: "ไม่สามารถแก้ไขได้ เนื่องจากเอกสารได้รับการพิจารณาไปแล้ว" }, { status: 400 });
        }

        const periodMonth: string = (body.period_month && /^\d{4}-\d{2}$/.test(body.period_month))
            ? body.period_month
            : derivePeriodMonthFromRow(existing);

        let rawItems: MissingCheckinDayItem[] = [];
        if (Array.isArray(body.items) && body.items.length > 0) {
            rawItems = body.items.map((it: any) => ({
                work_date: String(it.work_date || "").trim(),
                check_in_time: String(it.check_in_time || "").trim(),
                check_out_time: String(it.check_out_time || "").trim(),
                work_details: String(it.work_details || "").trim()
            }));
        } else if (body.work_date) {
            rawItems = [{
                work_date: String(body.work_date).trim(),
                check_in_time: String(body.check_in_time || "").trim(),
                check_out_time: String(body.check_out_time || "").trim(),
                work_details: String(body.work_details || "").trim()
            }];
        }

        if (rawItems.length === 0) {
            return NextResponse.json({ ok: false, error: "กรุณาระบุรายการวันที่ไม่ได้ลงเวลาอย่างน้อย 1 วัน" }, { status: 400 });
        }

        for (let i = 0; i < rawItems.length; i++) {
            const it = rawItems[i];
            if (!it.work_date || !it.check_in_time || !it.check_out_time || !it.work_details) {
                return NextResponse.json({
                    ok: false,
                    error: `กรุณากรอกวันที่ เวลาเข้า-ออก และรายละเอียดงานให้ครบถ้วน (รายการที่ ${i + 1})`
                }, { status: 400 });
            }
        }

        const summary = buildCombinedSummaryFromItems(rawItems, periodMonth);
        const reportItemsJson = JSON.stringify(summary.sortedItems);

        await prisma.$executeRawUnsafe(
            `UPDATE "missing_checkin_reports"
             SET "period_month" = $1,
                 "report_items" = $2,
                 "work_date" = $3::date,
                 "check_in_time" = $4,
                 "check_out_time" = $5,
                 "work_details" = $6,
                 "evidence_urls" = $7,
                 "updated_at" = NOW()
             WHERE "id" = $8 AND "emp_id" = $9`,
            periodMonth,
            reportItemsJson,
            summary.firstDate,
            summary.firstIn,
            summary.firstOut,
            summary.combinedDetails,
            evidence_urls,
            id,
            user.emp_id
        );

        return NextResponse.json({ ok: true, doc_no: existing.doc_no });
    } catch (e: any) {
        console.error("PUT missing-checkin-reports error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await ensureTableExists();
        const url = new URL(request.url);
        const id = url.searchParams.get("id");

        if (!id) {
            return NextResponse.json({ ok: false, error: "ไม่พบรหัสเอกสาร" }, { status: 400 });
        }

        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "missing_checkin_reports" WHERE "id" = $1 AND "emp_id" = $2 LIMIT 1`,
            id,
            user.emp_id
        );
        const existing = rows?.[0];

        if (!existing) {
            return NextResponse.json({ ok: false, error: "ไม่พบรายการเอกสารที่ต้องการลบ" }, { status: 404 });
        }

        if (existing.status !== "pending_supervisor") {
            return NextResponse.json({ ok: false, error: "ไม่สามารถลบได้ เนื่องจากเอกสารได้รับการพิจารณาไปแล้ว" }, { status: 400 });
        }

        await prisma.$executeRawUnsafe(
            `DELETE FROM "missing_checkin_reports" WHERE "id" = $1 AND "emp_id" = $2`,
            id,
            user.emp_id
        );

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("DELETE missing-checkin-reports error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
