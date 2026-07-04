"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import styles from "./page.module.css";
import { 
    DocumentTextIcon, 
    ArrowDownTrayIcon, 
    CheckCircleIcon,
    Bars3CenterLeftIcon,
    MagnifyingGlassIcon,
    ChevronDownIcon,
    UserGroupIcon,
    CalendarIcon,
    InboxIcon,
    ExclamationTriangleIcon
} from "@heroicons/react/24/outline";

interface Employee {
    emp_id: string;
    name: string;
    is_checkin_exempt: boolean;
}

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

export default function TeamRecordsPage() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const formatDate = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const [rangeType, setRangeType] = useState<"1" | "3" | "6" | "12" | "custom" | "single">("1");
    
    const [startDate, setStartDate] = useState(() => {
        let m = currentMonth - 1;
        let y = currentYear;
        if (m <= 0) { m += 12; y -= 1; }
        return formatDate(y, m, 26);
    });
    const [endDate, setEndDate] = useState(() => formatDate(currentYear, currentMonth, 25));

    const [data, setData] = useState<RecordSummary[]>([]);
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "ok" | "bad" } | null>(null);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filterEmpId, setFilterEmpId] = useState("all");
    
    // Searchable Select States
    const [searchTerm, setSearchTerm] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch("/api/admin/employees?team=1")
            .then(r => r.json())
            .then(json => {
                if (json.ok) setEmployees(json.list || []);
            });
    }, []);

    // Handle outside click to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function showToast(msg: string, type: "ok" | "bad" = "ok") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    const calcRange = (monthsBack: number) => {
        const eMonth = currentMonth;
        const eYear = currentYear;
        let sMonth = currentMonth - monthsBack;
        let sYear = currentYear;
        while (sMonth <= 0) { sMonth += 12; sYear -= 1; }
        setStartDate(formatDate(sYear, sMonth, 26));
        setEndDate(formatDate(eYear, eMonth, 25));
    };

    useEffect(() => {
        if (rangeType === "single") {
            setEndDate(startDate);
        } else if (rangeType !== "custom") {
            calcRange(Number(rangeType));
        }
    }, [rangeType]);

    async function loadData() {
        if (!startDate || !endDate) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/records?start_date=${startDate}&end_date=${endDate}&team=1`);
            const json = await res.json();
            if (json.ok) setData(json.summary || []);
            else showToast(json.error || "Failed to load records", "bad");

            if (filterEmpId !== "all") {
                const resDet = await fetch(`/api/admin/records/details?emp_id=${filterEmpId}&start_date=${startDate}&end_date=${endDate}&team=1`);
                const jsonDet = await resDet.json();
                if (jsonDet.ok) setDetails(jsonDet.details || []);
            }
        } catch (e) {
            showToast("Network error", "bad");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, [startDate, endDate, filterEmpId]);

    async function exportFile(type: "pdf" | "excel") {
        showToast("กำลังเตรียมไฟล์...");
        const p = new URLSearchParams({ start_date: startDate, end_date: endDate, team: "1" });
        if (filterEmpId !== "all") p.set("emp_id", filterEmpId);
        
        try {
            const res = await fetch(`/api/admin/export/records_${type}?${p.toString()}`);
            if (!res.ok) {
                showToast("ดาวน์โหลดไฟล์ไม่สำเร็จ", "bad");
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            // Content-Disposition usually has the filename, but we can provide a fallback
            const contentDisposition = res.headers.get('Content-Disposition');
            let filename = `records_${new Date().getTime()}.${type === "pdf" ? "pdf" : "xlsx"}`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            showToast("เกิดข้อผิดพลาดในการดาวน์โหลด", "bad");
        }
    }

    const filteredEmployees = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        const activeEmps = employees.filter(e => !e.is_checkin_exempt);
        if (!term) return activeEmps;
        return activeEmps.filter(e => 
            e.emp_id.toLowerCase().includes(term) || 
            e.name.toLowerCase().includes(term)
        );
    }, [employees, searchTerm]);

    const selectedEmployeeName = useMemo(() => {
        if (filterEmpId === "all") return "ทุกคนในทีม (สรุปภาพรวม)";
        const found = employees.find(e => e.emp_id === filterEmpId);
        return found ? `${found.emp_id} - ${found.name}` : filterEmpId;
    }, [employees, filterEmpId]);

    const sortedDetails = useMemo(() => {
        return [...details].sort((a, b) => a.date.localeCompare(b.date));
    }, [details]);

    const selectedSummaryData = useMemo(() => {
        if (filterEmpId === "all") return data;
        return data.filter(d => d.emp_id === filterEmpId);
    }, [data, filterEmpId]);

    return (
        <div className={styles.content}>
            {toast && (
                <div className={`${styles.toast} ${styles[toast.type]}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {toast.type === "ok" ? <CheckCircleIcon width={20} /> : <ExclamationTriangleIcon width={20} />}
                    {toast.msg}
                </div>
            )}

            <div className={styles.pageHeader}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <h1 className={styles.pageTitle}>ประวัติการเช็คอินทีม (Team Records)</h1>
                    <div className={styles.pageSubtitle}>ตรวจสอบและวิเคราะห์สถิติการเข้างานย้อนหลังของทีมงานในความดูแล</div>
                </div>
                
                <div style={{ display: "flex", gap: "12px" }}>
                    <button className={styles.btnExcelSm} onClick={() => exportFile("excel")}>
                        <ArrowDownTrayIcon width={16} /> Export Excel
                    </button>
                    <button className={styles.btnPdfSm} onClick={() => exportFile("pdf")}>
                        <DocumentTextIcon width={16} /> Export PDF
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div className={styles.filterBar} style={{ background: "var(--surface)", padding: "24px", borderRadius: "18px", border: "1px solid var(--line)", marginBottom: 32, boxShadow: "var(--shadow-sm)" }}>
                <div className={styles.filterGroup}>
                    <div className={styles.filterLabel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CalendarIcon width={14} /> ช่วงเวลา
                    </div>
                    <select 
                        className={styles.input} 
                        style={{ width: "180px" }}
                        value={rangeType}
                        onChange={(e) => setRangeType(e.target.value as any)}
                    >
                        <option value="1">1 เดือนล่าสุด</option>
                        <option value="3">3 เดือนล่าสุด</option>
                        <option value="6">6 เดือนล่าสุด</option>
                        <option value="12">1 ปีล่าสุด</option>
                        <option value="custom">กำหนดช่วงเวลา...</option>
                        <option value="single">เลือกวันเดียว</option>
                    </select>
                </div>

                {rangeType === "custom" && (
                    <div className={styles.filterGroup} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 20 }}>
                        <input type="date" className={styles.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <span style={{ color: "var(--text4)", fontSize: 13, fontWeight: 600 }}>ถึง</span>
                        <input type="date" className={styles.input} value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                )}

                {rangeType === "single" && (
                    <div className={styles.filterGroup} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 20 }}>
                        <input 
                            type="date" 
                            className={styles.input} 
                            value={startDate} 
                            onChange={e => {
                                setStartDate(e.target.value);
                                setEndDate(e.target.value);
                            }} 
                        />
                    </div>
                )}

                <div className={styles.separator} style={{ width: 1, height: 40, background: "var(--line)", alignSelf: "center", margin: "18px 8px 0" }} />

                <div className={styles.filterGroup} style={{ position: "relative", flex: 1, maxWidth: 450 }} ref={dropdownRef}>
                    <div className={styles.filterLabel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <UserGroupIcon width={14} /> เลือกพนักงานในทีม
                    </div>
                    <div 
                        className={styles.input} 
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: isDropdownOpen ? "var(--surface2)" : "var(--surface)" }}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                        <span style={{ color: filterEmpId === "all" ? "var(--text3)" : "var(--text)", fontWeight: 700 }}>{selectedEmployeeName}</span>
                        <ChevronDownIcon width={16} style={{ color: "var(--text4)", transform: isDropdownOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                    </div>

                    {isDropdownOpen && (
                        <div style={{ 
                            position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", 
                            border: "1.5px solid var(--line2)", borderRadius: "12px", marginTop: 8, 
                            boxShadow: "var(--shadow-md)", zIndex: 1000, overflow: "hidden" 
                        }}>
                            <div style={{ padding: 12, borderBottom: "1px solid var(--line)", background: "var(--surface2)" }}>
                                <div style={{ position: "relative" }}>
                                    <MagnifyingGlassIcon width={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text4)" }} />
                                    <input 
                                        type="text" 
                                        placeholder="พิมพ์เพื่อหาชื่อหรือรหัสพนักงาน..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                        style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid var(--line2)", borderRadius: "10px", fontSize: 14, outline: "none" }}
                                    />
                                </div>
                            </div>
                            <div style={{ maxHeight: 320, overflowY: "auto" }}>
                                <div 
                                    style={{ padding: "12px 20px", cursor: "pointer", fontSize: 14, fontWeight: filterEmpId === "all" ? 800 : 600, color: filterEmpId === "all" ? "var(--red)" : "var(--text2)", background: filterEmpId === "all" ? "var(--red-lt)" : "transparent" }}
                                    onClick={() => { setFilterEmpId("all"); setIsDropdownOpen(false); setSearchTerm(""); }}
                                >
                                    ทุกคนในทีม (สรุปภาพรวม)
                                </div>
                                {filteredEmployees.length === 0 ? (
                                    <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--text4)", fontSize: 13 }}>ไม่พบข้อมูลพนักงาน</div>
                                ) : filteredEmployees.map(e => (
                                    <div 
                                        key={e.emp_id} 
                                        style={{ padding: "12px 20px", cursor: "pointer", fontSize: 14, borderTop: "1px solid var(--line)", fontWeight: filterEmpId === e.emp_id ? 800 : 600, color: filterEmpId === e.emp_id ? "var(--red)" : "var(--text2)", background: filterEmpId === e.emp_id ? "var(--red-lt)" : "transparent" }}
                                        onClick={() => { setFilterEmpId(e.emp_id); setIsDropdownOpen(false); setSearchTerm(""); }}
                                    >
                                        <span style={{ fontFamily: "monospace", opacity: 0.6, fontSize: 12, marginRight: 10 }}>{e.emp_id}</span>
                                        {e.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Table */}
            {filterEmpId !== "all" && (
                <div className={styles.tableWrap} style={{ marginBottom: 32, position: "relative" }}>
                    {loading && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius)", backdropFilter: "blur(2px)" }}>
                            <div className={styles.loader} style={{ background: "var(--surface)", padding: "16px 24px", borderRadius: "12px", boxShadow: "var(--shadow-md)" }}>
                                <div className={styles.spinner} />กำลังดึงข้อมูลรายละเอียด...
                            </div>
                        </div>
                    )}
                    <div className={styles.tableHeader}>
                        <div className={styles.tableHeaderTitle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <DocumentTextIcon width={22} style={{ color: "var(--red)" }} /> 
                            รายละเอียดรายวันของ: <span style={{ color: "var(--red)", fontWeight: 800 }}>{selectedEmployeeName}</span>
                        </div>
                    </div>
                    
                    <div className={styles.tableScroll}>
                        <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 160 }}>วันที่</th>
                                        <th>บันทึกเช็คอิน</th>
                                        <th>บันทึกเช็คเอาท์</th>
                                        <th>แผนงานประจำวัน</th>
                                        <th style={{ textAlign: "center" }}>สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDetails.map((d, i) => {
                                        const isHighlight = d.is_weekend || d.status.includes("วันหยุด");
                                        return (
                                            <tr key={i} style={{ background: isHighlight ? "var(--surface2)" : "transparent" }}>
                                                <td><span style={{ fontWeight: 700, color: d.is_weekend ? "var(--text4)" : "var(--text)" }}>{d.date}</span></td>
                                                <td>
                                                    {d.in_time ? (
                                                        <>
                                                            <div style={{ fontWeight: 800, color: "var(--ok)", display: "flex", alignItems: "center", gap: 6 }}>
                                                                {d.in_time}
                                                                {d.is_trip && <span style={{ fontSize: 10, background: "var(--red)", color: "#fff", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.5 }}>TRIP</span>}
                                                            </div>
                                                            <div style={{ fontSize: 12, color: "var(--text4)", marginTop: 4 }}>{d.in_loc || "-"}</div>
                                                        </>
                                                    ) : <span style={{ color: "var(--text5)" }}>—</span>}
                                                </td>
                                                <td>
                                                    {d.out_time ? (
                                                        <>
                                                            <div style={{ fontWeight: 800, color: "var(--warn)" }}>{d.out_time}</div>
                                                            <div style={{ fontSize: 12, color: "var(--text4)", marginTop: 4 }}>{d.out_loc || "-"}</div>
                                                        </>
                                                    ) : <span style={{ color: "var(--text5)" }}>—</span>}
                                                </td>
                                                <td>
                                                    {d.work_plan ? (
                                                        <div style={{ 
                                                            fontSize: 12, 
                                                            display: "flex", 
                                                            flexDirection: "column", 
                                                            gap: 6,
                                                            minWidth: 250,
                                                            padding: "10px 14px",
                                                            background: "rgba(59, 130, 246, 0.04)",
                                                            border: "1px solid rgba(59, 130, 246, 0.15)",
                                                            borderRadius: 10
                                                        }}>
                                                            <div style={{ display: "flex", gap: 8 }}>
                                                                <span style={{ color: "#3b82f6", fontWeight: 800, minWidth: 32 }}>เช้า:</span>
                                                                <span style={{ color: "var(--text2)" }}>{d.work_plan.morning}</span>
                                                                <span style={{ color: "var(--text4)", fontSize: 11 }}>({d.work_plan.morning_loc})</span>
                                                            </div>
                                                            <div style={{ display: "flex", gap: 8 }}>
                                                                <span style={{ color: "#3b82f6", fontWeight: 800, minWidth: 32 }}>บ่าย:</span>
                                                                <span style={{ color: "var(--text2)" }}>{d.work_plan.afternoon}</span>
                                                                <span style={{ color: "var(--text4)", fontSize: 11 }}>({d.work_plan.afternoon_loc})</span>
                                                            </div>
                                                            {d.work_plan.ot && (
                                                                <div style={{ display: "flex", gap: 8, borderTop: "1px dashed rgba(59, 130, 246, 0.2)", paddingTop: 6, marginTop: 4 }}>
                                                                    <span style={{ color: "#f59e0b", fontWeight: 800, minWidth: 32 }}>OT:</span>
                                                                    <span style={{ color: "var(--text2)" }}>{d.work_plan.ot}</span>
                                                                    {d.work_plan.ot_attendant && <span style={{ color: "var(--text4)", fontSize: 11 }}>[ผช. {d.work_plan.ot_attendant}]</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "var(--text5)", fontSize: 12 }}>— ไม่มีแผนงาน —</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: "center" }}>
                                                    <span style={{
                                                        padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 900,
                                                        background: d.status === "มาทำงาน" ? "var(--ok-bg)" :
                                                                   d.status === "มาสาย" ? "var(--late-bg)" :
                                                                   d.status === "ขาด" ? "var(--bad-bg)" :
                                                                   (d.status.startsWith("ลา") || d.status.includes("ปฏิบัติงาน")) ? "var(--red-lt)" : "var(--surface3)",
                                                        color: d.status === "มาทำงาน" ? "var(--ok)" :
                                                               d.status === "มาสาย" ? "var(--late)" :
                                                               d.status === "ขาด" ? "var(--bad)" :
                                                               (d.status.startsWith("ลา") || d.status.includes("ปฏิบัติงาน")) ? "var(--red)" : "var(--text3)",
                                                        border: `1px solid ${
                                                            d.status === "มาทำงาน" ? "var(--ok-bdr)" :
                                                            d.status === "มาสาย" ? "var(--late-bdr)" :
                                                            d.status === "ขาด" ? "var(--bad-bdr)" :
                                                            (d.status.startsWith("ลา") || d.status.includes("ปฏิบัติงาน")) ? "#f5c6c3" : "var(--line)"
                                                        }`
                                                    }}>
                                                        {d.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {sortedDetails.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ padding: 60, textAlign: "center", color: "var(--text5)" }}>ไม่มีประวัติการลงเวลาในช่วงนี้</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                    </div>
                </div>
            )}

            {/* Summary Table */}
            <div className={styles.tableWrap} style={{ position: "relative" }}>
                {loading && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius)", backdropFilter: "blur(2px)" }}>
                        <div className={styles.loader} style={{ background: "var(--surface)", padding: "16px 24px", borderRadius: "12px", boxShadow: "var(--shadow-md)" }}>
                            <div className={styles.spinner} />กำลังวิเคราะห์ข้อมูลทีมงาน...
                        </div>
                    </div>
                )}
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Bars3CenterLeftIcon width={22} /> {filterEmpId === "all" ? "สรุปภาพรวมสถิติทีมงาน" : "สรุปภาพรวมสถิติรายบุคคล"}
                    </div>
                </div>

                <div className={styles.tableScroll}>
                    {selectedSummaryData.length === 0 && !loading ? (
                        <div className={styles.emptyState}>
                            <span className={styles.emptyIcon}><InboxIcon width={36} /></span>
                            ไม่พบข้อมูลสถิติในช่วงเวลานี้
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ width: 140 }}>รหัสพนักงาน</th>
                                    <th>พนักงาน / สาขา</th>
                                    <th style={{ textAlign: "center" }}>มาทำงาน</th>
                                    <th style={{ textAlign: "center" }}>ขาดงาน</th>
                                    <th style={{ textAlign: "center" }}>ออกต่างจังหวัด</th>
                                    <th style={{ textAlign: "center" }}>วันลา</th>
                                    <th style={{ textAlign: "center" }}>มาสาย</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedSummaryData.map(row => (
                                    <tr key={row.emp_id}>
                                        <td><span className={styles.monoText}>{row.emp_id}</span></td>
                                        <td>
                                            <div style={{ fontWeight: 800, color: "var(--text)", fontSize: 15 }}>{row.name}</div>
                                            <div style={{ fontSize: 13, color: "var(--text4)", marginTop: 4 }}>{row.branch_id || "ไม่ระบุสำนักงาน"}</div>
                                        </td>
                                        <td style={{ textAlign: "center", fontWeight: 800, color: "var(--ok)", fontSize: 16 }}>{row.present_days} <small style={{ color: "var(--text5)", fontWeight: 500, fontSize: 12 }}>วัน</small></td>
                                        <td style={{ textAlign: "center" }}>
                                            {row.absent_days > 0 ? (
                                                <span className={`${styles.badge} ${styles.absent}`} style={{ minWidth: 44 }}>{row.absent_days}</span>
                                            ) : <span style={{ color: "var(--text5)" }}>-</span>}
                                        </td>
                                        <td style={{ textAlign: "center", fontWeight: 800, color: "var(--red)", fontSize: 15 }}>
                                            {(row as any).travel_days > 0 ? (row as any).travel_days + " วัน" : <span style={{ color: "var(--text5)" }}>-</span>}
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            {row.leave_days > 0 ? (
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                    <span className={`${styles.badge} ${styles.leave}`} style={{ minWidth: 44, fontWeight: 900 }}>{row.leave_days}</span>
                                                    {row.pending_leave_days > 0 && <small style={{ fontSize: 10, color: "var(--warn)", marginTop: 4, fontWeight: 700 }}>รออนุมัติ {row.pending_leave_days}</small>}
                                                </div>
                                            ) : <span style={{ color: "var(--text5)" }}>-</span>}
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            {row.late_count > 0 ? (
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                    <span style={{ color: "var(--late)", fontWeight: 900, fontSize: 16 }}>{row.late_count} <small style={{ fontWeight: 500, color: "var(--text5)", fontSize: 12 }}>ครั้ง</small></span>
                                                    <small style={{ color: "var(--text4)", fontSize: 11, fontWeight: 600 }}>สายรวม {row.late_mins} นาที</small>
                                                </div>
                                            ) : <span style={{ color: "var(--text5)" }}>-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
