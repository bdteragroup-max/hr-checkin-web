"use client";

import Image from "next/image";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { 
    CheckCircleIcon, 
    XCircleIcon, 
    ExclamationTriangleIcon, 
    CameraIcon, 
    MapPinIcon, 
    ArrowPathIcon,
    ArrowRightStartOnRectangleIcon,
    StopIcon,
    PlusIcon,
    ClockIcon,
    PencilSquareIcon,
    ClipboardDocumentListIcon
} from "@heroicons/react/24/solid";
import { Camera, RotateCcw, ArrowRight, X, Play, Square, LogIn, LogOut, Loader2 } from "lucide-react";
import { formatTime24h, formatTimeFull24h, formatDateShortThai } from "@/utils/time";
import WorkPlanModal from "@/components/WorkPlanModal";

/* ──────────────────────────────────────────
   CONFIG 
────────────────────────────────────────── */
const WORK_START_H = 8, WORK_START_M = 0;
const WORK_END_H = 17, WORK_END_M = 0;
const OT_THRESHOLD_MIN = 30;

/* ──────────────────────────────────────────
   TYPES
────────────────────────────────────────── */
interface Me { emp_id: string; name: string; branch_id: string | null; is_checkin_exempt?: boolean; }
interface Project {
    id: number;
    code: string | null;
    name: string;
    client_name: string | null;
    address: string | null;
    status: string;
    contact: string | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
    radius_m: number;
}
interface Branch { id: string; name: string; centerLat?: number; centerLon?: number; radiusM?: number }
interface TodayItem {
    id: number | string;
    type: "Check-in" | "Check-out" | "Project-In" | "Project-Out";
    timestamp: string;
    branch_name: string;
    distance?: number | null;
    photo_url?: string | null;
    project_name?: string | null;
    remark?: string | null;
    lateStatus?: "ontime" | "late" | "early" | "ot";
    lateLabel?: string;
    customer_code?: string;
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

interface GpsState { ok: boolean; lat: number | null; lon: number | null; accuracy: number | null; distance: number | null; pass: boolean; reason: string }

/* ──────────────────────────────────────────
   UTILS
────────────────────────────────────────── */
function pad(n: number) { return String(n).padStart(2, "0") }
function formatLocalTimeOnly(ts: string) {
    return formatTime24h(ts);
}
function getThaiTime() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
}
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000, toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ──────────────────────────────────────────
   COMPONENTS
