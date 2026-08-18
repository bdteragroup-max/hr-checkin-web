"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import {
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ClockIcon,
    CalendarIcon,
    PencilSquareIcon,
    TrashIcon,
    ArrowPathIcon,
    XCircleIcon,
    InformationCircleIcon
} from "@heroicons/react/24/outline";
import { formatTime24h, formatDateThai, formatDecimalHoursToHHMM, HOUR_OPTIONS, MINUTE_OPTIONS, formatDateShortThai } from "@/utils/time";

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
                    {isErr ? <ExclamationTriangleIcon width={48} /> : <CheckCircleIcon width={48} />}
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

interface ConfirmModal { visible: boolean; message: string; onConfirm: () => void; }

function ConfirmModalComponent({ confirmState, onClose }: { confirmState: ConfirmModal; onClose: () => void }) {
    useEffect(() => {
        if (!confirmState.visible) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [confirmState.visible, onClose]);

    if (!confirmState.visible) return null;

    return (
        <div className={styles.alertOverlay} onClick={onClose} role="dialog" aria-modal="true">
            <div className={styles.alertModal} onClick={e => e.stopPropagation()}>
                <div className={`${styles.alertIcon} ${styles.alertIconErr}`} style={{ color: "var(--text3)", background: "var(--surface3)" }}>
                    <ExclamationTriangleIcon width={48} />
                </div>
                <div className={styles.alertTitle} style={{ color: "var(--text)", fontSize: "20px" }}>
                    ยืนยันการทำรายการ
                </div>
                <div className={styles.alertMsg} style={{ marginBottom: "24px" }}>{confirmState.message}</div>
                <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                    <button
                        className={styles.alertBtn}
                        style={{ background: "var(--surface3)", color: "var(--text2)", border: "1px solid var(--line)" }}
                        onClick={onClose}
                    >
                        ยกเลิก
                    </button>
                    <button
                        className={`${styles.alertBtn} ${styles.alertBtnErr}`}
                        onClick={() => {
                            confirmState.onConfirm();
                            onClose();
                        }}
                        autoFocus
                    >
                        ตกลง
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function EmployeeOtPage() {
    const [dateFor, setDateFor] = useState("");
    const [startHour, setStartHour] = useState("17");
    const [startMin, setStartMin] = useState("30");
    const [endHour, setEndHour] = useState("20");
    const [endMin, setEndMin] = useState("00");
    const [reason, setReason] = useState("");
    const [isForgotClock, setIsForgotClock] = useState(false);
    const [forgotReason, setForgotReason] = useState("");
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState<AlertModal>({ visible: false, message: "", type: "error" });
    const closeAlert = () => setAlert(p => ({ ...p, visible: false }));
    const [confirmModal, setConfirmModal] = useState<ConfirmModal>({ visible: false, message: "", onConfirm: () => {} });
    const closeConfirm = () => setConfirmModal(p => ({ ...p, visible: false }));

    function showAlert(message: string, type: "error" | "ok" = "error") {
        setAlert({ visible: true, message, type });
    }

    const [history, setHistory] = useState<{
        id: number;
        date_for: string;
        start_time: string;
        end_time: string;
        total_hours: number;
        reason: string;
        status: string;
        is_forgot_clock: boolean;
        forgot_reason: string | null;
        proof_url: string | null;
    }[]>([]);

    async function loadHistory() {
        try {
            const res = await fetch("/api/employee/ot");
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (e) { }
    }

    useEffect(() => {
        loadHistory();
    }, []);

    function handleDelete(id: number) {
        setConfirmModal({
            visible: true,
            message: "คุณต้องการยกเลิกคำขอนี้ใช่หรือไม่?",
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/employee/ot?id=${id}`, {
                        method: "DELETE"
                    });
                    if (res.ok) {
                        loadHistory();
                        showAlert("ยกเลิกคำขอสำเร็จ", "ok");
                    } else {
                        const d = await res.json();
                        showAlert(d.error || "ลบไม่สำเร็จ", "error");
                    }
                } catch (e) {
                    showAlert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "error");
                }
            }
        });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!dateFor) {
            showAlert("กรุณากรอกวันที่ให้ครบถ้วน", "error");
            return;
        }

        const startDT = new Date(`${dateFor}T${startHour}:${startMin}:00+07:00`);
        const endDT = new Date(`${dateFor}T${endHour}:${endMin}:00+07:00`);

        if (endDT <= startDT) {
            endDT.setDate(endDT.getDate() + 1);
        }

        setLoading(true);

        let proofUrl = null;
        if (isForgotClock) {
            if (!forgotReason.trim()) {
                showAlert("กรุณาระบุเหตุผลที่ลืมลงเวลา", "error");
                setLoading(false);
                return;
            }
            if (proofFile) {
                if (proofFile.size > 5 * 1024 * 1024) {
                    showAlert("ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB", "error");
                    setLoading(false);
                    return;
                }
                const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                if (!allowedTypes.includes(proofFile.type)) {
                    showAlert("รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)", "error");
                    setLoading(false);
                    return;
                }

                try {
                    const fd = new FormData();
                    fd.append("file", proofFile);
                    const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
                    if (uploadRes.ok) {
                        const upData = await uploadRes.json();
                        proofUrl = upData.url;
                    } else {
                        showAlert("อัพโหลดรูปภาพไม่สำเร็จ", "error");
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    showAlert("เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ", "error");
                    setLoading(false);
                    return;
                }
            }
        }

        try {
            const res = await fetch("/api/employee/ot", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    date_for: dateFor,
                    start_time: startDT.toISOString(),
                    end_time: endDT.toISOString(),
                    reason,
                    is_forgot_clock: isForgotClock,
                    forgot_reason: isForgotClock ? forgotReason : null,
                    proof_url: proofUrl
                })
            });

            if (res.ok) {
                showAlert("ส่งคำขออนุมัติ OT สำเร็จ!", "ok");
                setDateFor("");
                setReason("");
                setIsForgotClock(false);
                setForgotReason("");
                setProofFile(null);
                loadHistory(); // refresh history
            } else {
                const data = await res.json();
                showAlert(data.error || "เกิดข้อผิดพลาดในการส่งข้อมูล", "error");
            }
        } catch (error) {
            showAlert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
        }
        setLoading(false);
    }

    return (
        <div className={styles.page}>
            <AlertModalComponent alert={alert} onClose={closeAlert} />
            <div className={styles.wrap}>
                {/* Header Section */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>ขออนุมัติล่วงเวลา (OT)</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            แบบฟอร์มขออนุมัติทำงานล่วงเวลา / วันหยุด
                        </div>
                    </div>
                </div>

                {/* Form Card */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}>กรอกข้อมูลคำขอ</div>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        {/* Form Rows */}
                        <div className={styles.formRow}>
                            <div className={styles.formSection}>
                                <label className={styles.label}>วันที่ขอ OT / วันหยุด *</label>
                                <div className={styles.inputWithIcon}>
                                    <CalendarIcon className={styles.inputIcon} />
                                    <input
                                        type="date"
                                        className={styles.input}
                                        value={dateFor}
                                        onChange={e => setDateFor(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.timeSection}>
                            <div className={styles.timeRow}>
                                <div className={styles.timeGroup}>
                                    <label className={styles.label}>เวลาเริ่มทำงาน</label>
                                    <div className={styles.timeInputsRow}>
                                        <div className={styles.timeInputUnit}>
                                            <select className={styles.selectInput} value={startHour} onChange={e => setStartHour(e.target.value)}>
                                                {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                            <span className={styles.unitLabel}>ชั่วโมง</span>
                                        </div>
                                        <span className={styles.timeColon}>:</span>
                                        <div className={styles.timeInputUnit}>
                                            <select className={styles.selectInput} value={startMin} onChange={e => setStartMin(e.target.value)}>
                                                {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <span className={styles.unitLabel}>นาที</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.timeGroup}>
                                    <label className={styles.label}>เวลาสิ้นสุด</label>
                                    <div className={styles.timeInputsRow}>
                                        <div className={styles.timeInputUnit}>
                                            <select className={styles.selectInput} value={endHour} onChange={e => setEndHour(e.target.value)}>
                                                {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                            <span className={styles.unitLabel}>ชั่วโมง</span>
                                        </div>
                                        <span className={styles.timeColon}>:</span>
                                        <div className={styles.timeInputUnit}>
                                            <select className={styles.selectInput} value={endMin} onChange={e => setEndMin(e.target.value)}>
                                                {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <span className={styles.unitLabel}>นาที</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className={styles.label}>เหตุผล / รายละเอียดงาน *</label>
                            <textarea
                                className={styles.textarea}
                                placeholder="ระบุรายละเอียดงานที่ทำล่วงเวลา..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                                <input
                                    type="checkbox"
                                    checked={isForgotClock}
                                    onChange={e => setIsForgotClock(e.target.checked)}
                                    style={{ width: 18, height: 18 }}
                                />
                                ลืมลงเวลาเข้า/ออกงาน (Forgot Check-in/out)
                            </label>
                        </div>

                        {isForgotClock && (
                            <div style={{ marginTop: 16, padding: 16, backgroundColor: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                                <div style={{ marginBottom: 12 }}>
                                    <label className={styles.label}>เหตุผลที่ลืมลงเวลา *</label>
                                    <textarea
                                        className={styles.textarea}
                                        placeholder="ระบุเหตุผล เช่น โทรศัพท์แบตหมด, ออกไปพบลูกค้า..."
                                        value={forgotReason}
                                        onChange={e => setForgotReason(e.target.value)}
                                        required={isForgotClock}
                                        style={{ borderColor: '#fca5a5' }}
                                    />
                                </div>
                                <div>
                                    <label className={styles.label}>รูปถ่ายหลักฐาน (ถ้ามี)</label>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                if (file.size > 5 * 1024 * 1024) {
                                                    showAlert("ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB", "error");
                                                    e.target.value = "";
                                                    setProofFile(null);
                                                    return;
                                                }
                                                const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                                                if (!allowedTypes.includes(file.type)) {
                                                    showAlert("รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)", "error");
                                                    e.target.value = "";
                                                    setProofFile(null);
                                                    return;
                                                }
                                                setProofFile(file);
                                            } else {
                                                setProofFile(null);
                                            }
                                        }}
                                        className={styles.input}
                                        style={{ borderColor: '#fca5a5', backgroundColor: '#fff' }}
                                    />
                                    <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                                        * ขนาดไฟล์ไม่เกิน 5MB รองรับ JPG, PNG, WEBP เท่านั้น
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={loading}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            {loading ? <><ArrowPathIcon width={18} className="animate-spin" /> กำลังส่งข้อมูล...</> : "ส่งคำขออนุมัติ"}
                        </button>
                    </form>
                </div>

                {/* History Section */}
                {history.length > 0 && (
                    <div className={styles.card} style={{ marginTop: "20px" }}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>ประวัติคำขอ OT ของฉัน</div>
                        </div>

                        <div className={styles.historyList}>
                            {history.map(item => (
                                <div key={item.id} className={styles.historyItem}>
                                    <div>
                                        <div className={styles.historyDate}>
                                            <CalendarIcon width={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
                                            {formatDateShortThai(item.date_for)}
                                        </div>
                                        <div className={styles.historyTime}>
                                            <ClockIcon width={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
                                            {formatTime24h(item.start_time)} - {formatTime24h(item.end_time)}
                                            <span className={styles.historyHours}>{formatDecimalHoursToHHMM(item.total_hours)}</span>
                                        </div>
                                        <div className={styles.historyReason}><InformationCircleIcon width={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />เหตุผล: {item.reason}</div>
                                        {item.is_forgot_clock && (
                                            <div style={{ marginTop: 4, fontSize: 13, color: '#dc2626' }}>
                                                <InformationCircleIcon width={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
                                                ลืมลงเวลา: {item.forgot_reason}
                                                {item.proof_url ? (
                                                    <a href={item.proof_url} target="_blank" rel="noreferrer" style={{ marginLeft: 8, textDecoration: 'underline', color: '#2563eb' }}>ดูรูปหลักฐาน</a>
                                                ) : (
                                                    <span style={{ marginLeft: 8, color: '#9ca3af' }}>(ไม่มีภาพแนบ)</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.historyRight}>
                                        {item.status === "pending_supervisor" && <span className={styles.statusBadgePending} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ClockIcon width={14} /> รอหัวหน้าอนุมัติ</span>}
                                        {item.status === "pending_hr" && <span className={styles.statusBadgePending} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}><ClockIcon width={14} /> รอ HR อนุมัติ</span>}
                                        {item.status === "approved" && <span className={styles.statusBadgeApproved} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircleIcon width={14} /> อนุมัติแล้ว</span>}
                                        {item.status === "rejected" && <span className={styles.statusBadgeRejected} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><XCircleIcon width={14} /> ไม่อนุมัติ</span>}

                                        {item.status === "pending_supervisor" && (
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className={styles.btnCancel}
                                                style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}
                                            >
                                                <TrashIcon width={14} /> ยกเลิกคำขอ
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <ConfirmModalComponent confirmState={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
