import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { getTodayBangkokISO, getNowBangkok, getBangkokWallClock } from "@/utils/time";
import { calcLateOT } from "@/utils/checkin";

type CheckType = "Check-in" | "Check-out" | "Project-In" | "Project-Out" | "Offsite-In" | "Offsite-Out" | "Trip-Update";

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

        // 🔥 OPTIMIZATION: Fetch employee and supervisor in ONE query
        const emp = await prisma.employees.findUnique({
            where: { emp_id: payload.emp_id },
            include: { supervisor: { select: { line_user_id: true, name: true } } },
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

    const date_key = new Date(getTodayBangkokISO());

    let list: any[];
    try {
        list = await (prisma.checkins.findMany as any)({
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
                is_trip: true,
                lat: true,
                lon: true,
            },
        });
    } catch (e: any) {
        console.error("[API/CHECKIN] GET DB Error:", e);
        // Fallback or re-try without newer columns if DB is out of sync during migrations
        list = await (prisma.checkins.findMany as any)({
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
                lat: true,
                lon: true,
            },
        });
    }

    // 🔥 FIX BigInt
    const safeList = list.map((row: any) => ({
        ...row,
        id: row.id.toString(),
    }));

    return NextResponse.json({
        ok: true,
        date_key: getTodayBangkokISO(),
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
    const branch_id = String(body?.branch_id || auth.emp.branch_id || "").trim();
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    const accuracy = body?.accuracy ? Number(body.accuracy) : null;
    const photo_url = body?.photo_url ? String(body.photo_url) : null;
    const project_name = body?.project_name ? String(body.project_name).trim() : null;
    const customer_id = body?.customer_id ? Number(body.customer_id) : null;
    const remark = body?.remark ? String(body.remark).trim() : null;
    const is_trip = Boolean(body?.is_trip);

    if (!["Check-in", "Check-out", "Project-In", "Project-Out", "Offsite-In", "Offsite-Out", "Trip-Update"].includes(type))
        return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });

    if (!branch_id)
        return NextResponse.json({ error: "MISSING_BRANCH" }, { status: 400 });

    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return NextResponse.json({ error: "GPS_REQUIRED" }, { status: 400 });

    if (!photo_url)
        return NextResponse.json({ error: "PHOTO_REQUIRED" }, { status: 400 });

    // 🔥 OPTIMIZATION: Parallel Fetch Data (Branch, Project, Today's Check-ins)
    const date_key = new Date(getTodayBangkokISO());
    const [branch, project, todaysCheckins] = await Promise.all([
        prisma.branches.findUnique({ where: { id: branch_id } }),
        customer_id ? prisma.projects.findUnique({ where: { id: customer_id } }) : Promise.resolve(null),
        prisma.checkins.findMany({
            where: { emp_id: auth.emp.emp_id, date_key },
            select: { type: true, customer_id: true, project_name: true }
        })
    ]);

    if (!branch)
        return NextResponse.json({ error: "INVALID_BRANCH" }, { status: 400 });

    if (customer_id && !project)
        return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });

    const isProject = type.startsWith("Project");
    const isOffsite = type.startsWith("Offsite") || type === "Trip-Update";

    let targetLat = Number(branch.center_lat);
    let targetLon = Number(branch.center_lon);
    let targetRad = branch.radius_m;

    if (isProject && project) {
        targetLat = Number(project.lat || 0);
        targetLon = Number(project.lng || 0);
        targetRad = project.radius_m || 200;
    }

    // Radius Check
    const isUnmapped = targetLat === 0 && targetLon === 0 && targetRad === 0;
    const distance = (isUnmapped || isOffsite) ? 0 : getDistanceMeters(lat, lon, targetLat, targetLon);

    if (!(isUnmapped || isOffsite) && distance > targetRad) {
        return NextResponse.json(
            { error: "OUT_OF_RADIUS", distance: Math.round(distance), radius_m: targetRad },
            { status: 403 }
        );
    }

    // Time-based calculations
    const time_key = getBangkokWallClock();
    const lateInfo = type.startsWith("Project") || type.startsWith("Offsite") || type === "Trip-Update" 
        ? { status: "ontime", min: 0, label: "ตรงเวลา" } 
        : calcLateOT(type as "Check-in" | "Check-out");

    // 🔥 OPTIMIZATION: Validation Logic in-memory using todaysCheckins
    if (type === "Check-out" || type === "Project-Out" || type === "Offsite-Out") {
        let inType = "Check-in";
        if (type === "Project-Out") inType = "Project-In";
        else if (type === "Offsite-Out") inType = "Offsite-In";

        const hasIn = todaysCheckins.find(c => 
            c.type === inType && 
            (type === "Project-Out" ? (customer_id ? c.customer_id === customer_id : c.project_name === project_name) : true)
        );

        if (!hasIn)
            return NextResponse.json({ error: "MUST_CHECKIN_FIRST" }, { status: 400 });
    }

    // Duplicate Check
    if (type === "Check-in" || type === "Check-out") {
        const exists = todaysCheckins.find(c => c.type === type);
        if (exists)
            return NextResponse.json({ error: "DUPLICATE_TODAY" }, { status: 409 });
    }

    let row: any;
    try {
        row = await (prisma.checkins.create as any)({
            data: {
                timestamp: getNowBangkok(),
                date_key,
                time_key,
                emp_id: auth.emp.emp_id,
                name: auth.emp.name,
                type: type as string,
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
                is_trip,
                late_status: lateInfo.status,
                late_min: lateInfo.min ?? null,
            },
            select: { id: true },
        });
    } catch (e: any) {
        console.warn("[API/CHECKIN] POST DB Error (is_trip col missing?):", e.message);
        // Fallback without is_trip
        row = await (prisma.checkins.create as any)({
            data: {
                timestamp: getNowBangkok(),
                date_key,
                time_key,
                emp_id: auth.emp.emp_id,
                name: auth.emp.name,
                type: type as string,
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
    }

    // 📢 AUTOMATED TRACKING NOTIFICATION (Non-blocking Background Task)
    if (is_trip || (type as string) === "Trip-Update" || type === "Check-out") {
        const handleNotification = async () => {
            try {
                const targetLineIds = [];
                // 🔥 Re-using supervisor info fetched in requireEmployee to save 1 query
                if ((auth.emp as any).supervisor?.line_user_id) {
                    targetLineIds.push((auth.emp as any).supervisor.line_user_id);
                }
                if (process.env.HR_LINE_USER_ID) {
                    targetLineIds.push(process.env.HR_LINE_USER_ID);
                }

                const { sendTripUpdateNotification, sendCheckoutOtVerificationNotification } = await import("@/utils/lineMessaging");

                // Case 1: Trip or Manual Update
                if (is_trip || (type as string) === "Trip-Update") {
                    if (targetLineIds.length > 0) {
                        const [locPart, notePart] = (remark || "").split(" | ");
                        await sendTripUpdateNotification(targetLineIds, {
                            empName: auth.emp.name,
                            locationName: locPart || branch.name,
                            timestamp: new Date().toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' }),
                            photoUrl: photo_url!,
                            lat: lat || undefined,
                            lon: lon || undefined,
                            remark: notePart || undefined
                        });
                    }
                }

                // Case 2: Check-out with OT Verification
                if (type === "Check-out") {
                    const approvedOt = await prisma.ot_requests.findFirst({
                        where: {
                            emp_id: auth.emp.emp_id,
                            date_for: date_key,
                            status: "approved"
                        },
                        orderBy: { created_at: "desc" }
                    });

                    if (approvedOt) {
                        const actualOut = new Date();
                        const requestedEnd = new Date(approvedOt.end_time);
                        
                        // Calculate diff in minutes
                        const diffMins = Math.floor((actualOut.getTime() - requestedEnd.getTime()) / 60000);
                        const hasDiscrepancy = diffMins < -5; // Left more than 5 mins early
                        const status = hasDiscrepancy ? "early" : (diffMins > 15 ? "late" : "ontime");

                        // Update OT record
                        await prisma.ot_requests.update({
                            where: { id: approvedOt.id },
                            data: {
                                actual_end_at: actualOut,
                                has_discrepancy: hasDiscrepancy
                            }
                        });

                        // Get Check-in for "Actual In" time
                        const checkIn = todaysCheckins.find(c => c.type === "Check-in");
                        const actualInStr = checkIn ? "บันทึกเข้า" : "—"; // simplified for now or fetch full record

                        // Send Verification Notification
                        await sendCheckoutOtVerificationNotification({
                            empName: auth.emp.name,
                            dateFor: date_key.toLocaleDateString("th-TH"),
                            requestedTime: `${new Date(approvedOt.start_time).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })} - ${requestedEnd.toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })}`,
                            actualIn: checkIn ? "ช่วงเช้า" : "—", // In a real scenario, we'd fetch the exact time
                            actualOut: actualOut.toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' }),
                            status,
                            diffMins: Math.abs(diffMins),
                            photoUrl: photo_url!
                        });
                    }
                }
            } catch (e) {
                console.error("[API/CHECKIN] Notification Error:", e);
            }
        };

        // 🔥 Execute without await to avoid blocking the main API response
        handleNotification();
    }

    return NextResponse.json({
        ok: true,
        id: row.id.toString(), // 🔥 FIX BigInt
        distance: Math.round(distance),
    });
}
