/* ─────────────────────────────────────────────
   utils/checkin.ts
   ฟังก์ชัน utility ทั้งหมดสำหรับระบบ HR Check-in
   ─────────────────────────────────────────────── */

/* ─── CONFIG ─── */
export const WORK_START_H = 8;
export const WORK_START_M = 0;
export const WORK_END_H = 17;
export const WORK_END_M = 0;
export const OT_THRESHOLD_MIN = 30;

/* ─── TYPES ─── */
export type CheckType = "Check-in" | "Check-out";
export type LateStatus = "ontime" | "late" | "early" | "ot";

export interface LateInfo {
    status: LateStatus;
    label: string;
    detail: string;
    min?: number;
}

export interface GpsState {
    ok: boolean;
    lat: number | null;
    lon: number | null;
    accuracy: number | null;
    distance: number | null;
    pass: boolean;
    reason: string;
}

export interface Branch {
    id: string;
    name: string;
    centerLat: number;
    centerLon: number;
    radiusM: number;
}

/* ─── NUMBER UTILS ─── */
export function pad(n: number): string {
    return String(n).padStart(2, "0");
}

export function round(n: number, d = 2): number {
    const x = Number(n);
    if (!isFinite(x)) return 0;
    return Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
}

/* ─── HTML ESCAPE ─── */
export function escapeHtml(s: string): string {
    return String(s || "").replace(/[&<>"']/g, (m) => {
        const map: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };
        return map[m] ?? m;
    });
}

/* ─── TIME ─── */
export function getThaiTime(): Date {
    return new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );
}

export function fmtThaiTime(ts: string): string {
    try {
        return new Date(ts).toLocaleString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Bangkok",
        });
    } catch {
        return ts;
    }
}

export function fmtThaiDateTime(ts: string): string {
    try {
        return new Date(ts).toLocaleString("th-TH", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Asia/Bangkok",
        });
    } catch {
        return ts;
    }
}

/* ─── LATE / OT CALCULATION ─── */
export function calcLateOT(type: CheckType): LateInfo {
    const now = getThaiTime();
    const h = now.getHours();
    const m = now.getMinutes();
    const totalMin = h * 60 + m;

    if (type === "Check-in") {
        const startMin = WORK_START_H * 60 + WORK_START_M;
        const diffMin = totalMin - startMin;
        if (diffMin <= 0)
            return {
                status: "ontime",
                label: "✅ ตรงเวลา",
                detail: "เช็คอินก่อนเวลา",
                min: 0,
            };
        if (diffMin <= 5)
            return {
                status: "ontime",
                label: "✅ ตรงเวลา",
                detail: `เช็คอินภายใน ${diffMin} นาที`,
                min: diffMin,
            };
        return {
            status: "late",
            label: `⏰ สาย ${diffMin} นาที`,
            detail: `กำหนด ${pad(WORK_START_H)}:${pad(WORK_START_M)} — เช็คอิน ${pad(h)}:${pad(m)}`,
            min: diffMin,
        };
    } else {
        const endMin = WORK_END_H * 60 + WORK_END_M;
        const diffMin = totalMin - endMin;
        if (diffMin >= OT_THRESHOLD_MIN)
            return {
                status: "ot",
                label: `🔥 OT ${diffMin} นาที`,
                detail: `เลิกงาน ${pad(WORK_END_H)}:${pad(WORK_END_M)} — ออก ${pad(h)}:${pad(m)}`,
                min: diffMin,
            };
        if (diffMin < 0)
            return {
                status: "early",
                label: "✅ ออกก่อนเวลา",
                detail: `ออกก่อนเวลา ${Math.abs(diffMin)} นาที`,
                min: Math.abs(diffMin),
            };
        return {
            status: "ontime",
            label: "✅ ออกงานตรงเวลา",
            detail: `ออกงาน ${pad(h)}:${pad(m)}`,
            min: 0,
        };
    }
}

/**
 * คำนวณ late/OT จาก timestamp ที่บันทึกไว้แล้ว (ไม่ใช่เวลาปัจจุบัน)
 */
