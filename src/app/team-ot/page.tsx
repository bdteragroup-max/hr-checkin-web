"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { formatTime24h, formatDateThai } from "@/utils/time";
import { 
    CheckCircleIcon, 
    XCircleIcon, 
    ArrowPathIcon, 
    ExclamationTriangleIcon,
    UserIcon,
    ClockIcon,
    HandThumbUpIcon,
    HandThumbDownIcon
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

    const [editHours, setEditHours] = useState<{ [key: number]: number }>({});
    const [processingId, setProcessingId] = useState<number | null>(null);

    function handleHoursChange(id: number, val: string) {
        setEditHours(prev => ({ ...prev, [id]: Number(val) }));
    }

    async function handleUpdateStatus(id: number, status: "approved" | "rejected", defaultHours: number) {
        if (processingId) return;

        const approvedHours = editHours[id] ?? defaultHours;

        if (status === "approved" && (!approvedHours || approvedHours <= 0)) {
            showAlert("จำนวนชั่วโมงที่อนุมัติต้องมากกว่า 0", "error");
            return;
        }

        const confirmMsg = status === "approved"
            ? `ยืนยันการอนุมัติ OT จำนวน ${approvedHours} ชั่วโมง ใช่หรือไม่?`
            : `ยืนยันการปฏิเสธคำขอ OT นี้ใช่หรือไม่?`;

        if (!confirm(confirmMsg)) return;

        setProcessingId(id);
        try {
            const res = await fetch("/api/team/ot", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, approved_hours: status === "approved" ? approvedHours : null })
            });

            if (res.ok) {
                showAlert(status === "approved" ? "อนุมัติสำเร็จ" : "ปฏิเสธสำเร็จ", "ok");
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
                                const curVal = editHours[req.id] !== undefined ? editHours[req.id] : dHours;

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
                                        </div>

                                        <div className={styles.inputRow}>
                                            <span className={styles.inputLabel}>ระบุชม.ที่อนุมัติ:</span>
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                className={styles.inputHours}
                                                value={curVal}
                                                onChange={e => handleHoursChange(req.id, e.target.value)}
                                            />
                                            <span className={styles.inputLabel}>ชม.</span>
                                        </div>

                                        <div className={styles.actionRow}>
                                            <button
                                                className={styles.btnApprove}
                                                onClick={() => handleUpdateStatus(req.id, "approved", dHours)}
                                                disabled={!!processingId}
                                            >
                                                {processingId === req.id ? (
                                                    <>
                                                        <ArrowPathIcon width={18} className="animate-spin" /> กำลังส่ง...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircleIcon width={20} /> อนุมัติ
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                className={styles.btnReject}
                                                onClick={() => handleUpdateStatus(req.id, "rejected", dHours)}
                                                disabled={!!processingId}
                                            >
                                                <XCircleIcon width={20} /> ไม่อนุมัติ
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
                                                ขอ {Number(req.total_hours)} ชม.
                                                {(req.status === "approved" || req.status === "pending_hr") && (
                                                    <span style={{ color: "#16a34a", fontWeight: 700, marginLeft: 8 }}>
                                                        อนุมัติ {req.approved_hours ? Number(req.approved_hours) : Number(req.total_hours)} ชม.
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
        </div>
    );
}

