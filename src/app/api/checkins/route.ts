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

        if (emp.nickname) {
            emp.name = `${emp.name} (${emp.nickname})`;
        }

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

    // 🌙 MIDNIGHT SHIFT: between 00:00 and 06:00 BKK, also include yesterday's records
    const bkkNow = getBangkokWallClock();
    const bkkHour = bkkNow.getHours();
    const isPostMidnight = bkkHour >= 0 && bkkHour < 6;

    let yesterday_date_key: Date | null = null;
    if (isPostMidnight) {
        const yest = new Date(bkkNow);
        yest.setDate(yest.getDate() - 1);
        const yISO = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
        yesterday_date_key = new Date(yISO);
    }

    const selectFields = {
        id: true, type: true, timestamp: true, branch_name: true,
        distance: true, photo_url: true, project_name: true, remark: true,
        is_trip: true, lat: true, lon: true,
    };

    let list: any[];
    try {
        const queries = [
            (prisma.checkins.findMany as any)({ where: { emp_id: auth.emp.emp_id, date_key }, orderBy: { timestamp: "asc" }, select: selectFields })
        ];
        if (yesterday_date_key) {
            queries.push((prisma.checkins.findMany as any)({ where: { emp_id: auth.emp.emp_id, date_key: yesterday_date_key }, orderBy: { timestamp: "asc" }, select: selectFields }));
        }
        const results = await Promise.all(queries);
        // Merge and deduplicate by id; prefer records from yesterday's shift when post-midnight
        const combined = [...(results[1] || []), ...results[0]];
        const seen = new Set<string>();
        list = combined.filter((r: any) => { const k = String(r.id); if (seen.has(k)) return false; seen.add(k); return true; });
    } catch (e: any) {
        console.error("[API/CHECKIN] GET DB Error:", e);
        list = await (prisma.checkins.findMany as any)({
            where: { emp_id: auth.emp.emp_id, date_key },
            orderBy: { timestamp: "asc" },
            select: { id: true, type: true, timestamp: true, branch_name: true, distance: true, photo_url: true, project_name: true, remark: true, lat: true, lon: true },
        });
    }

    // 🔥 FIX BigInt
    const safeList = list.map((row: any) => ({
        ...row,
        id: row.id.toString(),
    }));

    // The displayed date key is yesterday's if we are in post-midnight and have relevant records from yesterday
    const displayKey = isPostMidnight && yesterday_date_key && safeList.some((r: any) => {
        const d = new Date(r.timestamp);
        return d.toDateString() === yesterday_date_key!.toDateString();
    }) ? yesterdayISO(yesterday_date_key) : getTodayBangkokISO();

    return NextResponse.json({
        ok: true,
        date_key: displayKey,
        list: safeList,
    });
}

function yesterdayISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


/* ============================
   POST - Check-in / Check-out
============================ */

