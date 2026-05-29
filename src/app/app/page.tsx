"use client";

import Image from "next/image";
import Script from "next/script";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { 
    CheckCircleIcon, 
    XCircleIcon, 
    ClockIcon, 
    FireIcon, 
    ArrowRightStartOnRectangleIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
    CakeIcon,
    ArrowPathIcon,
    MapPinIcon,
    CameraIcon,
    PhotoIcon,
    QrCodeIcon,
    CheckIcon,
    ChevronRightIcon
} from "@heroicons/react/24/solid";
import { ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { Camera, RotateCcw, X, Loader2 as LucideLoader } from "lucide-react";
import { formatDateThai, formatTime24h, formatTimeFull24h, getBangkokWallClock } from "@/utils/time";
import WorkPlanModal from "@/components/WorkPlanModal";

/* ──────────────────────────────────────────
   CONFIG — เวลาเริ่ม/เลิกงาน (24h)
────────────────────────────────────────── */
const WORK_START_H = 8, WORK_START_M = 0;
const WORK_END_H = 17, WORK_END_M = 0;
const OT_THRESHOLD_MIN = 30;

/* ──────────────────────────────────────────
   TYPES
────────────────────────────────────────── */
interface Me { 
    emp_id: string; 
    name: string; 
    branch_id: string | null; 
    line_user_id?: string | null; 
    is_supervisor?: boolean;
    is_checkin_exempt?: boolean;
}
interface Branch { id: string; name: string; centerLat?: number; centerLon?: number; radiusM?: number }
interface TodayItem {
    id: number | string;
    type: "Check-in" | "Check-out" | "Project-In" | "Project-Out" | "Offsite-In" | "Offsite-Out";
    timestamp: string;
    branch_name: string;
    distance?: number | null;
    photo_url?: string | null;
    project_name?: string | null;
    remark?: string | null;
    lateStatus?: "ontime" | "late" | "early" | "ot";
    lateLabel?: string;
}
interface AlertState { visible: boolean; message: string; type: "error" | "ok" }
interface GpsState { ok: boolean; lat: number | null; lon: number | null; accuracy: number | null; distance: number | null; pass: boolean; reason: string }
interface LateInfo { status: "ontime" | "late" | "early" | "ot"; label: string; detail: string }

/* ──────────────────────────────────────────
   UTILS
────────────────────────────────────────── */
function pad(n: number) { return String(n).padStart(2, "0") }

function formatLocal(ts: string) {
    try { 
        const d = new Date(ts);
        return `${d.toLocaleDateString("th-TH")} ${formatTime24h(d)}`;
    } catch { return ts; }
}


function getThaiTime() {
    return getBangkokWallClock();
}

function calcLateOT(type: "Check-in" | "Check-out"): LateInfo {
    const now = getThaiTime();
    const h = now.getHours(), m = now.getMinutes();
    const totalMin = h * 60 + m;
    if (type === "Check-in") {
        const startMin = WORK_START_H * 60 + WORK_START_M;
        const diff = totalMin - startMin;
        if (diff <= 5) return { status: "ontime", label: "ตรงเวลา", detail: diff <= 0 ? "เช็คอินก่อนเวลา" : `ภายใน ${diff} นาที` };
        return { status: "late", label: `สาย ${diff} นาที`, detail: `กำหนด ${pad(WORK_START_H)}:${pad(WORK_START_M)} — เช็คอิน ${pad(h)}:${pad(m)}` };
    } else {
        const endMin = WORK_END_H * 60 + WORK_END_M;
        const diff = totalMin - endMin;
        if (diff >= OT_THRESHOLD_MIN) return { status: "ot", label: `OT ${diff} นาที`, detail: `เลิกงาน ${pad(WORK_END_H)}:${pad(WORK_END_M)} — ออก ${pad(h)}:${pad(m)}` };
        return {
            status: diff < 0 ? "early" : "ontime",
            label: diff < 0 ? `ออกก่อนเวลา ${Math.abs(diff)} นาที` : "ออกงานตรงเวลา",
            detail: diff < 0 ? `ออกก่อนเวลา ${Math.abs(diff)} นาที` : `ออกงาน ${pad(h)}:${pad(m)}`
        };
    }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000, toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ──────────────────────────────────────────
   STEP INDICATOR
────────────────────────────────────────── */
function StepIndicator({ step }: { step: number }) {
    const steps = [
        { n: 1, label: "ข้อมูล" },
        { n: 2, label: "GPS" },
        { n: 3, label: "รูปภาพ" },
        { n: 4, label: "บันทึก" },
    ];
    return (
        <div className={styles.steps}>
            {steps.map((s, i) => (
                <div key={s.n} className={styles.stepGroup}>
                    <div className={`${styles.stepItem} ${step > s.n ? styles.stepDone : step === s.n ? styles.stepActive : ""}`}>
                        <div className={styles.stepCircle}>{step > s.n ? <CheckIcon width={16} /> : s.n}</div>
                        <div className={styles.stepLabel}>{s.label}</div>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`${styles.stepLine} ${step > s.n ? styles.stepLineDone : ""}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

/* ──────────────────────────────────────────
   ALERT MODAL
────────────────────────────────────────── */
function AlertModal({ alert, onClose }: { alert: AlertState; onClose: () => void }) {
    const isErr = alert.type === "error";

    useEffect(() => {
        if (!alert.visible) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [alert.visible, onClose]);

    if (!alert.visible) return null;

    return (
        <div className={styles.alertOverlay} onClick={onClose} role="dialog" aria-modal="true">
            <div className={styles.alertModal} onClick={e => e.stopPropagation()}>
                <div className={`${styles.alertIcon} ${isErr ? styles.alertIconErr : styles.alertIconOk}`}>
                    {isErr ? <ExclamationTriangleIcon width={32} /> : <CheckCircleIcon width={32} />}
                </div>
                <div className={`${styles.alertTitle} ${isErr ? styles.alertTitleErr : styles.alertTitleOk}`}>
                    {isErr ? "เกิดข้อผิดพลาด" : "สำเร็จ"}
                </div>
                <div className={styles.alertMsg}>{alert.message}</div>
                <button
                    className={`${styles.alertBtn} ${isErr ? styles.alertBtnErr : styles.alertBtnOk}`}
                    onClick={onClose}
                    autoFocus
                >
                    ตกลง
                </button>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────
   TIME CARD (Live Clock)
────────────────────────────────────────── */
function TimeCard({ lateInfo }: { lateInfo?: LateInfo | null }) {
    const [timeStr, setTimeStr] = useState("");
    const [dateStr, setDateStr] = useState("");

    useEffect(() => {
        function update() {
            const now = getThaiTime();
            setTimeStr(formatTimeFull24h(now));
            setDateStr(formatDateThai(now));
        }
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, []);

    if (!timeStr) return <div className={styles.card} style={{ height: 160 }} />;

    return (
        <div className={styles.card} style={{ textAlign: "center", padding: "28px 20px" }}>
            <div style={{ color: "var(--text3)", fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <ClockIcon width={16} />
                วัน{dateStr}
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text)", letterSpacing: "2px", lineHeight: 1 }}>
                {timeStr}
            </div>
            <div style={{ fontSize: 13, color: "var(--text4)", marginTop: 12 }}>
                เขตเวลา: Asia/Bangkok (GMT+7)
            </div>
            {lateInfo && (
                <div style={{ marginTop: 20 }}>
                    <LateBadge info={lateInfo} />
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────────────────────
   LATE BADGE
────────────────────────────────────────── */
function LateBadge({ info }: { info: LateInfo }) {
    const cls = info.status === "late" ? styles.badgeLate : info.status === "ot" ? styles.badgeOt : styles.badgeOntime;
    const Icon = info.status === "late" ? ClockIcon : info.status === "ot" ? FireIcon : info.status === "early" ? ArrowRightStartOnRectangleIcon : CheckCircleIcon;
    return (
        <div className={`${styles.timeBadge} ${cls}`}>
            <Icon width={16} style={{ marginRight: 6 }} />
            <span>{info.label}</span>
            <span className={styles.timeBadgeDetail}>{info.detail}</span>
        </div>
    );
}

/* ──────────────────────────────────────────
   HISTORY CARD
────────────────────────────────────────── */
function HistoryCard({ today, todayKey }: { today: TodayItem[]; todayKey: string }) {
    // The 'today' array is sorted latest first (DESC).
    // Earliest IN = last item in array that is an IN
    const inItem = [...today].reverse().find(x => x.type === "Check-in");
    // Latest OUT = first item in array that is an OUT
    const outItem = today.find(x => x.type === "Check-out");

    let workHours = "—";
    if (inItem && outItem) {
        const inDate = new Date(inItem.timestamp);
        const outDate = new Date(outItem.timestamp);
        const diffMin = Math.floor((outDate.getTime() - inDate.getTime()) / 60000);
        if (diffMin > 0) workHours = `${Math.floor(diffMin / 60)}:${pad(diffMin % 60)}`;
    }

    return (
        <div className={`${styles.card} ${styles.historyCard}`}>
            <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>ประวัติวันนี้</h3>
                <span className={styles.cardBadge}>{todayKey || "—"}</span>
            </div>

            {inItem && outItem && (
                <div className={styles.workSummary}>
                    <div className={styles.workStat}>
                        <div className={styles.wsVal}>{formatTime24h(inItem.timestamp)}</div>
                        <div className={styles.wsLabel}>เวลาเข้า</div>
                    </div>
                    <div className={styles.workStat}>
                        <div className={styles.wsVal}>{formatTime24h(outItem.timestamp)}</div>
                        <div className={styles.wsLabel}>เวลาออก</div>
                    </div>
                    <div className={styles.workStat}>
                        <div className={styles.wsVal}>{workHours}</div>
                        <div className={styles.wsLabel}>ชั่วโมง</div>
                    </div>
                </div>
            )}

            {today.length === 0 ? (
                <div className={styles.historyEmpty}>ยังไม่มีการเช็คอิน/เอาท์วันนี้</div>
            ) : (
                <div className={styles.historyList}>
                    {today.map(x => {
                        const isIn = x.type.toLowerCase().includes("in");
                        const tagCls = x.lateStatus === "late" ? styles.tagLate : x.lateStatus === "ot" ? styles.tagOt : styles.tagOntime;
                        return (
                            <div key={String(x.id)} className={styles.historyItem}>
                                <div className={`${styles.historyIcon} ${isIn ? styles.historyIconIn : styles.historyIconOut}`}>
                                    {isIn ? <ArrowRightStartOnRectangleIcon width={14} /> : <CheckCircleIcon width={14} />}
                                </div>
                                <div className={styles.historyInfo}>
                                    <div className={styles.historyType}>{isIn ? "เช็คอิน" : "เช็คเอาท์"}</div>
                                    <div className={styles.historyMeta}>
                                        {formatLocal(x.timestamp)} · {x.branch_name}
                                        {typeof x.distance === "number" ? ` · ${Math.round(x.distance)}m` : ""}
                                    </div>
                                    {(x.project_name || x.remark) && (
                                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, padding: "4px 8px", background: "var(--surface-3)", borderRadius: 4 }}>
                                            {x.project_name && <div><b>ลูกค้า/โปรเจกต์:</b> {x.project_name}</div>}
                                            {x.remark && <div><b>หมายเหตุ:</b> {x.remark}</div>}
                                        </div>
                                    )}
                                </div>
                                {x.lateLabel && (
                                    <span className={`${styles.historyTag} ${tagCls}`}>{x.lateLabel}</span>
                                )}
                                {x.photo_url && (
                                    <Image 
                                        src={x.photo_url} 
                                        alt="photo" 
                                        width={300} 
                                        height={225} 
                                        className={styles.photoThumb} 
                                        loading="lazy"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────────────────────
   MAIN PAGE
────────────────────────────────────────── */
export default function AppPage() {
    const [me, setMe] = useState<Me | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState("");
    const [type, setType] = useState<"Check-in" | "Check-out">("Check-in");
    const [today, setToday] = useState<TodayItem[]>([]);
    const [todayKey, setTodayKey] = useState("");
    const [step, setStep] = useState(1);
    const [statusMsg, setStatusMsg] = useState<React.ReactNode>(<span><ArrowPathIcon width={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />กำลังโหลด...</span>);
    const [statusType, setStatusType] = useState<"ok" | "bad" | "warn">("warn");

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "error" });
    const closeAlert = useCallback(() => setAlert(p => ({ ...p, visible: false })), []);
    const [lateInfo, setLateInfo] = useState<LateInfo | null>(null);

    const [gps, setGps] = useState<GpsState>({ ok: false, lat: null, lon: null, accuracy: null, distance: null, pass: false, reason: "" });
    const [gpsLoading, setGpsLoading] = useState(false);

    const [cameraReady, setCameraReady] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [preview, setPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showQR, setShowQR] = useState(false);
    const [empId, setEmpId] = useState("");
    const [empName, setEmpName] = useState("");
    const [warnings, setWarnings] = useState<{ id: number; date: string; reason: string }[]>([]);
    const [birthdays, setBirthdays] = useState<{ emp_id: string; name: string }[]>([]);

    const [showWorkPlan, setShowWorkPlan] = useState(false);
    const [planSubmittedToday, setPlanSubmittedToday] = useState(false);
    const [isPlanLoading, setIsPlanLoading] = useState(true);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rawCanvasRef = useRef<HTMLCanvasElement>(null);
    const qrVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const qrStreamRef = useRef<MediaStream | null>(null);

    const hasIn = useMemo(() => today.some(x => x.type === "Check-in"), [today]);
    const hasOut = useMemo(() => today.some(x => x.type === "Check-out"), [today]);
    const selectedBranchObj = useMemo(() => branches.find(b => b.id === selectedBranch), [branches, selectedBranch]);

    useEffect(() => {
        if (!isPlanLoading && !planSubmittedToday && me && !me.is_checkin_exempt && !hasIn) {
            setShowWorkPlan(true);
        }
    }, [isPlanLoading, planSubmittedToday, me, hasIn]);

    /* ── Alert ── */
    function showAlert(message: string, type: "error" | "ok" = "error") {
        setAlert({ visible: true, message, type });
    }

    /* ── Status ── */
    function setStatus(msg: React.ReactNode, t: "ok" | "bad" | "warn") { setStatusMsg(msg); setStatusType(t); }

    /* ── Late badge update ── */
    useEffect(() => {
        setLateInfo(calcLateOT(type));
        const id = setInterval(() => setLateInfo(calcLateOT(type)), 30000);
        return () => clearInterval(id);
    }, [type]);

    /* ── Init ── */
    useEffect(() => {
        (async () => {
            try {
                // Fetch basic 'me' first to verify auth
                const meRes = await fetch("/api/me");
                if (!meRes.ok) {
                    window.location.href = "/";
                    return;
                }
                const meData: Me = await meRes.json();
                setMe(meData);
                setEmpId(meData.emp_id);
                setEmpName(meData.name);
                if (meData.branch_id) setSelectedBranch(meData.branch_id);

                // Now fetch everything else in parallel
                const [branchesRes, checkinsRes, warningsRes, birthdaysRes] = await Promise.all([
                    fetch("/api/branches"),
                    fetch("/api/checkins", { cache: "no-store" }),
                    fetch("/api/warnings", { cache: "no-store" }),
                    fetch("/api/birthdays", { cache: "no-store" })
                ]);

                // Parse all results
                const [branchesData, checkinsData, warningsData, birthdaysData] = await Promise.all([
                    branchesRes.json(),
                    checkinsRes.json().catch(() => ({})),
                    warningsRes.json().catch(() => ({})),
                    birthdaysRes.json().catch(() => ({}))
                ]);

                // Update state
                if (branchesData.branches) setBranches(branchesData.branches);
                if (checkinsData.list) setToday(checkinsData.list);
                if (checkinsData.dateKey) setTodayKey(checkinsData.dateKey);
                if (warningsData.ok && warningsData.warnings) setWarnings(warningsData.warnings);
                if (birthdaysData.ok && birthdaysData.list) setBirthdays(birthdaysData.list);
                
                // Check if work plan is already submitted today
                const planRes = await fetch("/api/work-plans", { cache: "no-store" });
                const planData = await planRes.json();
                if (planData.ok && planData.plan) {
                    setPlanSubmittedToday(true);
                }
                setIsPlanLoading(false);

                setStatus(<span><CheckCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />พร้อมใช้งาน</span>, "ok");
            } catch (error) {
                console.error("Initialization failed:", error);
                setIsPlanLoading(false);
                setStatus(<span><ExclamationTriangleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />เกิดข้อผิดพลาดในการโหลด</span>, "bad");
            }
        })();
    }, []);

    async function fetchBirthdays() {
        try {
            const r = await fetch("/api/birthdays", { cache: "no-store" });
            const data = await r.json();
            if (data.ok) setBirthdays(data.list || []);
        } catch (e) {
            console.error("Fetch birthdays failed:", e);
        }
    }

    /* ── Refresh today ── */
    async function refreshToday() {
        const r = await fetch("/api/checkins", { cache: "no-store" });
        const data = await r.json().catch(() => ({}));
        setToday(data.list || []);
        setTodayKey(data.dateKey || "");
    }

    async function fetchWarnings() {
        try {
            const r = await fetch("/api/warnings", { cache: "no-store" });
            const data = await r.json();
            if (data.ok) setWarnings(data.warnings || []);
        } catch (e) {
            console.error("Fetch warnings failed:", e);
        }
    }


    /* ── GPS ── */
    async function readGPS() {
        setGpsLoading(true);
        setStatus(<span><ArrowPathIcon width={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />Waiting for GPS verification</span>, "warn");
        const branch = selectedBranchObj;

        return new Promise<GpsState>((resolve) => {
            if (!navigator.geolocation) {
                const state = { ok: false, lat: null, lon: null, accuracy: null, distance: null, pass: false, reason: "อุปกรณ์ไม่รองรับ GPS" };
                setGps(state); setGpsLoading(false); setStatus(<span><XCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />ไม่รองรับ GPS</span>, "bad"); resolve(state); return;
            }
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const { latitude: lat, longitude: lon, accuracy: acc } = pos.coords;
                    let dist: number | null = null;
                    let pass = true, reason = "ผ่าน";
                    if (branch?.centerLat && branch?.centerLon) {
                        dist = haversineMeters(lat, lon, branch.centerLat, branch.centerLon);
                        if (acc > (branch.radiusM || 200)) { pass = false; reason = `ความแม่นยำต่ำ (±${Math.round(acc)}m)`; }
                        else if (dist > (branch.radiusM || 200)) { pass = false; reason = `อยู่นอกพื้นที่ (~${Math.round(dist)}m)`; }
                    }
                    const state = { ok: true, lat, lon, accuracy: acc, distance: dist, pass, reason };
                    setGps(state);
                    setGpsLoading(false);
                    setStatus(
                        pass ? 
                        <span><CheckCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />GPS ผ่าน — ไปขั้นตอนถ่ายรูปได้</span> : 
                        <span><XCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />GPS ไม่ผ่าน — {reason}</span>, 
                        pass ? "ok" : "bad"
                    );
                    resolve(state);
                },
                err => {
                    const state = { ok: false, lat: null, lon: null, accuracy: null, distance: null, pass: false, reason: err.message };
                    if (window.location.hostname === "localhost") {
                        state.pass = true;
                        state.reason = "Bypass Localhost";
                        state.ok = true;
                    }
                    setGps(state); setGpsLoading(false);
                    setStatus(state.pass ? <span><CheckCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />ข้าม GPS (Localhost)</span> : <span><XCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />อ่าน GPS ไม่ได้ — กรุณาอนุญาต Location</span>, state.pass ? "ok" : "bad");
                    resolve(state);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }

    /* ── Camera ── */
    async function startCamera(facing: "user" | "environment" = facingMode) {
        stopCamera();
        setPreview(null);
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: facing, 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 },
                    // 📱 Add aspect ratio constraint to help mobile orientation
                    aspectRatio: { ideal: 1.7777777778 } 
                },
                audio: false,
            });
            streamRef.current = s;
            if (videoRef.current) { 
                videoRef.current.srcObject = s; 
                await videoRef.current.play(); 
            }
            setFacingMode(facing);
            setCameraReady(true);
            setStatus(<span><CheckCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />กล้อง{facing === "environment" ? "หลัง" : "หน้า"}พร้อม — กด ถ่ายรูป</span>, "ok");
        } catch {
            setStatus(<span><XCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />เปิดกล้องไม่ได้ — กรุณาอนุญาตกล้อง</span>, "bad");
        }
    }

    function stopCamera() {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraReady(false);
    }

    /* ── Capture + Watermark ── */
    function capturePhoto(overrideType?: "Check-in" | "Check-out", useRaw = false): string | null {
        const v = videoRef.current, c = canvasRef.current, raw = rawCanvasRef.current;
        if (!v || !c || !raw) return null;
        const currentType = overrideType || type;
        const w = v.videoWidth || 1280, h = v.videoHeight || 720;
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return null;

        if (useRaw) {
            ctx.drawImage(raw, 0, 0);
        } else {
            ctx.drawImage(v, 0, 0, w, h);
        }

        const branchName = branches.find(b => b.id === selectedBranch)?.name ?? "—";
        const now = new Date();
        const dateStr = now.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Bangkok" });
        const timeStr = formatTimeFull24h(now);
        const lateInfoNow = calcLateOT(currentType);
        const gpsStr = gps.lat ? `${gps.lat.toFixed(5)}, ${gps.lon!.toFixed(5)}` : "—";

        // 📱 Orientation-Aware Scaling
        const isPortrait = h > w;
        const baseDim = Math.min(w, h);
        const sc = baseDim / 720; // Scale relative to 720p short-side
        
        const bH = Math.round(baseDim * 0.21); // Bottom bar height
        const bY = h - bH;

        // Gradient Background
        const grad = ctx.createLinearGradient(0, bY - 20, 0, h);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.2, "rgba(0,0,0,0.85)");
        grad.addColorStop(1, "rgba(5,5,5,0.98)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, bY - Math.round(h * 0.04), w, bH + Math.round(h * 0.04));

        // Accenting Red Line
        ctx.fillStyle = "#d93025";
        ctx.fillRect(0, bY, w, Math.max(2, Math.round(h * 0.005)));

        const f1 = Math.round(24 * sc), f2 = Math.round(18 * sc), f3 = Math.round(13 * sc);
        const lPad = Math.round(w * 0.035);
        const itemGap = Math.round(bH * 0.22);
        const yStart = bY + Math.round(bH * 0.28);

        // Left Side Content
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${f1}px 'Segoe UI',Arial,Tahoma`;
        ctx.fillText(empName || me?.name || "—", lPad, yStart);

        ctx.fillStyle = "#e0e0e0";
        ctx.font = `500 ${f2}px 'Segoe UI',Arial,Tahoma`;
        ctx.fillText(`ID: ${empId || me?.emp_id || "—"}  |  ${branchName}`, lPad, yStart + itemGap);

        const lateColor = lateInfoNow.status === "late" ? "#fb923c" : lateInfoNow.status === "ot" ? "#a78bfa" : "#4ade80";
        ctx.fillStyle = lateColor;
        ctx.font = `700 ${f3}px 'Segoe UI',Arial,Tahoma`;
        ctx.fillText(lateInfoNow.label, lPad, yStart + itemGap * 2);

        ctx.fillStyle = "#888888";
        ctx.font = `400 ${f3}px 'Courier New',monospace`;
        ctx.fillText(`GPS: ${gpsStr}  ±${Math.round(gps.accuracy ?? 0)}m`, lPad, yStart + itemGap * 3);

        // Right Side Content
        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${f1}px 'Courier New',monospace`;
        ctx.fillText(`${dateStr}  ${timeStr}`, w - lPad, yStart);

        const isIn = currentType.toLowerCase().includes("in");
        const typeColor = isIn ? "#4ade80" : "#fb923c";
        ctx.fillStyle = typeColor;
        ctx.font = `800 ${f2}px 'Segoe UI',Arial,Tahoma`;
        ctx.fillText(currentType.toUpperCase().replace("-", " "), w - lPad, yStart + itemGap);

        // System Label
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(217,48,37,0.85)";
        ctx.font = `600 ${Math.round(12 * sc)}px 'Segoe UI',Arial`;
        ctx.fillText("TERA GROUP · HR ATTENDANCE", lPad, bY - Math.round(h * 0.012));

        const dataUrl = c.toDataURL("image/jpeg", 0.9);
        setPreview(dataUrl);
        return dataUrl;
    }

    /* ── Start Flow ── */
    async function startFlow() {
        if (!empId) { showAlert("กรอกรหัสพนักงานก่อน"); return; }
        if (!empName) { showAlert("กรอกชื่อ-นามสกุลก่อน"); return; }
        if (!selectedBranch) { showAlert("กรุณาเลือกสาขา"); return; }

        // If it's a Check-in and plan hasn't been submitted, show modal
        if (type === "Check-in" && !planSubmittedToday) {
            setShowWorkPlan(true);
            return;
        }

        proceedToGps();
    }

    async function proceedToGps() {
        setStep(2);
        const g = await readGPS();
        if (!g.pass) {
            setStep(1);
            showAlert(`GPS ไม่ผ่าน — ${g.reason}`);
            return;
        }
        setStep(3);
        await startCamera(facingMode);
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
                // After submitting plan, proceed with check-in flow
                proceedToGps();
            } else {
                throw new Error(result.error || "Failed to submit plan");
            }
        } catch (e: any) {
            showAlert("บันทึกแผนงานไม่สำเร็จ: " + e.message);
        }
    }

    /* ── Capture ── */
    function handleCapture() {
        const v = videoRef.current, rc = rawCanvasRef.current;
        if (!v || !rc) return;

        // 💾 Store raw frame
        const w = v.videoWidth || 1280, h = v.videoHeight || 720;
        rc.width = w; rc.height = h;
        rc.getContext("2d")?.drawImage(v, 0, 0);

        const dataUrl = capturePhoto(type);
        if (dataUrl) {
            setPreview(dataUrl);
            stopCamera();
            setStep(4);
            setStatus(<span><CheckCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />ถ่ายแล้ว — เลือก เช็คอิน หรือ เช็คเอาท์</span>, "ok");
        }
    }

    function handleRetake() {
        setPreview(null);
        setStep(3);
        startCamera(facingMode);
        setStatus("ถ่ายใหม่ได้ — กด ถ่ายรูป อีกครั้ง", "warn");
    }

    /* ── Submit ── */
    async function doCheck(targetType: "Check-in" | "Check-out") {
        if (isSubmitting) return;
        if (!empId || !selectedBranch) { showAlert("กร้อมูลไม่ครบ"); return; }
        if (!gps.pass) { showAlert("GPS ไม่ผ่าน"); return; }
        if (!preview) { showAlert("กรุณาถ่ายรูปก่อน"); return; }

        setIsSubmitting(true);
        setStatus(<span><ArrowPathIcon width={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />กำลังบันทึก...</span>, "warn");

        const lateInfoNow = calcLateOT(targetType);

        // 🔥 Re-draw watermark from stored RAW frame (works even if camera is off)
        setType(targetType);
        capturePhoto(targetType, true);


        let photoUrl = "";
        try {
            const blob = await new Promise<Blob>((res, rej) => canvasRef.current?.toBlob(b => b ? res(b) : rej(), "image/jpeg", 0.88));
            const fd = new FormData();
            fd.append("file", blob, "checkin.jpg");
            const up = await fetch("/api/upload", { method: "POST", body: fd });
            const upData = await up.json().catch(() => ({}));
            if (!up.ok) throw new Error(upData?.error || "UPLOAD_FAILED");
            photoUrl = upData.url;
        } catch (e: unknown) {
            setIsSubmitting(false);
            showAlert((e as Error).message || "อัปโหลดรูปไม่สำเร็จ");
            return;
        }

        const r = await fetch("/api/checkins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: targetType, branch_id: selectedBranch,
                lat: gps.lat, lon: gps.lon, accuracy: gps.accuracy,
                capture_mode: "webrtc", photo_url: photoUrl,
                emp_id: empId, name: empName,
                project_name: null, remark: null,
                lateStatus: lateInfoNow.status, lateLabel: lateInfoNow.label,
            }),
        });

        const data = await r.json().catch(() => ({}));
        setIsSubmitting(false);

        if (!r.ok) {
            const errMap: Record<string, string> = {
                OUT_OF_RADIUS: `อยู่นอกพื้นที่ (${data.distance}m / ${data.radius_m}m)`,
                DUPLICATE_TODAY: "วันนี้ทำรายการแล้ว",
                MUST_CHECKIN_FIRST: "ต้อง Check-in ก่อน",
                WORK_PLAN_REQUIRED: "กรุณาบันทึกแผนงานประจำวันก่อนทำรายการ",
            };
            const errMsg = errMap[data?.error] || data?.error || "เกิดข้อผิดพลาด";
            showAlert(errMsg);
            setStatus(<span><XCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />{errMsg}</span>, "bad");
            return;
        }

        showAlert(`${targetType === "Check-in" ? "เช็คอิน" : "เช็คเอาท์"} สำเร็จ!`, "ok");
        setStatus(<span><CheckCircleIcon width={14} style={{ display: 'inline', marginRight: 6 }} />บันทึกสำเร็จ</span>, "ok");
        await refreshToday();
        setPreview(null);
        setStep(1);
    }

    /* ── QR Scanner ── */
    async function openQR() {
        setShowQR(true);
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
            qrStreamRef.current = s;
            if (qrVideoRef.current) { qrVideoRef.current.srcObject = s; await qrVideoRef.current.play(); }

            if (typeof (window as unknown as Record<string, unknown>).ZXing !== "undefined") {
                const ZXing = (window as unknown as Record<string, { BrowserQRCodeReader: new () => { decodeFromVideoDevice: (id: string | undefined, el: string | HTMLVideoElement, cb: (result: { getText: () => string } | null, err: unknown) => void) => Promise<unknown>; reset: () => void } }>).ZXing;
                const reader = new ZXing.BrowserQRCodeReader();
                reader.decodeFromVideoDevice(undefined, qrVideoRef.current!, (result) => {
                    if (result) {
                        const text = result.getText();
                        closeQR();
                        setEmpId(text);
                        reader.reset();
                    }
                });
            }
        } catch {
            closeQR();
            showAlert("เปิดกล้อง QR ไม่ได้");
        }
    }

    function closeQR() {
        setShowQR(false);
        qrStreamRef.current?.getTracks().forEach(t => t.stop());
        qrStreamRef.current = null;
        if (qrVideoRef.current) qrVideoRef.current.srcObject = null;
    }

    /* ── Keyboard shortcut ── */
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.code !== "Space" || e.repeat) return;
            const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
            if (["input", "select", "textarea"].includes(tag)) return;
            e.preventDefault();
            if (!hasIn) doCheck("Check-in");
            else if (!hasOut) doCheck("Check-out");
        }
        window.addEventListener("keydown", onKey, { passive: false });
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasIn, hasOut, selectedBranch, preview, gps]);

    /* ──────────────────────────────────────────
       RENDER
    ────────────────────────────────────────── */
    return (
        <>
            {showQR && (
                <Script 
                    src="https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.21.3/zxing.min.js" 
                    onLoad={() => console.log("ZXing loaded")}
                />
            )}

            <div className={styles.wrapper} style={{ paddingBottom: 60 }}>

                <div className={styles.wrap}>

                    {/* ── HERO TITLE ── */}
                    <div className={styles.hero}>
                        <h1 className={styles.heroH1}>ระบบเช็คอินพนักงาน</h1>
                    </div>

                    {/* ── BIRTHDAY BANNER ── */}
                    {birthdays.length > 0 && (
                        <div className={styles.birthdayBanner}>
                            <div className={styles.birthdayIcon}><SparklesIcon width={24} /></div>
                            <div className={styles.birthdayContent}>
                                <div className={styles.birthdayTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>สุขสันต์วันเกิด! <CakeIcon width={20} className="text-pink-500" /></div>
                                <div className={styles.birthdayNames}>
                                    วันนี้เป็นวันเกิดของคุณ: {birthdays.map(b => b.name).join(", ")}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── WARNINGS SECTION ── */}
                    {warnings.length > 0 && (
                        <div className={styles.card} style={{ border: "1px solid var(--red)", background: "rgba(239, 68, 68, 0.03)" }}>
                            <div className={styles.sectionLabel} style={{ color: "var(--red)" }}>
                                <div className={styles.dot} style={{ background: "var(--red)" }} />
                                <span>ประกาศเตือน / Warning ({warnings.length})</span>
                            </div>
                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                                {warnings.map(w => (
                                    <div key={w.id} style={{ padding: "12px 14px", borderRadius: 8, background: "white", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--red)", marginBottom: 4 }}>
                                            วันที่: {new Date(w.date).toLocaleDateString("th-TH")}
                                        </div>
                                        <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
                                            {w.reason}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {empId && empName && (
                        <div className={styles.card} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: "16px 20px" }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                                {empName.charAt(0)}
                            </div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{empName}</div>
                                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{empId} · {branches.find(b => b.id === selectedBranch)?.name || "—"}</div>
                            </div>
                        </div>
                    )}



                    {(!empId || !empName) && (
                        <div className={styles.card}>
                            <div className={styles.sectionLabel}>
                                <div className={styles.dot} />
                                <span>ข้อมูลพนักงาน</span>
                            </div>

                            <div className={styles.row}>
                                <div>
                                    <label className={styles.label}>รหัสพนักงาน</label>
                                    <div className={styles.empIdWrap}>
                                        <input className={styles.input} value={empId} onChange={e => setEmpId(e.target.value)} placeholder="TERA-001" />
                                        <button className={styles.qrBtn} onClick={openQR} title="สแกน QR">
                                            <QrCodeIcon width={18} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className={styles.label}>ชื่อ-นามสกุล</label>
                                    <input className={styles.input} value={empName} onChange={e => setEmpName(e.target.value)} placeholder="ชื่อ นามสกุล" />
                                </div>
                            </div>

                            <div className={styles.row} style={{ marginTop: 12 }}>
                                <div>
                                    <label className={styles.label}>สาขาประจำ</label>
                                    <select className={styles.select} value={selectedBranch} disabled style={{ backgroundColor: "#f3f4f6", cursor: "not-allowed", opacity: 0.8 }}>
                                        <option value="">เลือกสาขา</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TIME CARD ── */}
                    <TimeCard lateInfo={lateInfo} />

                    {/* ── CAMERA CARD ── */}
                    <div className={styles.card}>
                        <canvas ref={canvasRef} style={{ display: "none" }} />
                        <div className={styles.cardHeader} style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                ถ่ายรูปยืนยันตัวตน
                            </div>
                        </div>

                        {/* ── SCREENING FORM ── */}


                        {step < 3 && !preview && (
                            <button 
                                className={`${styles.btn} ${styles.btnSecondary}`} 
                                style={{ 
                                    width: "100%", 
                                    display: "flex", 
                                    justifyContent: "center", 
                                    gap: 10, 
                                    padding: 20, 
                                    background: "var(--primary)", 
                                    color: "black",
                                    border: "none",
                                    cursor: "pointer"
                                }} 
                                onClick={startFlow}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                ถ่ายรูปเพื่อเช็คอิน
                            </button>
                        )}

                        {step >= 3 && !preview && (
                            <>
                                <div className={styles.camWrap}>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className={`${styles.video} ${facingMode === "user" ? styles.mirror : ""}`}
                                    />
                                    <div className={styles.camOverlay} />
                                    <div className={`${styles.camCorner} ${styles.tl}`} />
                                    <div className={`${styles.camCorner} ${styles.tr}`} />
                                    <div className={`${styles.camCorner} ${styles.bl}`} />
                                    <div className={`${styles.camCorner} ${styles.br}`} />
                                </div>
                                <div style={{ marginTop: 16 }}>
                                    <button className={`${styles.btn} ${styles.btnSecondary}`} style={{ width: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={handleCapture} disabled={!cameraReady}><Camera size={18} /> ถ่ายรูป</button>
                                </div>
                            </>
                        )}

                        {preview && (
                            <>
                                <div className={styles.camWrap}>
                                    <Image src={preview} alt="preview" width={1280} height={720} className={styles.video} unoptimized />
                                </div>
                                <div style={{ marginTop: 16 }}>
                                    <button className={`${styles.btn} ${styles.btnGhost}`} style={{ width: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={handleRetake}><RotateCcw size={18} /> ถ่ายใหม่</button>
                                </div>
                            </>
                        )}

                    </div>

                    <canvas ref={rawCanvasRef} style={{ display: "none" }} />

                    {/* ── ACTION BUTTONS ── */}
                    {preview && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
                            <button
                                style={{ padding: "16px 20px", fontSize: 18, fontWeight: 700, borderRadius: 12, background: "#22c55e", color: "white", border: "none", cursor: preview ? "pointer" : "not-allowed", opacity: preview && !isSubmitting ? 1 : 0.6 }}
                                onClick={() => doCheck("Check-in")}
                                disabled={!preview || isSubmitting}
                            >
                                {isSubmitting ? "..." : "เช็คอิน"}
                            </button>
                            <button
                                style={{ padding: "16px 20px", fontSize: 18, fontWeight: 800, borderRadius: 12, background: "white", color: "#ef4444", border: "2px solid #ef4444", cursor: preview ? "pointer" : "not-allowed", opacity: preview && !isSubmitting ? 1 : 0.6 }}
                                onClick={() => doCheck("Check-out")}
                                disabled={!preview || isSubmitting}
                            >
                                {isSubmitting ? "..." : "เช็คเอาท์"}
                            </button>
                        </div>
                    )}




                    <HistoryCard today={today} todayKey={todayKey} />


                </div>
            </div>

            {/* ── QR OVERLAY ── */}
            {showQR && (
                <div className={styles.qrOverlay} onClick={e => { if (e.target === e.currentTarget) closeQR(); }}>
                    <div className={styles.qrModal}>
                        <div className={styles.qrModalHeader}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Camera size={20} /> สแกน QR รหัสพนักงาน</h3>
                            <button className={styles.qrClose} onClick={closeQR}><X size={20} /></button>
                        </div>
                        <div className={styles.qrViewport}>
                            <video ref={qrVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            <div className={styles.qrFrame} />
                            <div className={styles.qrScanLine} />
                        </div>
                        <p className={styles.qrHint}>จ่อ QR Code ให้อยู่ในกรอบสีแดง</p>
                    </div>
                </div>
            )}

            {/* ── MODALS ── */}
            <AlertModal alert={alert} onClose={closeAlert} />

            <WorkPlanModal
                isOpen={showWorkPlan}
                onClose={() => {
                    setShowWorkPlan(false);
                    setStep(1); // Return to start if modal closed/cancelled
                }}
                onSubmit={handleWorkPlanSubmit}
                employeeName={empName}
            />

            <canvas ref={canvasRef} style={{ display: "none" }} />
        </>
    );
}