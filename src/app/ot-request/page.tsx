"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

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

export default function EmployeeOtPage() {
    const [dateFor, setDateFor] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
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

        if (!dateFor || !startTime || !endTime) {
            showAlert("กรุณากรอกข้อมูล วันที่และเวลา ให้ครบถ้วน", "error");
            return;
        }

        const startDT = new Date(`${dateFor}T${startTime}:00`);
        const endDT = new Date(`${dateFor}T${endTime}:00`);

        if (endDT <= startDT) {
            showAlert("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น", "error");
            return;
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
                setStartTime("");
                setEndTime("");
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
                            <div>
                                <label className={styles.label}>วันที่ขอ OT / วันหยุด *</label>
                                <input
                                    type="date"
                                    className={styles.input}
                                    value={dateFor}
                                    onChange={e => setDateFor(e.target.value)}
                                    required
                                />
                            </div>

                            <div className={styles.row2}>
                                <div>
                                    <label className={styles.label}>เวลาเริ่มต้น *</label>
                                    <input
                                        type="time"
                                        className={styles.input}
                                        value={startTime}
                                        onChange={e => setStartTime(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={styles.label}>เวลาสิ้นสุด *</label>
                                    <input
                                        type="time"
                                        className={styles.input}
                                        value={endTime}
                                        onChange={e => setEndTime(e.target.value)}
                                        required
                                    />
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
                            >
                                {loading ? "กำลังส่งข้อมูล..." : "ส่งคำขออนุมัติ"}
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
                                                {new Date(item.date_for).toLocaleDateString("th-TH", { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div className={styles.historyTime}>
                                                {new Date(item.start_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} - {new Date(item.end_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                                                <span className={styles.historyHours}>{item.total_hours} ชม.</span>
                                            </div>
                                            <div className={styles.historyReason}>เหตุผล: {item.reason}</div>
                                        </div>
                                        <div className={styles.historyRight}>
                                            {item.status === "pending" && <span className={styles.statusBadgePending}>รอพิจารณา</span>}
                                            {item.status === "approved" && <span className={styles.statusBadgeApproved}>อนุมัติแล้ว</span>}
                                            {item.status === "rejected" && <span className={styles.statusBadgeRejected}>ไม่อนุมัติ</span>}
                                            
                                            {item.status === "pending" && (
                                                <button 
                                                    onClick={() => handleDelete(item.id)}
                                                    className={styles.btnCancel}
                                                >
                                                    ยกเลิกคำขอ
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