export async function POST(req: Request) {
    const auth = await requireEmployee();
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => null);

    const type = String(body?.type || "").trim() as CheckType;
    let branch_id = String(body?.branch_id || auth.emp.branch_id || "").trim();

    // Enforce branch matching: Normal check-in MUST be at the employee's assigned branch
    if (type === "Check-in" || type === "Check-out") {
        if (auth.emp.branch_id) {
            branch_id = auth.emp.branch_id;
        }
    }
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

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0))
        return NextResponse.json({ error: "GPS_REQUIRED" }, { status: 400 });

    if (!photo_url)
        return NextResponse.json({ error: "PHOTO_REQUIRED" }, { status: 400 });

    // 🌙 MIDNIGHT SHIFT SUPPORT
    const date_key = new Date(getTodayBangkokISO());
    // If it's between 00:00 and 06:00 Bangkok time, a checkout might belong
    // to the *previous day's* shift (employee checked in yesterday before midnight).
    const bkkNow = getBangkokWallClock();
    const bkkHour = bkkNow.getHours();
    const isPostMidnight = bkkHour >= 0 && bkkHour < 6;

    // Compute yesterday's date_key for midnight-shift lookups
    const yesterdayBangkok = new Date(bkkNow);
    yesterdayBangkok.setDate(yesterdayBangkok.getDate() - 1);
    const yesterdayISO = `${yesterdayBangkok.getFullYear()}-${String(yesterdayBangkok.getMonth() + 1).padStart(2, '0')}-${String(yesterdayBangkok.getDate()).padStart(2, '0')}`;
    const yesterday_date_key = new Date(yesterdayISO);

    const [branch, project, todaysCheckins, yesterdaysCheckins, empWithPosition, dailyPlan] = await Promise.all([
        prisma.branches.findUnique({ where: { id: branch_id } }),
        customer_id ? prisma.projects.findUnique({ where: { id: customer_id } }) : Promise.resolve(null),
        prisma.checkins.findMany({
            where: { emp_id: auth.emp.emp_id, date_key },
            select: { type: true, customer_id: true, project_name: true }
        }),
        isPostMidnight ? prisma.checkins.findMany({
            where: { emp_id: auth.emp.emp_id, date_key: yesterday_date_key },
            select: { type: true, customer_id: true, project_name: true }
        }) : Promise.resolve([] as { type: string; customer_id: number | null; project_name: string | null }[]),
        prisma.employees.findUnique({
            where: { emp_id: auth.emp.emp_id },
            include: { job_positions: { select: { is_ot_eligible: true } } }
        }),
        prisma.daily_work_plans.findFirst({
            where: { 
                emp_id: auth.emp.emp_id, 
                date: {
                    gte: new Date(`${getTodayBangkokISO()}T00:00:00.000Z`),
                    lte: new Date(`${getTodayBangkokISO()}T23:59:59.999Z`)
                }
            }
        })
    ]);

    if (!branch)
        return NextResponse.json({ error: "INVALID_BRANCH" }, { status: 400 });

    if (customer_id && !project)
        return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });

    // Mandatory Work Plan Enforcement (Backend)
    const isInAction = type === "Check-in" || type === "Project-In" || type === "Offsite-In" || type === "Trip-Update";
    if (isInAction && !dailyPlan && !auth.emp.is_checkin_exempt) {
        console.log(`[CHECKIN_403] Missing plan for ${auth.emp.emp_id} on ${getTodayBangkokISO()} (${date_key.toISOString()}). Action: ${type}`);
        return NextResponse.json({ error: "WORK_PLAN_REQUIRED", message: "กรุณาบันทึกแผนงานประจำวันก่อนทำรายการ" }, { status: 403 });
    }

    const isProject = type.startsWith("Project");
    const isOffsite = type.startsWith("Offsite") || type === "Trip-Update" || is_trip;

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

        // Look in today's checkins first, then yesterday's (for midnight shifts)
        const allCheckins = [...todaysCheckins, ...yesterdaysCheckins];
        let hasIn = allCheckins.find(c =>
            c.type === inType &&
            (type === "Project-Out" ? (customer_id ? c.customer_id === customer_id : c.project_name === project_name) : true)
        );

        // Exception for trips: if they are on a trip, their first action of the day might be a Trip-Update instead of a formal Check-in.
        if (!hasIn && is_trip) {
            hasIn = allCheckins.find(c => c.type === "Trip-Update" || c.type === "Check-in");
        }

        if (!hasIn)
            return NextResponse.json({ error: "MUST_CHECKIN_FIRST" }, { status: 400 });
    }

    // For midnight shifts (00:00–06:00), the checkout record should be stored
    // under the same date_key as the check-in (yesterday), so the shift stays together.
    const effective_date_key = 
        isPostMidnight && (type === "Check-out") && 
        todaysCheckins.every(c => c.type !== "Check-in" && c.type !== "Trip-Update") && 
        yesterdaysCheckins.some(c => c.type === "Check-in" || c.type === "Trip-Update")
            ? yesterday_date_key
            : date_key;

    // Duplicate Check & Creation (Atomic)
    let row: any;
    try {
        row = await prisma.$transaction(async (tx) => {
            if (type === "Check-in" || type === "Check-out") {
                const lastAction = await tx.checkins.findFirst({
                    where: { emp_id: auth.emp.emp_id, date_key: effective_date_key },
                    orderBy: { timestamp: "desc" }
                });
                if (lastAction && lastAction.type === type) {
                    throw new Error("DUPLICATE_TODAY");
                }
            }

            const createdCheckin = await (tx.checkins.create as any)({
                data: {
                    timestamp: getNowBangkok(),
                    date_key: effective_date_key,
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

            let coin_awarded = false;

            // 🏅 COIN AWARD SYSTEM & STREAK LOGIC
            if (type === "Check-in" || type === "Project-In" || type === "Offsite-In") {
                const y = effective_date_key.getFullYear();
                const m = String(effective_date_key.getMonth() + 1).padStart(2, '0');
                const d = String(effective_date_key.getDate()).padStart(2, '0');
                const sourceKey = `checkin:${auth.emp.emp_id}:${y}-${m}-${d}`;
                
                const existingLedger = await tx.coin_ledgers.findUnique({
                    where: { source_key: sourceKey }
                });

                if (!existingLedger) { // Process only once per day
                    const employee = await tx.employees.findUnique({
                        where: { emp_id: auth.emp.emp_id }
                    });

                    let newStreak = 0;

                    if (lateInfo.status === "ontime" || lateInfo.status === "early") {
                        // Calculate previous working day (skip Sunday)
                        const prevWorkingDay = new Date(effective_date_key);
                        prevWorkingDay.setUTCDate(prevWorkingDay.getUTCDate() - 1);
                        if (prevWorkingDay.getUTCDay() === 0) { // Sunday
                            prevWorkingDay.setUTCDate(prevWorkingDay.getUTCDate() - 1); // Back to Saturday
                        }

                        // Check if they were on time on prevWorkingDay
                        const prevCheckin = await tx.checkins.findFirst({
                            where: { 
                                emp_id: auth.emp.emp_id, 
                                date_key: prevWorkingDay,
                                type: { in: ["Check-in", "Project-In", "Offsite-In"] }
                            },
                            orderBy: { timestamp: "asc" }
                        });

                        const wasPrevOnTime = prevCheckin && (prevCheckin.late_status === "ontime" || prevCheckin.late_status === "early");

                        newStreak = wasPrevOnTime ? ((employee as any)?.current_streak || 0) + 1 : 1;
                    } else {
                        // Late: streak resets to 0
                        newStreak = 0;
                    }

                    // Atomic update of current_streak
                    await (tx.employees.update as any)({
                        where: { emp_id: auth.emp.emp_id },
                        data: { current_streak: newStreak }
                    });

                    // Only award coins if on time
                    if (lateInfo.status === "ontime" || lateInfo.status === "early") {
                        // 1. Award +1 Bronze for Daily Check-in
                        await tx.coin_ledgers.create({
                            data: {
                                emp_id: auth.emp.emp_id,
                                coin_type_id: "BRONZE",
                                amount: 1,
                                transaction_type: "EARN",
                                source_key: sourceKey,
                                description: "Daily Check-in Reward",
                            },
                        });

                        // 2. Check Milestones (exactly 7 or 30)
                        let milestoneBonus = 0;
                        let milestoneSourceKey = "";
                        let milestoneDesc = "";
                        
                        if (newStreak === 7) {
                            milestoneBonus = 3;
                            milestoneSourceKey = `streak_milestone:${auth.emp.emp_id}:7:${y}-${m}-${d}`;
                            milestoneDesc = "7-Day Streak Reward";
                        } else if (newStreak === 30) {
                            milestoneBonus = 3;
                            milestoneSourceKey = `streak_milestone:${auth.emp.emp_id}:30:${y}-${m}-${d}`;
                            milestoneDesc = "30-Day Streak Reward";
                        }

                        if (milestoneBonus > 0) {
                            await tx.coin_ledgers.create({
                                data: {
                                    emp_id: auth.emp.emp_id,
                                    coin_type_id: "BRONZE",
                                    amount: milestoneBonus,
                                    transaction_type: "EARN",
                                    source_key: milestoneSourceKey,
                                    description: milestoneDesc,
                                },
                            });
                        }

                        // 3. Update employee coin balance (total)
                        const totalBonus = 1 + milestoneBonus;
                        const currentCoin = await tx.employee_coins.findUnique({
                            where: { emp_id_coin_type_id: { emp_id: auth.emp.emp_id, coin_type_id: "BRONZE" } }
                        });

                        if (currentCoin) {
                            await tx.employee_coins.update({
                                where: { id: currentCoin.id },
                                data: { balance: { increment: totalBonus } },
                            });
                        } else {
                            await tx.employee_coins.create({
                                data: { emp_id: auth.emp.emp_id, coin_type_id: "BRONZE", balance: totalBonus }
                            });
                        }
                        coin_awarded = true;
                    }
                }
            }

            return { createdCheckin, coin_awarded };
        });
    } catch (e: any) {
        if (e.message === "DUPLICATE_TODAY") {
            return NextResponse.json({ error: "DUPLICATE_TODAY" }, { status: 409 });
        }
        console.warn("[API/CHECKIN] POST DB Error:", e.message);
        // Fallback without is_trip
        row = await (prisma.checkins.create as any)({
            data: {
                timestamp: getNowBangkok(),
                date_key: effective_date_key,
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
                            timestamp: new Date().toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: '2-digit', minute: '2-digit' }),
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
                            requestedTime: `${new Date(approvedOt.start_time).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: '2-digit', minute: '2-digit' })} - ${requestedEnd.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: '2-digit', minute: '2-digit' })}`,
                            actualIn: checkIn ? "ช่วงเช้า" : "—", // In a real scenario, we'd fetch the exact time
                            actualOut: actualOut.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: '2-digit', minute: '2-digit' }),
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

        // Case 3: Auto-Trigger OT Request (New Requirement)
        if (type === "Check-out" && is_trip && empWithPosition?.job_positions?.is_ot_eligible) {
            const handleAutoOT = async () => {
                try {
                    const now = getBangkokWallClock();
                    const workEndH = 17;
                    const workEndM = 0;
                    
                    const otThresholdH = 17;
                    const otThresholdM = 30; // OT eligibility starts after 17:30
                    
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    const thresholdMin = otThresholdH * 60 + otThresholdM;
                    
                    if (nowMin >= thresholdMin) {
                        // Check if OT request already exists for today
                        const existingOt = await prisma.ot_requests.findFirst({
                            where: {
                                emp_id: auth.emp.emp_id,
                                date_for: effective_date_key,
                                status: { not: "rejected" }
                            }
                        });
                        
                        if (!existingOt) {
                            const y = effective_date_key.getFullYear();
                            const m = String(effective_date_key.getMonth() + 1).padStart(2, '0');
                            const d = String(effective_date_key.getDate()).padStart(2, '0');
                            const bkkDateStr = `${y}-${m}-${d}`;
                            const startTime = new Date(`${bkkDateStr}T${String(workEndH).padStart(2, '0')}:${String(workEndM).padStart(2, '0')}:00+07:00`);
                            const actualEndTime = new Date(); // Current UTC time
                            
                            const totalHours = (actualEndTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                            
                            await prisma.ot_requests.create({
                                data: {
                                    emp_id: auth.emp.emp_id,
                                    date_for: effective_date_key,
                                    start_time: startTime,
                                    end_time: actualEndTime,
                                    total_hours: Number(totalHours.toFixed(2)),
                                    reason: "Trip Log Check-out / อัตโนมัติ",
                                    status: "pending",
                                    supervisor_id: (auth.emp as any).supervisor_id || null
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.error("[API/CHECKIN] Auto-OT Error:", e);
                }
            };
            handleAutoOT();
        }

        // 🔥 Execute without await to avoid blocking the main API response
        handleNotification();
    }

    // Removed non-blocking coin award logic because it's now transactional.

    return NextResponse.json({
        ok: true,
        id: row?.createdCheckin ? row.createdCheckin.id.toString() : row.id.toString(), // 🔥 FIX BigInt
        distance: Math.round(distance),
        coin_awarded: row?.coin_awarded || false,
        auto_ot: type === "Check-out" && is_trip && empWithPosition?.job_positions?.is_ot_eligible
    });
}
