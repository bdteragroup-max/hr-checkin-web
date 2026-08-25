"use client";

import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
    PlusCircleIcon,
    ArrowPathIcon,
    PaperClipIcon,
    PencilSquareIcon,
    BanknotesIcon
} from "@heroicons/react/24/outline";
import {
    getMyTeamClaims,
    getMyTeamMembers,
    createDepreciationClaim,
    resubmitClaim
} from "@/app/actions/depreciation-claims";

export default function TeamDepreciationClaimsPage() {
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [msg, setMsg] = useState({ text: "", type: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [resubmitId, setResubmitId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        emp_id: "",
        amount: "",
        claim_month: format(new Date(), "yyyy-MM"),
        file: null as File | null
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    async function fetchInitialData() {
        setLoading(true);
        try {
            const [claimsData, membersData] = await Promise.all([
                getMyTeamClaims(),
                getMyTeamMembers()
            ]);
            setClaims(claimsData || []);
            setMembers(membersData || []);
        } catch (e: any) {
            console.error(e);
            setMsg({ text: "ไม่สามารถโหลดข้อมูลได้: " + e.message, type: "bad" });
        } finally {
            setLoading(false);
        }
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const allowedTypes = [
                "image/jpeg", 
                "image/png", 
                "application/pdf",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ];

            if (!allowedTypes.includes(file.type)) {
                alert("กรุณาอัปโหลดไฟล์ JPG, PNG, PDF หรือ Excel เท่านั้น");
                e.target.value = "";
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert("ไฟล์ต้องมีขนาดไม่เกิน 10MB");
                e.target.value = "";
                return;
            }

            setFormData({ ...formData, file });
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg({ text: "", type: "" });

        if (!resubmitId && !formData.emp_id) {
            alert("กรุณาเลือกพนักงาน");
            return;
        }
        if (!formData.amount || Number(formData.amount) <= 0) {
            alert("กรุณาระบุจำนวนเงินที่ถูกต้อง");
            return;
        }
        if (!formData.file) {
            alert("กรุณาแนบไฟล์เอกสาร");
            return;
        }

        setIsSubmitting(true);
        try {
            // Upload file first
            const uploadData = new FormData();
            uploadData.append("file", formData.file);

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: uploadData
            });
            const uploadJson = await uploadRes.json();

            if (!uploadRes.ok || !uploadJson.url) {
                throw new Error("อัปโหลดไฟล์ไม่สำเร็จ: " + (uploadJson.error || ""));
            }

            const receipt_url = uploadJson.url;
            const amount = Number(formData.amount);

            if (resubmitId) {
                await resubmitClaim(resubmitId, { amount, receipt_url });
                setMsg({ text: "แก้ไขและส่งคำขอเรียบร้อยแล้ว", type: "ok" });
            } else {
                const claimMonth = new Date(formData.claim_month + "-01");
                await createDepreciationClaim({
                    emp_id: formData.emp_id,
                    amount,
                    receipt_url,
                    claim_month: claimMonth
                });
                setMsg({ text: "ส่งคำขอเรียบร้อยแล้ว", type: "ok" });
            }

            setShowForm(false);
            setResubmitId(null);
            setFormData({ emp_id: "", amount: "", claim_month: format(new Date(), "yyyy-MM"), file: null });
            fetchInitialData();

        } catch (e: any) {
            console.error(e);
            setMsg({ text: e.message || "เกิดข้อผิดพลาดในการบันทึก", type: "bad" });
        } finally {
            setIsSubmitting(false);
        }
    }

    function openResubmit(claim: any) {
        setFormData({
            emp_id: claim.emp_id,
            amount: claim.amount.toString(),
            claim_month: format(new Date(claim.claim_month), "yyyy-MM"),
            file: null
        });
        setResubmitId(claim.id);
        setShowForm(true);
        window.scrollTo(0, 0);
    }

    return (
        <div className={styles.page}>
            <div className={styles.wrap}>
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>ค่าเสื่อม/ค่าน้ำมัน (ทีม)</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            ส่งและติดตามรายการขอเบิกค่าเสื่อมของพนักงานในทีม
                        </div>
                    </div>
                </div>

                {msg.text && (
                    <div className={msg.type === "ok" ? styles.msgOk : styles.msgBad}>
                        {msg.text}
                    </div>
                )}

                {showForm ? (
                    <div className={styles.card}>
                        <div className={styles.cardTitle} style={{ marginBottom: 16 }}>
                            {resubmitId ? "แก้ไขและส่งคำขอใหม่" : "สร้างคำขอเบิกใหม่"}
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>พนักงาน</label>
                                <select
                                    className={styles.select}
                                    value={formData.emp_id}
                                    onChange={e => setFormData({ ...formData, emp_id: e.target.value })}
                                    disabled={!!resubmitId}
                                    required
                                >
                                    <option value="">-- เลือกพนักงานในทีม --</option>
                                    {members.map(m => (
                                        <option key={m.emp_id} value={m.emp_id}>
                                            {m.name} {m.nickname ? `(${m.nickname})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>จำนวนเงิน (บาท)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={styles.input}
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>เดือนที่ขอเบิก</label>
                                <input
                                    type="month"
                                    className={styles.input}
                                    value={formData.claim_month}
                                    onChange={e => setFormData({ ...formData, claim_month: e.target.value })}
                                    disabled={!!resubmitId}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>ไฟล์เอกสาร (PDF, JPG, PNG, Excel ไม่เกิน 10MB)</label>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                                    className={styles.fileInput}
                                    onChange={handleFileChange}
                                    required
                                />
                            </div>

                            <div className={styles.actions}>
                                <button type="submit" className={styles.btnPrimary} disabled={isSubmitting}>
                                    {isSubmitting ? "กำลังส่ง..." : "ยืนยันการส่ง"}
                                </button>
                                <button type="button" className={styles.btnSecondary} onClick={() => {
                                    setShowForm(false);
                                    setResubmitId(null);
                                }}>
                                    ยกเลิก
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className={styles.card}>
                        <div className={styles.cardTitle} style={{ margin: "0 0 16px 0" }}>
                            <div>รายการขอเบิกของคุณ</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <button onClick={() => fetchInitialData()} disabled={loading} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                                    <ArrowPathIcon width={18} className={loading ? "animate-spin" : ""} /> รีเฟรช
                                </button>
                                <button onClick={() => setShowForm(true)} className={styles.btnPrimary} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px" }}>
                                    <PlusCircleIcon width={18} /> ส่งคำขอใหม่
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className={styles.emptyState}>กำลังโหลดข้อมูล...</div>
                        ) : claims.length === 0 ? (
                            <div className={styles.emptyState}>ยังไม่มีรายการขอเบิก</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {claims.map((c: any) => (
                                    <div key={c.id} className={styles.listItem}>
                                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: 12 }}>
                                            <div>
                                                <div className={styles.empName}>{c.employee?.name} {c.employee?.nickname ? `(${c.employee.nickname})` : ""}</div>
                                                <div className={styles.empId}>ID: {c.emp_id}</div>
                                            </div>
                                            <div>
                                                <span className={`${styles.statusBadge} ${styles["status_" + c.status]}`}>
                                                    {c.status === "APPROVED" ? "อนุมัติแล้ว" :
                                                        c.status === "RETURNED" ? "ตีกลับเพื่อแก้ไข" : "รออนุมัติ"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={styles.kv}>
                                            <span className={styles.kvKey}>เดือนที่ขอเบิก:</span>
                                            <span className={styles.kvValBold}>{format(new Date(c.claim_month), "MMMM yyyy", { locale: th })}</span>

                                            <span className={styles.kvKey}>จำนวนเงิน:</span>
                                            <span className={styles.redText}>฿{Number(c.amount).toLocaleString()}.-</span>

                                            <span className={styles.kvKey}>วันที่ยื่น:</span>
                                            <span className={styles.kvValBold}>{format(new Date(c.created_at), "d MMM yyyy (HH:mm)", { locale: th })}</span>
                                        </div>

                                        {c.status === "RETURNED" && c.return_reason && (
                                            <div style={{ marginTop: 12, padding: 12, background: "#fee2e2", borderRadius: 8, fontSize: 14, color: "#991b1b" }}>
                                                <strong>เหตุผลที่ตีกลับ:</strong> {c.return_reason}
                                            </div>
                                        )}

                                        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <a href={c.receipt_url} target="_blank" className={styles.link} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <PaperClipIcon width={16} /> ดูไฟล์แนบ
                                            </a>

                                            {c.status === "RETURNED" && (
                                                <button onClick={() => openResubmit(c)} className={styles.btnSecondary} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: "6px 12px", fontSize: 13 }}>
                                                    <PencilSquareIcon width={16} /> แก้ไขและส่งใหม่
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
