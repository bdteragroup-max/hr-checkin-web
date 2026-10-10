import { toBangkokWallClock, getTodayBangkokISO, getYesterdayBangkokISO } from "../utils/time";
import { prisma } from "./prisma";
import { calcLateOTFromTimestamp } from "../utils/checkin";
import { processCheckinCoins } from "../utils/coinAwards";

export interface HumanSoftAttendancePayload {
    attendance_datetime: string;     // ISO format: '2026-02-11T09:00:00.000'
    employee_code: string;           // 'EMP001'
    time_attendance_type_lv: 'Checkin' | 'Device'; // Note: HumanSoft requires 'Checkin' for GPS and 'Device' for hardware
    work_cycle_date: string;         // '2026-02-11'
    work_cycle_type_lv?: string;     // '00'
    work_date_seq?: number;          // 1
    location_id?: string;            // Base64-encoded string (required for Checkin)
    latitude?: number;
    longitude?: number;
    attendance_remark?: string;
    image_path?: string;             // Photo URL (optional)
}

export interface CompanyKeyConfig {
    company: "TE" | "TP" | "TG" | "DEFAULT" | string;
    key: string;
}

export function getAllApiKeys(): CompanyKeyConfig[] {
    const list: CompanyKeyConfig[] = [];
    
    if (process.env.HUMANSOFT_SUBSCRIPTION_KEY_TE) {
        list.push({ company: "TE", key: process.env.HUMANSOFT_SUBSCRIPTION_KEY_TE });
    }
    if (process.env.HUMANSOFT_SUBSCRIPTION_KEY_TP) {
        list.push({ company: "TP", key: process.env.HUMANSOFT_SUBSCRIPTION_KEY_TP });
    }
    if (process.env.HUMANSOFT_SUBSCRIPTION_KEY_TG) {
        list.push({ company: "TG", key: process.env.HUMANSOFT_SUBSCRIPTION_KEY_TG });
    }

    const defaultKey = process.env.HUMANSOFT_SUBSCRIPTION_KEY || process.env.HUMANSOFT_API_KEY;
    if (defaultKey) {
        if (defaultKey.includes(",")) {
            const keys = defaultKey.split(",").map(k => k.trim()).filter(Boolean);
            keys.forEach((k, idx) => {
                if (!list.some(item => item.key === k)) {
                    list.push({ company: `KEY_${idx + 1}`, key: k });
                }
            });
        } else if (!list.some(item => item.key === defaultKey)) {
            list.push({ company: "TE", key: defaultKey });
        }
    }

    return list;
}

export function getApiKey(empId?: string): string | null {
    if (empId) {
        const prefix = empId.slice(0, 2).toUpperCase();
        if (prefix === "TP" && process.env.HUMANSOFT_SUBSCRIPTION_KEY_TP) {
            return process.env.HUMANSOFT_SUBSCRIPTION_KEY_TP;
        }
        if (prefix === "TG" && process.env.HUMANSOFT_SUBSCRIPTION_KEY_TG) {
            return process.env.HUMANSOFT_SUBSCRIPTION_KEY_TG;
        }
        if (prefix === "TE" && process.env.HUMANSOFT_SUBSCRIPTION_KEY_TE) {
            return process.env.HUMANSOFT_SUBSCRIPTION_KEY_TE;
        }
    }
    return process.env.HUMANSOFT_SUBSCRIPTION_KEY || process.env.HUMANSOFT_SUBSCRIPTION_KEY_TE || process.env.HUMANSOFT_API_KEY || null;
}

function getBaseUrl(): string {
    return process.env.HUMANSOFT_BASE_URL || "https://openapi.humansoft.co.th";
}

/**
 * Fetch list of registered locations from HumanSoft to retrieve Base64 location_ids.
 * Endpoint: GET /api/v1/open-apis/locations/get-list
 */
