"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import {
    MapPin,
    Camera,
    Navigation,
    CheckCircle,
    History,
    Map as MapIcon,
    Loader2,
    ArrowLeft,
} from "lucide-react";
import { formatTime24h } from "@/utils/time";
import AlertModal, { AlertState } from "@/components/AlertModal";
import WorkPlanModal from "@/components/WorkPlanModal";

/* ──────────────────────────────────────────
   TYPES & UTILS
────────────────────────────────────────── */
interface Me { emp_id: string; name: string; branch_id: string | null; is_checkin_exempt?: boolean; }
interface TripItem {
    id: string;
    timestamp: string;
    location: string;
    remark?: string;
    photo_url?: string;
    lat?: number;
    lon?: number;
}

const QUICK_TAGS = ["ถึงที่หมาย", "เริ่มเดินทาง", "แวะพัก/เติมน้ำมัน", "พบลูกค้า", "เริ่มงานไซต์", "เช็คอินที่พัก"];

function getThaiTimeStr() {
    return new Date().toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getThaiDateStr() {
    return new Date().toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
}

/* ──────────────────────────────────────────
   MAIN PAGE
────────────────────────────────────────── */
export default function TripLogPage() {
    const [me, setMe] = useState<Me | null>(null);
    const [history, setHistory] = useState<TripItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State — single field: locationName is required, no separate remark
    const [locationName, setLocationName] = useState("");
    const [gps, setGps] = useState<{ lat: number; lon: number; acc: number } | null>(null);

    // Flow: 'log' | 'camera' | 'submitting'
    const [step, setStep] = useState<'log' | 'camera' | 'submitting'>('log');
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [pendingAction, setPendingAction] = useState<'update' | 'accommodation' | 'checkout'>('update');
    const [showWorkPlan, setShowWorkPlan] = useState(false);
    const [planSubmittedToday, setPlanSubmittedToday] = useState(false);
    const [isPlanLoading, setIsPlanLoading] = useState(true);

    useEffect(() => {
        if (!isPlanLoading && !planSubmittedToday && me && !me.is_checkin_exempt) {
            setShowWorkPlan(true);
        }
    }, [isPlanLoading, planSubmittedToday, me]);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const locationInputRef = useRef<HTMLInputElement>(null);

    // Alert State
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });

    // Initial Load
    useEffect(() => {
        (async () => {
            try {
                const rMe = await fetch("/api/me");
                if (!rMe.ok) { window.location.href = "/"; return; }
                const meData = await rMe.json();
                setMe(meData);

                await refreshHistory();

                if (navigator.geolocation) {
                    navigator.geolocation.watchPosition(
                        (p) => setGps({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
                        () => { },
                        { enableHighAccuracy: true }
                    );
                }

                // Check if work plan is already submitted today
                const planRes = await fetch("/api/work-plans");
                const planData = await planRes.json();
                if (planData.ok && planData.plan) {
                    setPlanSubmittedToday(true);
                }
                setIsPlanLoading(false);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    async function refreshHistory() {
        try {
            const r = await fetch("/api/checkins?trip=true");
            const data = await r.json();
            const tripLogs = (data.list || [])
                .filter((x: any) => x.is_trip || x.type === "Trip-Update")
                .map((x: any) => ({
                    id: x.id,
                    timestamp: x.timestamp,
                    location: x.remark?.split(" | ")[0] || x.branch_name,
                    remark: x.remark?.split(" | ")[1] || "",
                    photo_url: x.photo_url,
                    lat: x.lat,
                    lon: x.lon
                }));
            setHistory(tripLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        } catch (e) {
            console.error("History Refresh Error:", e);
        }
    }

    /* ── CAMERA ── */
    async function openCamera(action: 'update' | 'accommodation' | 'checkout') {
        if (!locationName.trim()) {
            setAlert({ visible: true, message: "กรุณาระบุสถานที่หรือชื่อลูกค้าก่อน", type: "error" });
            locationInputRef.current?.focus();
            return;
        }

        // If no plan today, show modal before camera
        if (!planSubmittedToday && !me?.is_checkin_exempt) {
            setPendingAction(action);
            setShowWorkPlan(true);
            return;
        }

        proceedToCamera(action);
    }

    async function proceedToCamera(action: 'update' | 'accommodation' | 'checkout') {
        setPendingAction(action);
        setStep('camera');
        setPhotoPreview(null);
        setIsCameraReady(false);
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            streamRef.current = s;
            if (videoRef.current) {
                videoRef.current.srcObject = s;
                videoRef.current.onloadedmetadata = () => setIsCameraReady(true);
            }
        } catch (e) {
            setAlert({ visible: true, message: "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง", type: "error" });
            setStep('log');
        }
    }

    async function handleWorkPlanSubmit(data: any) {
        try {
            const res = await fetch("/api/work-plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.ok) {
                setPlanSubmittedToday(true);
                setShowWorkPlan(false);
                proceedToCamera(pendingAction);
            } else {
                throw new Error(result.error || "Failed to submit plan");
            }
        } catch (e: any) {
            setAlert({ visible: true, message: "บันทึกแผนงานไม่สำเร็จ: " + e.message, type: "error" });
        }
    }

    function stopCamera() {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }

    function capturePhoto() {
        try {
            const v = videoRef.current;
            const c = canvasRef.current;
            if (!v || !c) return;
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(v, 0, 0);

            // Watermark — locationName appears as the location line
            const w = c.width;
            const h = c.height;
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillRect(0, h - 90, w, 90);

            ctx.fillStyle = "white";
            ctx.font = "bold 26px Sarabun";
            ctx.textAlign = "left";
            ctx.fillText(me?.name || "", 20, h - 55);

            ctx.font = "20px Sarabun";
            ctx.fillText(`📍 ${locationName}`, 20, h - 28);

            ctx.font = "16px Sarabun";
            ctx.fillText(`${getThaiDateStr()} ${getThaiTimeStr()} น.`, 20, h - 8);

            ctx.textAlign = "right";
            ctx.font = "14px Sarabun";
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillText("Smart Journey Tracking", w - 20, h - 8);

            setPhotoPreview(c.toDataURL("image/jpeg", 0.85));
            stopCamera();
        } catch (e) {
            setAlert({ visible: true, message: "เกิดข้อผิดพลาดในการถ่ายรูป", type: "error" });
        }
    }

    /* ── SUBMIT ── */
    async function handleUpdate() {
        if (!photoPreview) return;
        const isCheckout = pendingAction === 'checkout' || pendingAction === 'accommodation';
        setStep('submitting');
        try {
            const blob = await (await fetch(photoPreview)).blob();
            const fd = new FormData();
            fd.append("file", blob, "trip.jpg");
            const resUp = await fetch("/api/upload", { method: "POST", body: fd });
            const upData = await resUp.json();
            if (!resUp.ok) throw new Error(upData.error);

            const typeMap = {
                update: "Trip-Update",
                accommodation: "Check-out",
                checkout: "Check-out",
            };

            const resSave = await fetch("/api/checkins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: typeMap[pendingAction],
                    is_trip: true,
                    lat: gps?.lat,
                    lon: gps?.lon,
                    accuracy: gps?.acc,
                    photo_url: upData.url,
                    remark: locationName,
                    branch_name: locationName,
                    branch_id: me?.branch_id
                })
            });
            const saveData = await resSave.json();
            if (!resSave.ok) throw new Error(saveData.error || "บันทึกล้มเหลว");

            let successMsg = isCheckout
                ? "สิ้นสุดการเดินทางเรียบร้อยแล้ว"
                : "บันทึกพิกัดการเดินทางเรียบร้อยแล้ว";
            if (saveData.auto_ot) {
                successMsg += "\n(ระบบส่งคำขอ OT อัตโนมัติให้แล้ว)";
            }

            setAlert({ visible: true, message: successMsg, type: "ok" });
            setLocationName("");
            setPhotoPreview(null);
            setStep('log');
            await refreshHistory();
        } catch (e: any) {
            let msg = e.message || "เกิดข้อผิดพลาดในการบันทึก";
            if (msg === "WORK_PLAN_REQUIRED") msg = "กรุณาบันทึกแผนงานประจำวันก่อนทำรายการ";
            setAlert({ visible: true, message: msg, type: "error" });
            setStep('log');
        }
    }

    if (loading) return (
        <div className={styles.wrapper} style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={48} color="var(--red)" />
        </div>
    );

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>

                {/* ── HERO ── */}
                <header className={styles.hero}>
                    <h1 className={styles.heroH1}>เดินทางต่างจังหวัด</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <MapPin size={14} style={{ color: 'var(--red)' }} />
                            <span>{getThaiDateStr()}</span>
                        </div>
                        <div className={styles.heroMetaDot} />
                        <div className={styles.heroMetaItem}>
                            <span>LIVE TRACKING ACTIVE</span>
                        </div>
                    </div>
                </header>

                {/* ── LOG FORM ── */}
                {step === 'log' && (
                    <div className={styles.card}>
                        {/* GPS Status */}
                        <div className={styles.sectionLabel}>
                            <div className={styles.dot} style={{
                                background: gps
                                    ? (gps.acc < 50 ? 'var(--ok)' : '#f59e0b')
                                    : 'var(--red)'
                            }} />
                            <span>
                                {gps
                                    ? `GPS พร้อม · ±${Math.round(gps.acc)} ม.`
                                    : 'กำลังค้นหาสัญญาณ GPS...'}
                            </span>
                        </div>

                        {/* Location Input — required, single field */}
                        <div style={{ marginBottom: 14 }}>
                            <label className={styles.label}>
                                สถานที่ / ชื่อลูกค้า <span style={{ color: 'var(--red)' }}>*</span>
                            </label>
                            <input
                                ref={locationInputRef}
                                type="text"
                                className={styles.input}
                                placeholder="เช่น บ้านคุณสมศักดิ์ อ.วังน้อย, ไซต์งาน A อยุธยา..."
                                value={locationName}
                                onChange={(e) => setLocationName(e.target.value)}
                            />
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                                ข้อมูลนี้จะแสดงบน watermark รูปถ่ายและ timeline
                            </div>
                        </div>

                        {/* Quick Tags */}
                        <div style={{ marginBottom: 20 }}>
                            <label className={styles.label}>เลือกสถานะด่วน</label>
                            <div className={styles.quickTags}>
                                {QUICK_TAGS.map(t => (
                                    <button
                                        key={t}
                                        className={`${styles.tagBtn} ${locationName === t ? styles.tagBtnActive : ""}`}
                                        onClick={() => setLocationName(t)}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className={styles.mainBtnContainer}>
                            <button
                                className={styles.updateBtn}
                                onClick={() => gps && openCamera('update')}
                                disabled={!gps}
                                title="บันทึกพิกัด"
                            >
                                <Navigation size={32} />
                                <span className={styles.updateBtnText}>Update</span>
                            </button>

                            <button
                                className={`${styles.updateBtn} ${styles.accommodationBtn}`}
                                onClick={() => gps && openCamera('accommodation')}
                                disabled={!gps}
                                title="เช็คอินที่พัก"
                            >
                                <MapIcon size={32} />
                                <span className={styles.updateBtnText}>ที่พัก</span>
                            </button>

                            <button
                                className={`${styles.updateBtn} ${styles.checkoutBtn}`}
                                onClick={() => gps && openCamera('checkout')}
                                disabled={!gps}
                                title="สิ้นสุดการเดินทาง"
                            >
                                <CheckCircle size={32} />
                                <span className={styles.updateBtnText}>Check-out</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── HISTORY ── */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span>Timeline การเดินทางวันนี้</span>
                    </div>

                    {history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text4)' }}>
                            <History size={48} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                            <p style={{ fontSize: 14 }}>ยังไม่มีข้อมูลการเช็คอินในวันนี้</p>
                        </div>
                    ) : (
                        <div className={styles.timeline}>
                            {history.map((item) => (
                                <div key={item.id} className={styles.timelineItem}>
                                    <div className={styles.timelineDot} />
                                    <div className={styles.timelineContent}>
                                        <div className={styles.timelineHeader}>
                                            <div className={styles.timelineLocation}>{item.location}</div>
                                            <div className={styles.timelineTime}>{formatTime24h(item.timestamp)} น.</div>
                                        </div>
                                        {item.remark && (
                                            <div className={styles.timelineNote}>{item.remark}</div>
                                        )}
                                        {item.photo_url && (
                                            <div className={styles.timelinePhoto}>
                                                <Image
                                                    src={item.photo_url}
                                                    alt="Trip Stop"
                                                    width={500}
                                                    height={300}
                                                    style={{ width: '100%', height: 'auto' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── CAMERA OVERLAY ── */}
            {step === 'camera' && (
                <div className={styles.alertOverlay}>
                    <div className={styles.alertModal} style={{ position: 'relative', maxWidth: 440 }}>
                        <div className={styles.sectionLabel} style={{ marginBottom: 16 }}>
                            <div className={styles.dot} />
                            <span>
                                {pendingAction === 'checkout' && 'สิ้นสุดการเดินทาง'}
                                {pendingAction === 'accommodation' && 'เช็คอินที่พัก'}
                                {pendingAction === 'update' && 'บันทึกพิกัด'}
                            </span>
                        </div>

                        {/* Location preview badge */}
                        <div style={{
                            background: 'var(--red-dim)',
                            border: '1px solid var(--red-border)',
                            borderRadius: 10,
                            padding: '8px 12px',
                            marginBottom: 14,
                            fontSize: 13,
                            color: 'var(--red)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}>
                            <MapPin size={14} />
                            {locationName}
                        </div>

                        <div className={styles.camWrap}>
                            <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
                            {photoPreview && (
                                <Image src={photoPreview} fill style={{ objectFit: 'cover' }} alt="Preview" />
                            )}
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: '20px 24px',
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                                display: 'flex',
                                justifyContent: 'space-around',
                                alignItems: 'center',
                                zIndex: 100
                            }}>
                                {!photoPreview ? (
                                    <>
                                        <button
                                            onClick={() => { stopCamera(); setStep('log'); }}
                                            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer' }}
                                        >
                                            <ArrowLeft size={22} color="white" />
                                        </button>
                                        <button
                                            onClick={capturePhoto}
                                            disabled={!isCameraReady}
                                            style={{
                                                width: 68, height: 68, borderRadius: '50%',
                                                background: 'white', border: '5px solid rgba(255,255,255,0.35)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: isCameraReady ? 'pointer' : 'not-allowed',
                                                opacity: isCameraReady ? 1 : 0.5
                                            }}
                                        >
                                            <Camera size={30} color="var(--red)" />
                                        </button>
                                        <div style={{ width: 44 }} />
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => { setPhotoPreview(null); openCamera(pendingAction); }}
                                            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, padding: '8px 20px', color: 'white', cursor: 'pointer', fontSize: 14 }}
                                        >
                                            ถ่ายใหม่
                                        </button>
                                        <button
                                            onClick={handleUpdate}
                                            style={{ background: 'var(--red)', border: 'none', borderRadius: 20, padding: '8px 28px', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                                        >
                                            ✓ ยืนยัน
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SUBMITTING OVERLAY ── */}
            {step === 'submitting' && (
                <div className={styles.alertOverlay}>
                    <div className={styles.card} style={{ maxWidth: 300, textAlign: 'center', padding: '36px 20px' }}>
                        <Loader2 size={40} color="var(--red)" className="animate-spin" style={{ margin: '0 auto 16px' }} />
                        <h4 style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)' }}>กำลังบันทึกข้อมูล</h4>
                        <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
                            อัปโหลดพิกัดและรูปถ่าย<br />กรุณารอสักครู่...
                        </p>
                    </div>
                </div>
            )}

            <AlertModal
                alert={alert}
                onClose={() => setAlert({ ...alert, visible: false })}
            />

            <WorkPlanModal
                isOpen={showWorkPlan}
                onClose={() => {
                    setShowWorkPlan(false);
                    setStep('log'); // Reset to log if cancelled
                }}
                onSubmit={handleWorkPlanSubmit}
                employeeName={me?.name || ""}
            />

            <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
    );
}