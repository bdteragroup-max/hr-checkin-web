"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./records.module.css";
import {
    DocumentTextIcon,
    ArrowDownTrayIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ClockIcon,
    CalendarIcon,
    ExclamationTriangleIcon,
    ChevronDownIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    ArrowLeftIcon,
    EyeIcon,
    InboxIcon,
    SparklesIcon,
    FireIcon
} from "@heroicons/react/24/outline";

interface Employee {
    emp_id: string;
    name: string;
    branch_id?: string | null;
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
    travel_days?: number;
    total_work_days_period: number;
    under_9h_count?: number;
    under_9h_dates?: string[];
    over_9h_count?: number;
    over_9h_mins?: number;
    over_9h_dates?: string[];
}

interface WorkPlan {
    morning?: string;
    morning_loc?: string;
    afternoon?: string;
    afternoon_loc?: string;
    ot?: string;
    ot_attendant?: string;
}

interface RecordDetail {
    date: string;
    in_time: string | null;
    in_loc: string | null;
    out_time: string | null;
    out_loc: string | null;
    work_duration_mins?: number | null;
    work_duration_display?: string | null;
    is_under_9h?: boolean;
    under_9h_diff_mins?: number;
    is_over_9h?: boolean;
    over_9h_diff_mins?: number;
    late_mins: number;
    status: string;
    is_trip?: boolean;
    is_weekend?: boolean;
    work_plan?: WorkPlan | null;
}

interface RecordsKpi {
    total_under_9h_count: number;
    affected_employees_count: number;
    total_over_9h_count?: number;
    affected_over_9h_employees_count?: number;
    total_over_9h_mins?: number;
}

