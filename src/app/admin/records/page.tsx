"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.css";
import { DocumentTextIcon, ArrowDownTrayIcon, FunnelIcon } from "@heroicons/react/24/outline";

interface RecordSummary {
    emp_id: string;
    name: string;
    branch_id: string | null;
    is_active: boolean;
    leave_days: number;
    pending_leave_days: number;
    late_count: number;
    late_mins: number;
    absent_days: number;
    present_days: number;
    total_work_days_period: number;
}

export default function RecordsPage() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Helper to get YYYY-MM formatted string
    const formatMonth = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

    const [rangeType, setRangeType] = useState<"1" | "3" | "6" | "12" | "custom">("3");
    
    // Default custom range to (Current Month - 3) to Current Month
    const [startMonth, setStartMonth] = useState(() => {
        let m = currentMonth - 2;
        let y = currentYear;
        if (m <= 0) {
            m += 12;
            y -= 1;
        }
        return formatMonth(y, m);
    });
    const [endMonth, setEndMonth] = useState(() => formatMonth(currentYear, currentMonth));

    const [data, setData] = useState<RecordSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "ok" | "bad" } | null>(null);

    function showToast(msg: string, type: "ok" | "bad" = "ok") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    const calcRange = (monthsBack: number) => {
        const eMonth = currentMonth;
        const eYear = currentYear;
        
        // e.g. if monthsBack = 3, start is 2 months before current month to include current month
        let sMonth = currentMonth - (monthsBack - 1);
        let sYear = currentYear;
        
        while (sMonth <= 0) {
            sMonth += 12;
            sYear -= 1;
        }

        setStartMonth(formatMonth(sYear, sMonth));
        setEndMonth(formatMonth(eYear, eMonth));
    };

    useEffect(() => {
        if (rangeType !== "custom") {
            calcRange(Number(rangeType));
        }
    }, [rangeType]);

    async function loadData() {
        if (!startMonth || !endMonth) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/records?start_month=${startMonth}&end_month=${endMonth}`);
            const json = await res.json();
            if (json.ok) {
                setData(json.summary || []);
            } else {
                showToast(json.error || "Failed to load records", "bad");
            }
        } catch (e) {
            showToast("Network error", "bad");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, [startMonth, endMonth]);

    function exportFile(type: "pdf" | "excel") {
        showToast("⏳ กำลังเตรียมไฟล์...");
        const p = new URLSearchParams({ start_month: startMonth, end_month: endMonth });
        window.location.href = `/api/admin/export/records_${type}?${p.toString()}`;
    }

    return (
        <div className={styles.content}>
            {toast && (
                <div className={`${styles.toast} ${toast.type === "bad" ? styles.toastError : ""}`}>
                    {toast.msg}
                </div>
            )}

            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>สถิติย้อนหลัง (Historical Records)</h1>
                    <p className={styles.pageSubtitle}>ดูภาพรวมการลา ขาด สาย ย้อนหลัง</p>
                </div>
                
                <div style={{ display: "flex", gap: "10px" }}>
                    <button className={styles.btnSecondary} onClick={() => exportFile("excel")}>
                        <ArrowDownTrayIcon width={16} /> Excel
                    </button>
                    <button className={styles.btnSecondary} onClick={() => exportFile("pdf")}>
                        <DocumentTextIcon width={16} /> PDF
                    </button>
                </div>
            </div>

            {/* Filter Card */}
            <div className={styles.card} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FunnelIcon width={18} style={{ color: "var(--text3)" }} />
                        <span style={{ fontWeight: 500 }}>ช่วงเวลา:</span>
                    </div>
                    
                    <select 
                        className={styles.input} 
                        style={{ width: "150px" }}
                        value={rangeType}
                        onChange={(e) => setRangeType(e.target.value as any)}
                    >
                        <option value="1">1 เดือนล่าสุด</option>
                        <option value="3">3 เดือนล่าสุด</option>
                        <option value="6">6 เดือนล่าสุด</option>
                        <option value="12">1 ปีล่าสุด</option>
                        <option value="custom">กำหนดเอง</option>
                    </select>

                    {rangeType === "custom" && (
                        <>
                            <input 
                                type="month" 
                                className={styles.input} 
                                value={startMonth}
                                onChange={e => setStartMonth(e.target.value)}
                            />
                            <span>ถึง</span>
                            <input 
                                type="month" 
                                className={styles.input} 
                                value={endMonth}
                                onChange={e => setEndMonth(e.target.value)}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div className={styles.card} style={{ overflow: "hidden", padding: 0 }}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>กำลังโหลด...</div>
                ) : (
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ padding: "16px 20px" }}>รหัสพนักงาน</th>
                                    <th style={{ padding: "16px 20px" }}>ชื่อพนักงาน</th>
                                    <th style={{ padding: "16px 20px" }}>สาขา</th>
                                    <th style={{ padding: "16px 20px" }}>มาทำงาน (วัน)</th>
                                    <th style={{ padding: "16px 20px" }}>ขาดงาน (วัน)</th>
                                    <th style={{ padding: "16px 20px" }}>วันลา (วัน)</th>
                                    <th style={{ padding: "16px 20px" }}>สาย (ครั้ง/นาที)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map(row => (
                                    <tr key={row.emp_id}>
                                        <td style={{ padding: "16px 20px", fontWeight: 500 }}>{row.emp_id}</td>
                                        <td style={{ padding: "16px 20px" }}>{row.name}</td>
                                        <td style={{ padding: "16px 20px", color: "var(--text3)" }}>{row.branch_id || "-"}</td>
                                        
                                        <td style={{ padding: "16px 20px" }}>{row.present_days}</td>
                                        
                                        <td style={{ padding: "16px 20px" }}>
                                            {row.absent_days > 0 ? (
                                                <span style={{ color: "var(--red)", fontWeight: 500 }}>{row.absent_days}</span>
                                            ) : "0"}
                                        </td>
                                        
                                        <td style={{ padding: "16px 20px" }}>
                                            {row.leave_days > 0 ? (
                                                <span style={{ color: "var(--blue)", fontWeight: 500 }}>{row.leave_days}</span>
                                            ) : "0"}
                                            {row.pending_leave_days > 0 && (
                                                <div style={{ fontSize: 11, color: "var(--orange)" }}>
                                                    รออนุมัติ {row.pending_leave_days}
                                                </div>
                                            )}
                                        </td>
                                        
                                        <td style={{ padding: "16px 20px" }}>
                                            {row.late_count > 0 ? (
                                                <div style={{ color: "var(--orange)", fontWeight: 500 }}>
                                                    {row.late_count} ครั้ง <span style={{ fontSize: 12, color: "var(--text5)", fontWeight: 400 }}>({row.late_mins} นาที)</span>
                                                </div>
                                            ) : "-"}
                                        </td>
                                    </tr>
                                ))}
                                {data.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ padding: 30, textAlign: "center", color: "var(--text5)" }}>ไม่พบข้อมูลในช่วงเวลานี้</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