export function calcLateOTFromTimestamp(
    type: CheckType,
    timestamp: string
): LateInfo {
    const dt = new Date(timestamp);
    const thaiStr = dt.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
    const thaiDate = new Date(thaiStr);
    const h = thaiDate.getHours();
    const m = thaiDate.getMinutes();
    const totalMin = h * 60 + m;

    if (type === "Check-in") {
        const startMin = WORK_START_H * 60 + WORK_START_M;
        const diffMin = totalMin - startMin;
        if (diffMin <= 5)
            return {
                status: "ontime",
                label: "ตรงเวลา",
                detail: `${pad(h)}:${pad(m)}`,
            };
        return {
            status: "late",
            label: `สาย ${diffMin} น.`,
            detail: `${pad(h)}:${pad(m)}`,
        };
    } else {
        const endMin = WORK_END_H * 60 + WORK_END_M;
        const diffMin = totalMin - endMin;
        if (diffMin >= OT_THRESHOLD_MIN)
            return {
                status: "ot",
                label: `OT ${diffMin} น.`,
                detail: `${pad(h)}:${pad(m)}`,
            };
        if (diffMin < 0) {
            return {
                status: "early",
                label: "ออกก่อนเวลา",
                detail: `${pad(h)}:${pad(m)}`,
                min: Math.abs(diffMin)
            };
        }
        return {
            status: "ontime",
            label: "ออกงานตรงเวลา",
            detail: `${pad(h)}:${pad(m)}`,
        };
    }
}

/* ─── GPS ─── */
export function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkGpsInBranch(
    lat: number,
    lon: number,
    accuracy: number,
    branch: Branch,
    maxAccuracyM = 120
): { pass: boolean; reason: string; distance: number } {
    const distance = haversineMeters(lat, lon, branch.centerLat, branch.centerLon);
    if (!isFinite(accuracy) || accuracy <= 0)
        return { pass: false, reason: "ความแม่นยำอ่านไม่ได้", distance };
    if (accuracy > maxAccuracyM)
        return {
            pass: false,
            reason: `ความแม่นยำต่ำ (${Math.round(accuracy)}m > ${maxAccuracyM}m)`,
            distance,
        };
    if (distance > branch.radiusM)
        return {
            pass: false,
            reason: `อยู่นอกพื้นที่ (${Math.round(distance)}m > ${branch.radiusM}m)`,
            distance,
        };
    return { pass: true, reason: "ผ่าน ✅", distance };
}

export function getCurrentPosition(
    options?: PositionOptions
): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("อุปกรณ์ไม่รองรับ GPS"));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
            ...options,
        });
    });
}

/* ─── CAMERA ─── */
export async function startCameraStream(
    facingMode: "environment" | "user" = "environment",
    videoEl: HTMLVideoElement
): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
    });
    videoEl.srcObject = stream;
    return stream;
}

export function stopCameraStream(stream: MediaStream | null): void {
    try {
        stream?.getTracks().forEach((t) => t.stop());
    } catch {
        /* ignore */
    }
}

/* ─── WATERMARK / CAPTURE ─── */
export interface WatermarkOptions {
    empId: string;
    empName: string;
    branchName: string;
    type: CheckType;
    gps: GpsState;
    logoSrc?: string;
}

