import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcLateOTFromTimestamp } from "@/utils/checkin";
import { processCheckinCoins } from "@/utils/coinAwards";
import { syncHumanSoftAttendanceToDatabase } from "@/lib/humansoft";
import { upsertEmployeeFromHumanSoft } from "@/lib/humansoftSyncEmployees";
import { getTodayBangkokISO, toBangkokWallClock } from "@/utils/time";

export const dynamic = "force-dynamic";

/**
 * GET: Webhook verification / health check endpoint
 */
export async function GET(req: Request) {
    return NextResponse.json({
        ok: true,
        message: "HumanSoft Webhook endpoint is active and ready to receive events",
        supported_events: [
            "employee.create",
            "employee.terminate",
            "employee.structure.change",
            "time_attendance (check-in / check-out)"
        ],
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

        // =====================================================================
        // 1. Check for Employee Lifecycle Events (e.g. employee.create, employee.terminate)
        // =====================================================================
        const eventType = body?.event || body?.event_type;

        if (eventType && typeof eventType === "string" && eventType.startsWith("employee.")) {
            const empData = body.body || body.data || body.payload || body;
            const empCode = empData.employee_code || empData.emp_id;

            if (!empCode) {
                return NextResponse.json({ ok: false, error: "MISSING_EMPLOYEE_CODE" }, { status: 400 });
            }

            console.log(`[HumanSoft Webhook] Processing event: ${eventType} for employee: ${empCode}`);

            if (eventType === "employee.create" || eventType === "employee.structure.change") {
                const result = await upsertEmployeeFromHumanSoft(empData);
                return NextResponse.json({
                    ok: true,
                    event: eventType,
                    action: result.action,
                    emp_id: result.employee.emp_id,
                    name: result.employee.name,
                    message: result.action === "created" 
                        ? `สร้างข้อมูลพนักงานใหม่ ${result.employee.emp_id} สำเร็จ`
                        : `อัปเดตข้อมูลพนักงาน ${result.employee.emp_id} สำเร็จ`
                });
            }

            if (eventType === "employee.terminate" || eventType === "employee.purge") {
                const normId = empCode.trim().toUpperCase();
                const updated = await prisma.employees.update({
                    where: { emp_id: normId },
                    data: {
                        is_active: false,
                        resignation_date: empData.resign_dt ? new Date(empData.resign_dt) : new Date()
                    }
                }).catch(() => null);

                return NextResponse.json({
                    ok: true,
                    event: eventType,
                    emp_id: normId,
                    found: !!updated,
                    message: updated ? `ปรับสถานะพนักงาน ${normId} เป็นพ้นสภาพเรียบร้อย` : `ไม่พบพนักงาน ${normId} ในระบบ`
                });
            }
        }

        // =====================================================================
        // 2. Attendance Punches Handling (Check-in / Check-out)
        // =====================================================================
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
            // Check if this item is an employee event wrapped in an array
            const itemEvent = item?.event || item?.event_type;
            if (itemEvent && typeof itemEvent === "string" && itemEvent.startsWith("employee.")) {
                const empData = item.body || item.data || item.payload || item;
                if (empData.employee_code) {
                    if (itemEvent === "employee.create" || itemEvent === "employee.structure.change") {
                        await upsertEmployeeFromHumanSoft(empData).catch(err => {
                            console.error("[HumanSoft Webhook Item Employee Upsert Error]:", err);
                        });
                        processedCount++;
                        continue;
                    } else if (itemEvent === "employee.terminate") {
                        await prisma.employees.update({
                            where: { emp_id: empData.employee_code.trim().toUpperCase() },
                            data: { is_active: false, resignation_date: new Date() }
                        }).catch(() => null);
                        processedCount++;
                        continue;
                    }
                }
            }

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
