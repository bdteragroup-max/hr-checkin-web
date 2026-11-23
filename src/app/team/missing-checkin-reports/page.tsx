"use client";

import React, { useState, useEffect } from "react";
import styles from "../travel-claims/page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import AlertModal, { AlertState } from "@/components/AlertModal";
import {
    CheckCircleIcon,
    XCircleIcon,
    DocumentTextIcon,
    ArrowPathIcon,
    ClockIcon,
    HashtagIcon
} from "@heroicons/react/24/outline";

const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

function formatPeriodMonthThai(periodMonth?: string): string {
    if (!periodMonth || !periodMonth.includes("-")) return periodMonth || "-";
    const [y, m] = periodMonth.split("-").map(Number);
    if (!y || !m) return periodMonth;
    return `${THAI_MONTHS[m - 1] || m} ${y + 543}`;
}

function formatDateDMY(dateStr?: string): string {
    if (!dateStr) return "-";
    const clean = String(dateStr).slice(0, 10);
    const parts = clean.split("-");
    if (parts.length !== 3) return String(dateStr);
    const [y, m, d] = parts;
    const yearNum = parseInt(y, 10);
    if (isNaN(yearNum)) return String(dateStr);
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${yearNum + 543}`;
}

export default function TeamMissingCheckinReportsPage() {
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<any[]>([]);
    const [msg, setMsg] = useState({ text: "", type: "" });

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const [pendingAction, setPendingAction] = useState<{ id: string; status: string } | null>(null);

    const closeAlert = () => {
        setAlert(p => ({ ...p, visible: false }));
        setPendingAction(null);
    };

    useEffect(() => {
        fetchReports();
    }, []);

    async function fetchReports() {
        setLoading(true);
        try {
            const r = await fetch("/api/team/missing-checkin-reports");
            const data = await r.json();
            if (data.ok) setReports(data.list || []);
        } catch (e) {
            console.error("Fetch reports failed", e);
        } finally {
            setLoading(false);
        }
    }

    function handleActionClick(id: string, status: string) {
        setPendingAction({ id, status });
        setAlert({
            visible: true,
            message: status === "approved"
                ? "ยืนยันการอนุมัติและส่งต่อเอกสารนี้ให้ฝ่ายบุคคล (HR)?"
                : "ยืนยันการไม่อนุมัติเอกสารนี้?",
            type: "ok"
        });
    }

    async function executeAction(remark: string) {
        if (!pendingAction) return;
        const { id, status } = pendingAction;

        setLoading(true);
        try {
            const r = await fetch("/api/team/missing-checkin-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, remark })
            });
            const data = await r.json();
            if (data.ok) {
                setMsg({
                    text: status === "approved" ? "อนุมัติและส่งต่อให้ HR เรียบร้อยแล้ว" : "ปฏิเสธรายการเรียบร้อยแล้ว",
                    type: "ok"
                });
                fetchReports();
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
                inputPlaceholder="ระบุความเห็น/หมายเหตุถึง HR หรือพนักงาน (ถ้ามี)..."
                confirmText={pendingAction ? "ยืนยัน" : "ตกลง"}
            />
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>อนุมัติรายงานการทำงาน (ทีม)</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            สำหรับหัวหน้างานตรวจสอบรายงานการทำงานกรณีลงเวลาใน Human Soft ไม่ครบ และส่งต่อให้ HR
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
                        <div className={styles.cardTitle}>
                            รายการรอการพิจารณา ({reports.filter(r => r.status === "pending_supervisor").length})
                        </div>
                        <button
                            onClick={fetchReports}
                            disabled={loading}
                            style={{ background: "none", border: "none", color: "#d93025", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                        >
                            <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} /> รีเฟรช
                        </button>
                    </div>

                    {loading ? (
                        <div className={styles.emptyState}>กำลังโหลดข้อมูล...</div>
                    ) : reports.length === 0 ? (
                        <div className={styles.emptyState}>ไม่มีรายการรายงานการทำงานจากลูกน้อง</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {reports.map((r: any) => (
                                <div key={r.id} className={styles.listItem}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                                        <div>
                                            <div className={styles.empName}>{r.employee?.name}</div>
                                            <div className={styles.empId}>ID: {r.emp_id} {r.employee?.departments?.name ? `· ${r.employee.departments.name}` : ""}</div>
                                        </div>
                                        <div className={styles.claimType} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                            <HashtagIcon width={15} /> {r.doc_no}
                                        </div>
                                    </div>

                                    <div className={styles.kv}>
                                        <span className={styles.kvKey}>รอบเดือน / จำนวนวัน:</span>
                                        <span className={styles.kvValBold}>
                                            {r.period_month ? `เดือน${formatPeriodMonthThai(r.period_month)}` : formatDateDMY(r.work_date)}
                                            {Array.isArray(r.items) && r.items.length > 0 ? ` (รวม ${r.items.length} วัน)` : ""}
                                        </span>

                                        <span className={styles.kvKey}>รายการวันที่แจ้ง:</span>
                                        <div className={styles.kvVal} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {(Array.isArray(r.items) && r.items.length > 0 ? r.items : [{
                                                work_date: r.work_date,
                                                check_in_time: r.check_in_time,
                                                check_out_time: r.check_out_time,
                                                work_details: r.work_details
                                            }]).map((it: any, idx: number) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        background: "#f8fafc",
                                                        border: "1px solid #e2e8f0",
                                                        borderRadius: 8,
                                                        padding: "8px 10px"
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                                                        <span style={{ fontWeight: 700, color: "#0f172a" }}>
                                                            {idx + 1}. {formatDateDMY(it.work_date)}
                                                        </span>
                                                        <span style={{ fontWeight: 700, color: "#1d4ed8", fontSize: 12 }}>
                                                            <ClockIcon width={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />
                                                            {it.check_in_time} - {it.check_out_time} น.
                                                        </span>
                                                    </div>
                                                    <div style={{ marginTop: 3, whiteSpace: "pre-wrap", color: "#334155", fontSize: 13 }}>
                                                        {it.work_details}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {r.status !== "pending_supervisor" && (
                                            <>
                                                <span className={styles.kvKey}>สถานะ:</span>
                                                <span className={`${styles.statusBadge} ${styles["status_" + (r.status === "pending_hr" ? "pending_admin" : r.status)]}`}>
                                                    {r.status === "pending_hr" ? "อนุมัติแล้ว (ส่งต่อให้ HR)" :
                                                     r.status === "approved" ? "HR อนุมัติเรียบร้อยแล้ว" :
                                                     r.status === "rejected" ? "ไม่อนุมัติ" : r.status}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {r.evidence_urls && (
                                        <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                            {r.evidence_urls.split(",").map((url: string, index: number) => (
                                                <a
                                                    key={index}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className={styles.link}
                                                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                                                >
                                                    <DocumentTextIcon width={16} /> หลักฐานการทำงาน / Timeline ({index + 1})
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {r.status === "pending_supervisor" && (
                                        <div className={styles.actions}>
                                            <button
                                                onClick={() => handleActionClick(r.id, "approved")}
                                                className={styles.btnApprove}
                                                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                                            >
                                                <CheckCircleIcon width={18} /> อนุมัติและส่งต่อ HR
                                            </button>
                                            <button
                                                onClick={() => handleActionClick(r.id, "rejected")}
                                                className={styles.btnReject}
                                                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                                            >
                                                <XCircleIcon width={18} /> ไม่อนุมัติ
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
