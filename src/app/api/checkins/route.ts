import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { calcLateOT } from "@/utils/checkin";

type CheckType = "Check-in" | "Check-out" | "Project-In" | "Project-Out";

function dateKeyLocalISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// Haversine
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function requireEmployee() {
    const token = (await cookies()).get("token")?.value;
    if (!token)
        return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };

    try {
        const payload = verifyToken(token);

        const emp = await prisma.employees.findUnique({
            where: { emp_id: payload.emp_id },
            select: { emp_id: true, name: true, is_active: true },
        });

        if (!emp || !emp.is_active)
            return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };

        return { emp };
    } catch {
        return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    }
}

/* ============================
   GET - รายการวันนี้
============================ */

export async function GET() {
    const auth = await requireEmployee();
    if ("error" in auth) return auth.error;

    const date_key = new Date(dateKeyLocalISO());

    const list = await prisma.checkins.findMany({
        where: { emp_id: auth.emp.emp_id, date_key },
        orderBy: { timestamp: "asc" },
        select: {
            id: true,
            type: true,
            timestamp: true,
            branch_name: true,
            distance: true,
            photo_url: true,
            project_name: true,
            remark: true,
        },
    });

    // 🔥 FIX BigInt
    const safeList = list.map((row) => ({
        ...row,
        id: row.id.toString(),
    }));

    return NextResponse.json({
        ok: true,
        date_key: dateKeyLocalISO(),
        list: safeList,
    });
}

/* ============================
   POST - Check-in / Check-out
============================ */

export async function POST(req: Request) {
    const auth = await requireEmployee();
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => null);

    const type = String(body?.type || "").trim() as CheckType;
    const branch_id = String(body?.branch_id || "").trim();
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    const accuracy = body?.accuracy ? Number(body.accuracy) : null;
    const photo_url = body?.photo_url ? String(body.photo_url) : null;
    const project_name = body?.project_name ? String(body.project_name).trim() : null;
    const customer_id = body?.customer_id ? Number(body.customer_id) : null;
    const remark = body?.remark ? String(body.remark).trim() : null;

    if (!["Check-in", "Check-out", "Project-In", "Project-Out"].includes(type))
        return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });

    if (!branch_id)
        return NextResponse.json({ error: "MISSING_BRANCH" }, { status: 400 });

    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return NextResponse.json({ error: "GPS_REQUIRED" }, { status: 400 });

    if (!photo_url)
        return NextResponse.json({ error: "PHOTO_REQUIRED" }, { status: 400 });

    const branch = await prisma.branches.findUnique({
        where: { id: branch_id },
    });

    if (!branch)
        return NextResponse.json({ error: "INVALID_BRANCH" }, { status: 400 });

    const distance = getDistanceMeters(
        lat,
        lon,
        Number(branch.center_lat),
        Number(branch.center_lon)
    );

    if (distance > branch.radius_m) {
        return NextResponse.json(
            {
                error: "OUT_OF_RADIUS",
                distance: Math.round(distance),
                radius_m: branch.radius_m,
            },
            { status: 403 }
        );
    }

    const date_key = new Date(dateKeyLocalISO());
    const time_key = new Date();
    const lateInfo = type.startsWith("Project") ? { status: null, min: null, label: null } : calcLateOT(type as "Check-in" | "Check-out");

    // ❗ กัน Check-out ก่อน Check-in
    if (type === "Check-out" || type === "Project-Out") {
        const inType = type === "Project-Out" ? "Project-In" : "Check-in";
        const hasIn = await prisma.checkins.findFirst({
            where: {
                emp_id: auth.emp.emp_id,
                date_key,
                type: inType,
                ...(type === "Project-Out" ? (customer_id ? { customer_id } : { project_name: project_name || null }) : {})
            },
        });

        if (!hasIn)
            return NextResponse.json({ error: "MUST_CHECKIN_FIRST" }, { status: 400 });
    }

    // ❗ กันซ้ำในวันเดียว (สำหรับ Check-in/Check-out ปกติ ให้ Check-in ได้ครั้งเดียว)
    if (type === "Check-in" || type === "Check-out") {
        const exists = await prisma.checkins.findFirst({
            where: {
                emp_id: auth.emp.emp_id,
                date_key,
                type,
            },
        });

        if (exists)
            return NextResponse.json({ error: "DUPLICATE_TODAY" }, { status: 409 });
    }

    const row = await prisma.checkins.create({
        data: {
            timestamp: new Date(),
            date_key,
            time_key,
            emp_id: auth.emp.emp_id,
            name: auth.emp.name,
            type,
            branch_name: branch.name,
            lat,
            lon,
            accuracy,
            distance: Math.round(distance),
            capture_mode: "webrtc",
            photo_url,
            project_name,
            customer_id,
            remark,
            late_status: lateInfo.status,
            late_min: lateInfo.min ?? null,
        },
        select: { id: true },
    });

    return NextResponse.json({
        ok: true,
        id: row.id.toString(), // 🔥 FIX BigInt
        distance: Math.round(distance),
    });
}
