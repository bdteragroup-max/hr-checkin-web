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

export default function EmployeeOtPage() {
    const [dateFor, setDateFor] = useState("");
    const [startHour, setStartHour] = useState("17");
    const [startMin, setStartMin] = useState("30");
    const [endHour, setEndHour] = useState("20");
    const [endMin, setEndMin] = useState("00");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState<AlertModal>({ visible: false, message: "", type: "error" });
    const closeAlert = () => setAlert(p => ({ ...p, visible: false }));

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

    async function handleDelete(id: number) {
        if (!confirm("คุณต้องการยกเลิกคำขอนี้ใช่หรือไม่?")) return;

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
                    reason
                })
            });

            if (res.ok) {
                showAlert("ส่งคำขออนุมัติ OT สำเร็จ!", "ok");
                setDateFor("");
                setReason("");
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
        </div>
    );
}
