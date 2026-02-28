import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import crypto from "crypto";

export const runtime = "nodejs";

type TokenPayload = { emp_id: string; role: "employee" | "admin" };

type LeaveTypeDef = {
    id: string;
    name: string;
    max_days?: number; // ต่อครั้ง/ต่อปี (ใช้เป็น guideline)
    gender?: "M" | "F" | "ANY";
    note?: string;
    advance_notice?: number; // in days
};

const LEAVE_TYPES: LeaveTypeDef[] = [
    { id: "annual", name: "ลาพักร้อน", gender: "ANY", note: "เริ่ม 6 วัน/ปี ปรับตามอายุงาน", advance_notice: 30 },
    { id: "sick", name: "ลาป่วย", gender: "ANY", note: "ลาป่วย > 2 วันทำงาน ต้องแนบเอกสาร", advance_notice: 0 },
    { id: "personal", name: "ลากิจ", gender: "ANY", advance_notice: 3 },
    { id: "unpaid", name: "ลาไม่รับค่าจ้าง", gender: "ANY", advance_notice: 0 },

    { id: "maternity", name: "ลาคลอด", gender: "F", max_days: 120, advance_notice: 30 },
    { id: "paternity", name: "ลาดูแลภรรยาคลอดบุตร", gender: "M", max_days: 15, advance_notice: 15 },
    { id: "ordination", name: "ลาบวช", gender: "M", max_days: 15, advance_notice: 0 },
];

function toDateKeyBangkok(d: Date) {
    // date key by Bangkok date
    const s = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const y = s.getFullYear();
    const m = String(s.getMonth() + 1).padStart(2, "0");
    const day = String(s.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function isWeekendBangkok(dateKeyYYYYMMDD: string) {
    const [y, m, d] = dateKeyYYYYMMDD.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay(); // 0 Sun 6 Sat
    return dow === 0; // Only Sunday is considered a weekend/day off
}

async function countWorkingDaysBangkokInclusive(startAt: Date, endAt: Date) {
    const startKey = toDateKeyBangkok(startAt);
    const endKey = toDateKeyBangkok(endAt);

    const start = new Date(`${startKey}T00:00:00`);
    const end = new Date(`${endKey}T00:00:00`);

    const holidays = await prisma.holidays.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true },
    });

    const holidaySet = new Set(holidays.map((h) => {
        const d = new Date(h.date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }));

    let days = 0;
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const day = String(cur.getDate()).padStart(2, "0");
        const key = `${y}-${m}-${day}`;
        if (isWeekendBangkok(key)) continue;
        if (holidaySet.has(key)) continue;
        days += 1;
    }
    return days;
}

function calcMinutes(startAt: Date, endAt: Date) {
    const ms = endAt.getTime() - startAt.getTime();
    return Math.max(0, Math.floor(ms / 60000));
}

export async function calculateEntitlements(empId: string, hireDate: Date | null) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    let years = 0;
    if (hireDate) {
        const msInYear = 365.25 * 24 * 3600 * 1000;
        years = (now.getTime() - hireDate.getTime()) / msInYear;
    }

    // Get all defined entitlements
    const definedEntitlements = await prisma.leave_entitlements.findMany({
        orderBy: { min_years: 'desc' }
    });

    const quotas: Record<string, number> = {};

    // Annual Leave calculation (Special Rules)
    const annualTier = definedEntitlements.filter(e => e.leave_type_id === 'annual');
    if (years >= 1 && hireDate) {
        // Rule: After 1st year completion, calculate service years as of Dec 31 of this year
        const yearsAtEndOfYear = (endOfYear.getTime() - hireDate.getTime()) / (365.25 * 24 * 3600 * 1000);
        const match = annualTier.find(ent => yearsAtEndOfYear >= ent.min_years);
        if (match) {
            quotas['annual'] = match.days;
        }
    } else {
        // Less than 1 year or no hire date = 0 annual leave
        quotas['annual'] = 0;
    }

    // Other Leave Types (Standard Rule)
    for (const ent of definedEntitlements) {
        if (ent.leave_type_id === 'annual') continue;
        if (years >= ent.min_years) {
            if (!(ent.leave_type_id in quotas)) {
                quotas[ent.leave_type_id] = ent.days;
            }
        }
    }

    // Get used days for the current year
    const startOfCurrentYear = new Date(currentYear, 0, 1);
    const endOfCurrentYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    const usedLeaves = await prisma.leave_requests.findMany({
        where: {
            emp_id: empId,
            status: { in: ["pending", "approved", "pending_supervisor", "pending_hr"] },
            start_date: { gte: startOfCurrentYear },
            end_date: { lte: endOfCurrentYear }
        },
        select: { leave_type_id: true, days: true }
    });

    const used: Record<string, number> = {};
    for (const req of usedLeaves) {
        used[req.leave_type_id] = (used[req.leave_type_id] || 0) + req.days;
    }

    return { quotas, used };
}

