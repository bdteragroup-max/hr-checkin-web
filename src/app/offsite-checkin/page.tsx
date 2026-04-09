"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import {
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    CameraIcon,
    ArrowPathIcon,
    ArrowRightStartOnRectangleIcon,
    StopIcon,
    ClockIcon
} from "@heroicons/react/24/solid";
import { Camera, RotateCcw, ArrowRight } from "lucide-react";
import { formatTimeFull24h, formatDateThai, formatDateShortThai } from "@/utils/time";

/* ──────────────────────────────────────────
   TYPES
────────────────────────────────────────── */
interface Me { emp_id: string; name: string; branch_id: string | null; }
interface Branch { id: string; name: string; }
interface TodayItem {
    id: number | string;
    type: string;
    timestamp: string;
    branch_name: string;
    remark?: string | null;
}
interface AlertState { 
    visible: boolean; 
    message: string; 
    type: "error" | "ok";
    isMandatory?: boolean;
    id?: string;
    hasShared?: boolean;
    shareData?: {
        name: string;
        type: string;
        location: string;
        time: string;
        remark: string;
        photoUrl: string;
        lat: number | null;
        lng: number | null;
        duration?: string;
    };
}

interface GpsState { ok: boolean; lat: number | null; lon: number | null; accuracy: number | null }

/* ──────────────────────────────────────────
   UTILS
────────────────────────────────────────── */
function formatLocalTimeOnly(ts: string) {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}
function getThaiTime() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
}

