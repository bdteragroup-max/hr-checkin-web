"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../../leave/page.module.css";
import { formatDateThai } from "@/utils/time";
import { 
    CheckCircleIcon, 
    ExclamationTriangleIcon, 
    ArrowPathIcon, 
    HandThumbUpIcon, 
    HandThumbDownIcon,
    ClockIcon,
    UserIcon,
    BuildingOffice2Icon,
    XCircleIcon,
    UserGroupIcon,
    BanknotesIcon
} from "@heroicons/react/24/outline";

type CommissionClaim = {
    id: string;
    emp_id: string;
    date: string;
    customer_name: string;
    status: string;
    employee: {
        name: string;
    };
};

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

export default function TeamCommissionClaimsPage() {
    const [list, setList] = useState<CommissionClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [alert, setAlert] = useState<AlertModal>({ visible: false, message: "", type: "error" });
    const closeAlert = useCallback(() => setAlert(p => ({ ...p, visible: false })), []);

    function showAlert(message: string, type: "error" | "ok" = "error") {
        setAlert({ visible: true, message, type });
    }

    async function load() {
        setLoading(true);
        try {
            const r = await fetch("/api/team/commission-claims", { cache: "no-store" });
            if (!r.ok) {
                if (r.status === 401) window.location.href = "/";
                return;
            }
            const data = await r.json().catch(() => ({}));
            setList(data.list || []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function handleAction(id: string, action: "approve" | "reject") {
        if (actionLoading) return;

        if (!window.confirm(`ยืนยันการ ${action === "approve" ? "อนุมัติ" : "ปฏิเสธ"} คำขอนี้?`)) return;

        setActionLoading(true);
        try {
            const r = await fetch("/api/team/commission-claims", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action }),
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) {
                showAlert(data.error || "เกิดข้อผิดพลาดในการดำเนินการ", "error");
                return;
            }
            showAlert(`ดำเนินการสำเร็จ`, "ok");
            await load(); // reload list
        } catch (e) {
            showAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
        } finally {
            setActionLoading(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.wrap}>
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>อนุมัติค่าคอมมิชชั่น</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            สำหรับหัวหน้างานพิจารณาคำขอค่าคอมมิชชั่นของทีม
                        </div>
                    </div>
                </div>

                <div className={styles.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div className={styles.cardTitle} style={{ margin: 0 }}>ประวัติและรายการรออนุมัติ ({list.length})</div>
                        <button onClick={load} disabled={loading} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ArrowPathIcon width={18} className={loading ? "animate-spin" : ""} /> รีเฟรช
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : list.length === 0 ? (
                        <div className={styles.emptyState}>ไม่มีคำขอที่ต้องพิจารณา</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {list.map(x => (
                                <div key={x.id} style={{ border: "1px solid var(--gray-200)", borderRadius: 12, padding: 16, background: "white" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 16 }}>{x.employee.name} <span style={{ color: "var(--text-3)", fontSize: 13, fontWeight: 400 }}>({x.emp_id})</span></div>
                                        <div style={{ fontWeight: 600, color: "var(--primary)", fontSize: 14 }}>Commission</div>
                                    </div>

                                    {/* Status Indicator */}
                                    <div style={{ marginBottom: 12 }}>
                                        <span style={{ 
                                            padding: "4px 10px", 
                                            borderRadius: 6, 
                                            fontSize: 12, 
                                            fontWeight: 700,
                                            background: x.status === "pending_supervisor" ? "#eff6ff" : x.status === "rejected" ? "#fef2f2" : "#f0fdf4",
                                            color: x.status === "pending_supervisor" ? "#1d4ed8" : x.status === "rejected" ? "#dc2626" : "#15803d",
                                            display: "inline-block"
                                        }}>
                                            {x.status === "pending_supervisor" ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ClockIcon width={14} /> รอคุณพิจารณา</span> : 
                                             x.status === "pending_admin" ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BuildingOffice2Icon width={14} /> ส่งถึง HR แล้ว</span> : 
                                             x.status === "completed" ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircleIcon width={14} /> อนุมัติสำเร็จ</span> : 
                                             <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircleIcon width={14} /> ไม่อนุมัติ</span>}
                                        </span>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "4px 8px", fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
                                        <span style={{ color: "var(--text-3)" }}>วันที่ปฏิบัติงาน:</span>
                                        <span style={{ fontWeight: 600 }}>{formatDateThai(x.date)}</span>
                                        <span style={{ color: "var(--text-3)" }}>ชื่อลูกค้า:</span>
                                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{x.customer_name}</span>
                                    </div>

                                    <div style={{ display: "flex", gap: 10 }}>
                                        <button
                                            onClick={() => handleAction(x.id, "approve")}
                                            disabled={actionLoading || x.status !== "pending_supervisor"}
                                            style={{ 
                                                flex: 1, 
                                                padding: "10px 0", 
                                                background: x.status === "pending_supervisor" ? "#16a34a" : "#e5e7eb", 
                                                color: x.status === "pending_supervisor" ? "white" : "#9ca3af", 
                                                border: "none", 
                                                borderRadius: 8, 
                                                fontWeight: 600, 
                                                fontSize: 14, 
                                                cursor: (actionLoading || x.status !== "pending_supervisor") ? "not-allowed" : "pointer", 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                gap: 8 
                                            }}
                                        >
                                            <HandThumbUpIcon width={18} /> {x.status === "pending_supervisor" ? "อนุมัติ" : "ดำเนินการแล้ว"}
                                        </button>
                                        <button
                                            onClick={() => handleAction(x.id, "reject")}
                                            disabled={actionLoading || x.status !== "pending_supervisor"}
                                            style={{ 
                                                flex: 1, 
                                                padding: "10px 0", 
                                                background: "white", 
                                                border: x.status === "pending_supervisor" ? "1px solid #ef4444" : "1px solid #e5e7eb", 
                                                color: x.status === "pending_supervisor" ? "#ef4444" : "#9ca3af", 
                                                borderRadius: 8, 
                                                fontWeight: 600, 
                                                fontSize: 14, 
                                                cursor: (actionLoading || x.status !== "pending_supervisor") ? "not-allowed" : "pointer", 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                gap: 8 
                                            }}
                                        >
                                            <HandThumbDownIcon width={18} /> ไม่อนุมัติ
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <AlertModalComponent alert={alert} onClose={closeAlert} />
            </div>
        </div>
    );
}