export async function getHumanSoftLocations() {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { ok: false, error: "NO_API_KEY" };
    }

    try {
        const url = `${getBaseUrl()}/api/v1/open-apis/locations/get-list`;
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Ocp-Apim-Subscription-Key": apiKey,
                "Content-Type": "application/json"
            }
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || (data && data.code !== 200)) {
            return { ok: false, error: data?.errors || data?.message || "HTTP_ERROR", status: res.status };
        }

        return { ok: true, payload: data.payload || [] };
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

/**
 * Sends an attendance record to HumanSoft Open API.
 * Automatically checks for HUMANSOFT_SUBSCRIPTION_KEY.
 * If the key is not set, it safely skips sending without throwing errors.
 */
export async function sendAttendanceToHumanSoft(params: {
    emp_id: string;
    type: string;
    timestamp: Date;
    effective_date_key: Date;
    lat?: number | null;
    lon?: number | null;
    remark?: string | null;
    branch_name?: string | null;
    photo_url?: string | null;
    location_id?: string | null;
}) {
    const apiKey = getApiKey(params.emp_id);
    if (!apiKey) {
        // HumanSoft integration key not yet set in .env
        return { ok: false, skipped: true, reason: "NO_API_KEY" };
    }

    try {
        const apiUrl = `${getBaseUrl()}/api/v1/open-apis/time-attendance/submit`;

        // Format: YYYY-MM-DDTHH:mm:ss.SSS in Bangkok time
        const bkkTimestamp = toBangkokWallClock(params.timestamp);
        const y = bkkTimestamp.getFullYear();
        const m = String(bkkTimestamp.getMonth() + 1).padStart(2, '0');
        const d = String(bkkTimestamp.getDate()).padStart(2, '0');
        const hh = String(bkkTimestamp.getHours()).padStart(2, '0');
        const mm = String(bkkTimestamp.getMinutes()).padStart(2, '0');
        const ss = String(bkkTimestamp.getSeconds()).padStart(2, '0');
        const ms = String(bkkTimestamp.getMilliseconds()).padStart(3, '0');
        const attendance_datetime = `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}`;

        // Format: YYYY-MM-DD
        const bkkDateKey = toBangkokWallClock(params.effective_date_key);
        const work_cycle_date = `${bkkDateKey.getFullYear()}-${String(bkkDateKey.getMonth() + 1).padStart(2, '0')}-${String(bkkDateKey.getDate()).padStart(2, '0')}`;

        // Construct remark indicating Check-in vs Check-out
        const remarkParts: string[] = [];
        remarkParts.push(`[${params.type}]`);
        if (params.branch_name) {
            remarkParts.push(params.branch_name);
        }
        if (params.remark) {
            remarkParts.push(params.remark);
        }

        const locationId = params.location_id || process.env.HUMANSOFT_DEFAULT_LOCATION_ID || undefined;

        // Note: HumanSoft Open API requires time_attendance_type_lv to be strictly 'Checkin' or 'Device'.
        // For GPS mobile/web punch, 'Checkin' is used for both entry and exit.
        const payload: HumanSoftAttendancePayload = {
            attendance_datetime,
            employee_code: params.emp_id,
            time_attendance_type_lv: "Checkin",
            work_cycle_date,
            work_cycle_type_lv: "00",
            work_date_seq: 1,
            location_id: locationId,
            latitude: params.lat != null && Number.isFinite(params.lat) ? Number(params.lat) : undefined,
            longitude: params.lon != null && Number.isFinite(params.lon) ? Number(params.lon) : undefined,
            attendance_remark: remarkParts.join(" - "),
            image_path: params.photo_url || undefined
        };

        const res = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || (data && data.code !== 200)) {
            console.error("[HumanSoft] Submit failed:", {
                status: res.status,
                data,
                payload
            });
            return {
                ok: false,
                error: data?.errors || data?.message || "HTTP_ERROR",
                status: res.status,
                payload
            };
        }

        console.log("[HumanSoft] Attendance synced successfully:", {
            emp_id: params.emp_id,
            type: params.type,
            message: data?.message
        });

        return { ok: true, data };
    } catch (err: any) {
        console.error("[HumanSoft] Network/Internal Error:", err.message);
        return { ok: false, error: err.message };
    }
}

