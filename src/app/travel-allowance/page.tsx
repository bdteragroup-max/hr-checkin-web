"use client";

import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";

export default function TravelAllowancePage() {
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [msg, setMsg] = useState({ text: "", type: "" });

    // Form states
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [claimType, setClaimType] = useState("local");
    const [siteName, setSiteName] = useState("");
    const [isOvernight, setIsOvernight] = useState(false);
    const [accommodationAmount, setAccommodationAmount] = useState("");
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [hasPreApproval, setHasPreApproval] = useState(false);
    const [isSupervisorShared, setIsSupervisorShared] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    async function fetchHistory() {
        try {
            const r = await fetch("/api/travel-claims");
            const data = await r.json();
            if (data.ok) setHistory(data.list || []);
        } catch (e) {
            console.error("Fetch history failed", e);
        } finally {
            setLoading(false);
        }
    }

    async function uploadFile(file: File, prefix: string) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("prefix", prefix);
        const r = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await r.json();
        if (!data.ok) throw new Error(data.error || "Upload failed");
        return data.url;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg({ text: "", type: "" });

        if (!siteName) return setMsg({ text: "กรุณาระบุชื่อลูกค้า/สถานที่", type: "bad" });
        if (!reportFile) return setMsg({ text: "กรุณาแนบรายงานผลการปฏิบัติงาน", type: "bad" });

        if (isOvernight && !receiptFile && Number(accommodationAmount) > 0) {
            return setMsg({ text: "กรุณาแนบใบเสร็จค่าที่พักสำหรับการค้างคืน", type: "bad" });
        }

        if (isOvernight && endDate < date) {
            return setMsg({ text: "วันที่เดินทางกลับต้องไม่ก่อนวันที่เริ่มต้น", type: "bad" });
        }

        setIsSubmitting(true);
        try {
            const reportUrl = await uploadFile(reportFile, "report");
            let receiptUrl = null;
            if (receiptFile) {
                receiptUrl = await uploadFile(receiptFile, "receipt");
            }

            const body = {
                date,
                end_date: isOvernight ? endDate : date,
                claim_type: claimType,
                site_name: siteName,
                is_overnight: isOvernight,
                accommodation_amount: accommodationAmount,
                accommodation_receipt_url: receiptUrl,
                report_url: reportUrl,
                has_pre_approval: hasPreApproval,
                is_supervisor_shared: isSupervisorShared
            };

            const r = await fetch("/api/travel-claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await r.json();
            if (data.ok) {
                setMsg({ text: "ส่งคำขอเรียบร้อยแล้ว", type: "ok" });
                setSiteName("");
                setAccommodationAmount("");
                setReportFile(null);
                setReceiptFile(null);
                setIsOvernight(false);
                fetchHistory();
            } else {
                setMsg({ text: data.error || "เกิดข้อผิดพลาด", type: "bad" });
            }
        } catch (error: any) {
            setMsg({ text: error.message, type: "bad" });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (loading) return <div className={styles.loading}>กำลังโหลดข้อมูล...</div>;

    return (
        <div className={styles.page}>
            <div className={styles.wrap}>
                {/* ── HERO ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>เบี้ยเลี้ยง & ค่าเดินทาง</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            ระบบเบิกเบี้ยเลี้ยงออกหน้างานและต่างจังหวัด
                        </div>
                    </div>
                </div>

                {msg.text && (
                    <div className={msg.type === "ok" ? styles.msgOk : styles.msgBad}>
                        {msg.text}
                    </div>
                )}

                <form className={styles.card} onSubmit={handleSubmit}>
                    <div className={styles.cardTitle}>รายละเอียดการขอเบิก</div>

                    <div className={styles.form}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>วันที่ไปปฏิบัติงาน</label>
                            <input type="date" className={styles.input} value={date} onChange={e => setDate(e.target.value)} required />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>ประเภทการเบิก</label>
                            <select className={styles.select} value={claimType} onChange={e => setClaimType(e.target.value)}>
                                <option value="local">ออกหน้างานปกติ (Local)</option>
                                <option value="upcountry">ไปต่างจังหวัด (Upcountry)</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>ชื่อลูกค้า / สถานที่</label>
                            <input type="text" className={styles.input} placeholder="เช่น บจก. เอบีซี กรุงเทพฯ" value={siteName} onChange={e => setSiteName(e.target.value)} required />
                        </div>

                        <div className={styles.formGroup}>
                            <div className={`${styles.checkboxGroup} ${isOvernight ? styles.checkboxGroupWhite : ""}`} onClick={() => {
                                const newVal = !isOvernight;
                                setIsOvernight(newVal);
                                if (newVal) setEndDate(date);
                            }}>
                                <input type="checkbox" className={styles.checkbox} checked={isOvernight} readOnly />
                                <span className={styles.checkboxLabel}>เป็นการค้างคืน (Overnight)</span>
                            </div>
                        </div>

                        {isOvernight && (
                            <div className={styles.formGroup} style={{ animation: "fadeIn 0.3s ease" }}>
                                <label className={styles.label}>วันที่เดินทางกลับ (Return Date)</label>
                                <input type="date" className={styles.input} value={endDate} onChange={e => setEndDate(e.target.value)} required />
                            </div>
                        )}

                        {isOvernight && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeIn 0.3s ease" }}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>ค่าที่พัก (ตามจริง ไม่เกิน 600.- / คน)</label>
                                    <input type="number" className={styles.input} placeholder="ระบุจำนวนเงิน" value={accommodationAmount} onChange={e => setAccommodationAmount(e.target.value)} />
                                </div>

                                <div className={styles.formGroup}>
                                    <div className={`${styles.checkboxGroup} ${isSupervisorShared ? styles.checkboxGroupWhite : ""}`} onClick={() => setIsSupervisorShared(!isSupervisorShared)}>
                                        <input type="checkbox" className={styles.checkbox} checked={isSupervisorShared} readOnly />
                                        <span className={styles.checkboxLabel}>พักร่วมกับหัวหน้า (กรณีเบิกเกิน 600.-)</span>
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>แนบใบเสร็จค่าที่พัก</label>
                                    <div className={styles.fileInputWrapper}>
                                        <input
                                            type="file"
                                            className={styles.fileInput}
                                            accept="image/*,.pdf"
                                            onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                                        />
                                        <div className={styles.uploadIcon}>📄</div>
                                        <div className={`${styles.fileHint} ${receiptFile ? styles.fileHintSuccess : ''}`}>
                                            {receiptFile ? `✅ ${receiptFile.name}` : "คลิกหรือวางใบเสร็จที่นี่"}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <div className={`${styles.checkboxGroup} ${hasPreApproval ? styles.checkboxGroupWhite : ""}`} onClick={() => setHasPreApproval(!hasPreApproval)}>
                                        <input type="checkbox" className={styles.checkbox} checked={hasPreApproval} readOnly />
                                        <span className={styles.checkboxLabel}>ได้รับการอนุมัติล่วงหน้า (กรณีพักเกิน 2 คืน)</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={styles.formGroup}>
                            <label className={styles.label}>แนบรายงานผลการปฏิบัติงาน (บังคับ)</label>
                            <div className={styles.fileInputWrapper}>
                                <input
                                    type="file"
                                    className={styles.fileInput}
                                    accept="image/*,.pdf"
                                    onChange={e => setReportFile(e.target.files?.[0] || null)}
                                />
                                <div className={styles.uploadIcon}>📋</div>
                                <div className={`${styles.fileHint} ${reportFile ? styles.fileHintSuccess : ''}`}>
                                    {reportFile ? `✅ ${reportFile.name}` : "คลิกหรือวางรายงานที่นี่"}
                                </div>
                            </div>
                        </div>

                        <button type="submit" className={styles.btnPrimary} style={{ marginTop: 10 }} disabled={isSubmitting}>
                            {isSubmitting ? "กำลังส่งคำขอ..." : "ส่งคำขอเบิก"}
                        </button>
                    </div>
                </form>

                <div className={styles.historySection}>
                    <h2 className={styles.cardTitle} style={{ margin: "32px 0 16px", paddingLeft: 4 }}>ประวัติการเบิก</h2>

                    {history.length === 0 ? (
                        <div className={styles.empty}>ไม่มีประวัติการเบิก</div>
                    ) : (
                        <div className={styles.historyList}>
                            {history.map((h: any) => (
                                <div key={h.id} className={styles.historyCard}>
                                    <div className={styles.historyInfo}>
                                        <div className={styles.historyDate}>
                                            {format(new Date(h.date), "d MMM yyyy", { locale: th })}
                                        </div>
                                        <div className={styles.historySite}>
                                            {h.site_name} · <span style={{ textTransform: 'uppercase' }}>{h.claim_type}</span>
                                        </div>
                                    </div>
                                    <div className={`${styles.statusBadge} ${styles["status_" + h.status]}`}>
                                        {h.status === "pending_supervisor" ? "รอหัวหน้า" :
                                            h.status === "pending_admin" ? "รอ Admin" :
                                                h.status === "approved" ? "อนุมัติแล้ว" :
                                                    h.status === "rejected" ? "ปฏิเสธ" : h.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
