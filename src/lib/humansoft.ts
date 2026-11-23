import { toBangkokWallClock, getTodayBangkokISO, getYesterdayBangkokISO } from "../utils/time";
import { prisma } from "./prisma";
import { calcLateOTFromTimestamp } from "../utils/checkin";
import { processCheckinCoins } from "../utils/coinAwards";
import crypto from "crypto";
// Ensure HumanSoft Open API calls succeed even if certificate expires (e.g. *.humansoft.co.th cert expiry)
if (typeof process !== "undefined" && process.env) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

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
                }),
                signal: AbortSignal.timeout(20000)
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
 * Pull leave records from HumanSoft API (All employees)
 * Tries HumanSoft salary/get-data-filter leave actions or leave endpoints
 */
export async function fetchHumanSoftLeaves(params: {
    date_from: string; // YYYY-MM-DD
    date_to: string;   // YYYY-MM-DD
    apiKey?: string;
}) {
    const apiKey = params.apiKey || getApiKey();
    if (!apiKey) return { ok: false, error: "NO_API_KEY", records: [] as any[] };

    const candidateUrls = [
        `${getBaseUrl()}/api/v1/open-apis/salary/get-data-filter?path_action=search_leave_full`,
        `${getBaseUrl()}/api/v1/open-apis/salary/get-data-filter?path_action=search_leave`,
        `${getBaseUrl()}/api/v1/open-apis/leave/get-leave-list`,
    ];

    for (const url of candidateUrls) {
        try {
            const pageSize = 100;
            let page = 1;
            const allRecords: any[] = [];
            let totalRecords = 0;
            let endpointValid = false;

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
                    }),
                    signal: AbortSignal.timeout(12000)
                });

                const data = await res.json().catch(() => null);
                if (!res.ok || !data || (data.code && data.code !== 200)) {
                    break;
                }

                const payload = Array.isArray(data.payload)
                    ? data.payload
                    : Array.isArray(data.data)
                        ? data.data
                        : null;
                if (!payload) break;

                endpointValid = true;
                allRecords.push(...payload);
                totalRecords = data._PAGINATION?._TOTAL_RECORDS ?? allRecords.length;

                if (allRecords.length >= totalRecords || payload.length === 0) {
                    break;
                }
                page++;
                if (page > 30) break;
            }

            if (endpointValid && allRecords.length > 0) {
                return { ok: true, records: allRecords, total: totalRecords };
            }
        } catch {
            // Try next candidate URL
        }
    }

    return { ok: true, records: [] as any[], total: 0 };
}

function mapHumanSoftLeaveType(rawType: string): { id: string; name: string } {
    const t = (rawType || "").trim();
    const lower = t.toLowerCase();
    if (t.includes("ป่วย") || lower.includes("sick")) return { id: "sick", name: "ลาป่วย" };
    if (t.includes("พักร้อน") || t.includes("พักผ่อน") || lower.includes("annual") || lower.includes("vacation")) return { id: "annual", name: "ลาพักร้อน" };
    if (t.includes("ฉุกเฉิน") || lower.includes("emergency")) return { id: "emergency", name: "ลากรณีฉุกเฉิน" };
    if (t.includes("กิจ") || lower.includes("personal") || lower.includes("business")) return { id: "personal", name: "ลากิจ" };
    if (t.includes("คลอด") || lower.includes("maternity")) return { id: "maternity", name: "ลาคลอด" };
    if (t.includes("บวช") || lower.includes("ordination")) return { id: "ordination", name: "ลาบวช" };
    if (t.includes("ไม่รับค่าจ้าง") || lower.includes("unpaid") || lower.includes("without pay")) return { id: "unpaid", name: "ลาไม่รับค่าจ้าง" };
    return { id: "personal", name: t || "ลากิจ" };
}

