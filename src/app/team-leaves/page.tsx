"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../leave/page.module.css";
import Link from "next/link";

type TeamLeaveItem = {
    id: string;
    emp_id: string;
    name: string;
    leave_type: string;
    start_at: string;
    end_at: string;
    days: number;
    reason: string | null;
    status: string;
    attachment_url: string | null;
};

interface AlertModal { visible: boolean; message: string; type: "error" | "ok" }

function fmtDateTimeTH(d: string) {
    try {
        return new Date(d).toLocaleString("th-TH", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    } catch { return d; }
}

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

export default function TeamLeavesPage() {
    const [list, setList] = useState<TeamLeaveItem[]>([]);
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
            const r = await fetch("/api/team/leave", { cache: "no-store" });
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

        let reason = "";
        if (action === "reject") {
            const promptReason = window.prompt("ระบุเหตุผลที่ไม่อนุมัติ (ไม่บังคับ):");
            if (promptReason === null) return; // cancelled
            reason = promptReason;
        } else {
            if (!window.confirm("ยืนยันการอนุมัติใบลาของพนักงานนี้?")) return;
        }

        setActionLoading(true);
        try {
            const r = await fetch(`/api/team/leave/${id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
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
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    </div>
                    <h1 className={styles.heroH1}>อนุมัติการลา</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            สำหรับหัวหน้างานพิจารณาใบลาของทีม
                        </div>
                    </div>
                </div>

                {/* ── LIST CARD ── */}
                <div className={styles.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div className={styles.cardTitle} style={{ margin: 0 }}>รออนุมัติ ({list.length})</div>
                        <button onClick={load} disabled={loading} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}>
                            ↻ รีเฟรช
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : list.length === 0 ? (
                        <div className={styles.emptyState}>ไม่มีคำขอลาที่รอการอนุมัติ</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {list.map(x => (
                                <div key={x.id} style={{ border: "1px solid var(--gray-200)", borderRadius: 12, padding: 16, background: "white" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 16 }}>{x.name} <span style={{ color: "var(--text-3)", fontSize: 13, fontWeight: 400 }}>({x.emp_id})</span></div>
                                        <div style={{ fontWeight: 600, color: "var(--primary)", fontSize: 14 }}>{x.leave_type}</div>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "4px 8px", fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
                                        <span style={{ color: "var(--text-3)" }}>เริ่มลา:</span>
                                        <span>{fmtDateTimeTH(x.start_at)}</span>
                                        <span style={{ color: "var(--text-3)" }}>สิ้นสุด:</span>
                                        <span style={{ color: "var(--text-2)" }}>{fmtDateTimeTH(x.end_at)} <span style={{ color: "var(--red)", fontWeight: 600 }}>({x.days} วัน)</span></span>
                                        {x.reason && (
                                            <>
                                                <span style={{ color: "var(--text-3)" }}>เหตุผล:</span>
                                                <span style={{ color: "var(--text)", fontWeight: 500 }}>{x.reason}</span>
                                            </>
                                        )}
                                    </div>

                                    {x.attachment_url && (
                                        <div style={{ marginBottom: 16 }}>
                                            <a href={x.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--blue)", textDecoration: "underline", display: "inline-block", background: "var(--surface-2)", padding: "4px 10px", borderRadius: 6 }}>
                                                📎 ดูเอกสารแนบ
                                            </a>
                                        </div>
                                    )}

                                    <div style={{ display: "flex", gap: 10 }}>
                                        <button
                                            onClick={() => handleAction(x.id, "approve")}
                                            disabled={actionLoading}
                                            style={{ flex: 1, padding: "10px 0", background: "var(--ok)", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: actionLoading ? "not-allowed" : "pointer" }}
                                        >
                                            ✅ อนุมัติ
                                        </button>
                                        <button
                                            onClick={() => handleAction(x.id, "reject")}
                                            disabled={actionLoading}
                                            style={{ flex: 1, padding: "10px 0", background: "white", border: "1px solid var(--red-hover)", color: "var(--red)", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: actionLoading ? "not-allowed" : "pointer" }}
                                        >
                                            ✕ ไม่อนุมัติ
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