────────────────────────────────────────── */
function AlertModal({ alert, onClose }: { alert: AlertState; onClose: (sharedClick?: boolean) => void }) {
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
                                        `📍 รายงานการเช็กอิน: ${d.name}`,
                                        `🕒 เวลา: ${d.time}`
                                    ];
                                    if (d.duration) {
                                        textLines.push(`⏱️ ระยะเวลาที่อยู่: ${d.duration}`);
                                    }
                                    textLines.push(`📄 รายงานรายละเอียด: ${shareLink}`);
                                    const text = textLines.join('\n');
                                    
                                    const shareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(text)}`;
                                    window.open(shareUrl, '_blank');
                                    onClose(true); // Signal that share was clicked
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
            const d = now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
            setDateStr(`วัน${d.split("วัน")[1]}`); // Ensure nice format like วันพฤหัสบดีที่ 26 กุมภาพันธ์ 2569
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
export default function ProjectCheckinPage() {
    const [me, setMe] = useState<Me | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
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
    const [searchQ, setSearchQ] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState<Project | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);

    // Flow State: 0=Search, 1=Loading GPS, 2=Camera, 3=Submitting
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [gps, setGps] = useState<GpsState>({ ok: false, lat: null, lon: null, accuracy: null, distance: null, pass: false, reason: "" });
    const [checkType, setCheckType] = useState<"Project-In" | "Project-Out">("Project-In");

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
    const [remark, setRemark] = useState("");

    // New Customer Modal
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [newCus, setNewCus] = useState({ name: "", address: "", phone: "", contact: "" });
    const [newCusGps, setNewCusGps] = useState<{ lat: number, lng: number } | null>(null);
    const [isSavingCus, setIsSavingCus] = useState(false);

    // Work Plan State
    const [showWorkPlan, setShowWorkPlan] = useState(false);
    const [planSubmittedToday, setPlanSubmittedToday] = useState(false);
    const [isPlanLoading, setIsPlanLoading] = useState(true);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    // useEffect(() => {
    //     if (!isPlanLoading && !planSubmittedToday && me && !me.is_checkin_exempt) {
    //         setShowWorkPlan(true);
    //     }
    // }, [isPlanLoading, planSubmittedToday, me]);

    useEffect(() => {
        (async () => {
            const r = await fetch("/api/me");
            if (!r.ok) return (window.location.href = "/");
            const meData = await r.json();
            setMe(meData);

            // Check if plan submitted today
            const wp = await fetch("/api/work-plans");
            const wpData = await wp.json();
            if (wpData.ok && wpData.plan) {
                setPlanSubmittedToday(true);
            }
            setIsPlanLoading(false);

            const b = await fetch("/api/branches");
            const bd = await b.json();
            setBranches(bd.branches || []);

            fetchProjects();
            refreshToday();
        })();
    }, []);

    // Watch for GPS changes aggressively to show distance when selecting
    useEffect(() => {
        readGPSNoTarget();
    }, []);

    async function fetchProjects() {
        const pRes = await fetch("/api/projects");
        const pData = await pRes.json().catch(() => ({}));
        setProjects(pData.projects || []);
    }

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (preview || isSubmitting) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [preview, isSubmitting]);

    async function refreshToday() {
        const r = await fetch("/api/checkins", { cache: "no-store" });
        const data = await r.json().catch(() => ({}));
        setToday(data.list || []);
    }

    function showAlert(message: string, type: "error" | "ok" = "error") {
        setAlert({ visible: true, message, type });
    }

    /* ── ADD CUSTOMER ── */
    async function handleAddCustomer() {
        if (!newCus.name) return showAlert("กรุณาระบุชื่อลูกค้า/สถานที่");
        setIsSavingCus(true);
        try {
            const r = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newCus.name,
                    address: newCus.address,
                    phone: newCus.phone,
                    contact: newCus.contact,
                    lat: newCusGps?.lat || gps.lat,
                    lng: newCusGps?.lng || gps.lon,
                    radius_m: 200
                })
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            showAlert("เพิ่มลูกค้าสำเร็จ!", "ok");
            setShowAddCustomer(false);
            setNewCus({ name: "", address: "", phone: "", contact: "" });
            setNewCusGps(null);
            await fetchProjects();

            // Auto Select
            if (data.project) {
                setSearchQ("");
                selectCustomer(data.project);
            }
        } catch (e: any) {
            showAlert(e.message || "เกิดข้อผิดพลาด");
        } finally {
            setIsSavingCus(false);
        }
    }

    function grabMyGpsForCustomer() {
        if (!navigator.geolocation) return showAlert("อุปกรณ์ไม่รองรับ GPS");
        navigator.geolocation.getCurrentPosition(
            (pos) => setNewCusGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => {
                if (window.location.hostname === "localhost") setNewCusGps({ lat: 13.75, lng: 100.5 });
                else showAlert("ไม่สามารถอ่าน GPS ได้: " + err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    /* ── SELECTION FLOW ── */
    async function selectCustomer(cus: Project) {
        setSelectedCustomer(cus);
        setSearchQ("");
        setShowDropdown(false);
        setCheckType("Project-In"); // default

        // Try validate distance
        if (cus.lat && cus.lng && gps.lat && gps.lon) {
            const dist = haversineMeters(gps.lat, gps.lon, cus.lat, cus.lng);
            setGps(prev => ({ ...prev, distance: dist, pass: dist <= (cus.radius_m || 200) }));
        }
    }

    /* ── GPS ── */
    async function readGPSNoTarget() {
        if (!navigator.geolocation) return;
        navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude: lat, longitude: lon, accuracy: acc } = pos.coords;
                setGps(prev => {
                    let dist = null;
                    let pass = true;
                    if (selectedCustomer?.lat && selectedCustomer?.lng) {
                        dist = haversineMeters(lat, lon, selectedCustomer.lat, selectedCustomer.lng);
                        pass = dist <= (selectedCustomer.radius_m || 200);
                    }
                    return { ok: true, lat, lon, accuracy: acc, distance: dist, pass, reason: "" };
                });
            },
            (err) => {
                if (window.location.hostname === "localhost") {
                    setGps(prev => ({ ...prev, ok: true, lat: 13.75, lon: 100.5, accuracy: 10 }));
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }

    /* ── CAMERA ── */
    async function startCamera(facing: "user" | "environment" = "user") {
        stopCamera();
        setPreview(null);
        setIsCameraStarting(true);
        setCameraError(null);
        setCameraReady(false);

        try {
            // More flexible constraints to support wider range of devices
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
                // Wait for play to confirm it started
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
    function capturePhoto(overrideType?: "Project-In" | "Project-Out", useRaw = false): string | null {
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
            // First time: store raw
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

        ctx.fillStyle = currentType === "Project-In" ? "#4ade80" : "#fb923c";
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
        
        // Auto-calculate duration watermark
        let currentDuration = "";
        const matchIn = today.filter(x => x.type.startsWith("Project") || x.type === "Check-in").find(c => 
            (c.type === "Project-In" || c.type === "Check-in") && 
            c.project_name === selectedCustomer?.name
        );
        if (matchIn && currentType === "Project-Out") {
            const mins = Math.floor((new Date().getTime() - new Date(matchIn.timestamp).getTime()) / 60000);
            const hrs = Math.floor(mins / 60);
            currentDuration = hrs > 0 ? ` (อยู่ ${hrs} ชม. ${mins % 60} นาที)` : ` (อยู่ ${mins} นาที)`;
        }

        ctx.fillText(`ลูกค้า: ${selectedCustomer?.name || "—"}${currentDuration}`, lPad, yStart + itemGap);

        ctx.fillStyle = "#aaaaaa";
        ctx.font = `${f3}px 'Courier New', monospace`;
        ctx.fillText(`GPS: ${gps.lat?.toFixed(5)}, ${gps.lon?.toFixed(5)} (±${Math.round(gps.accuracy || 0)}m)`, lPad, yStart + itemGap * 2);

        ctx.textAlign = "right";
        ctx.fillStyle = "white";
        ctx.font = `bold ${f1}px 'Courier New', monospace`;
        ctx.fillText(`${dStr} ${tStr}`, w - lPad, yStart);
        
        const isIn = currentType.toLowerCase().includes("in");
        const typeColor = isIn ? "#4ade80" : "#fb923c";
        ctx.fillStyle = typeColor;
        ctx.font = `bold ${f2}px Arial, Tahoma`;
        ctx.fillText(isIn ? "PROJECT IN" : "PROJECT OUT", w - lPad, yStart + itemGap);
        
        // Also ensure duration watermark is clearly legible
        if (currentDuration) {
            ctx.fillStyle = "#fb923c"; // Orange for duration info
            ctx.font = `bold ${f2}px Arial, Tahoma`;
        }

        const dataUrl = c.toDataURL("image/jpeg", 0.9);
        return dataUrl;
    }

    /* ── SUBMIT ── */
    async function doSubmitCheckin(targetType: "Project-In" | "Project-Out") {
        if (!remark.trim()) return showAlert("กรุณาระบุรายละเอียดงาน/บันทึกเพิ่มเติม (จำเป็น)");
        if (!preview || !selectedCustomer || !me) return showAlert("กรุณาถ่ายรูปเพื่อยืนยันตัวตน");
        if (gps.lat === 0 && gps.lon === 0) return showAlert("ไม่สามารถอ่านพิกัดได้ (GPS: 0, 0) กรุณารอสักครู่หรือเปิด GPS");

        // Mandatory Work Plan Check
        if (!planSubmittedToday && !me.is_checkin_exempt) {
            setPendingAction(() => () => executeSubmit(targetType));
            setShowWorkPlan(true);
            return;
        }

        executeSubmit(targetType);
    }

    async function executeSubmit(targetType: "Project-In" | "Project-Out") {
        setIsSubmitting(true);
        // 🔥 Redraw watermark with correct type from RAW frame
        setCheckType(targetType);
        capturePhoto(targetType, true);

        try {
            const blob = await new Promise<Blob>((res, rej) => canvasRef.current?.toBlob(b => b ? res(b) : rej(), "image/jpeg", 0.88));
            const fd = new FormData();
            fd.append("file", blob, "checkin.jpg");
            const up = await fetch("/api/upload", { method: "POST", body: fd });
            const upData = await up.json();
            if (!up.ok) throw new Error(upData.error || "UPLOAD_FAILED");

            const r = await fetch("/api/checkins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: targetType,
                    branch_id: me?.branch_id || branches[0]?.id || "UNKNOWN",
                    lat: gps.lat, lon: gps.lon, accuracy: gps.accuracy,
                    photo_url: upData.url,
                    emp_id: me?.emp_id, name: me?.name,
                    project_name: selectedCustomer?.name,
                    customer_id: selectedCustomer?.id,
                    remark
                }),
            });
            const dbData = await r.json();
            if (!r.ok) throw new Error(dbData.error || "DB_ERROR");

            // Calculate duration for shared message if it's an OUT
            let stayDuration = "";
            if (targetType === "Project-Out") {
                const matchIn = today.filter(x => x.type.startsWith("Project") || x.type === "Check-in").find(c => 
                    (c.type === "Project-In" || c.type === "Check-in") && 
                    c.project_name === selectedCustomer?.name
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
                isMandatory: targetType === "Project-Out",
                shareData: {
                    name: me?.name || "",
                    type: targetType,
                    location: selectedCustomer?.name || "",
                    time: formatTimeFull24h(getThaiTime()) + " น.",
                    remark: remark,
                    photoUrl: upData.url,
                    lat: gps.lat,
                    lng: gps.lon,
                    duration: stayDuration
                }
            });

            // Reset for next
            setSelectedCustomer(null);
            setPreview(null);
            setRemark("");
            refreshToday();
            stopCamera(); // Stop camera after successful submission

        } catch (e: any) {
            let msg = e.message || "เกิดข้อผิดพลาดในการบันทึก";
            if (msg === "WORK_PLAN_REQUIRED") msg = "กรุณาบันทึกแผนงานประจำวันก่อนทำรายการ";
            showAlert(msg);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleWorkPlanSubmit(data: any) {
        try {
            const res = await fetch("/api/work-plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                setPlanSubmittedToday(true);
                setShowWorkPlan(false);
                if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                }
            }
        } catch (e) {
            console.error("Failed to submit work plan", e);
        }
    }

    /* ── RENDER ── */
    const filteredProjects = searchQ ? projects.filter(p => p.name.toLowerCase().includes(searchQ.toLowerCase()) || p.code?.toLowerCase().includes(searchQ.toLowerCase())) : projects;
    const projectCheckinsToday = today.filter(x => x.type.startsWith("Project"));

    return (
        <div style={{ background: "#f3f4f6", minHeight: "100vh", fontFamily: "'Prompt', 'Sarabun', sans-serif", padding: "16px", color: "#111827" }}>
            <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>

                {/* 1. Time Card */}
                <TimeCard />

                {/* 2. Customer Selection Box */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v6h6"></path><path d="M3 15h6"></path><path d="M3 18h6"></path></svg>
                        เลือกลูกค้า / โปรเจกต์
                    </div>

                    {!selectedCustomer ? (
                        /* UNSELECTED STATE */
                        <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: 14, top: 12, color: "#9ca3af" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </div>
                            <input
                                style={{
                                    width: "100%", padding: "12px 16px 12px 40px", borderRadius: 8,
                                    border: `1px solid ${searchQ ? "#3b82f6" : "#cbd5e1"}`,
                                    outline: "none", fontSize: 15,
                                    boxShadow: searchQ ? "0 0 0 2px rgba(59,130,246,0.2)" : "none"
                                }}
                                placeholder="ค้นหาชื่อบริษัทหรือรหัส..."
                                value={searchQ}
                                onChange={e => { setSearchQ(e.target.value); setShowDropdown(true); }}
                                onFocus={() => setShowDropdown(true)}
                            />

                            {showDropdown && (
                                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", zIndex: 50, border: "1px solid #e5e7eb", borderRadius: 8, marginTop: 4, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", padding: "4px 0" }}>
                                    <div style={{ maxHeight: 240, overflowY: "auto" }}>
                                        {filteredProjects.map(p => (
                                            <div key={p.id} style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                                                onClick={() => selectCustomer(p)}>
                                                <div style={{ fontWeight: 600, color: "#1f2937", fontSize: 15 }}>{p.name}</div>
                                                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{p.code || ""} {p.contact ? ` · ${p.contact}` : ""}</div>
                                                {p.address && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center" }}><MapPinIcon width={12} style={{ marginRight: 4, flexShrink: 0 }} /> {p.address}</div>}
                                            </div>
                                        ))}
                                        {filteredProjects.length === 0 && searchQ && (
                                            <div style={{ padding: "20px 16px", textAlign: "center" }}>
                                                <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 12 }}>ไม่พบลูกค้า "{searchQ}"</div>
                                                <button
                                                    style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", color: "#374151", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                                                    onClick={() => { setShowDropdown(false); setShowAddCustomer(true); setNewCus(p => ({ ...p, name: searchQ })); }}
                                                >
                                                    + เพิ่มลูกค้าใหม่
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* SELECTED STATE */
                        <div>
                            <div style={{ position: "relative", marginBottom: 16 }}>
                                <div style={{ position: "absolute", left: 14, top: 12, color: "#9ca3af" }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </div>
                                <input
                                    style={{ width: "100%", padding: "10px 16px 10px 40px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#9ca3af", outline: "none", fontSize: 14 }}
                                    placeholder="ค้นหาชื่อบริษัทหรือรหัส..."
                                    readOnly
                                    onClick={() => { setSelectedCustomer(null); stopCamera(); }}
                                />
                            </div>

                            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "14px 16px", position: "relative" }}>
                                <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>
                                    {selectedCustomer.name}
                                </div>
                                <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                                    {selectedCustomer.code || "N/A"} {selectedCustomer.address ? `- ${selectedCustomer.address}` : ""}
                                </div>
                                {selectedCustomer.contact && (
                                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        {selectedCustomer.contact} {selectedCustomer.phone ? `- ${selectedCustomer.phone}` : ""}
                                    </div>
                                )}
                                <div style={{ fontSize: 12, color: gps.pass ? "#059669" : "#e11d48", display: "flex", alignItems: "center", gap: 4 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                    ห่าง {Math.round(gps.distance || 0)} เมตร
                                </div>

                                <button
                                    style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#000", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                                    onClick={() => { setSelectedCustomer(null); stopCamera(); }}
                                >
                                    เปลี่ยน
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── SELECTION ACTIVE: MORE FORMS ── */}
                {selectedCustomer && (
                    <>
                        {/* 1. Remark Section (Moved up) */}
                        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
                                <PencilSquareIcon width={18} /> บันทึกเพิ่มเติม / รายละเอียด (จำเป็น)
                            </div>
                            <textarea
                                style={{ 
                                    width: "100%", 
                                    border: `1px solid ${remark.trim() ? "#3b82f6" : "#ef4444"}`, 
                                    borderRadius: 10, 
                                    padding: "14px", 
                                    background: preview ? "#f9fafb" : "white", 
                                    outline: "none", 
                                    fontSize: 15, 
                                    resize: "none", 
                                    minHeight: 120,
                                    fontFamily: "inherit"
                                }}
                                placeholder="ระบุรายละเอียดงานที่ทำวันนี้..."
                                value={remark}
                                onChange={e => setRemark(e.target.value)}
                                disabled={!!preview}
                            />
                            {!remark.trim() && (
                                <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6, fontWeight: 500 }}>
                                    * จำเป็นต้องระบรายละเอียดงานก่อนบันทึก
                                </div>
                            )}
                        </div>



                        {/* 2. Camera Section */}
                        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>


                            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                    ถ่ายรูปยืนยันตัวตน
                                </div>
                                {selectedCustomer && (() => {
                                    const matchIn = projectCheckinsToday.find(c => 
                                        (c.type === "Project-In" || c.type === "Check-in") && 
                                        c.project_name === selectedCustomer.name
                                    );
                                    if (matchIn) {
                                        const mins = Math.floor((new Date().getTime() - new Date(matchIn.timestamp).getTime()) / 60000);
                                        const hrs = Math.floor(mins / 60);
                                        const dur = hrs > 0 ? `${hrs} ชม. ${mins % 60} นาที` : `${mins} นาที`;
                                        return <span style={{ fontSize: 12, background: "#e0e7ff", color: "#4f46e5", padding: "2px 8px", borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><ClockIcon style={{ width: 14, height: 14 }} /> อยู่มาแล้ว {dur}</span>;
                                    }
                                    return null;
                                })()}
                                {gps.lat === 0 && gps.lon === 0 && (
                                    <span style={{ fontSize: 12, background: "#fee2e2", color: "#ef4444", padding: "2px 8px", borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <ExclamationTriangleIcon style={{ width: 14, height: 14 }} /> Waiting for GPS verification
                                    </span>
                                )}
                            </div>

                            {!cameraReady && (
                                <button
                                    style={{ width: "100%", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, color: "#1f2937", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
                                    onClick={() => startCamera()}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                    เปิดกล้อง
                                </button>
                            )}

                            <div style={{ position: "relative", marginBottom: 16 }}>
                                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "black", minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

                                    {!cameraReady && !isCameraStarting && !cameraError && (
                                        <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>
                                            {selectedCustomer ? "กรุณากด 'เปิดกล้อง' เพื่อถ่ายรูป" : "เลือกโปรเจกต์ก่อนขี้นตอนถัดไป"}
                                        </div>
                                    )}
                                </div>

                                {preview && (
                                    <div style={{ position: "relative", width: "100%", background: "black", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                                        <img src={preview} alt="preview" style={{ width: "100%", display: "block" }} />
                                        <button
                                            style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 12, cursor: "pointer", zIndex: 10, display: 'flex', alignItems: 'center', gap: 4 }}
                                            onClick={() => setPreview(null)}
                                        >
                                            <RotateCcw size={14} /> ถ่ายใหม่
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                                <button
                                    style={{ background: "#22c55e", color: "white", fontWeight: 700, fontSize: 18, border: "none", borderRadius: 12, padding: "18px", cursor: (preview && remark.trim()) ? "pointer" : "not-allowed", opacity: (preview && remark.trim() && !isSubmitting) ? 1 : 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                    onClick={() => doSubmitCheckin("Project-In")}
                                    disabled={!preview || isSubmitting || !remark.trim()}
                                >
                                    {isSubmitting ? <ArrowPathIcon width={20} className="animate-spin" /> : <ArrowRightStartOnRectangleIcon width={20} />}
                                    บันทึกเข้า (IN)
                                </button>
                                {(() => {
                                    const matchOut = projectCheckinsToday.find(c => 
                                        (c.type === "Project-Out" || c.type === "Check-out") && 
                                        c.project_name === selectedCustomer.name &&
                                        // Find if this OUT is the most recent activity (after the latest IN)
                                        new Date(c.timestamp) > new Date(projectCheckinsToday.find(i => (i.type === "Project-In" || i.type === "Check-in") && i.project_name === selectedCustomer.name)?.timestamp || 0)
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
                                            onClick={() => !isDone && remark.trim() && doSubmitCheckin("Project-Out")}
                                            disabled={!preview || isSubmitting || isDone || !remark.trim()}
                                        >
                                            {isSubmitting ? <ArrowPathIcon width={20} className="animate-spin" /> : <StopIcon width={20} />}
                                            {isDone ? "บันทึกออกแล้ว" : "บันทึกออก (OUT)"}
                                        </button>
                                    );
                                })()}
                            </div>

                            <div style={{ padding: "12px", background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#6b7280", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                {gps.lat ? `${gps.lat.toFixed(4)}, ${gps.lon?.toFixed(4)}` : "Waiting for GPS verification"}
                            </div>
                        </div>

                    </>
                )}

                {/* 3. History Card */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        เช็คอินวันนี้ ({projectCheckinsToday.length} จุด)
                    </div>

                    {projectCheckinsToday.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 14 }}>ยังไม่มีประวัติวันนี้</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {projectCheckinsToday.map((x, i) => {
                                const isIn = x.type === "Project-In" || x.type === "Check-in";

                                // Check if this IN already has a corresponding OUT
                                let hasOut = false;
                                if (isIn) {
                                    hasOut = projectCheckinsToday.some((other, idx) => 
                                        idx > i && 
                                        (other.type === "Project-Out" || other.type === "Check-out") && 
                                        other.project_name === x.project_name
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
                                    // For OUT, find the matching IN that happened BEFORE it (j < i)
                                    const matchIn = [...projectCheckinsToday].slice(0, i).reverse().find((prev) => 
                                        (prev.type === "Project-In" || prev.type === "Check-in") &&
                                        prev.project_name === x.project_name
                                    );
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
                                                const p = projects.find(proj => proj.name === x.project_name);
                                                if (p) {
                                                    setSelectedCustomer(p);
                                                    setSearchQ("");
                                                    setShowDropdown(false);
                                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                                    startCamera();
                                                }
                                            }
                                        }}
                                        title={isIn ? (hasOut ? "บันทึกออกแล้ว" : "คลิกเพื่อถ่ายรูปบันทึกออก (OUT)") : undefined}
                                        onMouseEnter={(e) => isIn && !hasOut && (e.currentTarget.style.background = "#f1f5f9")}
                                        onMouseLeave={(e) => isIn && !hasOut && (e.currentTarget.style.background = "#f8fafc")}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>{i + 1}. ลูกค้า: {x.project_name || "—"}</div>
                                            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                                                {formatLocalTimeOnly(x.timestamp)}
                                                {x.distance !== null ? ` · ห่าง ${x.distance} ม.` : ""}
                                                <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, fontSize: 11, background: !isIn ? "#fee2e2" : "#dcfce7", color: !isIn ? "#ef4444" : "#16a34a", fontWeight: 700 }}>
                                                    {isIn ? "IN" : "OUT"}
                                                </span>
                                            </div>
                                            {durationInfo}
                                        </div>
                                        <div style={{ color: isIn ? "#10b981" : "#f59e0b" }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                {isIn
                                                    ? <polyline points="20 6 9 17 4 12"></polyline>
                                                    : <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                }
                                            </svg>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* ── ADD CUSTOMER MODAL ── */}
            {showAddCustomer && (
                <div className={styles.alertOverlay}>
                    <div className={styles.alertModal} style={{ width: "95%", maxWidth: 460, padding: "32px 24px", position: "relative", borderRadius: 16, background: "white" }}>
                        <button style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", padding: 4 }} onClick={() => setShowAddCustomer(false)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>

                        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, color: "#111827", textAlign: "left" }}>เพิ่มลูกค้าใหม่</div>

                        <div style={{ padding: "0 12px" }}>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 10, textAlign: "left" }}>ชื่อบริษัท *</label>
                                <input style={{ width: "100%", padding: "14px 16px", borderRadius: 8, border: "2px solid #ef4444", outline: "none", fontSize: 16, color: "#111827" }} value={newCus.name} onChange={e => setNewCus({ ...newCus, name: e.target.value })} autoFocus />
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 10, textAlign: "left" }}>ที่อยู่</label>
                                <input style={{ width: "100%", padding: "14px 16px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", fontSize: 16, color: "#111827", colorScheme: "light" }} value={newCus.address} onChange={e => setNewCus({ ...newCus, address: e.target.value })} placeholder="ที่อยู่" />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 10, textAlign: "left" }}>ผู้ติดต่อ</label>
                                    <input style={{ width: "100%", padding: "14px 16px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", fontSize: 16, color: "#111827" }} value={newCus.contact} onChange={e => setNewCus({ ...newCus, contact: e.target.value })} placeholder="ชื่อ" />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 10, textAlign: "left" }}>เบอร์โทร</label>
                                    <input style={{ width: "100%", padding: "14px 16px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", fontSize: 16, color: "#111827" }} value={newCus.phone} onChange={e => setNewCus({ ...newCus, phone: e.target.value })} placeholder="08x-xxx-xxxx" />
                                </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#6b7280", marginTop: 32, marginBottom: 24, textAlign: "left", lineHeight: 1.5 }}>
                                <MapPinIcon width={18} style={{ color: "#ef4444", marginTop: 2 }} />
                                <span>พิกัด GPS จะใช้ตำแหน่งปัจจุบันของคุณ · สถานะ: ลูกค้าใหม่ · รหัสจะถูกสร้างอัตโนมัติ</span>
                            </div>

                            <button style={{ width: "100%", padding: "16px", borderRadius: 8, border: "none", background: "#ef4444", fontWeight: 700, color: "white", fontSize: 18, cursor: isSavingCus ? "default" : "pointer", opacity: isSavingCus ? 0.7 : 1 }} onClick={handleAddCustomer} disabled={isSavingCus}>
                                {isSavingCus ? "กำลังบันทึก..." : "เพิ่มลูกค้าใหม่"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AlertModal alert={alert} onClose={closeAlert} />
        </div>
    );
}