/**
 * Fetch and import attendance & leave records from HumanSoft into our local database (checkins & leave_requests tables)
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
    let leavesSyncedCount = 0;
    const errors: string[] = [];

    // Pre-fetch existing checkins and leaves for the date range once to eliminate hundreds of sequential DB round-trips
    const startDateRange = new Date(`${params.date_from}T00:00:00.000Z`);
    const endDateRange = new Date(`${params.date_to}T23:59:59.999Z`);

    const [existingCheckins, existingLeaves, allEmps] = await Promise.all([
        prisma.checkins.findMany({
            where: {
                date_key: { gte: startDateRange, lte: endDateRange }
            },
            select: {
                id: true,
                emp_id: true,
                type: true,
                timestamp: true,
                date_key: true,
                capture_mode: true,
                late_status: true
            }
        }),
        prisma.leave_requests.findMany({
            where: {
                start_date: { lte: endDateRange },
                end_date: { gte: startDateRange }
            },
            select: {
                id: true,
                emp_id: true,
                start_date: true,
                end_date: true,
                leave_type: true,
                status: true
            }
        }),
        prisma.employees.findMany({
            select: { emp_id: true, name: true }
        })
    ]);

    const empNameMap = new Map(allEmps.map(e => [e.emp_id.toUpperCase(), e.name]));

    const upsertLeaveFromHumanSoft = async (empCodeRaw: string, empNameFallback: string, rawLeaveType: string, startDateStr: string, endDateStr: string, daysVal?: number, reasonStr?: string) => {
        const empCode = empCodeRaw.trim().toUpperCase();
        if (!empNameMap.has(empCode)) return false;

        const sDateStr = startDateStr.split("T")[0].split(" ")[0];
        const eDateStr = (endDateStr || startDateStr).split("T")[0].split(" ")[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(sDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(eDateStr)) return false;

        const sDate = new Date(`${sDateStr}T00:00:00.000Z`);
        const eDate = new Date(`${eDateStr}T00:00:00.000Z`);
        const mappedType = mapHumanSoftLeaveType(rawLeaveType);

        // Check if employee already has a non-rejected leave covering this date
        const alreadyExists = existingLeaves.some(l => {
            if (l.emp_id.toUpperCase() !== empCode) return false;
            if (l.status === "rejected" || l.status === "cancelled") return false;
            const ls = l.start_date.toISOString().split("T")[0];
            const le = l.end_date.toISOString().split("T")[0];
            return sDateStr <= le && eDateStr >= ls;
        });

        if (alreadyExists) return false;

        const days = daysVal && daysVal > 0 ? Number(daysVal) : Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / 86400000) + 1);
        const minutes = Math.round(days * 480);
        const startAt = new Date(`${sDateStr}T08:00:00+07:00`);
        const endAt = days === 0.5 ? new Date(`${sDateStr}T12:00:00+07:00`) : new Date(`${eDateStr}T17:00:00+07:00`);

        const hash = crypto.createHash("sha256")
            .update(`HS|${empCode}|${sDateStr}|${eDateStr}|${mappedType.id}`)
            .digest("hex")
            .slice(0, 14);
        const id = `LV-HS-${hash}`;

        try {
            await prisma.leave_requests.upsert({
                where: { id },
                create: {
                    id,
                    emp_id: empCode,
                    name: empNameMap.get(empCode) || empNameFallback || empCode,
                    leave_type_id: mappedType.id,
                    leave_type: mappedType.name,
                    start_at: startAt,
                    end_at: endAt,
                    start_date: sDate,
                    end_date: eDate,
                    days,
                    minutes,
                    reason: reasonStr || "[ดึงข้อมูลวันลาจาก HumanSoft]",
                    status: "approved",
                    approved_by: "HUMANSOFT_SYNC",
                    approved_at: new Date()
                },
                update: {
                    leave_type_id: mappedType.id,
                    leave_type: mappedType.name,
                    days,
                    minutes,
                    status: "approved"
                }
            });

            existingLeaves.push({
                id,
                emp_id: empCode,
                start_date: sDate,
                end_date: eDate,
                leave_type: mappedType.name,
                status: "approved"
            });
            leavesSyncedCount++;
            return true;
        } catch {
            return false;
        }
    };

    for (const keyConfig of keys) {
        // 1. Try dedicated HumanSoft leave search if available
        const leaveRes = await fetchHumanSoftLeaves({ ...params, apiKey: keyConfig.key });
        if (leaveRes.ok && leaveRes.records && leaveRes.records.length > 0) {
            for (const lr of leaveRes.records) {
                const empCode = lr.employee_code || lr.emp_code || lr.emp_id;
                if (!empCode) continue;
                const rawType = lr.leave_type_name || lr.leave_name || lr.leave_type || lr.absent_type_name || "ลากิจ";
                const startD = lr.leave_date_from || lr.start_date || lr.leave_date || lr.work_cycle_date || lr.attendance_date;
                const endD = lr.leave_date_to || lr.end_date || startD;
                const daysVal = Number(lr.leave_day || lr.leave_days || lr.total_day || lr.days || 1);
                const empName = [lr.employee_name, lr.employee_last_name].filter(Boolean).join(" ") || empCode;
                if (startD) {
                    await upsertLeaveFromHumanSoft(empCode, empName, rawType, String(startD), String(endD), daysVal, lr.leave_remark || lr.remark);
                }
            }
        }

        // 2. Fetch time attendance full records
        const fetchRes = await fetchHumanSoftAttendance({ ...params, apiKey: keyConfig.key });
        if (!fetchRes.ok || !fetchRes.records) {
            if (fetchRes.error) errors.push(`[${keyConfig.company}]: ${fetchRes.error}`);
            continue;
        }

        totalRecords += fetchRes.records.length;

        // Sort records chronologically so morning check-in is processed before evening check-out
        fetchRes.records.sort((a: any, b: any) => (a.attendance_datetime || "").localeCompare(b.attendance_datetime || ""));

        for (const record of fetchRes.records) {
            const empCode = (record.employee_code || "").trim().toUpperCase();
            if (!empCode) continue;

            const empName = [record.employee_name, record.employee_last_name].filter(Boolean).join(" ") || empCode;
            const dateStr = record.attendance_date || record.work_cycle_date || (record.attendance_datetime ? record.attendance_datetime.split(" ")[0].split("T")[0] : params.date_from);

            // Check if this attendance record carries leave information from HumanSoft
            const hsLeaveName = record.leave_name || record.leave_type_name || record.leave_type ||
                ((record.attendance_remark && /(ลาป่วย|ลากิจ|ลาพักร้อน|ลาคลอด|ลาบวช|ลาฉุกเฉิน|ลาไม่รับค่าจ้าง)/.test(record.attendance_remark))
                    ? record.attendance_remark.match(/(ลาป่วย|ลากิจ|ลาพักร้อน|ลาคลอด|ลาบวช|ลาฉุกเฉิน|ลาไม่รับค่าจ้าง)/)?.[1]
                    : null);
            if (hsLeaveName && dateStr) {
                const hsLeaveDays = Number(record.leave_day || record.leave_days || 1);
                await upsertLeaveFromHumanSoft(empCode, empName, String(hsLeaveName), dateStr, dateStr, hsLeaveDays, record.attendance_remark);
            }

            if (!record.attendance_datetime) continue;

            // Parse attendance_datetime (e.g. '2026-05-21 08:30:00' -> Date)
            const dtStr = record.attendance_datetime.includes("T") 
                ? record.attendance_datetime 
                : record.attendance_datetime.replace(" ", "T");
            const recordTime = new Date(dtStr.endsWith("Z") || dtStr.includes("+") ? dtStr : `${dtStr}+07:00`);
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
                // Check in-memory if employee already has an earlier check-in on this date
                const earlierCheckin = existingCheckins.find(c =>
                    c.emp_id === empCode &&
                    c.date_key.getTime() === dateKey.getTime() &&
                    c.timestamp.getTime() < recordTime.getTime()
                );

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

            const lateInfo = calcLateOTFromTimestamp(type, recordTime);
            
            // Window check to prevent duplicate insertion (+/- 2 minutes)
            const windowStartMs = recordTime.getTime() - 2 * 60 * 1000;
            const windowEndMs = recordTime.getTime() + 2 * 60 * 1000;

            const existing = existingCheckins.find(c =>
                c.emp_id === empCode &&
                c.timestamp.getTime() >= windowStartMs &&
                c.timestamp.getTime() <= windowEndMs
            );

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
                    existing.type = type;
                    existing.late_status = lateInfo.status;
                }

                skippedCount++;
                continue;
            }

            const created = await prisma.checkins.create({
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

            existingCheckins.push({
                id: created.id,
                emp_id: empCode,
                type,
                timestamp: recordTime,
                date_key: dateKey,
                capture_mode: record.time_attendance_type_lv || "humansoft",
                late_status: lateInfo.status
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
        leavesSynced: leavesSyncedCount,
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