/**
 * Pull attendance records from HumanSoft API (All employees)
 * Endpoint: POST /api/v1/open-apis/salary/get-data-filter?path_action=search_time_attendance_full
 */
export async function fetchHumanSoftAttendance(params: {
    date_from: string; // YYYY-MM-DD
    date_to: string;   // YYYY-MM-DD
    apiKey?: string;
}) {
    const apiKey = params.apiKey || getApiKey();
    if (!apiKey) return { ok: false, error: "NO_API_KEY" };

    try {
        const url = `${getBaseUrl()}/api/v1/open-apis/salary/get-data-filter?path_action=search_time_attendance_full`;
        const pageSize = 100;
        let page = 1;
        const allRecords: any[] = [];
        let totalRecords = 0;

        while (true) {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Ocp-Apim-Subscription-Key": apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    date_from: params.date_from,
                    date_to: params.date_to,
                    _PAGE: page,
                    _NUMBER_PER_PAGE: pageSize
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || (data && data.code !== 200)) {
                if (allRecords.length > 0) {
                    break;
                }
                return { ok: false, error: data?.errors || data?.message || "HTTP_ERROR", status: res.status };
            }

            const payload = data.payload || [];
            allRecords.push(...payload);
            totalRecords = data._PAGINATION?._TOTAL_RECORDS ?? allRecords.length;

            if (allRecords.length >= totalRecords || payload.length === 0) {
                break;
            }

            page++;
            if (page > 50) break; // safety guard
        }

        return { ok: true, records: allRecords, total: totalRecords };
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

/**
 * Fetch and import attendance records from HumanSoft into our local database (checkins table)
 * Automatically syncs across all configured company API keys (TE, TP, TG).
 */
export async function syncHumanSoftAttendanceToDatabase(params: {
    date_from: string;
    date_to: string;
    apiKey?: string;
}) {
    const keys = params.apiKey ? [{ company: "CUSTOM", key: params.apiKey }] : getAllApiKeys();
    if (keys.length === 0) {
        return { ok: false, error: "NO_API_KEY" };
    }

    let totalRecords = 0;
    let insertedCount = 0;
    let skippedCount = 0;
    let coinsAwardedCount = 0;
    const errors: string[] = [];

    for (const keyConfig of keys) {
        const fetchRes = await fetchHumanSoftAttendance({ ...params, apiKey: keyConfig.key });
        if (!fetchRes.ok || !fetchRes.records) {
            if (fetchRes.error) errors.push(`[${keyConfig.company}]: ${fetchRes.error}`);
            continue;
        }

        totalRecords += fetchRes.records.length;

        // Sort records chronologically so morning check-in is processed before evening check-out
        fetchRes.records.sort((a: any, b: any) => (a.attendance_datetime || "").localeCompare(b.attendance_datetime || ""));

        for (const record of fetchRes.records) {
            const empCode = record.employee_code;
            if (!empCode || !record.attendance_datetime) continue;

            // Parse attendance_datetime (e.g. '2026-05-21 08:30:00' -> Date)
            const dtStr = record.attendance_datetime.includes("T") 
                ? record.attendance_datetime 
                : record.attendance_datetime.replace(" ", "T");
            const recordTime = new Date(dtStr.endsWith("Z") || dtStr.includes("+") ? dtStr : `${dtStr}+07:00`);
            
            const dateStr = record.attendance_date || (record.attendance_datetime ? record.attendance_datetime.split(" ")[0] : params.date_from);
            const dateKey = new Date(`${dateStr}T00:00:00.000Z`);

            // Determine type: 'Check-in' vs 'Check-out'
            // Note: HumanSoft Open API biometric machines always return attendance_inout as 'I'.
            // We distinguish Check-in vs Check-out using work schedule and punch history:
            const inOut = (record.attendance_inout || "").toUpperCase();
            const remarkLower = (record.attendance_remark || "").toLowerCase();
            const bkkTime = toBangkokWallClock(recordTime);
            const bkkHour = bkkTime.getHours();

            let type: "Check-in" | "Check-out" = "Check-in";

            if (inOut === "OUT" || inOut === "O" || inOut === "CHECK-OUT" || 
                remarkLower.includes("เลิกงาน") || remarkLower.includes("ออกงาน") || 
                remarkLower.includes("checkout") || remarkLower.includes("check-out")) {
                type = "Check-out";
            } else {
                // Check if employee already has an earlier check-in on this date
                const earlierCheckin = await prisma.checkins.findFirst({
                    where: {
                        emp_id: empCode,
                        date_key: dateKey,
                        timestamp: { lt: recordTime }
                    }
                });

                if (earlierCheckin) {
                    const diffMs = recordTime.getTime() - earlierCheckin.timestamp.getTime();
                    // If earlier check-in exists and this scan is at least 1 hour later or >= 12:00
                    if (diffMs >= 60 * 60 * 1000 || bkkHour >= 12) {
                        type = "Check-out";
                    }
                } else if (bkkHour >= 13) {
                    // Afternoon/evening punch without morning punch is a check-out (forgot morning check-in)
                    type = "Check-out";
                }
            }

            const empName = [record.employee_name, record.employee_last_name].filter(Boolean).join(" ") || empCode;
            const lateInfo = calcLateOTFromTimestamp(type, recordTime);
            
            // Window check to prevent duplicate insertion (+/- 2 minutes)
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

            if (existing) {
                // If existing record was wrongly marked as Check-in but should be Check-out, correct it
                if (existing.type !== type && (existing.capture_mode?.toLowerCase().includes("facial") || existing.capture_mode === "humansoft")) {
                    await prisma.checkins.update({
                        where: { id: existing.id },
                        data: {
                            type,
                            late_status: lateInfo.status,
                            late_min: lateInfo.min ?? null
                        }
                    });
                }

                skippedCount++;
                // Check if coin was already awarded for today (idempotent via source_key)
                const coinAward = await processCheckinCoins(prisma, {
                    emp_id: empCode,
                    type,
                    timestamp: recordTime,
                    effective_date_key: dateKey,
                    late_status: existing.late_status || lateInfo.status
                });
                if (coinAward.checkinCoinAwarded || coinAward.checkoutCoinAwarded) {
                    coinsAwardedCount++;
                }
                continue;
            }

            await prisma.checkins.create({
                data: {
                    timestamp: recordTime,
                    date_key: dateKey,
                    time_key: recordTime,
                    emp_id: empCode,
                    name: empName,
                    type,
                    branch_name: record.location_name || "HumanSoft",
                    lat: record.latitude ? Number(record.latitude) : null,
                    lon: record.longitude ? Number(record.longitude) : null,
                    photo_url: record.image_path || null,
                    capture_mode: record.time_attendance_type_lv || "humansoft",
                    late_status: lateInfo.status,
                    late_min: lateInfo.min ?? null,
                    remark: `[HumanSoft - ${record.time_attendance_type_lv || 'Sync'}] ${record.attendance_remark || ''}`.trim()
                }
            });

            insertedCount++;

            // Award coins based on check-in rules (on-time streak, daily coin, late checkout)
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
        }
    }

    return {
        ok: true,
        total: totalRecords,
        inserted: insertedCount,
        skipped: skippedCount,
        coinsAwarded: coinsAwardedCount,
        errors: errors.length > 0 ? errors : undefined
    };
}

let lastSyncTimestamp = 0;

/**
 * Triggers a throttled sync (maximum once per minute)
 * to keep attendance and coins up-to-date automatically when users load the app.
 */
export async function triggerSmartSync(force = false) {
    const now = Date.now();
    if (!force && (now - lastSyncTimestamp < 60 * 1000)) {
        return;
    }
    lastSyncTimestamp = now;
    const today = getTodayBangkokISO();
    const yesterday = getYesterdayBangkokISO();
    try {
        // Sync both yesterday and today so that evening checkouts or missed off-hours scans are automatically backfilled
        await syncHumanSoftAttendanceToDatabase({ date_from: yesterday, date_to: today });
    } catch (err: any) {
        console.warn("[HumanSoft SmartSync Error]:", err?.message);
    }
}

