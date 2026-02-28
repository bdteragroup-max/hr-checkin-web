"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";

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
                    {isErr ? "⚠" : "✓"}
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

    function handleHoursChange(id: number, val: string) {
        setEditHours(prev => ({ ...prev, [id]: Number(val) }));
    }

    async function handleUpdateStatus(id: number, status: "approved" | "rejected", defaultHours: number) {
        const approvedHours = editHours[id] ?? defaultHours;

        if (status === "approved" && (!approvedHours || approvedHours <= 0)) {
            showAlert("จำนวนชั่วโมงที่อนุมัติต้องมากกว่า 0", "error");
            return;
        }

        const confirmMsg = status === "approved"
            ? `ยืนยันการอนุมัติ OT จำนวน ${approvedHours} ชั่วโมง ใช่หรือไม่?`
            : `ยืนยันการปฏิเสธคำขอ OT นี้ใช่หรือไม่?`;

        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch("/api/team/ot", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, approved_hours: status === "approved" ? approvedHours : null })
            });

            if (res.ok) {
                showAlert(status === "approved" ? "อนุมัติสำเร็จ" : "ปฏิเสธสำเร็จ", "ok");
                loadData();
            } else {
                const d = await res.json();
                showAlert(d.error || "เกิดข้อผิดพลาด", "error");
            }
        } catch (e) {
            showAlert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
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
                            ↻ รีเฟรช
                        </button>
                    </div>

                    {loading ? (
                        <div className={styles.emptyState}>กำลังโหลดข้อมูล...</div>
                    ) : pending.length === 0 ? (
                        <div className={styles.emptyState}>ไม่มีคำขอ OT ที่รอการอนุมัติ</div>
                    ) : (
                        <div className={styles.itemList}>
                            {pending.map((req) => {
                                const dateLabel = format(new Date(req.date_for), "d MMM yyyy", { locale: th });
                                const startL = format(new Date(req.start_time), "HH:mm");
                                const endL = format(new Date(req.end_time), "HH:mm");
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
                                            <span className={styles.detailLabel}>วันที่:</span>
                                            <span className={styles.detailVal}>{dateLabel}</span>
                                            <span className={styles.detailLabel}>เวลา:</span>
                                            <span className={styles.detailVal}>{startL} - {endL}</span>
                                            {req.reason && (
                                                <>
                                                    <span className={styles.detailLabel}>เหตุผล:</span>
                                                    <div className={styles.reasonBox}>{req.reason}</div>
                                                </>
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
                                            >
                                                ✅ อนุมัติ
                                            </button>
                                            <button
                                                className={styles.btnReject}
                                                onClick={() => handleUpdateStatus(req.id, "rejected", dHours)}
                                            >
                                                ✕ ไม่อนุมัติ
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
                                const dateLabel = format(new Date(req.date_for), "d MMM yyyy", { locale: th });
                                const startL = format(new Date(req.start_time), "HH:mm");
                                const endL = format(new Date(req.end_time), "HH:mm");
                                return (
                                    <div key={req.id} className={styles.histCard}>
                                        <div className={styles.histHead}>
                                            <div className={styles.histName}>{req.employee.name}</div>
                                            <span className={req.status === "approved" ? styles.badgeOk : styles.badgeBad}>
                                                {req.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
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
                                                {req.status === "approved" && (
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