/* ──────────────────────────────────────────
   COMPONENTS
────────────────────────────────────────── */
function AlertModal({ alert, onClose }: { alert: AlertState; onClose: (shared?: boolean) => void }) {
    if (!alert.visible) return null;
    const isErr = alert.type === "error";
    return (
        <div className={styles.alertOverlay} onClick={() => onClose(false)} role="dialog" aria-modal="true" style={{ zIndex: 9999 }}>
            <div className={styles.alertModal} onClick={e => e.stopPropagation()}>
                <div className={`${styles.alertIcon} ${isErr ? styles.alertIconErr : styles.alertIconOk}`}>
                    {isErr ? <ExclamationTriangleIcon width={32} /> : <CheckCircleIcon width={32} />}
                </div>
                <div className={`${styles.alertTitle} ${isErr ? styles.alertTitleErr : styles.alertTitleOk}`}>
                    {isErr ? "เกิดข้อผิดพลาด" : "สำเร็จ"}
                </div>
                <div className={styles.alertMsg}>{alert.message}</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 10 }}>
                    {!isErr && alert.shareData && (
                        <>
                            {!alert.hasShared && (
                                <div style={{ 
                                    background: '#fff7ed', 
                                    border: '1px solid #ffedd5', 
                                    padding: '10px', 
                                    borderRadius: 8, 
                                    fontSize: 13, 
                                    color: '#c2410c',
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    marginBottom: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8
                                }}>
                                    <ExclamationTriangleIcon width={18} />
                                    กรุณาแชร์เข้ากลุ่ม LINE เพื่อทำรายการให้เสร็จสิ้น
                                </div>
                            )}
                            <button 
                                className={styles.alertBtn} 
                                style={{ 
                                    background: '#06c755', 
                                    color: 'white', 
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    animation: !alert.hasShared ? 'pulse 2s infinite' : 'none'
                                }}
                                onClick={() => {
                                    const d = alert.shareData!;
                                    // Add cache buster to ensure LINE fetches fresh OG image every time
                                    const shareLink = `${window.location.origin}/share/${alert.id}?t=${Date.now()}`;
                                    const textLines = [
                                        `📍 รายงานการเช็กอินนอกสถานที่: ${d.name}`,
                                        `🕒 เวลา: ${d.time}`
                                    ];
                                    if (d.duration) {
                                        textLines.push(`⏱️ ระยะเวลาที่อยู่: ${d.duration}`);
                                    }
                                    textLines.push(`📄 รายงานรายละเอียด: ${shareLink}`);
                                    const text = textLines.join('\n');
                                    
                                    const shareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(text)}`;
                                    window.open(shareUrl, '_blank');
                                    onClose(true);
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 10.304c0-4.58-4.814-8.304-10.739-8.304-5.924 0-10.74 3.724-10.74 8.304 0 4.102 3.821 7.545 8.99 8.216.35.076.825.231 1.054.53.24.316.158.81.077 1.129l-.337 2.03c-.102.614.47.336.663.22 1.393-.84 7.525-4.433 10.27-7.585 1.547-1.848 1.764-3.565 1.764-4.54z"/></svg>
                                {!alert.hasShared ? "แชร์เข้ากลุ่ม LINE ทันที" : "แชร์อีกครั้ง"}
                            </button>
                        </>
                    )}
                    
                    {(isErr || alert.hasShared || !alert.isMandatory) && (
                        <button className={`${styles.alertBtn} ${isErr ? styles.alertBtnErr : styles.alertBtnOk}`} onClick={() => onClose(false)} autoFocus>
                            {isErr ? "ตกลง" : "บันทึกเสร็จสมบูรณ์"}
                        </button>
                    )}
                </div>
            </div>
            <style jsx>{`
                @keyframes pulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(6, 199, 85, 0.4); }
                    70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(6, 199, 85, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(6, 199, 85, 0); }
                }
            `}</style>
        </div>
    );
}

function TimeCard() {
    const [timeStr, setTimeStr] = useState("");
    const [dateStr, setDateStr] = useState("");

    useEffect(() => {
        function update() {
            const now = getThaiTime();
            setTimeStr(formatTimeFull24h(now));
            const d = formatDateThai(now);
            setDateStr(`วัน${d.split("วัน")[1]}`);
        }
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, []);

    if (!timeStr) return <div style={{ background: "white", borderRadius: 12, height: 110, border: "1px solid #e5e7eb" }} />;

    return (
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px", textAlign: "center", marginBottom: 16 }}>
            <div style={{ color: "#6b7280", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8, fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                {dateStr}
            </div>
            <div style={{ fontSize: 38, fontWeight: 700, fontFamily: "var(--font-display), sans-serif", color: "#111827", letterSpacing: "1px", lineHeight: 1 }}>
                {timeStr}
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────
   MAIN PAGE
────────────────────────────────────────── */
export default function OffsiteCheckinPage() {
    const [me, setMe] = useState<Me | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [today, setToday] = useState<TodayItem[]>([]);
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "error", hasShared: false, isMandatory: false });
    const closeAlert = useCallback((sharedClick = false) => {
        if (sharedClick) {
            setAlert(p => ({ ...p, hasShared: true }));
        } else {
            setAlert(p => ({ ...p, visible: false, hasShared: false }));
        }
    }, []);

    // Selection State
    const [locationName, setLocationName] = useState(""); // REQUIRED
    const [remark, setRemark] = useState("");

    // Flow State: 0=Search, 1=Loading GPS, 2=Camera, 3=Submitting
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [gps, setGps] = useState<GpsState>({ ok: false, lat: null, lon: null, accuracy: null });
    const [checkType, setCheckType] = useState<"Offsite-In" | "Offsite-Out">("Offsite-In");

    // Camera
    const [cameraReady, setCameraReady] = useState(false);
    const [isCameraStarting, setIsCameraStarting] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [preview, setPreview] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rawCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        (async () => {
            const r = await fetch("/api/me");
            if (!r.ok) return (window.location.href = "/");
            setMe(await r.json());

            const b = await fetch("/api/branches");
            const bd = await b.json();
            setBranches(bd.branches || []);

            refreshToday();
        })();
    }, []);

    useEffect(() => {
        readGPSNoTarget();
    }, []);

    async function refreshToday() {
        const r = await fetch("/api/checkins", { cache: "no-store" });
        const data = await r.json().catch(() => ({}));
        setToday(data.list || []);
    }

    function showAlert(message: string, type: "error" | "ok" = "error") {
        setAlert({ visible: true, message, type });
    }

    /* ── GPS ── */
    async function readGPSNoTarget() {
        if (!navigator.geolocation) return;
        navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude: lat, longitude: lon, accuracy: acc } = pos.coords;
                setGps({ ok: true, lat, lon, accuracy: acc });
            },
            (err) => {
                if (window.location.hostname === "localhost") {
                    setGps({ ok: true, lat: 13.75, lon: 100.5, accuracy: 10 });
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }

    /* ── CAMERA ── */
    async function startCamera(facing: "user" | "environment" = "user", autoLoc?: string) {
        const _loc = typeof autoLoc === "string" ? autoLoc : locationName;
        if (!_loc.trim()) {
            return showAlert("กรุณาระบุสถานที่ปฏิบัติงาน (จำเป็น)");
        }

        stopCamera();
        setPreview(null);
        setIsCameraStarting(true);
        setCameraError(null);
        setCameraReady(false);

        try {
            const constraints = {
                video: {
                    facingMode: facing,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false
            };

            const s = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = s;
            if (videoRef.current) {
                videoRef.current.srcObject = s;
                await videoRef.current.play();
            }
            setFacingMode(facing);
        } catch (err: any) {
            console.error("Camera error:", err);
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setCameraError("ถูกปฏิเสธการเข้าถึงกล้อง กรุณาอนุญาตในตั้งค่าบราวเซอร์");
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                setCameraError("ไม่พบอุปกรณ์กล้องบนเครื่องนี้");
            } else {
                setCameraError("ไม่สามารถเปิดกล้องได้ (ข้อผิดพลาด: " + err.name + ")");
            }
        } finally {
            setIsCameraStarting(false);
        }
    }

    function stopCamera() {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraReady(false);
    }

    /* ── CAPTURE ── */
    function capturePhoto(overrideType?: "Offsite-In" | "Offsite-Out", useRaw = false): string | null {
        const v = videoRef.current, c = canvasRef.current, raw = rawCanvasRef.current;
        if (!v || !c || !raw) return null;
        const currentType = overrideType || checkType;
        const w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) return null;

        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        const rawCtx = raw.getContext("2d");
        if (!ctx || !rawCtx) return null;

        ctx.save();
        if (facingMode === "user") {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
        }

        if (useRaw) {
            ctx.drawImage(raw, 0, 0);
        } else {
            raw.width = w; raw.height = h;
            rawCtx.drawImage(v, 0, 0, w, h);
            ctx.drawImage(v, 0, 0, w, h);
        }
        ctx.restore();

        const now = getThaiTime();
        const dStr = formatDateShortThai(now);
        const tStr = formatTimeFull24h(now) + " น.";

        // 📱 Orientation-Aware Scaling
        const baseDim = Math.min(w, h);
        const sc = baseDim / 720; 
        const bH = Math.round(baseDim * 0.22); 
        const bY = h - bH;

        // Gradient & Line
        const grad = ctx.createLinearGradient(0, bY - 10, 0, h);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.2, "rgba(0,0,0,0.88)");
        grad.addColorStop(1, "rgba(10,10,10,0.98)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, bY - 15, w, bH + 15);

        ctx.fillStyle = currentType === "Offsite-In" ? "#4ade80" : "#fb923c";
        ctx.fillRect(0, bY, w, Math.max(2, Math.round(h * 0.005)));

        const f1 = Math.round(24 * sc), f2 = Math.round(18 * sc), f3 = Math.round(13 * sc);
        const lPad = Math.round(w * 0.035);
        const itemGap = Math.round(bH * 0.24);
        const yStart = bY + Math.round(bH * 0.3);

        ctx.textAlign = "left";
        ctx.fillStyle = "white";
        ctx.font = `bold ${f1}px Arial, Tahoma`;
        ctx.fillText(me?.name || "—", lPad, yStart);

        ctx.fillStyle = "#e0e0e0";
        ctx.font = `${f2}px Arial, Tahoma`;

        let currentDuration = "";
        const matchIn = today.filter(x => x.type.startsWith("Offsite")).find(c =>
            c.type === "Offsite-In" &&
            (c.remark?.split(" | ")[0] || "") === locationName.trim()
        );
        if (matchIn && currentType === "Offsite-Out") {
            const mins = Math.floor((new Date().getTime() - new Date(matchIn.timestamp).getTime()) / 60000);
            const hrs = Math.floor(mins / 60);
            currentDuration = hrs > 0 ? ` (อยู่ ${hrs} ชม. ${mins % 60} นาที)` : ` (อยู่ ${mins} นาที)`;
        }

        ctx.fillText(`สถานที่: ${locationName.trim() || "—"}${currentDuration}`, lPad, yStart + itemGap);

        ctx.fillStyle = "#aaaaaa";
        ctx.font = `${f3}px 'Courier New', monospace`;
        ctx.fillText(`GPS: ${gps.lat?.toFixed(5)}, ${gps.lon?.toFixed(5)}  ±${Math.round(gps.accuracy ?? 0)}m`, lPad, yStart + itemGap * 2);

        ctx.textAlign = "right";
        ctx.fillStyle = "white";
        ctx.font = `bold ${f1}px 'Courier New', monospace`;
        ctx.fillText(`${dStr} ${tStr}`, w - lPad, yStart);
        
        const isIn = currentType.toLowerCase().includes("in");
        const typeColor = isIn ? "#4ade80" : "#fb923c";
        ctx.fillStyle = typeColor;
        ctx.font = `bold ${f2}px Arial, Tahoma`;
        ctx.fillText(isIn ? "OFFSITE IN" : "OFFSITE OUT", w - lPad, yStart + itemGap);

        return c.toDataURL("image/jpeg", 0.9);
    }

    /* ── SUBMIT ── */
    async function doSubmitCheckin(targetType: "Offsite-In" | "Offsite-Out") {
        if (!locationName.trim()) return showAlert("กรุณาระบุสถานที่ปฏิบัติงาน");
        if (!remark.trim()) return showAlert("กรุณาระบุรายละเอียดงาน/หมายเหตุ (จำเป็น)");
        if (!preview || !me) return showAlert("กรุณาถ่ายรูปเพื่อยืนยันตัวตน");

        setIsSubmitting(true);
        setCheckType(targetType);
        capturePhoto(targetType, true);

        try {
            const blob = await new Promise<Blob>((res, rej) => canvasRef.current?.toBlob(b => b ? res(b) : rej(), "image/jpeg", 0.88));
            const fd = new FormData();
            fd.append("file", blob, "offsite.jpg");
            const up = await fetch("/api/upload", { method: "POST", body: fd });
            const upData = await up.json();
            if (!up.ok) throw new Error(upData.error || "UPLOAD_FAILED");

            const actualRemark = remark.trim() ? `${locationName.trim()} | ${remark.trim()}` : locationName.trim();

            const r = await fetch("/api/checkins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: targetType,
                    branch_id: me.branch_id || branches[0]?.id || "UNKNOWN",
                    lat: gps.lat, lon: gps.lon, accuracy: gps.accuracy,
                    photo_url: upData.url,
                    emp_id: me.emp_id, name: me.name,
                    remark: actualRemark,
                }),
            });
            const dbData = await r.json();
            if (!r.ok) throw new Error(dbData.error || "DB_ERROR");

            // Calculate duration for shared message if it's an OUT
            let stayDuration = "";
            if (targetType === "Offsite-Out") {
                const matchIn = today.filter(x => x.type.startsWith("Offsite")).find(c =>
                    c.type === "Offsite-In" &&
                    (c.remark?.split(" | ")[0] || "") === locationName.trim()
                );
                if (matchIn) {
                    const diffMs = new Date().getTime() - new Date(matchIn.timestamp).getTime();
                    const mins = Math.floor(diffMs / 60000);
                    const hrs = Math.floor(mins / 60);
                    stayDuration = hrs > 0 ? `${hrs} ชม. ${mins % 60} นาที` : `${mins} นาที`;
                }
            }

            setAlert({
                visible: true,
                type: "ok",
                message: "บันทึกสำเร็จ",
                id: dbData.id,
                hasShared: false,
                isMandatory: targetType === "Offsite-Out",
                shareData: {
                    name: me.name,
                    type: targetType,
                    location: locationName.trim(),
                    time: formatTimeFull24h(getThaiTime()) + " น.",
                    remark: remark.trim(),
                    photoUrl: upData.url,
                    lat: gps.lat,
                    lng: gps.lon,
                    duration: stayDuration
                }
            });

            // Reset
            setPreview(null);
            setLocationName("");
            setRemark("");
            refreshToday();
            stopCamera();

        } catch (e: any) {
            showAlert(e.message || "เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSubmitting(false);
        }
    }

    // Combine any checkin types today for the history
    const checkinsToday = today.filter(x => x.type.startsWith("Offsite"));

    return (
        <div style={{ background: "#f3f4f6", minHeight: "100vh", fontFamily: "'Prompt', 'Sarabun', sans-serif", padding: "16px", color: "#111827" }}>
            <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>

                {/* 1. Time Card */}
                <TimeCard />

                {/* 2. Location Input Box */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                        สถานที่ปฏิบัติงาน (จำเป็น)
                    </div>

                    <div style={{ position: "relative" }}>
                        <input
                            style={{
                                width: "100%", padding: "12px 16px", borderRadius: 8,
                                border: `1px solid ${locationName ? "#3b82f6" : "#ef4444"}`,
                                outline: "none", fontSize: 15, background: preview ? "#f9fafb" : "white"
                            }}
                            placeholder="เช่น บ้าน, ร้านกาแฟ, ไซต์งานชั่วคราว"
                            value={locationName}
                            onChange={e => setLocationName(e.target.value)}
                            disabled={!!preview} // Lock input once photo is taken
                        />
                        {!locationName.trim() && (
                            <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>
                                * จำเป็นต้องกรอกสถานที่ก่อนเช็คอิน
                            </div>
                        )}
                    </div>
                </div>

                {/* 2.5. Remark Input Box (Mandatory) */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        รายละเอียดงาน / หมายเหตุ (จำเป็น)
                    </div>

                    <div style={{ position: "relative" }}>
                        <textarea
                            style={{
                                width: "100%", padding: "12px 16px", borderRadius: 8,
                                border: `1px solid ${remark.trim() ? "#3b82f6" : "#ef4444"}`,
                                outline: "none", fontSize: 15, background: preview ? "#f9fafb" : "white",
                                minHeight: 80, resize: "none", fontFamily: "inherit"
                            }}
                            placeholder="ระบุสิ่งที่ทำ เช่น ซ่อมอุปกร์, ติดตั้งระบบ"
                            value={remark}
                            onChange={e => setRemark(e.target.value)}
                            disabled={!!preview}
                        />
                        {!remark.trim() && (
                            <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>
                                * จำเป็นต้องระบุรายละเอียดก่อนเช็คอิน
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Camera Section */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <CameraIcon width={18} /> ถ่ายรูปยืนยันตัวตน
                        </div>
                        {locationName.trim() && (() => {
                            const matchIn = checkinsToday.find(c =>
                                c.type === "Offsite-In" &&
                                (c.remark?.split(" | ")[0] || "") === locationName.trim()
                            );
                            if (matchIn) {
                                const mins = Math.floor((new Date().getTime() - new Date(matchIn.timestamp).getTime()) / 60000);
                                const hrs = Math.floor(mins / 60);
                                const dur = hrs > 0 ? `${hrs} ชม. ${mins % 60} นาที` : `${mins} นาที`;
                                return <span style={{ fontSize: 12, background: "#e0e7ff", color: "#4f46e5", padding: "2px 8px", borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><ClockIcon style={{ width: 14, height: 14 }} /> อยู่มาแล้ว {dur}</span>;
                            }
                            return null;
                        })()}
                    </div>

                    {!cameraReady && !cameraError && !isCameraStarting && (
                        <button
                            style={{ width: "100%", background: (locationName.trim() && remark.trim()) ? "#f3f4f6" : "#f1f5f9", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, color: (locationName.trim() && remark.trim()) ? "#1f2937" : "#94a3b8", fontWeight: 600, fontSize: 15, cursor: (locationName.trim() && remark.trim()) ? "pointer" : "not-allowed" }}
                            onClick={() => startCamera()}
                            disabled={!locationName.trim() || !remark.trim()}
                        >
                            <CameraIcon width={18} />
                            เปิดกล้อง
                        </button>
                    )}

                    <div style={{ position: "relative", marginBottom: 16, marginTop: cameraReady || isCameraStarting || cameraError ? 0 : 16 }}>
                        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "black", minHeight: cameraReady || isCameraStarting || cameraError || preview ? 240 : 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s" }}>

                            <video
                                 ref={videoRef}
                                 autoPlay
                                 playsInline
                                 muted
                                 className={`${styles.video} ${facingMode === "user" ? styles.mirror : ""}`}
                                 style={{ display: cameraReady ? "block" : "none" }}
                                 onLoadedMetadata={() => setCameraReady(true)}
                             />
                            <canvas ref={canvasRef} style={{ display: "none" }} />
                            <canvas ref={rawCanvasRef} style={{ display: "none" }} />

                            {isCameraStarting && (
                                <div style={{ color: "white", textAlign: "center", position: "absolute" }}>
                                    <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }}></div>
                                    <div style={{ fontSize: 14 }}>กำลังเรียกใช้กล้อง...</div>
                                </div>
                            )}

                            {cameraError && (
                                <div style={{ color: "#fca5a5", textAlign: "center", padding: 20, position: "absolute" }}>
                                    <XCircleIcon width={40} style={{ margin: "0 auto 12px" }} />
                                    <div style={{ fontSize: 14, fontWeight: 500 }}>{cameraError}</div>
                                    <button
                                        onClick={() => startCamera(facingMode)}
                                        style={{ marginTop: 12, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                                    >
                                        ลองใหม่อีกครั้ง
                                    </button>
                                </div>
                            )}

                            {cameraReady && !preview && !isCameraStarting && (
                                <button
                                    style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "white", color: "black", padding: "12px 24px", borderRadius: 24, border: "none", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: 6, zIndex: 10 }}
                                    onClick={() => {
                                        const url = capturePhoto();
                                        if (url) {
                                            setPreview(url);
                                            stopCamera();
                                        }
                                    }}
                                >
                                    <CameraIcon width={20} /> ถ่ายรูป
                                </button>
                            )}

                            {preview && (
                                <div style={{ position: "absolute", inset: 0, width: "100%", background: "black", zIndex: 5 }}>
                                    <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                    <button
                                        style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 12, cursor: "pointer", zIndex: 10, display: 'flex', alignItems: 'center', gap: 4 }}
                                        onClick={() => {
                                            setPreview(null);
                                            startCamera();
                                        }}
                                    >
                                        <RotateCcw size={14} /> ถ่ายใหม่
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                        <button
                            style={{ background: "#22c55e", color: "white", fontWeight: 700, fontSize: 18, border: "none", borderRadius: 12, padding: "18px", cursor: (preview && remark.trim()) ? "pointer" : "not-allowed", opacity: (preview && remark.trim() && !isSubmitting) ? 1 : 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            onClick={() => doSubmitCheckin("Offsite-In")}
                            disabled={!preview || isSubmitting || !remark.trim()}
                        >
                            {isSubmitting ? <ArrowPathIcon width={20} className="animate-spin" /> : <ArrowRightStartOnRectangleIcon width={20} />}
                            บันทึกเข้า (IN)
                        </button>
                        {(() => {
                            const locClean = locationName.trim();
                            const matchOut = checkinsToday.find(c =>
                                c.type === "Offsite-Out" &&
                                (c.remark?.split(" | ")[0] || "") === locClean &&
                                new Date(c.timestamp) > new Date(checkinsToday.find(i => i.type === "Offsite-In" && (i.remark?.split(" | ")[0] || "") === locClean)?.timestamp || 0)
                            );
                            const isDone = !!matchOut;

                            return (
                                <button
                                    style={{
                                        background: isDone ? "#f3f4f6" : "white",
                                        color: isDone ? "#9ca3af" : "#ef4444",
                                        fontWeight: 700,
                                        fontSize: 18,
                                        border: isDone ? "2px solid #e5e7eb" : "2px solid #ef4444",
                                        borderRadius: 12,
                                        padding: "18px",
                                        cursor: (preview && !isSubmitting && !isDone && remark.trim()) ? "pointer" : "not-allowed",
                                        opacity: (preview && !isSubmitting && !isDone && remark.trim()) ? 1 : 0.6,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                    }}
                                    onClick={() => !isDone && remark.trim() && doSubmitCheckin("Offsite-Out")}
                                    disabled={!preview || isSubmitting || isDone || !remark.trim()}
                                >
                                    {isSubmitting ? <ArrowPathIcon width={20} className="animate-spin" /> : <StopIcon width={20} />}
                                    {isDone ? "บันทึกออกแล้ว" : "บันทึกออก (OUT)"}
                                </button>
                            );
                        })()}
                    </div>
                </div>

                {/* 4. History Card */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        เช็คอินนอกสถานที่วันนี้
                    </div>

                    {checkinsToday.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 14 }}>ยังไม่มีประวัติวันนี้</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {checkinsToday.map((x, i) => {
                                const isIn = x.type === "Offsite-In";

                                // Check if this IN already has a corresponding OUT
                                let hasOut = false;
                                if (isIn) {
                                    const xLoc = x.remark?.split(" | ")[0] || "";
                                    hasOut = checkinsToday.some((other, idx) =>
                                        idx > i &&
                                        other.type === "Offsite-Out" &&
                                        (other.remark?.split(" | ")[0] || "") === xLoc
                                    );
                                }

                                let durationInfo = null;
                                if (isIn && !hasOut) {
                                    // Calculate 'Stayed so far'
                                    const mins = Math.floor((new Date().getTime() - new Date(x.timestamp || new Date()).getTime()) / 60000);
                                    const hrs = Math.floor(mins / 60);
                                    const dur = hrs > 0 ? `${hrs} ชม. ${mins % 60} นาที` : `${mins} นาที`;
                                    durationInfo = <div style={{ fontSize: 12, color: "#10b981", marginTop: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><ClockIcon style={{ width: 14, height: 14 }} /> อยู่มาแล้ว: {dur}</div>;
                                }

                                if (!isIn) {
                                    const xLoc = x.remark?.split(" | ")[0] || "";
                                    const matchIn = [...checkinsToday].slice(0, i).reverse().find((prev) => {
                                        const prevLoc = prev.remark?.split(" | ")[0] || "";
                                        return prev.type === "Offsite-In" && prevLoc === xLoc;
                                    });

                                    if (matchIn) {
                                        const inTime = formatLocalTimeOnly(matchIn.timestamp);
                                        const mins = Math.floor((new Date(x.timestamp).getTime() - new Date(matchIn.timestamp).getTime()) / 60000);
                                        const hrs = Math.floor(mins / 60);
                                        const dur = hrs > 0 ? `${hrs} ชม. ${mins % 60} นาที` : `${mins} นาที`;
                                        durationInfo = <div style={{ fontSize: 12, color: "#4f46e5", marginTop: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><ClockIcon style={{ width: 14, height: 14 }} /> เข้า: {inTime} <ArrowRight size={12} /> รวมเวลา: {dur}</div>;
                                    }
                                }

                                return (
                                    <div
                                        key={x.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            border: "1px solid #e5e7eb",
                                            padding: "14px",
                                            borderRadius: 10,
                                            cursor: (isIn && !hasOut) ? "pointer" : "default",
                                            transition: "background 0.2s",
                                            background: (isIn && !hasOut) ? "#f8fafc" : "white",
                                            opacity: (isIn && hasOut) ? 0.7 : 1
                                        }}
                                        onClick={() => {
                                            if (isIn && !hasOut) {
                                                const loc = x.remark?.split(" | ")[0] || "";
                                                setLocationName(loc);
                                                window.scrollTo({ top: 0, behavior: "smooth" });
                                                startCamera("user", loc);
                                            }
                                        }}
                                        title={isIn ? (hasOut ? "บันทึกออกแล้ว" : "คลิกเพื่อถ่ายรูปบันทึกออก (OUT)") : undefined}
                                        onMouseEnter={(e) => isIn && !hasOut && (e.currentTarget.style.background = "#f1f5f9")}
                                        onMouseLeave={(e) => isIn && !hasOut && (e.currentTarget.style.background = "#f8fafc")}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
                                                {i + 1}. {x.remark?.split(" | ")[0] || "นอกสถานที่"}
                                            </div>
                                            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                                                {formatLocalTimeOnly(x.timestamp)}
                                                <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, fontSize: 11, background: !isIn ? "#fee2e2" : "#dcfce7", color: !isIn ? "#ef4444" : "#16a34a", fontWeight: 700 }}>
                                                    {isIn ? "IN" : "OUT"}
                                                </span>
                                            </div>
                                            {durationInfo}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
            <AlertModal alert={alert} onClose={closeAlert} />
        </div>
    );
}
