import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcLateOTFromTimestamp } from "@/utils/checkin";
import { processCheckinCoins } from "@/utils/coinAwards";
import { syncHumanSoftAttendanceToDatabase } from "@/lib/humansoft";
import { getTodayBangkokISO, toBangkokWallClock } from "@/utils/time";

export const dynamic = "force-dynamic";

/**
 * GET: Webhook verification / health check endpoint
 */
export async function GET(req: Request) {
    return NextResponse.json({
        ok: true,
        message: "HumanSoft Webhook endpoint is active and ready to receive events",
        timestamp: new Date().toISOString()
    });
}

/**
 * POST: Receive real-time Webhook events from HumanSoft
 */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        console.log("[HumanSoft Webhook] Received payload:", JSON.stringify(body));

        if (!body) {
            return NextResponse.json({ ok: false, error: "EMPTY_BODY" }, { status: 400 });
        }

        // Support array of records or single record or wrapped payload
        const records = Array.isArray(body) 
            ? body 
            : Array.isArray(body?.payload) 
                ? body.payload 
                : Array.isArray(body?.data) 
                    ? body.data 
                    : [body?.payload || body?.data || body];

        let processedCount = 0;
        let coinsAwardedCount = 0;

        for (const item of records) {
            // Find employee_code and attendance_datetime in various possible payload structures
            const empCode = item.employee_code || item.emp_id || item.employee_id_code;
            const datetimeStr = item.attendance_datetime || item.datetime || item.timestamp;

            if (empCode && datetimeStr) {
                const dtStr = datetimeStr.includes("T") ? datetimeStr : datetimeStr.replace(" ", "T");
                const recordTime = new Date(dtStr.endsWith("Z") || dtStr.includes("+") ? dtStr : `${dtStr}+07:00`);
                const dateStr = item.attendance_date || (datetimeStr.split(" ")[0]) || getTodayBangkokISO();
                const dateKey = new Date(`${dateStr}T00:00:00.000Z`);

                const inOut = (item.attendance_inout || item.in_out || item.type || "").toUpperCase();
                const remarkLower = (item.attendance_remark || "").toLowerCase();
                const bkkTime = toBangkokWallClock(recordTime);
                const bkkHour = bkkTime.getHours();

                let type: "Check-in" | "Check-out" = "Check-in";

                if (inOut === "OUT" || inOut === "O" || inOut === "CHECK-OUT" || 
                    remarkLower.includes("เลิกงาน") || remarkLower.includes("ออกงาน") || 
                    remarkLower.includes("checkout") || remarkLower.includes("check-out")) {
                    type = "Check-out";
                } else {
                    const earlierCheckin = await prisma.checkins.findFirst({
                        where: {
                            emp_id: empCode,
                            date_key: dateKey,
                            timestamp: { lt: recordTime }
                        }
                    });

                    if (earlierCheckin) {
                        const diffMs = recordTime.getTime() - earlierCheckin.timestamp.getTime();
                        if (diffMs >= 60 * 60 * 1000 || bkkHour >= 12) {
                            type = "Check-out";
                        }
                    } else if (bkkHour >= 13) {
                        type = "Check-out";
                    }
                }

                const lateInfo = calcLateOTFromTimestamp(type, recordTime);

                const windowStart = new Date(recordTime.getTime() - 2 * 60 * 1000);
                const windowEnd = new Date(recordTime.getTime() + 2 * 60 * 1000);

                const existing = await prisma.checkins.findFirst({
                    where: {
                        emp_id: empCode,
                        timestamp: {
                            gte: windowStart,
                            lte: windowEnd
                        }
                    }
                });

                if (!existing) {
                    const empName = [item.employee_name, item.employee_last_name].filter(Boolean).join(" ") || empCode;

                    await prisma.checkins.create({
                        data: {
                            timestamp: recordTime,
                            date_key: dateKey,
                            time_key: recordTime,
                            emp_id: empCode,
                            name: empName,
                            type,
                            branch_name: item.location_name || "HumanSoft",
                            lat: item.latitude ? Number(item.latitude) : null,
                            lon: item.longitude ? Number(item.longitude) : null,
                            photo_url: item.image_path || item.photo_url || null,
                            capture_mode: item.time_attendance_type_lv || "humansoft_webhook",
                            late_status: lateInfo.status,
                            late_min: lateInfo.min ?? null,
                            remark: `[HumanSoft Webhook] ${item.attendance_remark || ''}`.trim()
                        }
                    });
                }

                // Award coins based on check-in rules (idempotent via source_key)
                const coinAward = await processCheckinCoins(prisma, {
                    emp_id: empCode,
                    type,
                    timestamp: recordTime,
                    effective_date_key: dateKey,
                    late_status: lateInfo.status
                });

                if (coinAward.checkinCoinAwarded || coinAward.checkoutCoinAwarded) {
                    coinsAwardedCount++;
                }

                processedCount++;
            }
        }

        // Also trigger background sync for today to ensure complete consistency
        const today = getTodayBangkokISO();
        syncHumanSoftAttendanceToDatabase({ date_from: today, date_to: today }).catch(err => {
            console.warn("[Webhook Auto-Sync Background Error]:", err?.message);
        });

        return NextResponse.json({
            ok: true,
            message: "Webhook processed successfully",
            processed: processedCount,
            coinsAwarded: coinsAwardedCount
        });
    } catch (e: any) {
        console.error("[HumanSoft Webhook Error]:", e);
        return NextResponse.json({ ok: false, error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
