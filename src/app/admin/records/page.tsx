"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "../page.module.css";
import {
    DocumentTextIcon,
    ArrowDownTrayIcon,
    FunnelIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    UserIcon,
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
    is_checkin_exempt?: boolean;
    is_active?: boolean;
}

interface RecordSummary {
    emp_id: string;
    name: string;
    branch_id: string | null;
    is_active: boolean;
    is_checkin_exempt?: boolean;
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

    const formatDate = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const [rangeType, setRangeType] = useState<"1" | "3" | "6" | "12" | "custom" | "single">("1");

    const [startDate, setStartDate] = useState(() => {
        let m = currentMonth - 1;
        let y = currentYear;
        if (m <= 0) { m += 12; y -= 1; }
        return formatDate(y, m, 26);
    });
    const [endDate, setEndDate] = useState(() => formatDate(currentYear, currentMonth, 25));

    const queryClient = useQueryClient();
    const [toast, setToast] = useState<{ msg: string; type: "ok" | "bad" } | null>(null);
    const [filterEmpId, setFilterEmpId] = useState("all");
    const [exportStatus, setExportStatus] = useState<"all" | "active" | "inactive">("all");
    const [exportingType, setExportingType] = useState<"pdf" | "excel" | null>(null);

    // Searchable Select States
    const [searchTerm, setSearchTerm] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
        queryKey: ['admin-employees-list'],
        queryFn: async () => {
            const res = await fetch("/api/admin/employees?all=1&status=all");
            const json = await res.json();
            return json.ok ? json.list || [] : [];
        }
    });

    const { data: recordsData, isLoading: loadingRecords, isFetching: fetchingRecords } = useQuery({
        queryKey: ['admin-records-summary', startDate, endDate, exportStatus],
        queryFn: async () => {
            if (!startDate || !endDate) return [];
            const p = new URLSearchParams({ start_date: startDate, end_date: endDate, status: exportStatus });

            const res = await fetch(`/api/admin/records?${p.toString()}`);
            const json = await res.json();
            if (!json.ok) {
                showToast(json.error || "Failed to load records", "bad");
                return [];
            }
            return json.summary || [];
        },
        enabled: !!startDate && !!endDate
    });

    const { data: detailsData, isLoading: loadingDetails, isFetching: fetchingDetails } = useQuery({
        queryKey: ['admin-records-details', filterEmpId, startDate, endDate],
        queryFn: async () => {
            if (filterEmpId === "all" || !startDate || !endDate) return [];
            const resDet = await fetch(`/api/admin/records/details?emp_id=${filterEmpId}&start_date=${startDate}&end_date=${endDate}`);
            const jsonDet = await resDet.json();
            return jsonDet.ok ? jsonDet.details || [] : [];
        },
        enabled: filterEmpId !== "all" && !!startDate && !!endDate
    });

    const data: RecordSummary[] = recordsData || [];
    const details = detailsData || [];
    const loading = loadingEmployees || loadingRecords || loadingDetails;
    const isFetching = fetchingRecords || fetchingDetails;



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
        // The end date is always the 25th of the current month
        // The start date is the 26th of the month (monthsBack) ago
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



    async function exportFile(type: "pdf" | "excel") {
        setExportingType(type);
        showToast("กำลังเตรียมไฟล์...");
        const p = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (filterEmpId !== "all") p.set("emp_id", filterEmpId);
        if (exportStatus !== "all") p.set("status", exportStatus);

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
        } finally {
            setExportingType(null);
        }
    }

    const filteredEmployees = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        let list = employees;
        if (exportStatus === "active") list = list.filter(e => e.is_active);
        else if (exportStatus === "inactive") list = list.filter(e => !e.is_active);

        if (!term) return list;
        return list.filter(e =>
            e.emp_id.toLowerCase().includes(term) ||
            e.name.toLowerCase().includes(term)
        );
    }, [employees, searchTerm, exportStatus]);

    const selectedEmployeeName = useMemo(() => {
        if (filterEmpId === "all") return "ทุกคน (สรุปภาพรวม)";
        const found = employees.find(e => e.emp_id === filterEmpId);
        return found ? `${found.emp_id} - ${found.name}` : filterEmpId;
    }, [employees, filterEmpId]);

    // Added sorting: Ascending (1st of the month first)
    const sortedDetails = useMemo(() => {
        return [...details].sort((a, b) => a.date.localeCompare(b.date));
    }, [details]);

    // Summary data for just the selected employee (if individual)
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
                    <h1 className={styles.pageTitle}>สถิติย้อนหลัง (Historical Records)</h1>
                    <div className={styles.pageSubtitle}>ตรวจสอบและวิเคราะห์สถิติการเข้างานย้อนหลังของพนักงาน</div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button
                        onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['admin-records-summary'] });
                            queryClient.invalidateQueries({ queryKey: ['admin-records-details'] });
                        }}
                        disabled={isFetching}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            height: 36, padding: "0 16px",
                            borderRadius: 8, border: "1px solid var(--line)",
                            background: "var(--surface)", color: "var(--text2)",
                            cursor: isFetching ? "not-allowed" : "pointer",
                            fontSize: 14, fontWeight: 500
                        }}
                    >
                        <ArrowPathIcon width={16} />
                        {isFetching ? "กำลังโหลด..." : "รีโหลด"}
                    </button>
                    <select
                        className={styles.input}
                        style={{ height: "36px", padding: "0 12px", width: "auto" }}
                        value={exportStatus}
                        onChange={(e) => setExportStatus(e.target.value as any)}
                    >
                        <option value="all">ทั้งหมด (All)</option>
                        <option value="active">ทำงานอยู่ (Active)</option>
                        <option value="inactive">ลาออก (Inactive)</option>
                    </select>
                    <button
                        className={styles.btnExcelSm}
                        onClick={() => exportFile("excel")}
                        disabled={exportingType === "excel"}
                        style={{ cursor: exportingType === "excel" ? "not-allowed" : "pointer", opacity: exportingType === "excel" ? 0.7 : 1 }}
                    >
                        {exportingType === "excel" ? <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite", display: "inline-block" }} /> : <ArrowDownTrayIcon width={16} />}
                        {exportingType === "excel" ? "กำลังโหลด..." : "Export Excel"}
                    </button>
                    <button
                        className={styles.btnPdfSm}
                        onClick={() => exportFile("pdf")}
                        disabled={exportingType === "pdf"}
                        style={{ cursor: exportingType === "pdf" ? "not-allowed" : "pointer", opacity: exportingType === "pdf" ? 0.7 : 1 }}
                    >
                        {exportingType === "pdf" ? <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite", display: "inline-block" }} /> : <DocumentTextIcon width={16} />}
                        {exportingType === "pdf" ? "กำลังโหลด..." : "Export PDF"}
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div className={styles.filterBar} style={{ background: "var(--surface)", padding: "18px 24px", borderRadius: "16px", border: "1px solid var(--line)", marginBottom: 24, boxShadow: "var(--shadow-sm)" }}>
                <div className={styles.filterGroup}>
                    <div className={styles.filterLabel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CalendarIcon width={14} /> ช่วงเวลา
                    </div>
                    <select
                        className={styles.input}
                        style={{ width: "160px" }}
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

                <div style={{ width: 1, height: 32, background: "var(--line)", alignSelf: "center", margin: "18px 8px 0" }} />

                <div className={styles.filterGroup} style={{ position: "relative", flex: 1, maxWidth: 400 }} ref={dropdownRef}>
                    <div className={styles.filterLabel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <UserGroupIcon width={14} /> เลือกพนักงาน (Search)
                    </div>
                    <div
                        className={styles.input}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: isDropdownOpen ? "var(--surface2)" : "var(--surface)" }}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                        <span style={{ color: filterEmpId === "all" ? "var(--text3)" : "var(--text)", fontWeight: 600 }}>{selectedEmployeeName}</span>
                        <ChevronDownIcon width={16} style={{ color: "var(--text4)", transform: isDropdownOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                    </div>

                    {isDropdownOpen && (
                        <div style={{
                            position: "absolute", top: "100%", left: 0, right: 0, background: "#fff",
                            border: "1.5px solid var(--line2)", borderRadius: "12px", marginTop: 8,
                            boxShadow: "var(--shadow-md)", zIndex: 1000, overflow: "hidden"
                        }}>
                            <div style={{ padding: 10, borderBottom: "1px solid var(--line)", background: "var(--surface2)" }}>
                                <div style={{ position: "relative" }}>
                                    <MagnifyingGlassIcon width={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text4)" }} />
                                    <input
                                        type="text"
                                        placeholder="พิมพ์เพื่อหาชื่อหรือรหัส..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                        style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid var(--line2)", borderRadius: "8px", fontSize: 13, outline: "none" }}
                                    />
                                </div>
                            </div>
                            <div style={{ maxHeight: 280, overflowY: "auto" }}>
                                <div
                                    style={{ padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: filterEmpId === "all" ? 700 : 500, color: filterEmpId === "all" ? "var(--red)" : "var(--text2)", background: filterEmpId === "all" ? "var(--red-lt)" : "transparent" }}
                                    onClick={() => { setFilterEmpId("all"); setIsDropdownOpen(false); setSearchTerm(""); }}
                                >
                                    ทุกคน (สรุปภาพรวม)
                                </div>
                                {filteredEmployees.length === 0 ? (
                                    <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text4)", fontSize: 12 }}>ไม่พบข้อมูลพนักงาน</div>
                                ) : filteredEmployees.map(e => (
                                    <div
                                        key={e.emp_id}
                                        style={{ padding: "10px 16px", cursor: "pointer", fontSize: 13, borderTop: "1px solid var(--line)", fontWeight: filterEmpId === e.emp_id ? 700 : 500, color: filterEmpId === e.emp_id ? "var(--red)" : "var(--text2)", background: filterEmpId === e.emp_id ? "var(--red-lt)" : "transparent", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                                        onClick={() => { setFilterEmpId(e.emp_id); setIsDropdownOpen(false); setSearchTerm(""); }}
                                    >
                                        <div>
                                            <span style={{ fontFamily: "monospace", opacity: 0.6, fontSize: 11, marginRight: 8 }}>{e.emp_id}</span>
                                            {e.name}
                                        </div>
                                        {e.is_checkin_exempt && (
                                            <span style={{ fontSize: 10, background: "var(--surface3)", color: "var(--text4)", padding: "1px 6px", borderRadius: 4 }}>ยกเว้นลงเวลา</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* REORDERED: Detailed Table shown at the TOP when an individual is selected */}
            {filterEmpId !== "all" && (
                <div className={styles.tableWrap} style={{ marginBottom: 24, position: "relative" }}>
                    {loading && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius)", backdropFilter: "blur(2px)" }}>
                            <div className={styles.loader} style={{ background: "var(--surface)", padding: "16px 24px", borderRadius: "12px", boxShadow: "var(--shadow-md)" }}>
                                <div className={styles.spinner} />กำลังโหลดข้อมูล...
                            </div>
                        </div>
                    )}
                    <div className={styles.tableHeader} style={{ background: "var(--surface2)" }}>
                        <div className={styles.tableHeaderTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <DocumentTextIcon width={20} style={{ color: "var(--red)" }} />
                            รายละเอียดการลงเวลารายวัน: <span style={{ color: "var(--red)", fontWeight: 800 }}>{selectedEmployeeName}</span>
                        </div>
                    </div>

                    <div className={styles.tableScroll}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ width: 140 }}>วันที่</th>
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
                                            <td><span style={{ fontWeight: 600, color: d.is_weekend ? "var(--text4)" : "var(--text)" }}>{d.date}</span></td>
                                            <td>
                                                {d.in_time ? (
                                                    <>
                                                        <div style={{ fontWeight: 700, color: "var(--ok)", display: "flex", alignItems: "center", gap: 6 }}>
                                                            {d.in_time}
                                                            {d.is_trip && <span style={{ fontSize: 10, background: "var(--red)", color: "#fff", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.5 }}>TRIP</span>}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 2 }}>{d.in_loc || "-"}</div>
                                                    </>
                                                ) : <span style={{ color: "var(--text5)" }}>—</span>}
                                            </td>
                                            <td>
                                                {d.out_time ? (
                                                    <>
                                                        <div style={{ fontWeight: 700, color: "var(--warn)" }}>{d.out_time}</div>
                                                        <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 2 }}>{d.out_loc || "-"}</div>
                                                    </>
                                                ) : <span style={{ color: "var(--text5)" }}>—</span>}
                                            </td>
                                            <td>
                                                {d.work_plan ? (
                                                    <div style={{
                                                        fontSize: 11,
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 4,
                                                        minWidth: 200,
                                                        padding: "6px 10px",
                                                        background: "rgba(59, 130, 246, 0.05)",
                                                        border: "1px solid rgba(59, 130, 246, 0.2)",
                                                        borderRadius: 8
                                                    }}>
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                            <span style={{ color: "#3b82f6", fontWeight: 700, minWidth: 28 }}>เช้า:</span>
                                                            <span style={{ color: "var(--text2)" }}>{d.work_plan.morning}</span>
                                                            <span style={{ color: "var(--text4)", fontSize: 10 }}>({d.work_plan.morning_loc})</span>
                                                        </div>
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                            <span style={{ color: "#3b82f6", fontWeight: 700, minWidth: 28 }}>บ่าย:</span>
                                                            <span style={{ color: "var(--text2)" }}>{d.work_plan.afternoon}</span>
                                                            <span style={{ color: "var(--text4)", fontSize: 10 }}>({d.work_plan.afternoon_loc})</span>
                                                        </div>
                                                        {d.work_plan.ot && (
                                                            <div style={{ display: "flex", gap: 6, borderTop: "1px dashed rgba(59, 130, 246, 0.2)", paddingTop: 4, marginTop: 2 }}>
                                                                <span style={{ color: "#f59e0b", fontWeight: 700, minWidth: 28 }}>OT:</span>
                                                                <span style={{ color: "var(--text2)" }}>{d.work_plan.ot}</span>
                                                                {d.work_plan.ot_attendant && <span style={{ color: "var(--text4)", fontSize: 10 }}>[ผช. {d.work_plan.ot_attendant}]</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "var(--text5)", fontSize: 11 }}>— ไม่มีแผนงาน —</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                                <span style={{
                                                    padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase",
                                                    background: d.status.startsWith("มาทำงาน") ? "var(--ok-bg)" :
                                                        d.status.startsWith("มาสาย") ? "var(--late-bg)" :
                                                            d.status === "ขาด" || d.status === "ไม่เช็คอิน" ? "var(--bad-bg)" :
                                                                (d.status.startsWith("ลา") || d.status.includes("ปฏิบัติงาน")) ? "var(--red-lt)" : "var(--surface3)",
                                                    color: d.status.startsWith("มาทำงาน") ? "var(--ok)" :
                                                        d.status.startsWith("มาสาย") ? "var(--late)" :
                                                            d.status === "ขาด" || d.status === "ไม่เช็คอิน" ? "var(--bad)" :
                                                                (d.status.startsWith("ลา") || d.status.includes("ปฏิบัติงาน")) ? "var(--red)" : "var(--text3)",
                                                    border: `1px solid ${d.status.startsWith("มาทำงาน") ? "var(--ok-bdr)" :
                                                        d.status.startsWith("มาสาย") ? "var(--late-bdr)" :
                                                            d.status === "ขาด" || d.status === "ไม่เช็คอิน" ? "var(--bad-bdr)" :
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
                                        <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text5)" }}>ไม่มีรายละเอียดประวัติในช่วงเวลานี้</td>
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
                            <div className={styles.spinner} />กำลังประมวลผลข้อมูล...
                        </div>
                    </div>
                )}
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Bars3CenterLeftIcon width={20} /> {filterEmpId === "all" ? "ตารางสรุปภาพรวมสถิติพนักงาน" : "สรุปภาพรวมสถิติรายบุคคล"}
                    </div>
                </div>

                <div className={styles.tableScroll}>
                    {selectedSummaryData.length === 0 && !loading ? (
                        <div className={styles.emptyState}>
                            <span className={styles.emptyIcon}><InboxIcon width={32} /></span>
                            ไม่พบข้อมูลในช่วงที่กำหนด
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ width: 120 }}>รหัส</th>
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
                                            <div style={{ fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                                                {row.name}
                                                {row.is_checkin_exempt && (
                                                    <span style={{ fontSize: 10, background: "var(--surface3)", color: "var(--text4)", padding: "1px 6px", borderRadius: 4, fontWeight: 500 }}>ยกเว้นลงเวลา</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--text4)", marginTop: 2 }}>{row.branch_id || "ไม่ระบุสำนักงาน"}</div>
                                        </td>
                                        <td style={{ textAlign: "center", fontWeight: 700, color: "var(--ok)" }}>
                                            {row.is_checkin_exempt ? (
                                                <span style={{ color: "var(--text4)", fontSize: 12, fontWeight: 500 }}>ยกเว้นลงเวลา</span>
                                            ) : (
                                                <>{row.present_days} <small style={{ color: "var(--text5)", fontWeight: 400 }}>วัน</small></>
                                            )}
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            {row.absent_days > 0 ? (
                                                <span className={`${styles.badge} ${styles.absent}`} style={{ minWidth: 40 }}>{row.absent_days}</span>
                                            ) : <span style={{ color: "var(--text5)" }}>-</span>}
                                        </td>
                                        <td style={{ textAlign: "center", fontWeight: 700, color: "var(--red)" }}>
                                            {(row as any).travel_days > 0 ? (row as any).travel_days + " วัน" : <span style={{ color: "var(--text5)" }}>-</span>}
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            {row.leave_days > 0 ? (
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                    <span className={`${styles.badge} ${styles.leave}`} style={{ minWidth: 40, fontWeight: 900 }}>{row.leave_days}</span>
                                                    {row.pending_leave_days > 0 && <small style={{ fontSize: 9, color: "var(--warn)", marginTop: 2 }}>รอ {row.pending_leave_days}</small>}
                                                </div>
                                            ) : <span style={{ color: "var(--text5)" }}>-</span>}
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            {row.late_count > 0 ? (
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                    <span style={{ color: "var(--late)", fontWeight: 800, fontSize: 14 }}>{row.late_count} <small style={{ fontWeight: 400, color: "var(--text5)" }}>ครั้ง</small></span>
                                                    <small style={{ color: "var(--text4)", fontSize: 10 }}>สายรวม {row.late_mins} นาที</small>
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