export async function GET() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    let p: TokenPayload;
    try {
        p = verifyToken(token) as TokenPayload;
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const emp = await prisma.employees.findUnique({
        where: { emp_id: p.emp_id },
        select: { emp_id: true, name: true, gender: true, hire_date: true, supervisor_id: true },
    });
    if (!emp) return NextResponse.json({ error: "EMP_NOT_FOUND" }, { status: 404 });

    const { quotas, used } = await calculateEntitlements(emp.emp_id, emp.hire_date);

    // ส่ง types ที่ “ใช้ได้” ตามเพศ
    const types = LEAVE_TYPES
        .filter((t) => t.gender === "ANY" || t.gender === emp.gender)
        .map((t) => ({
            id: t.id,
            name: t.name,
            max_days: t.max_days ?? null,
            require_attachment: t.id === "sick", // เงื่อนไขละเอียดจะ validate ตอน POST/trigger
            note: t.note ?? null,
            quota: quotas[t.id] ?? null,
            used: used[t.id] ?? 0,
            advance_notice: t.advance_notice ?? 0,
        }));

    const list = await prisma.leave_requests.findMany({
        where: { emp_id: p.emp_id },
        orderBy: { timestamp: "desc" },
        select: {
            id: true,
            timestamp: true,
            leave_type: true,
            leave_type_id: true,
            start_at: true,
            end_at: true,
            minutes: true,
            days: true,
            status: true,
            reason: true,
            attachment_url: true,
        },
    });

    return NextResponse.json({ ok: true, types, list });
}

