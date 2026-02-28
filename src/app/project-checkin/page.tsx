"use client";

import Image from "next/image";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

/* ──────────────────────────────────────────
   CONFIG 
────────────────────────────────────────── */
const WORK_START_H = 8, WORK_START_M = 0;
const WORK_END_H = 17, WORK_END_M = 0;
const OT_THRESHOLD_MIN = 30;

/* ──────────────────────────────────────────
   TYPES
────────────────────────────────────────── */
interface Me { emp_id: string; name: string; branch_id: string | null; }
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
interface AlertState { visible: boolean; message: string; type: "error" | "ok" }
interface GpsState { ok: boolean; lat: number | null; lon: number | null; accuracy: number | null; distance: number | null; pass: boolean; reason: string }

/* ──────────────────────────────────────────
   UTILS
────────────────────────────────────────── */
function pad(n: number) { return String(n).padStart(2, "0") }
function formatLocalTimeOnly(ts: string) {
    try {
        return new Date(ts).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
    } catch { return ts; }
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
function AlertModal({ alert, onClose }: { alert: AlertState; onClose: () => void }) {
    if (!alert.visible) return null;
    const isErr = alert.type === "error";
    return (
        <div className={styles.alertOverlay} onClick={onClose} role="dialog" aria-modal="true" style={{ zIndex: 9999 }}>
            <div className={styles.alertModal} onClick={e => e.stopPropagation()}>
                <div className={`${styles.alertIcon} ${isErr ? styles.alertIconErr : styles.alertIconOk}`}>
                    {isErr ? "⚠" : "✓"}
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
            setTimeStr(now.toLocaleTimeString("th-TH", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
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
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "error" });
    const closeAlert = useCallback(() => setAlert(p => ({ ...p, visible: false })), []);

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

    useEffect(() => {
        (async () => {
            const r = await fetch("/api/me");
            if (!r.ok) return (window.location.href = "/");
            setMe(await r.json());

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
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            streamRef.current = s;
            if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
            setFacingMode(facing);
            setCameraReady(true);
        } catch {
            showAlert("ไม่สามารถเปิดกล้องได้");
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
        const w = v.videoWidth || 1280, h = v.videoHeight || 720;
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return null;

        if (useRaw) {
            ctx.drawImage(raw, 0, 0);
        } else {
            // First time: store raw
            raw.width = w; raw.height = h;
            raw.getContext("2d")?.drawImage(v, 0, 0);
            ctx.drawImage(v, 0, 0, w, h);
        }

        const dStr = getThaiTime().toLocaleDateString("th-TH");
        const tStr = getThaiTime().toLocaleTimeString("th-TH") + " น.";

        const bH = Math.round(h * 0.22), bY = h - bH;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(0, bY, w, bH);

        ctx.fillStyle = currentType === "Project-In" ? "#4ade80" : "#fb923c";
        ctx.fillRect(0, bY, w, 4);

        ctx.textAlign = "left";
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.round(22 * w / 1280)}px Arial`;
        ctx.fillText(me?.name || "—", 30, bY + 35);

        ctx.fillStyle = "#aaa";
        ctx.font = `${Math.round(18 * w / 1280)}px Arial`;
        ctx.fillText(`Cus: ${selectedCustomer?.name || "—"}`, 30, bY + 65);

        ctx.font = `${Math.round(14 * w / 1280)}px Arial`;
        ctx.fillText(`GPS: ${gps.lat?.toFixed(5)}, ${gps.lon?.toFixed(5)} (±${Math.round(gps.accuracy || 0)}m)`, 30, bY + 95);

        ctx.textAlign = "right";
        ctx.font = `bold ${Math.round(22 * w / 1280)}px Arial`;
        ctx.fillText(`${dStr} ${tStr}`, w - 30, bY + 35);
        ctx.fillStyle = currentType === "Project-In" ? "#4ade80" : "#fb923c";
        ctx.fillText(currentType === "Project-In" ? "▶ IN" : "■ OUT", w - 30, bY + 65);

        const dataUrl = c.toDataURL("image/jpeg", 0.88);
        // stopCamera(); // Don't stop camera here, only after submit
        return dataUrl;
    }

    /* ── SUBMIT ── */
    async function doSubmitCheckin(targetType: "Project-In" | "Project-Out") {
        if (!preview || !selectedCustomer || !me) return showAlert("กรุณาถ่ายรูปก่อนบันทึก");

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
                    branch_id: me.branch_id || branches[0]?.id || "UNKNOWN",
                    lat: gps.lat, lon: gps.lon, accuracy: gps.accuracy,
                    photo_url: upData.url,
                    emp_id: me.emp_id, name: me.name,
                    project_name: selectedCustomer.name,
                    customer_id: selectedCustomer.id,
                    remark
                }),
            });
            const dbData = await r.json();
            if (!r.ok) throw new Error(dbData.error || "DB_ERROR");

            showAlert("บันทึกสำเร็จ", "ok");

            // Reset for next
            setSelectedCustomer(null);
            setPreview(null);
            setRemark("");
            refreshToday();
            stopCamera(); // Stop camera after successful submission

        } catch (e: any) {
            showAlert(e.message || "เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSubmitting(false);
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
                        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>


                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                ถ่ายรูปยืนยันตัวตน
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
                                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "black", minHeight: 240 }}>
                                    <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block" }} onLoadedMetadata={() => setCameraReady(true)} />
                                    <canvas ref={canvasRef} style={{ display: "none" }} />
                                    <canvas ref={rawCanvasRef} style={{ display: "none" }} />
                                    {!preview && (
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
                                            📸 ถ่ายรูป
                                        </button>
                                    )}
                                </div>

                                {preview && (
                                    <div style={{ position: "relative", width: "100%", background: "black", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                                        <img src={preview} alt="preview" style={{ width: "100%", display: "block" }} />
                                        <button
                                            style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 12, cursor: "pointer", zIndex: 10 }}
                                            onClick={() => setPreview(null)}
                                        >
                                            ↺ ถ่ายใหม่
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                                <button
                                    style={{ background: "#22c55e", color: "white", fontWeight: 700, fontSize: 18, border: "none", borderRadius: 12, padding: "18px", cursor: preview ? "pointer" : "not-allowed", opacity: preview && !isSubmitting ? 1 : 0.6 }}
                                    onClick={() => doSubmitCheckin("Project-In")}
                                    disabled={!preview || isSubmitting}
                                >
                                    {isSubmitting ? "..." : "บันทึกเข้า (IN)"}
                                </button>
                                <button
                                    style={{ background: "white", color: "#ef4444", fontWeight: 700, fontSize: 18, border: "2px solid #ef4444", borderRadius: 12, padding: "18px", cursor: preview ? "pointer" : "not-allowed", opacity: preview && !isSubmitting ? 1 : 0.6 }}
                                    onClick={() => doSubmitCheckin("Project-Out")}
                                    disabled={!preview || isSubmitting}
                                >
                                    {isSubmitting ? "..." : "บันทึกออก (OUT)"}
                                </button>
                            </div>

                            <div style={{ padding: "12px", background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#6b7280", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                {gps.lat ? `${gps.lat.toFixed(4)}, ${gps.lon?.toFixed(4)}` : "กำลังหาพิกัด..."}
                            </div>
                        </div>

                        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                                บันทึกเพิ่มเติม (ไม่บังคับ)
                            </div>
                            <textarea
                                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px", background: "#f9fafb", outline: "none", fontSize: 14, resize: "vertical", minHeight: 80 }}
                                placeholder="รายละเอียดการเข้าพบ..."
                                value={remark}
                                onChange={e => setRemark(e.target.value)}
                            />
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
                                return (
                                    <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #e5e7eb", padding: "14px", borderRadius: 10 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>{i + 1}. ลูกค้า: {x.project_name || "—"}</div>
                                            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                                                {formatLocalTimeOnly(x.timestamp)}
                                                {x.distance !== null ? ` · ห่าง ${x.distance} ม.` : ""}
                                                <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, fontSize: 11, background: !isIn ? "#fee2e2" : "#dcfce7", color: !isIn ? "#ef4444" : "#16a34a", fontWeight: 700 }}>
                                                    {isIn ? "IN" : "OUT"}
                                                </span>
                                            </div>
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
                                <span style={{ color: "#ef4444", fontSize: 18, marginTop: -2 }}>📍</span>
                                <span>พิกัด GPS จะใช้ตำแหน่งปัจจุบันของคุณ · สถานะ: ลูกค้าใหม่ · รหัสจะถูก<br />สร้างอัตโนมัติ</span>
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
