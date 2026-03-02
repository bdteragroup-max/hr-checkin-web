"use client";

import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import AlertModal, { AlertState } from "@/components/AlertModal";

export default function TeamTravelClaimsPage() {
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<any[]>([]);
    const [msg, setMsg] = useState({ text: "", type: "" });

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const [pendingAction, setPendingAction] = useState<{ id: string, status: string } | null>(null);

    const closeAlert = () => {
        setAlert(p => ({ ...p, visible: false }));
        setPendingAction(null);
    };

    useEffect(() => {
        fetchClaims();
    }, []);

    async function fetchClaims() {
        setLoading(true);
        try {
            const r = await fetch("/api/team/travel-claims");
            const data = await r.json();
            if (data.ok) setClaims(data.list || []);
        } catch (e) {
            console.error("Fetch claims failed", e);
        } finally {
            setLoading(false);
        }
    }

    async function handleActionClick(id: string, status: string) {
        setPendingAction({ id, status });
        setAlert({
            visible: true,
            message: `ยืนยันการ${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} รายการนี้?`,
            type: "ok"
        });
    }

    async function executeAction(remark: string) {
        if (!pendingAction) return;
        const { id, status } = pendingAction;

        setLoading(true);
        try {
            const r = await fetch("/api/team/travel-claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, remark })
            });
            const data = await r.json();
            if (data.ok) {
                setMsg({ text: `ดำเนินการเรียบร้อยแล้ว`, type: "ok" });
                fetchClaims();
            } else {
                setMsg({ text: data.error || "เกิดข้อผิดพลาด", type: "bad" });
            }
        } catch (e: any) {
            setMsg({ text: e.message, type: "bad" });
        } finally {
            closeAlert();
        }
    }

    return (
        <div className={styles.page}>
            <AlertModal
                alert={alert}
                onClose={closeAlert}
                onConfirmInput={pendingAction ? executeAction : undefined}
                inputPlaceholder="ระบุหมายเหตุ/เหตุผล (ถ้ามี)..."
                confirmText={pendingAction ? "ยืนยัน" : "ตกลง"}
            />
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>อนุมัติเบี้ยเลี้ยง (ทีม)</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            สำหรับหัวหน้างานตรวจสอบใบเบิกเบี้ยเลี้ยง/ที่พัก
                        </div>
                    </div>
                </div>

                {msg.text && (
                    <div className={msg.type === "ok" ? styles.msgOk : styles.msgBad}>
                        {msg.text}
                    </div>
                )}

                <div className={styles.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <div className={styles.cardTitle}>รายการรอการพิจารณา ({claims.filter(c => c.status === 'pending_supervisor').length})</div>
                        <button onClick={fetchClaims} disabled={loading} style={{ background: "none", border: "none", color: "#d93025", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                            ↻ รีเฟรช
                        </button>
                    </div>

                    {loading ? (
                        <div className={styles.emptyState}>กำลังโหลดข้อมูล...</div>
                    ) : claims.length === 0 ? (
                        <div className={styles.emptyState}>ไม่มีรายการเบิกจ่ายจากลูกน้อง</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {claims.map((c: any) => (
                                <div key={c.id} className={styles.listItem}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                        <div>
                                            <div className={styles.empName}>{c.employee?.name}</div>
                                            <div className={styles.empId}>ID: {c.emp_id}</div>
                                        </div>
                                        <div className={styles.claimType}>{c.claim_type === 'local' ? '🏢 Local Off-Site' : '✈️ Upcountry Travel'}</div>
                                    </div>

                                    <div className={styles.kv}>
                                        <span className={styles.kvKey}>วันที่:</span>
                                        <span className={styles.kvValBold}>
                                            {format(new Date(c.date), "d MMM yyyy", { locale: th })}
                                            {c.end_date && format(new Date(c.end_date), "d MMM yyyy", { locale: th }) !== format(new Date(c.date), "d MMM yyyy", { locale: th }) && (
                                                <> - {format(new Date(c.end_date), "d MMM yyyy", { locale: th })}</>
                                            )}
                                        </span>

                                        <span className={styles.kvKey}>สถานที่:</span>
                                        <span className={styles.kvVal}>{c.site_name}</span>

                                        <span className={styles.kvKey}>ที่พัก:</span>
                                        <span className={styles.kvVal}>
                                            {c.is_overnight ? (
                                                <span className={styles.purpleText}>ค้างคืน ({Number(c.accommodation_amount).toLocaleString()}.-)</span>
                                            ) : "ไม่ค้างคืน"}
                                        </span>

                                        {c.status !== 'pending_supervisor' && (
                                            <>
                                                <span className={styles.kvKey}>สถานะ:</span>
                                                <span className={`${styles.statusBadge} ${styles["status_" + c.status]}`}>
                                                    {c.status === "pending_admin" ? "รอ HR อนุมัติ" :
                                                        c.status === "approved" ? "อนุมัติแล้ว" :
                                                            c.status === "rejected" ? "ไม่อนุมัติ" : c.status}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    <div style={{ marginBottom: 16 }}>
                                        <a href={c.report_url} target="_blank" className={styles.link}>📄 รายงานปฏิบัติงาน</a>
                                        {c.accommodation_receipt_url && (
                                            <a href={c.accommodation_receipt_url} target="_blank" className={styles.link}>🏨 ใบเสร็จที่พัก</a>
                                        )}
                                    </div>

                                    {c.status === "pending_supervisor" && (
                                        <div className={styles.actions}>
                                            <button onClick={() => handleActionClick(c.id, "approved")} className={styles.btnApprove}>
                                                ✅ อนุมัติ
                                            </button>
                                            <button onClick={() => handleActionClick(c.id, "rejected")} className={styles.btnReject}>
                                                ✕ ไม่อนุมัติ
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
