"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { formatTime24h, formatDateThai, formatDecimalHoursToHHMM, HOUR_OPTIONS, MINUTE_OPTIONS } from "@/utils/time";
import { 
    CheckCircleIcon, 
    XCircleIcon, 
    ArrowPathIcon, 
    ExclamationTriangleIcon,
    UserIcon,
    ClockIcon,
    HandThumbUpIcon,
    HandThumbDownIcon,
    InformationCircleIcon
} from "@heroicons/react/24/solid";

interface AlertModal { visible: boolean; message: string; type: "error" | "ok" }

function AlertModalComponent({ alert, onClose }: { alert: AlertModal; onClose: () => void }) {
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

export default function TeamOtPage() {
    const [pending, setPending] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [alert, setAlert] = useState<AlertModal>({ visible: false, message: "", type: "error" });
    const closeAlert = () => setAlert(p => ({ ...p, visible: false }));

    function showAlert(message: string, type: "error" | "ok" = "error") {
        setAlert({ visible: true, message, type });
    }

    async function loadData() {
        setLoading(true);
        try {
            const res = await fetch("/api/team/ot");
            if (res.ok) {
                const d = await res.json();
                setPending(d.pending || []);
                setHistory(d.history || []);
            } else {
                showAlert("ไม่สามารถดึงข้อมูลได้", "error");
            }
        } catch (e) {
            showAlert("เกิดข้อผิดพลาด", "error");
        }
        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, []);

    const [approveModalReq, setApproveModalReq] = useState<any>(null);
    const [approveStartHour, setApproveStartHour] = useState("17");
    const [approveStartMin, setApproveStartMin] = useState("30");
    const [approveEndHour, setApproveEndHour] = useState("20");
    const [approveEndMin, setApproveEndMin] = useState("00");
    const [processingId, setProcessingId] = useState<number | null>(null);

    function openApproveModal(req: any) {
        setApproveModalReq(req);
        const sTime = new Date(req.start_time);
        const eTime = new Date(req.end_time);
        setApproveStartHour(String(sTime.getHours()).padStart(2, '0'));
        setApproveStartMin(String(sTime.getMinutes()).padStart(2, '0'));
        setApproveEndHour(String(eTime.getHours()).padStart(2, '0'));
        setApproveEndMin(String(eTime.getMinutes()).padStart(2, '0'));
    }

    async function submitApprove() {
        if (!approveModalReq) return;
        
        const sDT = new Date(approveModalReq.date_for);
        sDT.setHours(Number(approveStartHour), Number(approveStartMin), 0, 0);
        const eDT = new Date(approveModalReq.date_for);
        eDT.setHours(Number(approveEndHour), Number(approveEndMin), 0, 0);

        if (eDT <= sDT) {
            eDT.setDate(eDT.getDate() + 1);
        }
        const diffMs = eDT.getTime() - sDT.getTime();
        const calcHours = diffMs / (1000 * 60 * 60);

        if (calcHours <= 0 || calcHours > 16) {
            showAlert("เวลาที่ระบุไม่ถูกต้อง (อาจระบุเวลาสิ้นสุดก่อนเวลาเริ่มต้น หรือจำนวนชั่วโมงเกิน 16 ชม.)", "error");
            return;
        }

        setProcessingId(approveModalReq.id);
        try {
            const res = await fetch("/api/team/ot", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: approveModalReq.id, 
                    status: "approved",
                    approved_start_time: sDT.toISOString(),
                    approved_end_time: eDT.toISOString(),
                    approved_hours: calcHours
                })
            });
            if (res.ok) {
                showAlert("อนุมัติสำเร็จ", "ok");
                setApproveModalReq(null);
                await loadData();
            } else {
                const d = await res.json();
                showAlert(d.error || "เกิดข้อผิดพลาด", "error");
            }
        } catch (e) {
            showAlert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
        } finally {
            setProcessingId(null);
        }
    }

    async function handleReject(id: number) {
        if (!confirm("ยืนยันการปฏิเสธคำขอ OT นี้ใช่หรือไม่?")) return;
        setProcessingId(id);
        try {
            const res = await fetch("/api/team/ot", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: "rejected" })
            });
            if (res.ok) {
                showAlert("ปฏิเสธสำเร็จ", "ok");
                await loadData();
            } else {
                const d = await res.json();
                showAlert(d.error || "เกิดข้อผิดพลาด", "error");
            }
        } catch (e) {
            showAlert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
        } finally {
            setProcessingId(null);
        }
    }

    return (
        <div className={styles.page}>
            <AlertModalComponent alert={alert} onClose={closeAlert} />
            <div className={styles.wrap}>
                {/* ── HERO ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>อนุมัติทำงานล่วงเวลา</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            สำหรับหัวหน้างาน (Supervisor) ตรวจสอบและอนุมัติ OT ของทีม
                        </div>
                    </div>
                </div>

                {/* ── PENDING CARD ── */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}>รออนุมัติ ({pending.length})</div>
                        <button className={styles.btnRefresh} onClick={loadData} disabled={loading}>
                            <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} style={{ marginRight: 6 }} /> รีเฟรช
                        </button>
                    </div>

                    {loading ? (
                        <div className={styles.emptyState}>กำลังโหลดข้อมูล...</div>
                    ) : pending.length === 0 ? (
                        <div className={styles.emptyState}>ไม่มีคำขอ OT ที่รอการอนุมัติ</div>
                    ) : (
                        <div className={styles.itemList}>
                            {pending.map((req) => {
                                const dateLabel = formatDateThai(req.date_for);
                                const startL = formatTime24h(req.start_time);
                                const endL = formatTime24h(req.end_time);
                                const dHours = Number(req.total_hours);

                                return (
                                    <div key={req.id} className={styles.itemCard}>
                                        <div className={styles.itemHead}>
                                            <div>
                                                <div className={styles.empName}>{req.employee.name}</div>
                                                <div className={styles.empId}>ID: {req.employee.emp_id}</div>
                                            </div>
                                            <div className={styles.reqHours}>ขอ {dHours} ชม.</div>
                                        </div>

                                        <div className={styles.itemDetails}>
                                            <div className={styles.detailRow}>
                                                <div className={styles.detailBlock}>
                                                    <span className={styles.detailLabel}>วันที่ทำงาน:</span>
                                                    <span className={styles.detailValLarge}>{dateLabel}</span>
                                                </div>
                                                {req.has_discrepancy && (
                                                    <div className={styles.discrepancyBadge}>
                                                        <ExclamationTriangleIcon width={14} /> พบความผิดปกติ
                                                    </div>
                                                )}
                                            </div>

                                            <div className={styles.timeGrid}>
                                                <div className={styles.timeBox}>
                                                    <span className={styles.timeLabel}>เวลาที่ขอ (Requested)</span>
                                                    <span className={styles.timeVal}>{startL} - {endL}</span>
                                                </div>
                                                {req.actual_start_at && (
                                                    <div className={styles.timeBoxActual}>
                                                        <span className={styles.timeLabel}>เช็คอินจริง (Actual)</span>
                                                        <span className={styles.timeVal}>
                                                            {formatTime24h(req.actual_start_at)} - {formatTime24h(req.actual_end_at)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {req.reason && (
                                                <div className={styles.reasonSection}>
                                                    <span className={styles.detailLabel}>เหตุผลการขอ OT:</span>
                                                    <div className={styles.reasonBox}>{req.reason}</div>
                                                </div>
                                            )}
                                            {req.is_forgot_clock && (
                                                <div className={styles.reasonSection} style={{ marginTop: 12, backgroundColor: '#fef2f2', borderColor: '#fecaca', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                                    <span className={styles.detailLabel} style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <InformationCircleIcon width={16} /> ลืมลงเวลา (Forgot Check-in)
                                                    </span>
                                                    <div className={styles.reasonBox} style={{ color: '#b91c1c', marginTop: 4, backgroundColor: 'transparent', padding: 0 }}>{req.forgot_reason}</div>
                                                    <div style={{ marginTop: 8, fontSize: 13 }}>
                                                        {req.proof_url ? (
                                                            <a href={req.proof_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>ดูรูปหลักฐาน (Attached Image)</a>
                                                        ) : (
                                                            <span style={{ color: '#dc2626', fontWeight: 600 }}>* ไม่มีรูปหลักฐานแนบ (No attached evidence)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className={styles.actionRow} style={{ marginTop: 16 }}>
                                            <button
                                                className={styles.btnApprove}
                                                onClick={() => openApproveModal(req)}
                                                disabled={!!processingId}
                                            >
                                                <CheckCircleIcon width={20} /> อนุมัติ
                                            </button>
                                            <button
                                                className={styles.btnReject}
                                                onClick={() => handleReject(req.id)}
                                                disabled={!!processingId}
                                            >
                                                {processingId === req.id ? (
                                                    <><ArrowPathIcon width={18} className="animate-spin" /> กำลังส่ง...</>
                                                ) : (
                                                    <><XCircleIcon width={20} /> ไม่อนุมัติ</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── HISTORY CARD ── */}
                {history.length > 0 && (
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>ประวัติการอนุมัติล่าสุด</div>
                        </div>

                        <div className={styles.itemList}>
                            {history.map((req) => {
                                const dateLabel = formatDateThai(req.date_for);
                                const startL = formatTime24h(req.start_time);
                                const endL = formatTime24h(req.end_time);
                                return (
                                    <div key={req.id} className={styles.histCard}>
                                        <div className={styles.histHead}>
                                            <div className={styles.histName}>{req.employee.name}</div>
                                            <span className={(req.status === "approved" || req.status === "pending_hr") ? styles.badgeOk : styles.badgeBad}>
                                                {req.status === "pending_hr" ? "ส่งต่อ HR" : req.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
                                            </span>
                                        </div>

                                        <div className={styles.histGrid}>
                                            <span className={styles.detailLabel}>วันที่:</span>
                                            <span className={styles.detailVal}>{dateLabel}</span>
                                            <span className={styles.detailLabel}>เวลา:</span>
                                            <span className={styles.detailVal}>{startL} - {endL}</span>
                                            <span className={styles.detailLabel}>ชม.:</span>
                                            <span className={styles.detailVal}>
                                                ขอ {formatDecimalHoursToHHMM(req.total_hours)}
                                                {(req.status === "approved" || req.status === "pending_hr") && (
                                                    <span style={{ color: "#16a34a", fontWeight: 700, marginLeft: 8 }}>
                                                        อนุมัติ {formatDecimalHoursToHHMM(req.approved_hours ? Number(req.approved_hours) : Number(req.total_hours))}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── APPROVE MODAL ── */}
            {approveModalReq && (
                <div className={styles.alertOverlay} onClick={() => setApproveModalReq(null)}>
                    <div className={styles.alertModal} style={{ width: 400, padding: 24, textAlign: 'left' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>อนุมัติ OT ของ {approveModalReq.employee?.name}</h3>
                        <div style={{ marginBottom: 12 }}>วันที่ขอ: <b>{formatDateThai(approveModalReq.date_for)}</b></div>
                        
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>เวลาเริ่มต้นที่อนุมัติ:</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <select value={approveStartHour} onChange={e => setApproveStartHour(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', flex: 1 }}>
                                {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span style={{ padding: '8px 0' }}>:</span>
                            <select value={approveStartMin} onChange={e => setApproveStartMin(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', flex: 1 }}>
                                {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div style={{ marginBottom: 8, fontWeight: 500 }}>เวลาสิ้นสุดที่อนุมัติ:</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                            <select value={approveEndHour} onChange={e => setApproveEndHour(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', flex: 1 }}>
                                {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span style={{ padding: '8px 0' }}>:</span>
                            <select value={approveEndMin} onChange={e => setApproveEndMin(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', flex: 1 }}>
                                {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setApproveModalReq(null)}
                                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer' }}
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={submitApprove}
                                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', backgroundColor: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                                disabled={!!processingId}
                            >
                                {processingId ? 'กำลังบันทึก...' : 'ยืนยันอนุมัติ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