export default function RecordsPage() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const formatDate = (y: number, m: number, d: number) =>
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const formatDateThai = (dateStr: string) => {
        if (!dateStr) return "";
        const parts = dateStr.split("-");
        if (parts.length !== 3) return dateStr;
        const [y, m, d] = parts;
        const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const monthName = months[parseInt(m, 10) - 1] || m;
        const thaiYear = parseInt(y, 10) + 543;
        return `${parseInt(d, 10)} ${monthName} ${thaiYear}`;
    };

    const getDayOfWeekThai = (dateStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
        return days[d.getDay()];
    };

    // Range type state
    const [rangeType, setRangeType] = useState<"1" | "3" | "6" | "12" | "single" | "custom">("1");

    const [startDate, setStartDate] = useState(() => {
        let m = currentMonth - 1;
        let y = currentYear;
        if (m <= 0) { m += 12; y -= 1; }
        return formatDate(y, m, 26);
    });
    const [endDate, setEndDate] = useState(() => formatDate(currentYear, currentMonth, 25));

    const queryClient = useQueryClient();
    const searchParams = useSearchParams();

    const [toast, setToast] = useState<{ msg: string; type: "ok" | "bad" } | null>(null);
    const [filterEmpId, setFilterEmpId] = useState("all");
    const [exportStatus, setExportStatus] = useState<"all" | "active" | "inactive">("all");
    const [exportingType, setExportingType] = useState<"pdf" | "excel" | null>(null);

    // Filter states for working hours: "all" | "under_9h" | "over_9h"
    const [hourFilter, setHourFilter] = useState<"all" | "under_9h" | "over_9h">(() => {
        const tab = searchParams?.get("tab");
        const filter = searchParams?.get("filter");
        if (tab === "under_9h" || filter === "under_9h") return "under_9h";
        if (tab === "over_9h" || filter === "over_9h") return "over_9h";
        return "all";
    });

    // Detail view working hours filter: "all" | "under_9h" | "over_9h"
    const [detailHourFilter, setDetailHourFilter] = useState<"all" | "under_9h" | "over_9h">("all");

    // In-table search for master summary view
    const [inTableSearch, setInTableSearch] = useState("");

    // Modal state for viewing full work plan
    const [activeWorkPlanModal, setActiveWorkPlanModal] = useState<{
        date: string;
        plan: WorkPlan;
    } | null>(null);

    // Searchable Select dropdown states
    const [searchTerm, setSearchTerm] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const tab = searchParams?.get("tab");
        const filter = searchParams?.get("filter");
        if (tab === "under_9h" || filter === "under_9h") {
            setHourFilter("under_9h");
        } else if (tab === "over_9h" || filter === "over_9h") {
            setHourFilter("over_9h");
        }
        const sDate = searchParams?.get("start_date") || searchParams?.get("start");
        const eDate = searchParams?.get("end_date") || searchParams?.get("end");
        if (sDate && eDate) {
            setStartDate(sDate);
            setEndDate(eDate);
            setRangeType("custom");
        }
    }, [searchParams]);

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

    const showToast = (msg: string, type: "ok" | "bad" = "ok") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const calcRange = (monthsBack: number) => {
        const eMonth = currentMonth;
        const eYear = currentYear;
        let sMonth = currentMonth - monthsBack;
        let sYear = currentYear;
        while (sMonth <= 0) { sMonth += 12; sYear -= 1; }
        setStartDate(formatDate(sYear, sMonth, 26));
        setEndDate(formatDate(eYear, eMonth, 25));
    };

    const handleSelectRangeType = (type: "1" | "3" | "6" | "12" | "single" | "custom") => {
        setRangeType(type);
        if (type === "single") {
            setEndDate(startDate);
        } else if (type !== "custom") {
            calcRange(Number(type));
        }
    };

    // Queries
    const { data: employees = [] } = useQuery<Employee[]>({
        queryKey: ['admin-employees-list'],
        queryFn: async () => {
            const res = await fetch("/api/admin/employees?all=1&status=all");
            const json = await res.json();
            return json.ok ? json.list || [] : [];
        }
    });

    const { data: recordsResult, isLoading: loadingRecords, isFetching: fetchingRecords } = useQuery<{ summary: RecordSummary[]; kpi: RecordsKpi }>({
        queryKey: ['admin-records-summary', startDate, endDate, exportStatus],
        queryFn: async () => {
            if (!startDate || !endDate) return { summary: [], kpi: { total_under_9h_count: 0, affected_employees_count: 0 } };
            const p = new URLSearchParams({ start_date: startDate, end_date: endDate, status: exportStatus });

            const res = await fetch(`/api/admin/records?${p.toString()}`);
            const json = await res.json();
            if (!json.ok) {
                showToast(json.error || "Failed to load records", "bad");
                return { summary: [], kpi: { total_under_9h_count: 0, affected_employees_count: 0 } };
            }
            return {
                summary: json.summary || [],
                kpi: json.kpi || { total_under_9h_count: 0, affected_employees_count: 0 }
            };
        },
        enabled: !!startDate && !!endDate
    });

    const { data: detailsData, isLoading: loadingDetails, isFetching: fetchingDetails } = useQuery<RecordDetail[]>({
        queryKey: ['admin-records-details', filterEmpId, startDate, endDate],
        queryFn: async () => {
            if (filterEmpId === "all" || !startDate || !endDate) return [];
            const resDet = await fetch(`/api/admin/records/details?emp_id=${filterEmpId}&start_date=${startDate}&end_date=${endDate}`);
            const jsonDet = await resDet.json();
            return jsonDet.ok ? jsonDet.details || [] : [];
        },
        enabled: filterEmpId !== "all" && !!startDate && !!endDate
    });

    const data: RecordSummary[] = recordsResult?.summary || [];
    const kpiData: RecordsKpi = recordsResult?.kpi || { total_under_9h_count: 0, affected_employees_count: 0 };
    const details = detailsData || [];
    const isFetching = fetchingRecords || fetchingDetails;
    const isTableLoading = loadingRecords || loadingDetails;

    // Export function
    const exportFile = async (type: "pdf" | "excel") => {
        setExportingType(type);
        const activeHourFilter = filterEmpId === "all" ? hourFilter : detailHourFilter;
        let filterNotice = "";
        if (activeHourFilter === "under_9h") filterNotice = " (เฉพาะที่ทำงาน < 9 ชม.)";
        else if (activeHourFilter === "over_9h") filterNotice = " (เฉพาะที่ทำงาน > 9 ชม.)";

        showToast(`กำลังเตรียมไฟล์ ${type.toUpperCase()}${filterNotice}...`);

        const p = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (filterEmpId !== "all") p.set("emp_id", filterEmpId);
        if (exportStatus !== "all") p.set("status", exportStatus);
        if (activeHourFilter === "under_9h") p.set("under_9h", "1");
        if (activeHourFilter === "over_9h") p.set("over_9h", "1");

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
        } catch {
            showToast("เกิดข้อผิดพลาดในการดาวน์โหลด", "bad");
        } finally {
            setExportingType(null);
        }
    };

    // Employee dropdown filtering
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

    const selectedEmployeeObj = useMemo(() => {
        if (filterEmpId === "all") return null;
        return employees.find(e => e.emp_id === filterEmpId) || null;
    }, [employees, filterEmpId]);

    const selectedEmployeeSummary = useMemo(() => {
        if (filterEmpId === "all") return null;
        return data.find(d => d.emp_id === filterEmpId) || null;
    }, [data, filterEmpId]);

    const selectedEmployeeName = useMemo(() => {
        if (filterEmpId === "all") return "ทุกคน (สรุปภาพรวม)";
        return selectedEmployeeObj ? `${selectedEmployeeObj.emp_id} - ${selectedEmployeeObj.name}` : filterEmpId;
    }, [selectedEmployeeObj, filterEmpId]);

    // Sorted details for individual view
    const sortedDetails = useMemo(() => {
        let list = [...details].sort((a, b) => a.date.localeCompare(b.date));
        if (detailHourFilter === "under_9h") {
            list = list.filter(d => d.is_under_9h);
        } else if (detailHourFilter === "over_9h") {
            list = list.filter(d => d.is_over_9h);
        }
        return list;
    }, [details, detailHourFilter]);

    // Master summary data (with instant in-table search and hourFilter)
    const displayedSummaryData = useMemo(() => {
        let list = data;
        if (hourFilter === "under_9h") {
            list = list.filter(d => (d.under_9h_count || 0) > 0);
        } else if (hourFilter === "over_9h") {
            list = list.filter(d => (d.over_9h_count || 0) > 0);
        }
        if (inTableSearch.trim()) {
            const q = inTableSearch.toLowerCase().trim();
            list = list.filter(d =>
                d.emp_id.toLowerCase().includes(q) ||
                d.name.toLowerCase().includes(q) ||
                (d.branch_id && d.branch_id.toLowerCase().includes(q))
            );
        }
        return list;
    }, [data, hourFilter, inTableSearch]);

    // Aggregate KPI Metrics
    const totalPresentDays = useMemo(() => data.reduce((acc, r) => acc + (r.present_days || 0), 0), [data]);
    const totalLateTimes = useMemo(() => data.reduce((acc, r) => acc + (r.late_count || 0), 0), [data]);
    const totalLateMinutes = useMemo(() => data.reduce((acc, r) => acc + (r.late_mins || 0), 0), [data]);
    const totalLeaveDays = useMemo(() => data.reduce((acc, r) => acc + (r.leave_days || 0), 0), [data]);
    
    // Under 9h metrics
    const totalUnder9h = kpiData.total_under_9h_count || data.reduce((acc, r) => acc + (r.under_9h_count || 0), 0);
    const affectedEmployeesCount = kpiData.affected_employees_count || data.filter(r => (r.under_9h_count || 0) > 0).length;

    // Over 9h metrics
    const totalOver9h = kpiData.total_over_9h_count !== undefined 
        ? kpiData.total_over_9h_count 
        : data.reduce((acc, r) => acc + (r.over_9h_count || 0), 0);
    const affectedOver9hCount = kpiData.affected_over_9h_employees_count !== undefined 
        ? kpiData.affected_over_9h_employees_count 
        : data.filter(r => (r.over_9h_count || 0) > 0).length;
    const totalOver9hMins = kpiData.total_over_9h_mins !== undefined 
        ? kpiData.total_over_9h_mins 
        : data.reduce((acc, r) => acc + (r.over_9h_mins || 0), 0);

    // Helper for status badge rendering
    const renderStatusBadge = (status: string) => {
        if (!status) return <span style={{ color: "var(--text5)" }}>—</span>;
        let badgeClass = styles.badgeHoliday;
        if (status.startsWith("มาทำงาน")) {
            badgeClass = styles.badgePresent;
        } else if (status.startsWith("มาสาย")) {
            badgeClass = styles.badgeLate;
        } else if (status === "ขาด" || status === "ไม่เช็คอิน" || status.includes("ขาดงาน")) {
            badgeClass = styles.badgeAbsent;
        } else if (status.startsWith("ลา") || status.includes("ปฏิบัติงาน")) {
            badgeClass = styles.badgeLeave;
        } else if (status.includes("วันหยุด") || status.includes("เสาร์") || status.includes("อาทิตย์")) {
            badgeClass = styles.badgeHoliday;
        }
        return <span className={`${styles.badge} ${badgeClass}`}>{status}</span>;
    };

    return (
        <div className={styles.container}>
            {/* Toast notification */}
            {toast && (
                <div className={`${styles.toast} ${toast.type === "ok" ? styles.toastOk : styles.toastBad}`}>
                    {toast.type === "ok" ? <CheckCircleIcon width={18} /> : <ExclamationTriangleIcon width={18} />}
                    {toast.msg}
                </div>
            )}

            {/* Header Section */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.headerTitle}>สถิติย้อนหลัง (Historical Records)</h1>
                    <p className={styles.headerSubtitle}>ตรวจสอบและวิเคราะห์สถิติการเข้างานย้อนหลังของพนักงานอย่างละเอียด</p>
                </div>

                <div className={styles.headerActions}>
                    <button
                        className={styles.btnAction}
                        onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['admin-records-summary'] });
                            queryClient.invalidateQueries({ queryKey: ['admin-records-details'] });
                        }}
                        disabled={isFetching}
                        title="รีเฟรชข้อมูลล่าสุด"
                    >
                        <ArrowPathIcon width={15} className={isFetching ? styles.spinner : ""} />
                        {isFetching ? "กำลังโหลด..." : "รีโหลด"}
                    </button>

                    <select
                        className={styles.selectStatus}
                        value={exportStatus}
                        onChange={(e) => setExportStatus(e.target.value as any)}
                        title="กรองตามสถานะพนักงาน"
                    >
                        <option value="all">สถานะ: ทั้งหมด (All)</option>
                        <option value="active">เฉพาะ: ทำงานอยู่ (Active)</option>
                        <option value="inactive">เฉพาะ: ลาออก (Inactive)</option>
                    </select>

                    <button
                        className={`${styles.btnAction} ${styles.btnExcel}`}
                        onClick={() => exportFile("excel")}
                        disabled={exportingType === "excel"}
                        title={hourFilter !== "all" ? `ส่งออก Excel เฉพาะ ${displayedSummaryData.length} คนที่กรอง` : "ส่งออก Excel"}
                        style={{
                            background: hourFilter === "under_9h" ? "#ea580c" : hourFilter === "over_9h" ? "#7c3aed" : undefined,
                            borderColor: hourFilter === "under_9h" ? "#c2410c" : hourFilter === "over_9h" ? "#6d28d9" : undefined
                        }}
                    >
                        {exportingType === "excel" ? (
                            <div className={styles.spinner} style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                        ) : (
                            <ArrowDownTrayIcon width={15} />
                        )}
                        {exportingType === "excel"
                            ? "กำลังส่งออก..."
                            : hourFilter === "under_9h"
                                ? `Excel (< 9 ชม. ${displayedSummaryData.length} คน)`
                                : hourFilter === "over_9h"
                                    ? `Excel (> 9 ชม. ${displayedSummaryData.length} คน)`
                                    : "Export Excel"
                        }
                    </button>

                    <button
                        className={`${styles.btnAction} ${styles.btnPdf}`}
                        onClick={() => exportFile("pdf")}
                        disabled={exportingType === "pdf"}
                        title="ส่งออกรายงาน PDF"
                    >
                        {exportingType === "pdf" ? (
                            <div className={styles.spinner} style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                        ) : (
                            <DocumentTextIcon width={15} />
                        )}
                        {exportingType === "pdf" ? "กำลังส่งออก..." : "Export PDF"}
                    </button>
                </div>
            </div>

            {/* Filter Card */}
            <div className={styles.filterCard}>
                <div className={styles.filterTopRow}>
                    {/* Date range pills */}
                    <div className={styles.filterPills}>
                        <button
                            className={`${styles.filterPillBtn} ${rangeType === "1" ? styles.filterPillActive : ""}`}
                            onClick={() => handleSelectRangeType("1")}
                        >
                            1 เดือนล่าสุด
                        </button>
                        <button
                            className={`${styles.filterPillBtn} ${rangeType === "3" ? styles.filterPillActive : ""}`}
                            onClick={() => handleSelectRangeType("3")}
                        >
                            3 เดือน
                        </button>
                        <button
                            className={`${styles.filterPillBtn} ${rangeType === "6" ? styles.filterPillActive : ""}`}
                            onClick={() => handleSelectRangeType("6")}
                        >
                            6 เดือน
                        </button>
                        <button
                            className={`${styles.filterPillBtn} ${rangeType === "12" ? styles.filterPillActive : ""}`}
                            onClick={() => handleSelectRangeType("12")}
                        >
                            1 ปี
                        </button>
                        <button
                            className={`${styles.filterPillBtn} ${rangeType === "single" ? styles.filterPillActive : ""}`}
                            onClick={() => handleSelectRangeType("single")}
                        >
                            เลือกวันเดียว
                        </button>
                        <button
                            className={`${styles.filterPillBtn} ${rangeType === "custom" ? styles.filterPillActive : ""}`}
                            onClick={() => handleSelectRangeType("custom")}
                        >
                            กำหนดเอง
                        </button>
                    </div>

                    {/* Active Date Range Badge */}
                    <div className={styles.dateRangeBadge}>
                        <CalendarIcon width={15} style={{ color: "var(--red)" }} />
                        <span>ช่วงข้อมูล: <b>{formatDateThai(startDate)}</b> ถึง <b>{formatDateThai(endDate)}</b></span>
                    </div>

                    {/* Searchable Employee Select Dropdown */}
                    <div className={styles.employeeDropdownWrapper} ref={dropdownRef}>
                        <div
                            className={styles.employeeDropdownTrigger}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <span style={{ fontWeight: filterEmpId === "all" ? 600 : 700, color: filterEmpId === "all" ? "var(--text3)" : "var(--text)" }}>
                                {selectedEmployeeName}
                            </span>
                            <ChevronDownIcon
                                width={15}
                                style={{
                                    color: "var(--text4)",
                                    transform: isDropdownOpen ? "rotate(180deg)" : "none",
                                    transition: "0.2s"
                                }}
                            />
                        </div>

                        {isDropdownOpen && (
                            <div className={styles.employeeDropdownMenu}>
                                <div className={styles.employeeSearchInputWrap}>
                                    <MagnifyingGlassIcon
                                        width={15}
                                        style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "var(--text4)" }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="พิมพ์เพื่อค้นหาชื่อหรือรหัสพนักงาน..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                        className={styles.employeeSearchInput}
                                    />
                                </div>
                                <div className={styles.employeeListScroll}>
                                    <div
                                        className={`${styles.employeeOptionItem} ${filterEmpId === "all" ? styles.employeeOptionActive : ""}`}
                                        onClick={() => { setFilterEmpId("all"); setIsDropdownOpen(false); setSearchTerm(""); }}
                                    >
                                        <span style={{ fontWeight: 700 }}>ทุกคน (สรุปภาพรวมทั้งองค์กร)</span>
                                    </div>
                                    {filteredEmployees.length === 0 ? (
                                        <div style={{ padding: "18px 14px", textAlign: "center", color: "var(--text4)", fontSize: 12 }}>
                                            ไม่พบรายชื่อพนักงาน
                                        </div>
                                    ) : (
                                        filteredEmployees.map(e => (
                                            <div
                                                key={e.emp_id}
                                                className={`${styles.employeeOptionItem} ${filterEmpId === e.emp_id ? styles.employeeOptionActive : ""}`}
                                                onClick={() => {
                                                    setFilterEmpId(e.emp_id);
                                                    setDetailHourFilter("all");
                                                    setIsDropdownOpen(false);
                                                    setSearchTerm("");
                                                }}
                                            >
                                                <div>
                                                    <span className={styles.monoText} style={{ marginRight: 8, fontSize: 11 }}>{e.emp_id}</span>
                                                    <span>{e.name}</span>
                                                </div>
                                                {e.is_checkin_exempt && (
                                                    <span className={styles.exemptBadge}>ยกเว้นลงเวลา</span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Custom Date Pickers */}
                {rangeType === "custom" && (
                    <div className={styles.customDateRow}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text3)" }}>เลือกช่วงวัน:</span>
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                        <span style={{ color: "var(--text4)", fontSize: 13, fontWeight: 700 }}>ถึง</span>
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                )}

                {rangeType === "single" && (
                    <div className={styles.customDateRow}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text3)" }}>เลือกวัน:</span>
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={startDate}
                            onChange={e => {
                                setStartDate(e.target.value);
                                setEndDate(e.target.value);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* KPI Cards Grid (5 Cards) */}
            <div className={styles.kpiGrid}>
                {/* 1. Actual Work Days */}
                <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                    <div className={styles.kpiTop}>
                        <span className={styles.kpiLabel}>วันทำงานจริง (รวม)</span>
                        <div className={styles.kpiIconBox}>
                            <CheckCircleIcon width={18} />
                        </div>
                    </div>
                    <div className={styles.kpiVal}>
                        {totalPresentDays.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text4)" }}>วัน</span>
                    </div>
                    <div className={styles.kpiSub}>
                        พนักงานทั้งหมด {data.length} คน
                    </div>
                </div>

                {/* 2. Total Late */}
                <div className={`${styles.kpiCard} ${styles.kpiAmber}`}>
                    <div className={styles.kpiTop}>
                        <span className={styles.kpiLabel}>มาสายทั้งหมด</span>
                        <div className={styles.kpiIconBox}>
                            <ClockIcon width={18} />
                        </div>
                    </div>
                    <div className={styles.kpiVal} style={{ color: "#d97706" }}>
                        {totalLateTimes.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text4)" }}>ครั้ง</span>
                    </div>
                    <div className={styles.kpiSub}>
                        สายสะสมรวม {totalLateMinutes.toLocaleString()} นาที
                    </div>
                </div>

                {/* 3. Approved Leaves */}
                <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
                    <div className={styles.kpiTop}>
                        <span className={styles.kpiLabel}>วันลาที่อนุมัติ</span>
                        <div className={styles.kpiIconBox}>
                            <CalendarIcon width={18} />
                        </div>
                    </div>
                    <div className={styles.kpiVal} style={{ color: "#2563eb" }}>
                        {totalLeaveDays.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text4)" }}>วัน</span>
                    </div>
                    <div className={styles.kpiSub}>
                        รายการลาที่ได้รับการอนุมัติแล้ว
                    </div>
                </div>

                {/* 4. Under 9 Hours (< 9h) Interactive Filter Card */}
                <div
                    className={`${styles.kpiCard} ${styles.kpiOrange} ${styles.kpiCardClickable} ${hourFilter === "under_9h" ? styles.kpiActiveToggle : ""}`}
                    onClick={() => setHourFilter(hourFilter === "under_9h" ? "all" : "under_9h")}
                    title="คลิกเพื่อกรองตารางเฉพาะพนักงานที่ทำงาน < 9 ชม."
                >
                    <div className={styles.kpiTop}>
                        <span className={styles.kpiLabel} style={{ color: hourFilter === "under_9h" ? "#c2410c" : undefined }}>
                            ทำงาน &lt; 9 ชม. (จ.-ศ.)
                        </span>
                        <span className={`${styles.kpiFilterBadge} ${hourFilter === "under_9h" ? styles.kpiFilterBadgeActive : ""}`}>
                            {hourFilter === "under_9h" ? "กำลังกรองอยู่" : "คลิกเพื่อกรอง"}
                        </span>
                    </div>
                    <div className={styles.kpiVal} style={{ color: "#ea580c" }}>
                        {totalUnder9h.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text4)" }}>ครั้ง</span>
                    </div>
                    <div className={styles.kpiSub} style={{ color: hourFilter === "under_9h" ? "#c2410c" : undefined, fontWeight: hourFilter === "under_9h" ? 600 : 400 }}>
                        พบในพนักงาน <b>{affectedEmployeesCount}</b> คน
                    </div>
                </div>

                {/* 5. NEW: Over 9 Hours (> 9h) Interactive Filter Card */}
                <div
                    className={`${styles.kpiCard} ${styles.kpiPurple} ${styles.kpiCardClickable} ${hourFilter === "over_9h" ? styles.kpiPurpleActiveToggle : ""}`}
                    onClick={() => setHourFilter(hourFilter === "over_9h" ? "all" : "over_9h")}
                    title="คลิกเพื่อกรองตารางเฉพาะพนักงานที่ทำงาน > 9 ชม."
                >
                    <div className={styles.kpiTop}>
                        <span className={styles.kpiLabel} style={{ color: hourFilter === "over_9h" ? "#7c3aed" : undefined }}>
                            ทำงาน &gt; 9 ชม. (จ.-ศ.)
                        </span>
                        <span className={`${styles.kpiFilterBadgePurple} ${hourFilter === "over_9h" ? styles.kpiFilterBadgePurpleActive : ""}`}>
                            {hourFilter === "over_9h" ? "กำลังกรองอยู่" : "คลิกเพื่อกรอง"}
                        </span>
                    </div>
                    <div className={styles.kpiVal} style={{ color: "#7c3aed" }}>
                        {totalOver9h.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text4)" }}>ครั้ง</span>
                    </div>
                    <div className={styles.kpiSub} style={{ color: hourFilter === "over_9h" ? "#7c3aed" : undefined, fontWeight: hourFilter === "over_9h" ? 600 : 400 }}>
                        เกินรวม <b>{Math.floor(totalOver9hMins / 60)} ชม.{totalOver9hMins % 60 > 0 ? ` ${totalOver9hMins % 60} น.` : ""}</b> ({affectedOver9hCount} คน)
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                MODE B: INDIVIDUAL EMPLOYEE DETAIL VIEW
                ══════════════════════════════════════════════════════════════ */}
            {filterEmpId !== "all" && (
                <>
                    {/* Individual Hero Card */}
                    <div className={styles.empHeroCard}>
                        <div className={styles.empHeroLeft}>
                            <button
                                className={styles.btnBack}
                                onClick={() => {
                                    setFilterEmpId("all");
                                    setDetailHourFilter("all");
                                }}
                                title="กลับไปดูสรุปภาพรวมทุกคน"
                            >
                                <ArrowLeftIcon width={14} />
                                <span>กลับไปภาพรวม</span>
                            </button>

                            <div className={styles.empAvatar}>
                                {selectedEmployeeObj?.name ? selectedEmployeeObj.name.charAt(0) : "P"}
                            </div>

                            <div className={styles.empHeroInfo}>
                                <div className={styles.empHeroName}>
                                    {selectedEmployeeObj ? selectedEmployeeObj.name : filterEmpId}
                                </div>
                                <div className={styles.empHeroMeta}>
                                    <span className={styles.monoText}>{filterEmpId}</span>
                                    <span>•</span>
                                    <span>{selectedEmployeeSummary?.branch_id || "ไม่ระบุสาขา"}</span>
                                    {selectedEmployeeObj?.is_checkin_exempt && (
                                        <>
                                            <span>•</span>
                                            <span className={styles.exemptBadge}>ยกเว้นลงเวลา</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Individual mini KPI metrics */}
                        {selectedEmployeeSummary && (
                            <div className={styles.empMiniKpiChips}>
                                <div className={styles.miniKpiChip}>
                                    <span className={styles.miniKpiChipLabel}>มาทำงาน</span>
                                    <span className={styles.miniKpiChipVal} style={{ color: "#059669" }}>
                                        {selectedEmployeeSummary.present_days} วัน
                                    </span>
                                </div>
                                <div className={styles.miniKpiChip}>
                                    <span className={styles.miniKpiChipLabel}>มาสาย</span>
                                    <span className={styles.miniKpiChipVal} style={{ color: "#d97706" }}>
                                        {selectedEmployeeSummary.late_count} ครั้ง ({selectedEmployeeSummary.late_mins} น.)
                                    </span>
                                </div>
                                <div className={styles.miniKpiChip}>
                                    <span className={styles.miniKpiChipLabel}>วันลา</span>
                                    <span className={styles.miniKpiChipVal} style={{ color: "#2563eb" }}>
                                        {selectedEmployeeSummary.leave_days} วัน
                                    </span>
                                </div>
                                <div
                                    className={styles.miniKpiChip}
                                    style={{
                                        border: (selectedEmployeeSummary.under_9h_count || 0) > 0 ? "1px solid #fed7aa" : undefined,
                                        background: (selectedEmployeeSummary.under_9h_count || 0) > 0 ? "#fff7ed" : undefined
                                    }}
                                >
                                    <span className={styles.miniKpiChipLabel} style={{ color: (selectedEmployeeSummary.under_9h_count || 0) > 0 ? "#ea580c" : undefined }}>
                                        &lt; 9 ชม.
                                    </span>
                                    <span className={styles.miniKpiChipVal} style={{ color: (selectedEmployeeSummary.under_9h_count || 0) > 0 ? "#ea580c" : undefined }}>
                                        {selectedEmployeeSummary.under_9h_count || 0} วัน
                                    </span>
                                </div>
                                <div
                                    className={styles.miniKpiChip}
                                    style={{
                                        border: (selectedEmployeeSummary.over_9h_count || 0) > 0 ? "1px solid #ddd6fe" : undefined,
                                        background: (selectedEmployeeSummary.over_9h_count || 0) > 0 ? "#f5f3ff" : undefined
                                    }}
                                >
                                    <span className={styles.miniKpiChipLabel} style={{ color: (selectedEmployeeSummary.over_9h_count || 0) > 0 ? "#7c3aed" : undefined }}>
                                        &gt; 9 ชม.
                                    </span>
                                    <span className={styles.miniKpiChipVal} style={{ color: (selectedEmployeeSummary.over_9h_count || 0) > 0 ? "#7c3aed" : undefined }}>
                                        {selectedEmployeeSummary.over_9h_count || 0} วัน
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Detailed Attendance Table */}
                    <div className={styles.tableCard}>
                        {isTableLoading && (
                            <div className={styles.loadingOverlay}>
                                <div className={styles.loadingBox}>
                                    <div className={styles.spinner} />
                                    <span>กำลังโหลดรายละเอียดการลงเวลา...</span>
                                </div>
                            </div>
                        )}

                        <div className={styles.tableHeader}>
                            <div className={styles.tableHeaderTitle}>
                                <DocumentTextIcon width={18} style={{ color: "var(--red)" }} />
                                <span>บันทึกการลงเวลารายวัน: <b>{selectedEmployeeName}</b></span>
                            </div>

                            <div className={styles.tableHeaderActions}>
                                <div className={styles.filterPills}>
                                    <button
                                        className={`${styles.filterPillBtn} ${detailHourFilter === "all" ? styles.filterPillActive : ""}`}
                                        onClick={() => setDetailHourFilter("all")}
                                    >
                                        ทั้งหมด ({details.length})
                                    </button>
                                    <button
                                        className={`${styles.filterPillBtn} ${detailHourFilter === "under_9h" ? styles.filterPillActive : ""}`}
                                        onClick={() => setDetailHourFilter("under_9h")}
                                        style={{ color: detailHourFilter === "under_9h" ? "#ea580c" : undefined }}
                                    >
                                        <ExclamationTriangleIcon width={13} style={{ display: "inline-block", marginRight: 3 }} />
                                        &lt; 9 ชม. ({details.filter(d => d.is_under_9h).length})
                                    </button>
                                    <button
                                        className={`${styles.filterPillBtn} ${detailHourFilter === "over_9h" ? styles.filterPillActive : ""}`}
                                        onClick={() => setDetailHourFilter("over_9h")}
                                        style={{ color: detailHourFilter === "over_9h" ? "#7c3aed" : undefined }}
                                    >
                                        <FireIcon width={13} style={{ display: "inline-block", marginRight: 3 }} />
                                        &gt; 9 ชม. ({details.filter(d => d.is_over_9h).length})
                                    </button>
                                </div>

                                <button
                                    className={`${styles.btnAction} ${styles.btnExcel}`}
                                    onClick={() => exportFile("excel")}
                                    disabled={exportingType === "excel"}
                                    style={{
                                        height: 32,
                                        fontSize: 12,
                                        background: detailHourFilter === "under_9h" ? "#ea580c" : detailHourFilter === "over_9h" ? "#7c3aed" : undefined
                                    }}
                                    title="ส่งออก Excel ของพนักงานคนนี้"
                                >
                                    <ArrowDownTrayIcon width={13} />
                                    <span>
                                        {detailHourFilter === "under_9h"
                                            ? "Excel (< 9 ชม.)"
                                            : detailHourFilter === "over_9h"
                                                ? "Excel (> 9 ชม.)"
                                                : "Excel บุคคล"
                                        }
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className={styles.tableScroll}>
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 140 }}>วันที่</th>
                                        <th>บันทึกเช็คอิน</th>
                                        <th>บันทึกเช็คเอาท์</th>
                                        <th style={{ textAlign: "center", width: 180 }}>ระยะเวลาทำงาน</th>
                                        <th>แผนงานประจำวัน</th>
                                        <th style={{ textAlign: "center", width: 130 }}>สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDetails.map((d, i) => {
                                        const isHighlight = d.is_weekend || d.status.includes("วันหยุด");
                                        const dayName = getDayOfWeekThai(d.date);

                                        return (
                                            <tr key={i} style={{ background: isHighlight ? "#fcfcfd" : undefined }}>
                                                <td>
                                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                                        <span style={{ fontWeight: 700, color: d.is_weekend ? "var(--text4)" : "var(--text)" }}>
                                                            {d.date}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: "var(--text4)" }}>
                                                            วัน{dayName}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td>
                                                    {d.in_time ? (
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", gap: 6 }}>
                                                                {d.in_time}
                                                                {d.is_trip && (
                                                                    <span className={styles.badgeTrip} style={{ fontSize: 9.5, padding: "1px 5px" }}>TRIP</span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 2 }}>{d.in_loc || "-"}</div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "var(--text5)" }}>—</span>
                                                    )}
                                                </td>

                                                <td>
                                                    {d.out_time ? (
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: "#ea580c" }}>{d.out_time}</div>
                                                            <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 2 }}>{d.out_loc || "-"}</div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "var(--text5)" }}>—</span>
                                                    )}
                                                </td>

                                                <td style={{ textAlign: "center" }}>
                                                    {d.work_duration_display ? (
                                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                            <span
                                                                style={{
                                                                    fontWeight: 700,
                                                                    fontSize: 13,
                                                                    color: d.is_under_9h ? "#ea580c" : d.is_over_9h ? "#7c3aed" : "var(--text)"
                                                                }}
                                                            >
                                                                {d.work_duration_display}
                                                            </span>

                                                            {d.is_under_9h ? (
                                                                <span className={styles.under9DiffBadge}>
                                                                    <ExclamationTriangleIcon width={11} /> ขาด {d.under_9h_diff_mins} น.
                                                                </span>
                                                            ) : d.is_over_9h && d.over_9h_diff_mins ? (
                                                                <span className={styles.over9DiffBadge}>
                                                                    <FireIcon width={11} /> + เกิน {Math.floor(d.over_9h_diff_mins / 60) > 0 ? `${Math.floor(d.over_9h_diff_mins / 60)} ชม. ` : ""}{d.over_9h_diff_mins % 60} น.
                                                                </span>
                                                            ) : (
                                                                <span style={{ fontSize: 10, color: "#059669", fontWeight: 600, marginTop: 2 }}>
                                                                    ครบ 9 ชม.
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "var(--text5)" }}>—</span>
                                                    )}
                                                </td>

                                                <td>
                                                    {d.work_plan ? (
                                                        <div
                                                            className={styles.workPlanPreview}
                                                            onClick={() => setActiveWorkPlanModal({ date: d.date, plan: d.work_plan! })}
                                                            title="คลิกเพื่อดูรายละเอียดแผนงานเต็ม"
                                                        >
                                                            <EyeIcon width={14} style={{ flexShrink: 0 }} />
                                                            <span>
                                                                {d.work_plan.morning || d.work_plan.afternoon || "ดูแผนงาน"}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "var(--text5)", fontSize: 12 }}>— ไม่มีแผนงาน —</span>
                                                    )}
                                                </td>

                                                <td style={{ textAlign: "center" }}>
                                                    {renderStatusBadge(d.status)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {sortedDetails.length === 0 && (
                                        <tr>
                                            <td colSpan={6}>
                                                <div className={styles.emptyState}>
                                                    <InboxIcon width={34} className={styles.emptyStateIcon} />
                                                    <div>ไม่พบรายละเอียดประวัติการลงเวลาในช่วงนี้</div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                MODE A: ALL EMPLOYEES MASTER SUMMARY VIEW
                ══════════════════════════════════════════════════════════════ */}
            {filterEmpId === "all" && (
                <div className={styles.tableCard}>
                    {isTableLoading && (
                        <div className={styles.loadingOverlay}>
                            <div className={styles.loadingBox}>
                                <div className={styles.spinner} />
                                <span>กำลังประมวลผลสรุปข้อมูลพนักงาน...</span>
                            </div>
                        </div>
                    )}

                    <div className={styles.tableHeader}>
                        <div className={styles.tableHeaderTitle}>
                            <SparklesIcon width={18} style={{ color: "var(--red)" }} />
                            <span>ตารางสรุปภาพรวมสถิติพนักงาน ({displayedSummaryData.length} คน)</span>
                        </div>

                        <div className={styles.tableHeaderActions}>
                            {/* In-table Instant Search */}
                            <div style={{ position: "relative" }}>
                                <MagnifyingGlassIcon
                                    width={14}
                                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text4)" }}
                                />
                                <input
                                    type="text"
                                    placeholder="ค้นหาชื่อ, รหัส, สาขา..."
                                    value={inTableSearch}
                                    onChange={e => setInTableSearch(e.target.value)}
                                    className={styles.inTableSearchInput}
                                />
                            </div>

                            {/* Active filter badge if filtering under 9h */}
                            {hourFilter === "under_9h" && (
                                <div className={styles.activeFilterNotice}>
                                    <ExclamationTriangleIcon width={14} />
                                    <span>กรองเฉพาะ &lt; 9 ชม. ({displayedSummaryData.length} คน)</span>
                                    <button
                                        className={styles.btnClearFilter}
                                        onClick={() => setHourFilter("all")}
                                        title="ล้างตัวกรอง"
                                    >
                                        <XMarkIcon width={13} />
                                    </button>
                                </div>
                            )}

                            {/* Active filter badge if filtering over 9h */}
                            {hourFilter === "over_9h" && (
                                <div className={styles.activeFilterNoticePurple}>
                                    <FireIcon width={14} />
                                    <span>กรองเฉพาะ &gt; 9 ชม. ({displayedSummaryData.length} คน)</span>
                                    <button
                                        className={styles.btnClearFilterPurple}
                                        onClick={() => setHourFilter("all")}
                                        title="ล้างตัวกรอง"
                                    >
                                        <XMarkIcon width={13} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.tableScroll}>
                        {displayedSummaryData.length === 0 && !isTableLoading ? (
                            <div className={styles.emptyState}>
                                <InboxIcon width={36} className={styles.emptyStateIcon} />
                                <div style={{ fontWeight: 600, fontSize: 14 }}>ไม่พบข้อมูลที่ตรงกับเงื่อนไข</div>
                                <div style={{ fontSize: 12, marginTop: 4 }}>ลองเปลี่ยนช่วงวันที่ หรือล้างคำค้นหา</div>
                            </div>
                        ) : (
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 110 }}>รหัส</th>
                                        <th>พนักงาน / สาขา</th>
                                        <th style={{ textAlign: "center" }}>มาทำงาน</th>
                                        <th style={{ textAlign: "center" }}>ขาดงาน</th>
                                        <th style={{ textAlign: "center" }}>ออก ตจว.</th>
                                        <th style={{ textAlign: "center" }}>วันลา</th>
                                        <th style={{ textAlign: "center" }}>มาสาย</th>
                                        <th style={{ textAlign: "center" }}>ทำงาน &lt; 9 ชม.</th>
                                        <th style={{ textAlign: "center" }}>ทำงาน &gt; 9 ชม.</th>
                                        <th style={{ textAlign: "center", width: 100 }}>รายละเอียด</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedSummaryData.map(row => (
                                        <tr
                                            key={row.emp_id}
                                            className={styles.dataRowClickable}
                                            onClick={() => {
                                                setFilterEmpId(row.emp_id);
                                                setDetailHourFilter("all");
                                            }}
                                        >
                                            <td>
                                                <span className={styles.monoText}>{row.emp_id}</span>
                                            </td>

                                            <td>
                                                <div className={styles.empNameCell}>
                                                    <span>{row.name}</span>
                                                    {row.is_checkin_exempt && (
                                                        <span className={styles.exemptBadge}>ยกเว้นลงเวลา</span>
                                                    )}
                                                </div>
                                                <div className={styles.branchSub}>
                                                    {row.branch_id || "ไม่ระบุสาขา"}
                                                </div>
                                            </td>

                                            <td style={{ textAlign: "center" }}>
                                                {row.is_checkin_exempt ? (
                                                    <span style={{ color: "var(--text4)", fontSize: 12 }}>ยกเว้นลงเวลา</span>
                                                ) : (
                                                    <span style={{ fontWeight: 700, color: "#059669", fontSize: 13.5 }}>
                                                        {row.present_days} <small style={{ fontWeight: 400, color: "var(--text4)", fontSize: 11 }}>วัน</small>
                                                    </span>
                                                )}
                                            </td>

                                            <td style={{ textAlign: "center" }}>
                                                {row.absent_days > 0 ? (
                                                    <span className={`${styles.badge} ${styles.badgeAbsent}`}>
                                                        {row.absent_days} วัน
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "var(--text5)" }}>-</span>
                                                )}
                                            </td>

                                            <td style={{ textAlign: "center" }}>
                                                {(row.travel_days || 0) > 0 ? (
                                                    <span className={`${styles.badge} ${styles.badgeTrip}`}>
                                                        {row.travel_days} วัน
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "var(--text5)" }}>-</span>
                                                )}
                                            </td>

                                            <td style={{ textAlign: "center" }}>
                                                {row.leave_days > 0 ? (
                                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                        <span className={`${styles.badge} ${styles.badgeLeave}`}>
                                                            {row.leave_days} วัน
                                                        </span>
                                                        {row.pending_leave_days > 0 && (
                                                            <small style={{ fontSize: 10, color: "#d97706", marginTop: 2 }}>
                                                                (รออนุมัติ {row.pending_leave_days})
                                                            </small>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "var(--text5)" }}>-</span>
                                                )}
                                            </td>

                                            <td style={{ textAlign: "center" }}>
                                                {row.late_count > 0 ? (
                                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                        <span style={{ color: "#d97706", fontWeight: 800, fontSize: 13.5 }}>
                                                            {row.late_count} <small style={{ fontWeight: 500, color: "var(--text4)", fontSize: 11 }}>ครั้ง</small>
                                                        </span>
                                                        <small style={{ color: "var(--text4)", fontSize: 10.5 }}>
                                                            สายรวม {row.late_mins} น.
                                                        </small>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "var(--text5)" }}>-</span>
                                                )}
                                            </td>

                                            {/* Under 9h Pill */}
                                            <td style={{ textAlign: "center" }}>
                                                {(row.under_9h_count || 0) > 0 ? (
                                                    <button
                                                        className={styles.under9Pill}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFilterEmpId(row.emp_id);
                                                            setDetailHourFilter("under_9h");
                                                        }}
                                                        title="คลิกเพื่อดูรายละเอียดวันที่ทำงาน < 9 ชม. ของคนนี้ทันที"
                                                    >
                                                        <ExclamationTriangleIcon width={13} />
                                                        <span>{row.under_9h_count} วัน</span>
                                                    </button>
                                                ) : (
                                                    <span style={{ color: "var(--text5)" }}>-</span>
                                                )}
                                            </td>

                                            {/* Over 9h Pill */}
                                            <td style={{ textAlign: "center" }}>
                                                {(row.over_9h_count || 0) > 0 ? (
                                                    <button
                                                        className={styles.over9Pill}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFilterEmpId(row.emp_id);
                                                            setDetailHourFilter("over_9h");
                                                        }}
                                                        title={`คลิกเพื่อดูรายละเอียดวันที่ทำงาน > 9 ชม. (เกินรวม ${Math.floor((row.over_9h_mins || 0) / 60)} ชม. ${(row.over_9h_mins || 0) % 60} น.)`}
                                                    >
                                                        <FireIcon width={13} />
                                                        <span>{row.over_9h_count} วัน</span>
                                                    </button>
                                                ) : (
                                                    <span style={{ color: "var(--text5)" }}>-</span>
                                                )}
                                            </td>

                                            <td style={{ textAlign: "center" }}>
                                                <button
                                                    className={styles.btnViewDetail}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFilterEmpId(row.emp_id);
                                                        setDetailHourFilter("all");
                                                    }}
                                                >
                                                    <EyeIcon width={13} />
                                                    <span>ดูข้อมูล</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                WORK PLAN MODAL
                ══════════════════════════════════════════════════════════════ */}
            {activeWorkPlanModal && (
                <div
                    className={styles.modalOverlay}
                    onClick={() => setActiveWorkPlanModal(null)}
                >
                    <div
                        className={styles.modalContent}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitle}>
                                <CalendarIcon width={18} style={{ color: "#3b82f6" }} />
                                <span>แผนงานประจำวัน: {activeWorkPlanModal.date}</span>
                            </div>
                            <button
                                className={styles.modalClose}
                                onClick={() => setActiveWorkPlanModal(null)}
                                title="ปิดหน้าต่าง"
                            >
                                <XMarkIcon width={18} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.planBlock}>
                                <div className={styles.planBlockLabel}>ช่วงเช้า (Morning)</div>
                                <div className={styles.planBlockText}>
                                    {activeWorkPlanModal.plan.morning || "ไม่ได้ระบุ"}
                                </div>
                                {activeWorkPlanModal.plan.morning_loc && (
                                    <div className={styles.planBlockSub}>
                                        สถานที่: {activeWorkPlanModal.plan.morning_loc}
                                    </div>
                                )}
                            </div>

                            <div className={styles.planBlock}>
                                <div className={styles.planBlockLabel}>ช่วงบ่าย (Afternoon)</div>
                                <div className={styles.planBlockText}>
                                    {activeWorkPlanModal.plan.afternoon || "ไม่ได้ระบุ"}
                                </div>
                                {activeWorkPlanModal.plan.afternoon_loc && (
                                    <div className={styles.planBlockSub}>
                                        สถานที่: {activeWorkPlanModal.plan.afternoon_loc}
                                    </div>
                                )}
                            </div>

                            {activeWorkPlanModal.plan.ot && (
                                <div className={styles.planBlock} style={{ borderLeft: "3px solid #f59e0b" }}>
                                    <div className={styles.planBlockLabel} style={{ color: "#f59e0b" }}>งานล่วงเวลา (OT)</div>
                                    <div className={styles.planBlockText}>
                                        {activeWorkPlanModal.plan.ot}
                                    </div>
                                    {activeWorkPlanModal.plan.ot_attendant && (
                                        <div className={styles.planBlockSub}>
                                            ผู้ช่วย/ผู้ร่วมงาน: {activeWorkPlanModal.plan.ot_attendant}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
