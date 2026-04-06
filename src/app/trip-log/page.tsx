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
    RotateCcw,
    Map as MapIcon,
    AlertTriangle,
    Loader2,
    ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { formatTime24h } from "@/utils/time";

/* ──────────────────────────────────────────
   TYPES & UTILS
────────────────────────────────────────── */
interface Me { emp_id: string; name: string; branch_id: string | null; }
interface TripItem {
    id: string;
    timestamp: string;
    location: string;
    remark?: string;
    photo_url?: string;
    lat?: number;
    lon?: number;
}

const QUICK_TAGS = ["ถึงที่หมาย", "เริ่มเดินทาง", "แวะพัก/เติมน้ำมัน", "พบลูกค้า", "เริ่มงานไซต์", "เช็คอินโรงแรม"];

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

    // Form State
    const [locationName, setLocationName] = useState("");
    const [remark, setRemark] = useState("");
    const [gps, setGps] = useState<{ lat: number; lon: number; acc: number } | null>(null);

    // Flow: 'log' | 'camera' | 'submitting'
    const [step, setStep] = useState<'log' | 'camera' | 'submitting'>('log');
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Alert State
    const [alertData, setAlertData] = useState<{ type: 'success' | 'warning' | 'error', msg: string } | null>(null);

    // Initial Load
    useEffect(() => {
        (async () => {
            try {
                const rMe = await fetch("/api/me");
                if (!rMe.ok) { window.location.href = "/"; return; }
                const meData = await rMe.json();
                setMe(meData);

                await refreshHistory();

                // Start GPS
                if (navigator.geolocation) {
                    navigator.geolocation.watchPosition(
                        (p) => setGps({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
                        () => { },
                        { enableHighAccuracy: true }
                    );
                }
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
    async function startCamera() {
        if (!locationName.trim()) {
            setAlertData({ type: 'warning', msg: "กรุณาระบุสถานที่ก่อนถ่ายรูป" });
            return;
        }
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
            setAlertData({ type: 'error', msg: "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง" });
            setStep('log');
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

            // Watermark
            const w = c.width;
            const h = c.height;
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(0, h - 80, w, 80);
            ctx.fillStyle = "white";
            ctx.font = "bold 24px Sarabun";
            ctx.fillText(me?.name || "", 20, h - 45);
            ctx.font = "18px Sarabun";
            ctx.fillText(`${getThaiDateStr()} ${getThaiTimeStr()} น.`, 20, h - 20);
            ctx.textAlign = "right";
            ctx.fillText("Smart Journey Tracking", w - 20, h - 20);

            setPhotoPreview(c.toDataURL("image/jpeg", 0.85));
            stopCamera();
        } catch (e) {
            setAlertData({ type: 'error', msg: "เกิดข้อผิดพลาดในการถ่ายรูป" });
        }
    }

    /* ── ACTIONS ── */
    async function handleUpdate() {
        if (!photoPreview) return;
        setStep('submitting');
        try {
            const blob = await (await fetch(photoPreview)).blob();
            const fd = new FormData();
            fd.append("file", blob, "trip.jpg");
            const resUp = await fetch("/api/upload", { method: "POST", body: fd });
            const upData = await resUp.json();
            if (!resUp.ok) throw new Error(upData.error);

            const resSave = await fetch("/api/checkins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "Trip-Update",
                    is_trip: true,
                    lat: gps?.lat,
                    lon: gps?.lon,
                    accuracy: gps?.acc,
                    photo_url: upData.url,
                    remark: `${locationName}${remark ? ' | ' + remark : ''}`,
                    branch_name: locationName,
                    branch_id: me?.branch_id
                })
            });
            if (!resSave.ok) throw new Error("บันทึกล้มเหลว");

            setAlertData({ type: 'success', msg: "บันทึกพิกัดการเดินทางและแจ้งเตือนเรียบร้อยแล้ว" });
            setLocationName("");
            setRemark("");
            setPhotoPreview(null);
            setStep('log');
            await refreshHistory();
        } catch (e: any) {
            setAlertData({ type: 'error', msg: e.message || "เกิดข้อผิดพลาดในการบันทึก" });
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
                {/* ── HERO SECTION ── */}
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

                {/* ── UPDATE FORM ── */}
                {step === 'log' && (
                    <div className={styles.card}>
                        <div className={styles.sectionLabel}>
                            <div className={styles.dot} />
                            <span>อัปเดตสถานะการเดินทาง</span>
                        </div>

                        <div className={styles.mainBtnContainer}>
                            <button
                                className={styles.updateBtn}
                                onClick={gps ? startCamera : undefined}
                                disabled={!gps}
                                style={{ opacity: gps ? 1 : 0.6 }}
                            >
                                <Navigation size={42} />
                                <span className={styles.updateBtnText}>บันทึกพิกัด</span>
                            </button>
                        </div>

                        {/* GPS Info */}
                        <div style={{
                            background: gps ? 'var(--ok-bg)' : 'var(--red-dim)',
                            border: `1.5px solid ${gps ? 'var(--ok-bdr)' : 'var(--red-border)'}`,
                            borderRadius: 12,
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 20
                        }}>
                            <div style={{
                                width: 10, height: 10, borderRadius: '50%',
                                background: gps ? 'var(--ok)' : 'var(--red)',
                                boxShadow: gps ? '0 0 10px var(--ok)' : 'none'
                            }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: gps ? 'var(--ok)' : 'var(--red)' }}>
                                    {gps ? 'พิกัด GPS แม่นยำพร้อมใช้งาน' : 'กำลังค้นหาตำแหน่ง GPS...'}
                                </div>
                                {gps && <div style={{ fontSize: 11, color: 'var(--text3)' }}>ความแม่นยำ +/- {Math.round(gps.acc)} เมตร</div>}
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label className={styles.label}>ระบุสถานที่ หรือ ชื่อลูกค้า</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="เช่น บ้านลูกค้า A, ไซต์งาน B..."
                                value={locationName}
                                onChange={(e) => setLocationName(e.target.value)}
                            />
                        </div>

                        <div>
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
                            {history.map((item, i) => (
                                <div key={item.id} className={styles.timelineItem}>
                                    <div className={styles.timelineDot} />
                                    <div className={styles.timelineContent}>
                                        <div className={styles.timelineHeader}>
                                            <div className={styles.timelineLocation}>{item.location}</div>
                                            <div className={styles.timelineTime}>{formatTime24h(item.timestamp)} น.</div>
                                        </div>
                                        {item.remark && <div className={styles.timelineNote}>{item.remark}</div>}
                                        {item.photo_url && (
                                            <div className={styles.timelinePhoto}>
                                                <Image src={item.photo_url} alt="Trip Stop" width={500} height={300} style={{ width: '100%', height: 'auto' }} />
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
                        <div className={styles.sectionLabel} style={{ marginBottom: 20 }}>
                            <div className={styles.dot} />
                            <span>ถ่ายรูปเพื่อยืนยันพิกัด</span>
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
                                padding: '24px',
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                display: 'flex',
                                justifyContent: 'space-around',
                                alignItems: 'center',
                                zIndex: 100
                            }}>
                                {!photoPreview ? (
                                    <>
                                        <button onClick={() => { stopCamera(); setStep('log'); }} className={styles.btnSecondary} style={{ borderRadius: '50%', padding: '12px' }}>
                                            <ArrowLeft size={24} />
                                        </button>
                                        <button onClick={capturePhoto} disabled={!isCameraReady} style={{
                                            width: 68, height: 68, borderRadius: '50%',
                                            background: 'white', border: '6px solid rgba(255,255,255,0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Camera size={32} color="var(--red)" />
                                        </button>
                                        <div style={{ width: 44 }} />
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { setPhotoPreview(null); startCamera(); }} className={styles.btnSecondary} style={{ borderRadius: 20, padding: '8px 24px' }}>ถ่ายใหม่</button>
                                        <button onClick={handleUpdate} className={`${styles.btn} ${styles.btnPrimary}`} style={{ borderRadius: 20, padding: '8px 28px' }}>ใช้รูปนี้</button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div style={{ textAlign: 'left', marginTop: 12 }}>
                            <label className={styles.label}>บันทึกเพิ่มเติม</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                                value={remark}
                                onChange={(e) => setRemark(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── SUBMITTING OVERLAY ── */}
            {step === 'submitting' && (
                <div className={styles.alertOverlay}>
                    <div className={styles.alertModal} style={{ maxWidth: 300 }}>
                        <Loader2 className="animate-spin" size={48} color="var(--red)" style={{ margin: '0 auto 16px' }} />
                        <h4 style={{ fontSize: 18, fontWeight: 700 }}>กำลังอัปเดต...</h4>
                        <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 8 }}>ระบบกำลังส่งข้อมูลไปยังกลุ่ม LINE เพื่อแจ้งเตือนหัวหน้างาน</p>
                    </div>
                </div>
            )}

            {/* ── LED ALERT MODAL ── */}
            {alertData && (
                <div className={styles.alertOverlay} onClick={() => setAlertData(null)}>
                    <div className={`${styles.alertModal} ${styles.ledModal} ${alertData.type === 'success' ? styles.ledModalSuccess : ''}`} onClick={e => e.stopPropagation()}>
                        <div className={styles.ledTitle}>
                            {alertData.type === 'success' ? 'SYSTEM OK' : alertData.type === 'warning' ? 'SYSTEM WARNING' : 'SYSTEM ERROR'}
                        </div>
                        <p className={styles.ledMsg}>{alertData.msg}</p>
                        <button 
                            className={styles.btnPrimary} 
                            style={{ 
                                background: alertData.type === 'success' ? 'var(--ok)' : 'var(--red)',
                                borderColor: 'transparent',
                                borderRadius: 30,
                                padding: '10px 40px',
                                textTransform: 'uppercase',
                                fontSize: 12,
                                letterSpacing: 1
                            }}
                            onClick={() => setAlertData(null)}
                        >
                            Acknowledge
                        </button>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
    );
}
