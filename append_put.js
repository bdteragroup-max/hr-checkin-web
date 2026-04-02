const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'api', 'leave', 'route.ts');
let code = fs.readFileSync(filePath, 'utf8');

const putCode = `
export async function PUT(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    let p: TokenPayload;
    try {
        p = verifyToken(token) as TokenPayload;
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

    const existing = await prisma.leave_requests.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (existing.emp_id !== p.emp_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
    if (!existing.status.startsWith("pending")) return NextResponse.json({ error: "CANNOT_EDIT_APPROVED" }, { status: 400 });

    const leave_type_id = String(body?.leave_type_id || "").trim();
    const start_at_s = String(body?.start_at || "").trim();
    const end_at_s = String(body?.end_at || "").trim();
    const reason = body?.reason ? String(body.reason) : null;
    const attachment_url = body?.attachment_url !== undefined ? (body.attachment_url ? String(body.attachment_url) : null) : existing.attachment_url;

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
        select: { emp_id: true, name: true, gender: true, hire_date: true, supervisor_id: true, is_on_trial: true },
    });
    if (!emp) return NextResponse.json({ error: "EMP_NOT_FOUND" }, { status: 404 });

    if ((leave_type_id === "personal" || leave_type_id === "emergency") && emp.is_on_trial) {
        return NextResponse.json({ error: "PROBATION_PERSONAL_NOT_ALLOWED" }, { status: 403 });
    }

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

    if (def.gender && def.gender !== "ANY" && def.gender !== (emp.gender as any)) {
        return NextResponse.json({ error: "GENDER_NOT_ALLOWED" }, { status: 403 });
    }

    const overlap = await prisma.leave_requests.findFirst({
        where: {
            id: { not: id },
            emp_id: p.emp_id,
            status: { in: ["pending", "approved", "pending_supervisor", "pending_hr"] },
            AND: [{ start_at: { lte: endAt } }, { end_at: { gte: startAt } }],
        },
        select: { id: true },
    });
    if (overlap) return NextResponse.json({ error: "OVERLAP_LEAVE" }, { status: 409 });

    const minutes = calcMinutes(startAt, endAt);
    if (minutes <= 0) return NextResponse.json({ error: "ZERO_MINUTES" }, { status: 400 });

    const days = await countWorkingDaysBangkokInclusive(startAt, endAt);
    if (days <= 0) return NextResponse.json({ error: "ZERO_WORKING_DAYS" }, { status: 400 });

    if (leave_type_id === "sick" && days >= 3 && (!attachment_url || attachment_url.trim().length === 0)) {
        return NextResponse.json({ error: "SICK_ATTACHMENT_REQUIRED", days }, { status: 400 });
    }

    if (leave_type_id === "personal" && days > 3) {
        return NextResponse.json({ error: "MAX_3_CONSECUTIVE_DAYS", days }, { status: 400 });
    }

    if (leave_type_id === "annual") {
        const startH = startAt.getHours();
        const startM = startAt.getMinutes();
        const endH = endAt.getHours();
        const endM = endAt.getMinutes();

        if (startH !== 8 || startM !== 0 || endH !== 17 || endM !== 0) {
            return NextResponse.json({ error: "ANNUAL_FULL_DAYS_ONLY" }, { status: 400 });
        }
    }

    if (["annual", "personal", "sick"].includes(leave_type_id)) {
        const { quotas, used } = await calculateEntitlements(emp.emp_id, emp.hire_date, emp.is_on_trial);

        if (leave_type_id in quotas) {
            const ent = quotas[leave_type_id];
            const oldDays = (existing.leave_type_id === leave_type_id) ? existing.days : 0;
            const alreadyUsed = (used[leave_type_id] || 0) - oldDays;
            
            if (days + alreadyUsed > ent) {
                return NextResponse.json({ error: "EXCEED_ENTITLEMENT", entitlement_days: ent, used: alreadyUsed, remaining: Math.max(0, ent - alreadyUsed), requested: days }, { status: 400 });
            }
        } else if (leave_type_id === "annual") {
            return NextResponse.json({ error: "NO_ENTITLEMENT", entitlement_days: 0 }, { status: 400 });
        }
    }

    try {
        await prisma.leave_requests.update({
            where: { id },
            data: {
                leave_type_id,
                leave_type: def.name,
                start_at: startAt,
                end_at: endAt,
                minutes,
                start_date: new Date(toDateKeyBangkok(startAt)),
                end_date: new Date(toDateKeyBangkok(endAt)),
                days,
                reason,
                attachment_url,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id, days, minutes });
}
`;

fs.writeFileSync(filePath, code + '\n' + putCode);
console.log('Appended PUT method');