export function captureWithWatermark(
    videoEl: HTMLVideoElement,
    canvasEl: HTMLCanvasElement,
    opts: WatermarkOptions
): string {
    const { empId, empName, branchName, type, gps, logoSrc } = opts;
    const ctx = canvasEl.getContext("2d", { willReadFrequently: true })!;
    const w = videoEl.videoWidth || 1280;
    const h = videoEl.videoHeight || 720;
    canvasEl.width = w;
    canvasEl.height = h;
    ctx.drawImage(videoEl, 0, 0, w, h);

    const now = new Date();
    const dateStr = now.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Bangkok",
    });
    const timeStr = now.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Bangkok",
        hour12: false,
    });
    const gpsStr = gps.lat
        ? `${gps.lat.toFixed(5)}, ${gps.lon!.toFixed(5)}`
        : "—";
    const lateInfo = calcLateOT(type);

    // gradient bar
    const bH = Math.round(h * 0.22);
    const bY = h - bH;
    const grad = ctx.createLinearGradient(0, bY, 0, h);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.3, "rgba(0,0,0,.84)");
    grad.addColorStop(1, "rgba(10,10,10,.96)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, bY - Math.round(h * 0.05), w, bH + Math.round(h * 0.05));

    // red accent line
    const barH = Math.round(h * 0.008);
    ctx.fillStyle = "#d93025";
    ctx.fillRect(0, bY, w, barH);

    // logo
    const lPad = Math.round(w * 0.03);
    if (logoSrc) {
        const logoImg = new Image();
        logoImg.src = logoSrc;
        const lSize = Math.round(bH * 0.55);
        const lY = bY + barH + (bH - lSize) / 2;
        try {
            ctx.drawImage(logoImg, lPad, lY, lSize, lSize);
        } catch { /* ignore */ }
    }

    // text
    const sc = w / 1280;
    const f1 = Math.round(22 * sc);
    const f2 = Math.round(18 * sc);
    const f3 = Math.round(14 * sc);
    const typeColor = type === "Check-in" ? "#4ade80" : "#fb923c";
    const typeLabel = type === "Check-in" ? "▶ CHECK-IN" : "■ CHECK-OUT";
    const lateColor =
        lateInfo.status === "late"
            ? "#fb923c"
            : lateInfo.status === "ot"
                ? "#a78bfa"
                : "#4ade80";

    const tX = lPad + Math.round(bH * 0.55) + Math.round(w * 0.025);
    const rBase = bY + barH + Math.round(bH * 0.22);
    const rH = Math.round(bH * 0.22);

    ctx.font = `700 ${f1}px 'Segoe UI',Arial`;
    ctx.fillStyle = "#fff";
    ctx.fillText(empName, tX, rBase);

    ctx.font = `500 ${f2}px 'Segoe UI',Arial`;
    ctx.fillStyle = "#b0b0b0";
    ctx.fillText(`ID: ${empId}   |   ${branchName}`, tX, rBase + rH);

    ctx.font = `700 ${f3}px 'Segoe UI',Arial`;
    ctx.fillStyle = lateColor;
    ctx.fillText(lateInfo.label, tX, rBase + rH * 2);

    const dtStr = `${dateStr}  ${timeStr}`;
    ctx.font = `700 ${f1}px 'Courier New',monospace`;
    ctx.fillStyle = "#fff";
    const dtW = ctx.measureText(dtStr).width;
    ctx.fillText(dtStr, w - dtW - lPad, rBase);

    ctx.font = `700 ${f2}px 'Segoe UI',Arial`;
    ctx.fillStyle = typeColor;
    const tW = ctx.measureText(typeLabel).width;
    ctx.fillText(typeLabel, w - tW - lPad, rBase + rH);

    ctx.font = `400 ${f3}px 'Courier New',monospace`;
    ctx.fillStyle = "#6e6e6e";
    ctx.fillText(`GPS: ${gpsStr}`, tX, rBase + rH * 3);

    ctx.font = `600 ${Math.round(13 * sc)}px 'Segoe UI',Arial`;
    ctx.fillStyle = "rgba(217,48,37,.75)";
    ctx.fillText(
        "TERA GROUP · HR SYSTEM",
        lPad,
        bY - Math.round(h * 0.012)
    );

    return canvasEl.toDataURL("image/jpeg", 0.88);
}

/* ─── WORK HOURS SUMMARY ─── */
export interface WorkSummary {
    inTime: string | null;
    outTime: string | null;
    hoursDisplay: string;
    totalMinutes: number;
}

export function calcWorkSummary(
    inTimestamp: string | null,
    outTimestamp: string | null
): WorkSummary {
    const inTime = inTimestamp ? fmtThaiTime(inTimestamp) : null;
    const outTime = outTimestamp ? fmtThaiTime(outTimestamp) : null;

    if (!inTime || !outTime) {
        return { inTime, outTime, hoursDisplay: "—", totalMinutes: 0 };
    }

    const [ih, im] = inTime.split(":").map(Number);
    const [oh, om] = outTime.split(":").map(Number);
    const diffMin = oh * 60 + om - (ih * 60 + im);
    const hrs = Math.floor(diffMin / 60);
    const mins = diffMin % 60;

    return {
        inTime,
        outTime,
        hoursDisplay: diffMin > 0 ? `${hrs}:${pad(mins)}` : "—",
        totalMinutes: diffMin > 0 ? diffMin : 0,
    };
}