export async function POST(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    let p: TokenPayload;
    try {
        p = verifyToken(token) as TokenPayload;
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const leave_type_id = String(body?.leave_type_id || "").trim();
    const start_at_s = String(body?.start_at || "").trim();
    const end_at_s = String(body?.end_at || "").trim();
    const reason = body?.reason ? String(body.reason) : null;
    const attachment_url = body?.attachment_url ? String(body.attachment_url) : null;

    const def = LEAVE_TYPES.find((x) => x.id === leave_type_id);
    if (!def) return NextResponse.json({ error: "INVALID_LEAVE_TYPE" }, { status: 400 });

    const startAt = new Date(start_at_s);
    const endAt = new Date(end_at_s);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        return NextResponse.json({ error: "INVALID_DATETIME" }, { status: 400 });
    }
    if (endAt < startAt) return NextResponse.json({ error: "END_BEFORE_START" }, { status: 400 });

    const emp = await prisma.employees.findUnique({
        where: { emp_id: p.emp_id },
        select: { emp_id: true, name: true, gender: true, hire_date: true, supervisor_id: true },
    });
    if (!emp) return NextResponse.json({ error: "EMP_NOT_FOUND" }, { status: 404 });

    // Enforce advance notice based on Thailand timezone calendar day difference
    if (def.advance_notice && def.advance_notice > 0) {
        const nowForNotice = new Date();
        const startNoticeDate = new Date(startAt.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const currentDate = new Date(nowForNotice.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));

        startNoticeDate.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);

        const noticeDays = Math.floor((startNoticeDate.getTime() - currentDate.getTime()) / (1000 * 3600 * 24));
        if (noticeDays < def.advance_notice) {
            return NextResponse.json({ error: "ADVANCE_NOTICE_REQUIRED", required_days: def.advance_notice, days: noticeDays }, { status: 400 });
        }
    }

    // กรองตามเพศ (ชั้น API อีกชั้น)
    if (def.gender && def.gender !== "ANY" && def.gender !== (emp.gender as any)) {
        return NextResponse.json({ error: "GENDER_NOT_ALLOWED" }, { status: 403 });
    }

    // กันช่วงเวลาซ้อนกัน (pending/approved) แบบ timestamptz
    const overlap = await prisma.leave_requests.findFirst({
        where: {
            emp_id: p.emp_id,
            status: { in: ["pending", "approved"] },
            AND: [{ start_at: { lte: endAt } }, { end_at: { gte: startAt } }],
        },
        select: { id: true },
    });
    if (overlap) return NextResponse.json({ error: "OVERLAP_LEAVE" }, { status: 409 });

    const minutes = calcMinutes(startAt, endAt);
    if (minutes <= 0) return NextResponse.json({ error: "ZERO_MINUTES" }, { status: 400 });

    const days = await countWorkingDaysBangkokInclusive(startAt, endAt);
    if (days <= 0) return NextResponse.json({ error: "ZERO_WORKING_DAYS" }, { status: 400 });

    // เงื่อนไข: ลาป่วยเกิน 2 วันทำงาน (>=3) ต้องแนบเอกสาร
    if (leave_type_id === "sick" && days >= 3 && (!attachment_url || attachment_url.trim().length === 0)) {
        return NextResponse.json({ error: "SICK_ATTACHMENT_REQUIRED", days }, { status: 400 });
    }

    // Rule: Personal leave is limited to a maximum of 3 consecutive days
    if (leave_type_id === "personal" && days > 3) {
        return NextResponse.json({ error: "MAX_3_CONSECUTIVE_DAYS", days }, { status: 400 });
    }

    // Rule: Annual Leave must be full working days (08:00 - 17:00)
    if (leave_type_id === "annual") {
        const startH = startAt.getHours();
        const startM = startAt.getMinutes();
        const endH = endAt.getHours();
        const endM = endAt.getMinutes();

        // 08:00 to 17:00 check (assuming these are the full day hours from config)
        if (startH !== 8 || startM !== 0 || endH !== 17 || endM !== 0) {
            return NextResponse.json({ error: "ANNUAL_FULL_DAYS_ONLY" }, { status: 400 });
        }
    }

    // Quota validation
    if (["annual", "personal", "sick"].includes(leave_type_id)) {
        const { quotas, used } = await calculateEntitlements(emp.emp_id, emp.hire_date);

        // If there is an entitlement definition for this type
        if (leave_type_id in quotas) {
            const ent = quotas[leave_type_id];
            const alreadyUsed = used[leave_type_id] || 0;
            if (days + alreadyUsed > ent) {
                return NextResponse.json({ error: "EXCEED_ENTITLEMENT", entitlement_days: ent, used: alreadyUsed, remaining: Math.max(0, ent - alreadyUsed), requested: days }, { status: 400 });
            }
        } else if (leave_type_id === "annual") {
            // If annual leave doesn't have an entitlement (e.g. < 1 year and no 0-year policy defined, block it entirely)
            return NextResponse.json({ error: "NO_ENTITLEMENT", entitlement_days: 0 }, { status: 400 });
        }
    }

    const id = `LV-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`; // varchar(30)

    try {
        await prisma.leave_requests.create({
            data: {
                id,
                emp_id: emp.emp_id,
                name: emp.name,
                leave_type_id,
                leave_type: def.name,
                start_at: startAt,
                end_at: endAt,
                minutes,
                // คง start_date/end_date ไว้เพื่อ compatibility/report แบบเดิม (ถ้ายังมี)
                start_date: new Date(toDateKeyBangkok(startAt)),
                end_date: new Date(toDateKeyBangkok(endAt)),
                days,
                reason,
                attachment_url,
                status: emp.supervisor_id ? "pending_supervisor" : "pending_hr",
                supervisor_id: emp.supervisor_id || null,
            },
        });
    } catch (e: any) {
        // ถ้า trigger DB โยน error จะมาเข้าตรงนี้
        const msg = String(e?.message || "");
        if (msg.includes("SICK_ATTACHMENT_REQUIRED")) {
            return NextResponse.json({ error: "SICK_ATTACHMENT_REQUIRED", days }, { status: 400 });
        }
        if (msg.includes("GENDER_NOT_ALLOWED_MATERNITY") || msg.includes("GENDER_NOT_ALLOWED_ORDINATION") || msg.includes("GENDER_NOT_ALLOWED_PATERNITY")) {
            return NextResponse.json({ error: "GENDER_NOT_ALLOWED" }, { status: 403 });
        }
        return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id, days, minutes });
}
