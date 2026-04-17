"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { ArrowDownTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export default function PayslipPage() {
    const [list, setList] = useState<{month: number, year: number}[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPayslips() {
            setLoading(true);
            try {
                const res = await fetch("/api/payroll/list");
                if (res.ok) {
                    const data = await res.json();
                    setList(data.list || []);
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        }
        fetchPayslips();
    }, []);

    const handleDownload = (month: number, year: number) => {
        // Direct to API that returns PDF
        window.open(`/api/payroll/download?month=${month}&year=${year}`, "_blank");
    };

    if (loading) {
        return (
            <div className={styles.wrapper}>
                <div className={styles.wrap} style={{ paddingTop: 80, textAlign: "center", color: "var(--text3)" }}>
                    กำลังโหลด...
                </div>
            </div>
        );
    }

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>สลิปเงินเดือน</h1>
                </div>

                <div className={styles.card}>
                    <div className={styles.sectionLabel} style={{ color: "var(--red)" }}>
                        <div className={styles.dot} style={{ background: "var(--red)" }} />
                        <span>My Payslips</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16 }}>
                        รายการสลิปเงินเดือนของคุณที่ได้รับการอนุมัติ และเผยแพร่โดยฝ่ายบุคคลแล้ว
                    </div>

                    {list.length === 0 ? (
                        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text4)" }}>
                            <DocumentTextIcon width={48} style={{ margin: "0 auto", marginBottom: 12, opacity: 0.5 }} />
                            <p style={{ marginBottom: 16 }}>ยังไม่มีสลิปเงินเดือนที่สามารถดาวน์โหลดได้ในขณะนี้</p>
                            <div style={{ fontSize: 13, color: "var(--text4)", fontStyle: "italic", marginBottom: 20 }}>
                                (หากคุณเพิ่งได้รับแจ้งเตือน กรุณาลองกดรีเฟรชหรือตรวจสอบกับฝ่ายบุคคล)
                            </div>
                            <button 
                                className={styles.btnSecondary} 
                                style={{ width: "auto", margin: "0 auto", padding: "8px 20px" }}
                                onClick={() => window.location.reload()}
                            >
                                รีเฟรชหน้านี้
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {list.map((item, i) => (
                                <div key={i} style={{ padding: "16px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--gray-200)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--gray-50)", boxShadow: "var(--shadow-sm)" }}>
                                    <div style={{ fontWeight: 700, color: "var(--text2)", fontSize: 15, fontFamily: "var(--font-display)" }}>
                                        ประจำเดือน{THAI_MONTHS[item.month - 1]} {item.year + 543}
                                    </div>
                                    <button className={styles.btnPrimary} style={{ padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, width: "auto" }} onClick={() => handleDownload(item.month, item.year)}>
                                        <ArrowDownTrayIcon width={16} /> ดาวน์โหลด PDF
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
