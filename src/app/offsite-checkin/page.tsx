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
    StopIcon
} from "@heroicons/react/24/solid";
import { formatTimeFull24h } from "@/utils/time";

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
interface AlertState { visible: boolean; message: string; type: "error" | "ok" }
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
function AlertModal({ alert, onClose }: { alert: AlertState; onClose: () => void }) {
    if (!alert.visible) return null;
    const isErr = alert.type === "error";
    return (
        <div className={styles.alertOverlay} onClick={onClose} role="dialog" aria-modal="true" style={{ zIndex: 9999 }}>
            <div className={styles.alertModal} onClick={e => e.stopPropagation()}>
                <div className={`${styles.alertIcon} ${isErr ? styles.alertIconErr : styles.alertIconOk}`}>
                    {isErr ? <ExclamationTriangleIcon width={32} /> : <CheckCircleIcon width={32} />}
                </div>
                <div className={`${styles.alertTitle} ${isErr ? styles.alertTitleErr : styles.alertTitleOk}`}>
                    {isErr ? "เกิดข้อผิดพลาด" : "สำเร็จ"}
                </div>
                <div className={styles.alertMsg}>{alert.message}</div>
                <button className={`${styles.alertBtn} ${isErr ? styles.alertBtnErr : styles.alertBtnOk}`} onClick={onClose} autoFocus>
                    ตกลง
                </button>
            </div>
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
            const d = now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "error" });
    const closeAlert = useCallback(() => setAlert(p => ({ ...p, visible: false })), []);

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
    async function startCamera(facing: "user" | "environment" = "user") {
        if (!locationName.trim()) {
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
                    width: { ideal: 1280, min: 640 },
                    height: { ideal: 720, min: 480 }
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
        const w = v.videoWidth || 1280, h = v.videoHeight || 720;
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return null;

        if (useRaw) {
            ctx.drawImage(raw, 0, 0);
        } else {
            raw.width = w; raw.height = h;
            raw.getContext("2d")?.drawImage(v, 0, 0);
            ctx.drawImage(v, 0, 0, w, h);
        }

        const dStr = getThaiTime().toLocaleDateString("th-TH");
        const tStr = formatTimeFull24h(getThaiTime()) + " น.";

        const bH = Math.round(h * 0.22), bY = h - bH;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(0, bY, w, bH);

        ctx.fillStyle = currentType === "Offsite-In" ? "#4ade80" : "#fb923c";
        ctx.fillRect(0, bY, w, 4);

        ctx.textAlign = "left";
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.round(22 * w / 1280)}px Arial`;
        ctx.fillText(me?.name || "—", 30, bY + 35);

        ctx.fillStyle = "#aaa";
        ctx.font = `${Math.round(18 * w / 1280)}px Arial`;
        ctx.fillText(`Loc: ${locationName.trim() || "—"}`, 30, bY + 65);

        ctx.font = `${Math.round(14 * w / 1280)}px Arial`;
        ctx.fillText(`GPS: ${gps.lat?.toFixed(5)}, ${gps.lon?.toFixed(5)} `, 30, bY + 95);

        ctx.textAlign = "right";
        ctx.font = `bold ${Math.round(22 * w / 1280)}px Arial`;
        ctx.fillText(`${dStr} ${tStr}`, w - 30, bY + 35);
        ctx.fillStyle = currentType === "Offsite-In" ? "#4ade80" : "#fb923c";
        ctx.fillText(currentType === "Offsite-In" ? "▶ IN" : "■ OUT", w - 30, bY + 65);

        return c.toDataURL("image/jpeg", 0.88);
    }

    /* ── SUBMIT ── */
    async function doSubmitCheckin(targetType: "Offsite-In" | "Offsite-Out") {
        if (!preview || !locationName.trim() || !me) return showAlert("กรุณาระบุสถานที่และถ่ายรูป");

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

            showAlert("บันทึกสำเร็จ", "ok");

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

                {/* 3. Camera Section */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
                        <CameraIcon width={18} /> ถ่ายรูปยืนยันตัวตน
                    </div>

                    {!cameraReady && !cameraError && !isCameraStarting && (
                        <button
                            style={{ width: "100%", background: locationName.trim() ? "#f3f4f6" : "#f1f5f9", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, color: locationName.trim() ? "#1f2937" : "#94a3b8", fontWeight: 600, fontSize: 15, cursor: locationName.trim() ? "pointer" : "not-allowed" }}
                            onClick={() => startCamera()}
                            disabled={!locationName.trim()}
                        >
                            <CameraIcon width={18} />
                            เปิดกล้อง
                        </button>
                    )}

                    <div style={{ position: "relative", marginBottom: 16, marginTop: cameraReady || isCameraStarting || cameraError ? 0 : 16 }}>
                        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "black", minHeight: cameraReady || isCameraStarting || cameraError || preview ? 240 : 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s" }}>
                            
                            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: cameraReady ? "block" : "none" }} onLoadedMetadata={() => setCameraReady(true)} />
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
                                        style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 12, cursor: "pointer", zIndex: 10 }}
                                        onClick={() => {
                                            setPreview(null);
                                            startCamera();
                                        }}
                                    >
                                        ↺ ถ่ายใหม่
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                        <button
                            style={{ background: "#22c55e", color: "white", fontWeight: 700, fontSize: 18, border: "none", borderRadius: 12, padding: "18px", cursor: preview ? "pointer" : "not-allowed", opacity: preview && !isSubmitting ? 1 : 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            onClick={() => doSubmitCheckin("Offsite-In")}
                            disabled={!preview || isSubmitting}
                        >
                            {isSubmitting ? <ArrowPathIcon width={20} className="animate-spin" /> : <ArrowRightStartOnRectangleIcon width={20} />}
                            บันทึกเข้า (IN)
                        </button>
                        <button
                            style={{ background: "white", color: "#ef4444", fontWeight: 700, fontSize: 18, border: "2px solid #ef4444", borderRadius: 12, padding: "18px", cursor: preview ? "pointer" : "not-allowed", opacity: preview && !isSubmitting ? 1 : 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            onClick={() => doSubmitCheckin("Offsite-Out")}
                            disabled={!preview || isSubmitting}
                        >
                            {isSubmitting ? <ArrowPathIcon width={20} className="animate-spin" /> : <StopIcon width={20} />}
                            บันทึกออก (OUT)
                        </button>
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
                                return (
                                    <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #e5e7eb", padding: "14px", borderRadius: 10 }}>
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
