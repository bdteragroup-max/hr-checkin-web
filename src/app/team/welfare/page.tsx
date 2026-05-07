"use client";

import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import AlertModal, { AlertState } from "@/components/AlertModal";
import { 
    CheckCircleIcon, 
    XCircleIcon, 
    AcademicCapIcon,
    UserGroupIcon,
    SparklesIcon,
    HandRaisedIcon,
    HeartIcon,
    BanknotesIcon,
    ArrowPathIcon,
    PaperClipIcon
} from "@heroicons/react/24/outline";

type WelfareType = "CHILD_EDUCATION" | "MARRIAGE" | "CHILDBIRTH" | "ORDINATION" | "FUNERAL";

const CHILD_EDU_LEVELS = [
    { id: "P1_3", label: "ประถม (ป.1 - ป.3)", minGpa: 3.85 },
    { id: "P4_6", label: "ประถม (ป.4 - ป.6)", minGpa: 3.75 },
    { id: "M1_3", label: "มัธยมต้น (ม.1 - ม.3)", minGpa: 3.50 },
    { id: "M4_6", label: "มัธยมปลาย / ปวช.", minGpa: 3.50 },
    { id: "DIP_BACH", label: "ปวส. / ปริญญาตรี", minGpa: 3.25 },
];

const WELFARE_CONFIG: Record<string, { title: string; icon: any; color: string }> = {
    CHILD_EDUCATION: { title: "ทุนการศึกษาบุตร", icon: AcademicCapIcon, color: "#3b82f6" },
    MARRIAGE: { title: "เงินแสดงความยินดีมงคลสมรส", icon: HeartIcon, color: "#ec4899" },
    CHILDBIRTH: { title: "เงินรับขวัญบุตร", icon: SparklesIcon, color: "#8b5cf6" },
    ORDINATION: { title: "เงินช่วยเหลืองานอุปสมบท", icon: HandRaisedIcon, color: "#f59e0b" },
    FUNERAL: { title: "เงินช่วยเหลืองานฌาปนกิจ", icon: UserGroupIcon, color: "#64748b" }
};

export default function TeamWelfarePage() {
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
            const r = await fetch("/api/team/welfare");
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
            message: `ยืนยันการ${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} รายการสวัสดิการนี้?`,
            type: "ok"
        });
    }

    async function executeAction(remark: string) {
        if (!pendingAction) return;
        const { id, status } = pendingAction;

        setLoading(true);
        try {
            const r = await fetch("/api/team/welfare", {
                method: "PATCH",
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
                    <h1 className={styles.heroH1}>อนุมัติสวัสดิการ (ทีม)</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            ตรวจสอบและพิจารณาคำขอสวัสดิการของพนักงานในทีม
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
                        <div className={styles.cardTitle}>รายการรอการพิจารณา ({claims.filter(c => c.supervisor_status === 'pending').length})</div>
                        <button onClick={fetchClaims} disabled={loading} style={{ background: "none", border: "none", color: "#d93025", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                            <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} /> รีเฟรช
                        </button>
                    </div>

                    {loading ? (
                        <div className={styles.emptyState}>กำลังโหลดข้อมูล...</div>
                    ) : claims.length === 0 ? (
                        <div className={styles.emptyState}>ไม่มีรายการสวัสดิการจากลูกน้อง</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {claims.map((c: any) => (
                                <div key={c.id} className={styles.listItem}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                        <div>
                                            <div className={styles.empName}>{c.employees?.name} {c.employees?.nickname ? `(${c.employees.nickname})` : ""}</div>
                                            <div className={styles.empId}>ID: {c.emp_id}</div>
                                        </div>
                                        <div className={styles.claimType} style={{ color: WELFARE_CONFIG[c.welfare_type]?.color }}>
                                            {(() => {
                                                const Icon = WELFARE_CONFIG[c.welfare_type]?.icon || BanknotesIcon;
                                                return <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon width={16} /> {WELFARE_CONFIG[c.welfare_type]?.title || c.welfare_type}</span>;
                                            })()}
                                        </div>
                                    </div>

                                    <div className={styles.kv}>
                                        <span className={styles.kvKey}>วันที่ยื่น:</span>
                                        <span className={styles.kvValBold}>
                                            {format(new Date(c.created_at), "d MMM yyyy (HH:mm)", { locale: th })}
                                        </span>

                                        <span className={styles.kvKey}>จำนวนเงิน:</span>
                                        <span className={styles.redText}>฿{Number(c.amount).toLocaleString()}.-</span>

                                        {c.metadata && Object.entries(c.metadata as any).map(([k, v]: [string, any]) => {
                                            const labelMap: Record<string, string> = {
                                                child_name: "ชื่อบุตร",
                                                education_level: "ระดับการศึกษา",
                                                gpa: "เกรดเฉลี่ย",
                                                service_years_at_claim: "อายุงาน ณ วันที่ยื่น"
                                            };
                                            const displayKey = labelMap[k] || k;
                                            const displayVal = k === 'education_level' 
                                                ? (CHILD_EDU_LEVELS.find(l => l.id === v)?.label || v) 
                                                : v;
                                            
                                            return (
                                                <React.Fragment key={k}>
                                                    <span className={styles.kvKey}>{displayKey}:</span>
                                                    <span className={styles.kvVal}>{displayVal}</span>
                                                </React.Fragment>
                                            );
                                        })}

                                        <span className={styles.kvKey}>หมายเหตุ:</span>
                                        <span className={styles.kvVal}>{c.remark || "-"}</span>

                                        {c.supervisor_status !== 'pending' && (
                                            <>
                                                <span className={styles.kvKey}>สถานะ:</span>
                                                <span className={`${styles.statusBadge} ${styles["status_" + c.supervisor_status]}`}>
                                                    {c.supervisor_status === "approved" ? "อนุมัติแล้ว" :
                                                     c.supervisor_status === "rejected" ? "ไม่อนุมัติ" : c.supervisor_status}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {c.attachment_url && (
                                        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                            {(c.attachment_url.startsWith('[') ? JSON.parse(c.attachment_url) : [c.attachment_url]).map((url: string, i: number) => (
                                                <a key={i} href={url} target="_blank" className={styles.link} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <PaperClipIcon width={16} /> ไฟล์แนบ {i + 1}
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {c.supervisor_status === "pending" && (
                                        <div className={styles.actions}>
                                            <button onClick={() => handleActionClick(c.id, "approved")} className={styles.btnApprove} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                <CheckCircleIcon width={18} /> อนุมัติ
                                            </button>
                                            <button onClick={() => handleActionClick(c.id, "rejected")} className={styles.btnReject} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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
