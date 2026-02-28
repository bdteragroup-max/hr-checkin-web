"use client";

import Image from "next/image";
import Link from "next/link";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

/* ══════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════ */
interface Branch { id: string; name: string; }

interface CheckItem {
    id: string;
    emp_id: string;
    name: string;
    type: "Check-in" | "Check-out" | string;
    timestamp: string;
    branch_name: string;
    distance?: number | null;
    photo_url?: string | null;
    project_name?: string | null;
    remark?: string | null;
    late_status?: "ontime" | "late" | "ot" | string;
    late_label?: string;
}

interface DashboardData {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    recent: CheckItem[];
}

interface LeaveRequest {
    id: string;
    emp_id: string;
    name: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number;
    reason?: string;
    status: "pending" | "approved" | "rejected";
}

interface Holiday { date: string; name: string; }

interface MonthlyReport {
    workDays: number;
    lateTimes: number;
    otMinutes: number;
    leaveDays: number;
    absentDays: number;
    totalOtPay: number;
    holidays: number;
    employees: EmpSummary[];
}

interface EmpSummary {
    emp_id: string;
    name: string;
    branch: string;
    presentDays: number;
    lateTimes: number;
    otHours: string;
    otPay: number;
    leaveDays: number;
    absentDays: number;
    workHours: string;
    lateMins: number;
}

interface PhotoModal {
    url: string;
    empId: string;
    name: string;
    time: string;
    type: string;
    lateLabel: string;
}

interface EmpDailyRow {
    date: string;
    checkIn?: string;
    checkOut?: string;
    workHours?: string;
    late_status?: string;
    late_label?: string;
    leaveType?: string;
    note?: string;
    project_string?: string;
}

interface EmpDetail extends EmpSummary {
    dailyRows: EmpDailyRow[];
}

interface Project {
    id: number;
    code: string | null;
    name: string;
    client_name: string | null;
    address: string | null;
    is_active: boolean;
    status?: string;
    contact?: string | null;
    phone?: string | null;
    lat?: number | null;
    lng?: number | null;
    radius_m?: number;
    created_at: string;
}

type TabKey = "dashboard" | "attendance" | "leave" | "holiday" | "report" | "projects";

const PAGE_SIZE = 25;

const TH_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const TH_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function fmtThai(d: Date | string | null | undefined) {
    if (!d) return "-";
    const date = typeof d === "string" ? new Date(d) : d;
    if (isNaN(date.getTime())) return "-";
    return `${date.getDate()} ${TH_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

const DEFAULT_LEAVE_TYPES = [
    { id: "sick", name: "ลาป่วย", color: "#ef4444", quota: 30 },
    { id: "personal", name: "ลากิจ", color: "#3b82f6", quota: 6 },
    { id: "vacation", name: "ลาพักร้อน", color: "#10b981", quota: 10 },
    { id: "maternity", name: "ลาคลอด", color: "#ec4899", quota: 90 },
    { id: "ordain", name: "ลาบวช", color: "#f59e0b", quota: 15 },
];

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function formatTime(ts: string) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function badgeClass(status: string) {
    const map: Record<string, string> = {
        ontime: styles.ontime, late: styles.late, ot: styles.ot, early: styles.early,
        leave: styles.leave, absent: styles.absent, holiday: styles.holiday,
        pending: styles.pending, approved: styles.approved, rejected: styles.rejected,
    };
    return `${styles.badge} ${map[status] || styles.ontime}`;
}

function tabFromQuery(t: string | null): TabKey {
    const v = (t || "dashboard").toLowerCase();
    if (v === "attendance" || v === "leave" || v === "holiday" || v === "report" || v === "projects") return v as TabKey;
    return "dashboard";
}

/* ══════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════ */
function AdminPageInner() {
    const searchParams = useSearchParams();

    /* ── Global ── */
    const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
    const [branches, setBranches] = useState<Branch[]>([]);
    const [toast, setToast] = useState<{ msg: string; type: "ok" | "bad" } | null>(null);
    const [photoModal, setPhotoModal] = useState<PhotoModal | null>(null);

    /* ── Dashboard ── */
    const [dash, setDash] = useState<DashboardData | null>(null);
    const [notifs, setNotifs] = useState<{
        arrivals: any[],
        birthdays: any[],
        pendingClaimsCount: number
    } | null>(null);

    /* ── Attendance ── */
    const [allRows, setAllRows] = useState<CheckItem[]>([]);
    const [attLoading, setAttLoading] = useState(false);
    const [attMsg, setAttMsg] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [filterBranch, setFilterBranch] = useState("");
    const [filterSearch, setFilterSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    /* ── Leave ── */
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [leaveLoading, setLeaveLoading] = useState(false);

    /* ── Holiday ── */
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [holidayDate, setHolidayDate] = useState("");
    const [holidayName, setHolidayName] = useState("");

    /* ── Projects ── */
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsSearch, setProjectsSearch] = useState("");
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [projectForm, setProjectForm] = useState<Partial<Project>>({ id: 0, code: "", name: "", client_name: "", address: "", is_active: true, status: "CURRENT", contact: "", phone: "", lat: null, lng: null, radius_m: 200 });

    /* ── REPORT & PAYROLL ── */
    const currentY = new Date().getFullYear();
    const currentM = String(new Date().getMonth() + 1).padStart(2, "0");

    const [reportSelYear, setReportSelYear] = useState<string>(currentY.toString());
    const [reportSelMonth, setReportSelMonth] = useState<string>(currentM);

    // API payload string
    const reportMonth = `${reportSelYear}-${reportSelMonth}`;

    const [reportBranch, setReportBranch] = useState("");
    const [report, setReport] = useState<MonthlyReport | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportSearch, setReportSearch] = useState("");
    const [hideResigned, setHideResigned] = useState(true);

    /* ── Expanding Row State ── */
    const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
    const [empDetailsCache, setEmpDetailsCache] = useState<Record<string, EmpDetail>>({});

    /* ── Settings Modal ── */
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState<"shift" | "payroll">("shift");

    /* ค่าจริงที่ใช้งาน (committed) */
    const [shiftStart, setShiftStart] = useState("09:00");
    const [shiftEnd, setShiftEnd] = useState("18:00");
    const [graceMin, setGraceMin] = useState(0);

    /* ค่า draft ใน modal — ยังไม่บันทึก */
    const [draftStart, setDraftStart] = useState("09:00");
    const [draftEnd, setDraftEnd] = useState("18:00");
    const [draftGrace, setDraftGrace] = useState(0);

    function openSettings(tab: "shift" | "payroll" = "shift") {
        setDraftStart(shiftStart);
        setDraftEnd(shiftEnd);
        setDraftGrace(graceMin);
        setSettingsTab(tab);
        setShowSettings(true);
    }
    function saveSettings() {
        setShiftStart(draftStart);
        setShiftEnd(draftEnd);
        setGraceMin(draftGrace);
        setShowSettings(false);
        showToast("✅ บันทึกการตั้งค่าแล้ว");
    }
    function closeSettings() {
        setShowSettings(false);
    }

    /* ── Employee Detail Drawer ── */
    const [empDetail, setEmpDetail] = useState<EmpDetail | null>(null);
    const [empDetailLoading, setEmpDetailLoading] = useState(false);

    function showToast(msg: string, type: "ok" | "bad" = "ok") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    /* ✅ sync activeTab with URL (?tab=...) */
    useEffect(() => {
        const t = tabFromQuery(searchParams.get("tab"));
        setActiveTab(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    /* ─────────────────────────────────── */
    /*  INIT                               */
    /* ─────────────────────────────────── */
    useEffect(() => {
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
        setFilterDate(today);
        loadBranches();
        loadDashboard();
        loadNotifications();
    }, []);

    async function loadNotifications() {
        try {
            const r = await fetch("/api/admin/notifications");
            const d = await r.json();
            if (d.ok) setNotifs(d);
        } catch { }
    }

    /* Reload attendance / report when tab switches */
    useEffect(() => {
        if (activeTab === "attendance") loadAttendance();
        if (activeTab === "leave") loadLeave();
        if (activeTab === "holiday") loadHolidays();
        if (activeTab === "report") loadReport();
        if (activeTab === "projects") loadProjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    /* ─────────────────────────────────── */
    /*  BRANCHES                           */
    /* ─────────────────────────────────── */
    async function loadBranches() {
        try {
            const r = await fetch("/api/branches", { cache: "no-store" });
            const d = await r.json().catch(() => ({}));
            setBranches(d.branches || []);
        } catch { setBranches([]); }
    }

    /* ─────────────────────────────────── */
    /*  DASHBOARD                          */
    /* ─────────────────────────────────── */
    async function loadDashboard() {
        try {
            const r = await fetch("/api/admin/dashboard", { cache: "no-store" });
            if (!r.ok) { handleAuthError(await r.json().catch(() => ({}))); return; }
            const d = await r.json();
            setDash(d);
        } catch { setDash(null); }
    }

    /* ─────────────────────────────────── */
    /*  ATTENDANCE                         */
    /* ─────────────────────────────────── */
    const qs = useMemo(() => {
        const p = new URLSearchParams();
        if (filterDate) p.append("date", filterDate);
        if (filterBranch) p.append("branch", filterBranch);
        return p.toString();
    }, [filterDate, filterBranch]);

    async function loadAttendance() {
        setAttLoading(true); setAttMsg("");
        try {
            const r = await fetch(`/api/admin/checkins?${qs}`, { cache: "no-store" });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) { handleAuthError(data); setAllRows([]); setAttMsg(data?.error || "FAILED"); return; }
            setAllRows(data.list || []);
            setCurrentPage(1);
        } catch { setAllRows([]); setAttMsg("โหลดข้อมูลไม่สำเร็จ"); }
        finally { setAttLoading(false); }
    }

    const filteredRows = useMemo(() => {
        const q = filterSearch.toLowerCase();
        return allRows.filter(r => {
            const matchQ = !q || r.emp_id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
            const matchSt = !filterStatus || r.late_status === filterStatus;
            return matchQ && matchSt;
        });
    }, [allRows, filterSearch, filterStatus]);

    const pagedRows = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredRows.slice(start, start + PAGE_SIZE);
    }, [filteredRows, currentPage]);

    const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;

    /* ─────────────────────────────────── */
    /*  LEAVE                              */
    /* ─────────────────────────────────── */
    async function loadLeave() {
        setLeaveLoading(true);
        try {
            const r = await fetch("/api/admin/leave", { cache: "no-store" });
            if (!r.ok) return;
            const d = await r.json();
            setLeaveRequests(d.requests || []);
        } catch { setLeaveRequests([]); }
        finally { setLeaveLoading(false); }
    }

    async function approveLeave(id: string, status: "approved" | "rejected") {
        try {
            const r = await fetch("/api/admin/leave/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status }),
            });
            if (r.ok) {
                showToast(status === "approved" ? "✅ อนุมัติแล้ว" : "❌ ปฏิเสธแล้ว", status === "approved" ? "ok" : "bad");
                loadLeave();
            } else showToast("เกิดข้อผิดพลาด", "bad");
        } catch { showToast("เกิดข้อผิดพลาด", "bad"); }
    }

    const pendingLeave = leaveRequests.filter(r => r.status === "pending");

    /* ─────────────────────────────────── */
    /*  HOLIDAY                            */
    /* ─────────────────────────────────── */
    async function loadHolidays() {
        try {
            const r = await fetch("/api/admin/holidays", { cache: "no-store" });
            if (!r.ok) return;
            const d = await r.json();
            setHolidays(d.holidays || []);
        } catch { setHolidays([]); }
    }

    async function addHoliday() {
        if (!holidayDate || !holidayName.trim()) { showToast("กรุณากรอกวันที่และชื่อวันหยุด", "bad"); return; }
        try {
            const r = await fetch("/api/admin/holidays", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: holidayDate, name: holidayName.trim() }),
            });
            if (r.ok) { showToast("✅ เพิ่มวันหยุดแล้ว"); setHolidayDate(""); setHolidayName(""); loadHolidays(); }
            else showToast("เกิดข้อผิดพลาด", "bad");
        } catch { showToast("เกิดข้อผิดพลาด", "bad"); }
    }

    async function deleteHoliday(date: string) {
        if (!confirm(`ลบวันหยุด ${date} ออก?`)) return;
        try {
            const r = await fetch("/api/admin/holidays", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date }),
            });
            if (r.ok) { showToast("🗑 ลบแล้ว"); loadHolidays(); }
            else showToast("เกิดข้อผิดพลาด", "bad");
        } catch { showToast("เกิดข้อผิดพลาด", "bad"); }
    }

    /* ─────────────────────────────────── */
    /*  PROJECTS                           */
    /* ─────────────────────────────────── */
    async function loadProjects() {
        setProjectsLoading(true);
        try {
            const r = await fetch("/api/projects?all=1", { cache: "no-store" });
            if (!r.ok) return;
            const d = await r.json();
            setProjects(d.projects || []);
        } catch { setProjects([]); }
        finally { setProjectsLoading(false); }
    }

    async function saveProject() {
        if (!projectForm.name?.trim()) { showToast("กรุณากรอกชื่อโครงการ", "bad"); return; }
        const isEdit = !!projectForm.id;
        try {
            const r = await fetch("/api/projects", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(projectForm),
            });
            if (r.ok) {
                showToast(`✅ ${isEdit ? "แก้ไข" : "เพิ่ม"}โครงการสำเร็จ`);
                setShowProjectModal(false);
                loadProjects();
            } else {
                showToast("เกิดข้อผิดพลาด", "bad");
            }
        } catch { showToast("เกิดข้อผิดพลาด", "bad"); }
    }

    async function deleteProject(id: number) {
        if (!confirm(`ยืนยันการลบโครงการนี้?`)) return;
        try {
            const r = await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
            if (r.ok) { showToast("🗑 ลบแล้ว"); loadProjects(); }
            else showToast("เกิดข้อผิดพลาด", "bad");
        } catch { showToast("เกิดข้อผิดพลาด", "bad"); }
    }

    const filteredProjects = useMemo(() => {
        const q = projectsSearch.toLowerCase();
        return projects.filter(p =>
            !q || p.name.toLowerCase().includes(q) ||
            (p.code && p.code.toLowerCase().includes(q)) ||
            (p.client_name && p.client_name.toLowerCase().includes(q))
        );
    }, [projects, projectsSearch]);

    /* ─────────────────────────────────── */
    /*  REPORT                             */
    /* ─────────────────────────────────── */
    async function loadReport(m = reportMonth, b = reportBranch, hide = hideResigned) {
        if (!m) return;
        setReportLoading(true);
        try {
            // Debug: log both the provided params and the current component state
            console.log("loadReport: called with params ->", { m, b, hide });
            console.log("loadReport: current state ->", { reportSelYear, reportSelMonth, reportMonth, reportBranch, hideResigned });

            const p = new URLSearchParams();
            p.append("month", m);
            if (b) p.append("branch", b);
            p.append("hide_resigned", hide ? "1" : "0");
            const url = `/api/admin/report?${p.toString()}`;
            console.log("loadReport: fetching", url);
            const r = await fetch(url, { cache: "no-store" });
            if (!r.ok) return;
            const d = await r.json();
            console.log("loadReport: response employees=", (d && d.employees && d.employees.length) || 0, d?.employees?.slice(0, 3));
            setReport(d);
        } catch (err) { console.error("loadReport: error", err); setReport(null); }
        finally { setReportLoading(false); }
    }

    // Ensure report reloads when month/branch/hideResigned change while on report tab
    useEffect(() => {
        if (activeTab !== "report") return;
        // call with current computed reportMonth to keep behavior consistent
        loadReport(reportMonth, reportBranch, hideResigned);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportMonth, reportBranch, hideResigned, activeTab]);

    /* ─────────────────────────────────── */
    /*  EXPORT                             */
    /* ─────────────────────────────────── */
    async function exportData(endpoint: string, params: Record<string, string>) {
        showToast("⏳ กำลังสร้างไฟล์...");
        try {
            const p = new URLSearchParams(params);
            window.location.href = `/api/admin/export/${endpoint}?${p.toString()}`;
            setTimeout(() => showToast("✅ ดาวน์โหลดเริ่มแล้ว"), 1500);
        } catch { showToast("เกิดข้อผิดพลาด", "bad"); }
    }

    function handleAuthError(data: { error?: string }) {
        if (data?.error === "UNAUTHORIZED" || data?.error === "FORBIDDEN") {
            window.location.href = "/admin/login";
        }
    }

    const yearOptions = useMemo(() => {
        const nowYear = new Date().getFullYear();
        const opts = [];
        for (let y = nowYear + 1; y >= nowYear - 3; y--) {
            opts.push({ val: y.toString(), label: `${y + 543}` });
        }
        return opts;
    }, []);

    const monthOptionsList = useMemo(() => {
        const ms = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        return ms.map((m, i) => ({
            val: String(i + 1).padStart(2, "0"),
            label: m
        }));
    }, []);

    // Year label in CE for header filter (matches export filenames)
    const selYearLabel = String(parseInt(reportSelYear));

    // Use a memo or state that is initialized on client to prevent hydration mismatch for "today"
    const [todayLabel, setTodayLabel] = useState("");
    useEffect(() => {
        const now = new Date();
        const label = `${TH_WEEKDAYS[now.getDay()]}ที่ ${now.getDate()} ${TH_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;
        setTodayLabel(label);
    }, []);

    async function toggleEmpDetail(emp: EmpSummary) {
        if (expandedEmpId === emp.emp_id) {
            setExpandedEmpId(null);
            return;
        }

        setExpandedEmpId(emp.emp_id);

        // Use cache if we already loaded them this session
        if (empDetailsCache[emp.emp_id]) return;

        setEmpDetailLoading(true);
        try {
            const p = new URLSearchParams({ emp_id: emp.emp_id, month: reportMonth });
            const r = await fetch(`/api/admin/report/employee?${p.toString()}`, { cache: "no-store" });
            if (r.ok) {
                const d = await r.json();
                setEmpDetailsCache(prev => ({
                    ...prev,
                    [emp.emp_id]: { ...emp, dailyRows: d.dailyRows || [] }
                }));
            }
        } catch { }
        finally { setEmpDetailLoading(false); }
    }

    async function exportEmpData(emp_id: string, name: string, format: "excel" | "pdf") {
        showToast(`⏳ กำลังสร้าง ${format.toUpperCase()}...`);
        try {
            const p = new URLSearchParams({ emp_id, month: reportMonth, format });
            window.open(`/api/admin/export/employee?${p.toString()}`, "_blank");
            setTimeout(() => showToast(`✅ Export ${name} สำเร็จ`), 1500);
        } catch { showToast("เกิดข้อผิดพลาด", "bad"); }
    }

    const filteredEmployees = useMemo(() => {
        if (!report) return [];
        const q = reportSearch.toLowerCase();
        return report.employees.filter(e =>
            !q || e.emp_id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || e.branch.toLowerCase().includes(q)
        );
    }, [report, reportSearch]);

    /* ══════════════════════════════════════════════
       RENDER TABS (ใช้ของเดิมคุณ)
    ══════════════════════════════════════════════ */

    function renderDashboard() {
        return (
            <>
                {notifs && (notifs.arrivals.length > 0 || notifs.birthdays.length > 0 || notifs.pendingClaimsCount > 0) && (
                    <div className={styles.notifTray}>
                        {notifs.arrivals.map(a => (
                            <div key={a.emp_id} className={styles.notifItem}>
                                <span className={styles.notifIcon}>👋</span>
                                <div className={styles.notifText}>
                                    <b>{a.name}</b> จะเริ่มงานในวันที่ {fmtThai(a.hire_date)}
                                </div>
                            </div>
                        ))}
                        {notifs.birthdays.map(b => (
                            <div key={b.emp_id} className={styles.notifItem}>
                                <span className={styles.notifIcon}>🎂</span>
                                <div className={styles.notifText}>
                                    วันนี้เป็นวันเกิดของ <b>{b.name}</b> อย่าลืมมอบสวัสดิการ!
                                </div>
                            </div>
                        ))}
                        {notifs.pendingClaimsCount > 0 && (
                            <Link href="/admin/birthday-claims" className={styles.notifItemLink}>
                                <span className={styles.notifIcon}>✍️</span>
                                <div className={styles.notifText}>
                                    มีคำขอสวัสดิการวันเกิด <b>{notifs.pendingClaimsCount} รายการ</b> ที่รอการตรวจสอบ
                                </div>
                                <span className={styles.notifArrow}>›</span>
                            </Link>
                        )}
                    </div>
                )}

                <div className={styles.statsGrid}>
                    {([
                        { color: "green", icon: "✅", val: dash?.present, label: "มาทำงานวันนี้" },
                        { color: "red", icon: "❌", val: dash?.absent, label: "ขาดงาน" },
                        { color: "orange", icon: "⏰", val: dash?.late, label: "มาสาย" },
                        { color: "blue", icon: "🏖️", val: dash?.onLeave, label: "ลาวันนี้" },
                    ] as { color: string; icon: string; val: number | undefined; label: string }[]).map(s => (
                        <div key={s.label} className={`${styles.statCard} ${styles[s.color as keyof typeof styles]}`}>
                            <div className={styles.statTop}>
                                <div className={styles.statVal}>{s.val ?? "—"}</div>
                                <div className={styles.statIconBox}>{s.icon}</div>
                            </div>
                            <div className={styles.statLabel}>{s.label}</div>
                        </div>
                    ))}
                </div>

                <div className={styles.tableWrap}>
                    <div className={styles.tableHeader}>
                        <div className={styles.tableHeaderTitle}>📋 กิจกรรมล่าสุดวันนี้</div>
                        <span className={styles.rowCount}>{todayLabel}</span>
                    </div>
                    <div className={styles.tableScroll}>
                        {!dash ? (
                            <div className={styles.loader}><div className={styles.spinner} />กำลังโหลด...</div>
                        ) : dash.recent.length === 0 ? (
                            <div className={styles.emptyState}><span className={styles.emptyIcon}>📭</span>ยังไม่มีข้อมูลวันนี้</div>
                        ) : (
                            <table className={styles.table}>
                                <thead><tr>
                                    <th>รหัส</th><th>ชื่อ</th><th>ประเภท</th><th>เวลา</th>
                                    <th>สถานที่ / โครงการ</th><th>สถานะ</th><th>รูป</th>
                                </tr></thead>
                                <tbody>{dash.recent.map(r => (
                                    <tr key={r.id}>
                                        <td><span className={styles.monoText}>{r.emp_id}</span></td>
                                        <td>{r.name}</td>
                                        <td>
                                            <span className={`${styles.typeBadge} ${r.type?.includes("In") ? styles.checkin : styles.checkout}`}>
                                                {r.type === "Project-In" ? "▶ เข้า (โครงการ)" : r.type === "Project-Out" ? "■ ออก (โครงการ)" : r.type === "Check-in" ? "▶ เข้า" : "■ ออก"}
                                            </span>
                                        </td>
                                        <td><span className={styles.monoText}>{formatTime(r.timestamp)}</span></td>
                                        <td>
                                            <div>{r.branch_name}</div>
                                            {(r.project_name || r.remark) && (
                                                <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 2 }}>
                                                    {r.project_name && <span><b>Prj:</b> {r.project_name} </span>}
                                                    {r.remark && <span><b>Note:</b> {r.remark}</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td>{r.late_status && (<span className={badgeClass(r.late_status)}>{r.late_label || r.late_status}</span>)}</td>
                                        <td>{r.photo_url
                                            ? <Image src={r.photo_url} alt="photo" width={60} height={45} unoptimized
                                                className={styles.photoThumb}
                                                onClick={() => setPhotoModal({ url: r.photo_url!, empId: r.emp_id, name: r.name, time: formatTime(r.timestamp), type: r.type, lateLabel: r.late_label || "" })} />
                                            : "—"}
                                        </td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        )}
                    </div>
                </div>
            </>
        );
    }

    function renderAttendance() {
        return (
            <>
                <div className={styles.filterBar}>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>ค้นหา</span>
                        <input type="text" placeholder="🔍 ชื่อ / รหัส"
                            value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setCurrentPage(1); }} />
                    </div>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>วันที่</span>
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                    </div>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>สาขา</span>
                        <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                            <option value="">ทุกสาขา</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>สถานะ</span>
                        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
                            <option value="">ทุกสถานะ</option>
                            <option value="ontime">ตรงเวลา</option>
                            <option value="late">สาย</option>
                            <option value="early">ออกก่อนเวลา</option>
                            <option value="ot">OT</option>
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>&nbsp;</span>
                        <button className={styles.btnPrimary} onClick={loadAttendance} disabled={attLoading}>
                            {attLoading ? <><span className={styles.spinner} style={{ width: 14, height: 14 }} />โหลด...</> : "🔍 ค้นหา"}
                        </button>
                    </div>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>&nbsp;</span>
                        <div style={{ display: "flex", gap: 6 }}>
                            <button className={styles.btnExcelSm} onClick={() => exportData("excel", { date: filterDate, branch: filterBranch })}>⬇ Excel</button>
                            <button className={styles.btnPdfSm} onClick={() => exportData("pdf", { date: filterDate, branch: filterBranch })}>⬇ PDF</button>
                        </div>
                    </div>
                </div>

                {attMsg && <div className={styles.errorMsg}>⚠️ {attMsg}</div>}

                <div className={styles.tableWrap}>
                    <div className={styles.tableHeader}>
                        <div className={styles.tableHeaderTitle}>📋 บันทึกการเข้า–ออกงาน</div>
                        <span className={styles.rowCount}>{filteredRows.length} รายการ</span>
                    </div>
                    <div className={styles.tableScroll}>
                        {attLoading ? (
                            <div className={styles.loader}><div className={styles.spinner} />กำลังโหลด...</div>
                        ) : (
                            <table className={styles.table}>
                                <thead><tr>
                                    <th>Timestamp</th><th>รหัส</th><th>ชื่อ</th><th>ประเภท</th>
                                    <th>เวลา</th><th>สถานที่ / โครงการ</th><th>ระยะ(m)</th><th>สถานะ</th><th>รูป</th>
                                </tr></thead>
                                <tbody>
                                    {pagedRows.map(r => (
                                        <tr key={r.id}>
                                            <td><span className={styles.timestampSub}>{r.timestamp?.slice(0, 10)}</span></td>
                                            <td><span className={styles.monoText}>{r.emp_id}</span></td>
                                            <td style={{ whiteSpace: "nowrap" }}>
                                                <div className={styles.empName}>{r.name}</div>
                                            </td>
                                            <td style={{ whiteSpace: "nowrap" }}>
                                                <span className={`${styles.typeBadge} ${r.type?.includes("In") ? styles.checkin : styles.checkout}`}>
                                                    {r.type === "Project-In" ? "▶ เข้า (โครงการ)" : r.type === "Project-Out" ? "■ ออก (โครงการ)" : r.type === "Check-in" ? "▶ เข้า" : "■ ออก"}
                                                </span>
                                            </td>
                                            <td><span className={styles.monoText}>{formatTime(r.timestamp)}</span></td>
                                            <td style={{ whiteSpace: "nowrap" }}>
                                                <span>{r.branch_name}</span>
                                                {r.project_name && <span style={{ color: "var(--text4)", marginLeft: 6 }}>• Prj: {r.project_name}</span>}
                                                {r.remark && <span style={{ color: "var(--text4)", marginLeft: 6 }}>• Note: {r.remark}</span>}
                                            </td>
                                            <td><span className={styles.monoText}>{r.distance != null ? r.distance : "—"}</span></td>
                                            <td>{r.late_status && <span className={badgeClass(r.late_status)}>{r.late_label || r.late_status}</span>}</td>
                                            <td>{r.photo_url
                                                ? <Image src={r.photo_url} alt="photo" width={60} height={45} unoptimized
                                                    className={styles.photoThumb}
                                                    onClick={() => setPhotoModal({ url: r.photo_url!, empId: r.emp_id, name: r.name, time: formatTime(r.timestamp), type: r.type, lateLabel: r.late_label || "" })} />
                                                : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                    {!attLoading && pagedRows.length === 0 && (
                                        <tr><td colSpan={9}>
                                            <div className={styles.emptyState}><span className={styles.emptyIcon}>📭</span>ไม่มีข้อมูล</div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {filteredRows.length > PAGE_SIZE && (
                        <div className={styles.pagination}>
                            <span className={styles.paginationInfo}>
                                แสดง {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredRows.length)}–{Math.min(currentPage * PAGE_SIZE, filteredRows.length)} จาก {filteredRows.length}
                            </span>
                            <div className={styles.pageButtons}>
                                <button className={styles.pageBtn} disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    const p = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                                    return (
                                        <button key={p} className={`${styles.pageBtn} ${p === currentPage ? styles.active : ""}`}
                                            onClick={() => setCurrentPage(p)}>{p}</button>
                                    );
                                })}
                                <button className={styles.pageBtn} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                            </div>
                        </div>
                    )}
                </div>
            </>
        );
    }

    function renderLeave() {
        const historyRows = leaveRequests;
        return (
            <>
                <div className={styles.leaveGrid}>
                    <div className={styles.leaveCard}>
                        <div className={styles.leaveCardTitle}>⚙️ ประเภทการลา &amp; โควต้า/ปี</div>
                        <div className={styles.leaveTypeList}>
                            {DEFAULT_LEAVE_TYPES.map(t => (
                                <div key={t.id} className={styles.leaveTypeItem}>
                                    <div className={styles.leaveTypeDot} style={{ background: t.color }} />
                                    <div className={styles.leaveTypeName}>{t.name}</div>
                                    <div className={styles.leaveTypeDays}>{t.quota} วัน/ปี</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.leaveCard}>
                        <div className={styles.leaveCardTitle}>
                            ⏳ รออนุมัติ
                            <span className={styles.pendingCountBadge}>{pendingLeave.length}</span>
                        </div>
                        {leaveLoading ? (
                            <div className={styles.loader}><div className={styles.spinner} /></div>
                        ) : pendingLeave.length === 0 ? (
                            <div className={styles.emptyState} style={{ padding: "20px 0" }}>ไม่มีรายการรออนุมัติ</div>
                        ) : pendingLeave.map(r => (
                            <div key={r.id} className={styles.leavePendingItem}>
                                <div className={styles.leavePendingHead}>
                                    <div className={styles.leavePendingName}>
                                        {r.name} <span style={{ fontSize: 11, color: "var(--text4)" }}>({r.emp_id})</span>
                                    </div>
                                    <span className={`${styles.badge} ${styles.leave}`}>{r.leaveType}</span>
                                </div>
                                <div className={styles.leavePendingMeta}>
                                    📅 {r.startDate} → {r.endDate} · {r.days} วัน · {r.reason || "—"}
                                </div>
                                <div className={styles.leaveApproveButtons}>
                                    <button className={styles.btnApprove} onClick={() => approveLeave(r.id, "approved")}>✅ อนุมัติ</button>
                                    <button className={styles.btnReject} onClick={() => approveLeave(r.id, "rejected")}>❌ ไม่อนุมัติ</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.tableWrap}>
                    <div className={styles.tableHeader}>
                        <div className={styles.tableHeaderTitle}>📜 ประวัติการลาทั้งหมด</div>
                        <span className={styles.rowCount}>{historyRows.length} รายการ</span>
                    </div>
                    <div className={styles.tableScroll}>
                        {historyRows.length === 0 ? (
                            <div className={styles.emptyState}><span className={styles.emptyIcon}>📭</span>ยังไม่มีประวัติการลา</div>
                        ) : (
                            <table className={styles.table}>
                                <thead><tr>
                                    <th>รหัส</th><th>ชื่อ</th><th>ประเภท</th><th>วันที่</th>
                                    <th>จำนวน</th><th>เหตุผล</th><th>สถานะ</th>
                                </tr></thead>
                                <tbody>{historyRows.map(r => (
                                    <tr key={r.id}>
                                        <td><span className={styles.monoText}>{r.emp_id}</span></td>
                                        <td>{r.name}</td>
                                        <td>{r.leaveType}</td>
                                        <td style={{ fontSize: 12 }}>{r.startDate} – {r.endDate}</td>
                                        <td>{r.days} วัน</td>
                                        <td style={{ fontSize: 12, color: "var(--text3)" }}>{r.reason || "—"}</td>
                                        <td><span className={badgeClass(r.status)}>{
                                            r.status === "approved" ? "อนุมัติ" : r.status === "rejected" ? "ไม่อนุมัติ" : "รออนุมัติ"
                                        }</span></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        )}
                    </div>
                </div>
            </>
        );
    }

    function renderHoliday() {
        const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
        return (
            <div className={styles.card}>
                <div className={styles.cardTitle}>📅 จัดการวันหยุดประจำปี</div>
                <div className={styles.holidayAddRow}>
                    <input type="date" value={holidayDate} onChange={e => setHolidayDate(e.target.value)} />
                    <input type="text" placeholder="ชื่อวันหยุด เช่น วันสงกรานต์"
                        value={holidayName} onChange={e => setHolidayName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addHoliday()} />
                    <button className={styles.btnAdd} onClick={addHoliday}>+ เพิ่ม</button>
                </div>
                {sorted.length === 0 ? (
                    <div className={styles.emptyState}><span className={styles.emptyIcon}>📅</span>ยังไม่มีวันหยุด</div>
                ) : sorted.map(h => (
                    <div key={h.date} className={styles.holidayItem}>
                        <span className={styles.holidayDate}>📅 {h.date}</span>
                        <span className={styles.holidayName}>{h.name}</span>
                        <button className={styles.btnDelete} onClick={() => deleteHoliday(h.date)} title="ลบ">✕</button>
                    </div>
                ))}
            </div>
        );
    }

    function renderReport() {
        const selMonthLabel = monthOptionsList.find(m => m.val === reportSelMonth)?.label || "";
        // Show CE year (matches exported file naming like 2026-02)
        const selYearLabel = String(parseInt(reportSelYear));

        return (
            <div style={{ background: "white", padding: 24, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", minHeight: "calc(100vh - 120px)" }}>
                {/* Header Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                        <div>
                            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>เดือน</div>
                            <select style={{ padding: "10px 36px 10px 16px", borderRadius: 8, border: "1px solid #e5e7eb", outline: "none", fontSize: 14, color: "#111827", minWidth: 200, appearance: "none", background: "#f9fafb url('data:image/svg+xml;utf8,<svg fill=\"none\" stroke=\"%239ca3af\" stroke-width=\"2\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M19 9l-7 7-7-7\"></path></svg>') no-repeat right 12px center", backgroundSize: "16px" }} value={reportSelMonth} onChange={e => { console.log("month select onChange ->", { selected: e.target.value, reportSelYear }); setReportSelMonth(e.target.value); loadReport(`${reportSelYear}-${e.target.value}`, reportBranch, hideResigned); }}>
                                {monthOptionsList.map(o => <option key={o.val} value={o.val}>{o.label} {selYearLabel}</option>)}
                            </select>
                        </div>
                        <div>
                            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>สาขา</div>
                            <select style={{ padding: "10px 36px 10px 16px", borderRadius: 8, border: "1px solid #e5e7eb", outline: "none", fontSize: 14, color: "#111827", minWidth: 160, appearance: "none", background: "#f9fafb url('data:image/svg+xml;utf8,<svg fill=\"none\" stroke=\"%239ca3af\" stroke-width=\"2\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M19 9l-7 7-7-7\"></path></svg>') no-repeat right 12px center", backgroundSize: "16px" }} value={reportBranch} onChange={e => { setReportBranch(e.target.value); loadReport(reportMonth, e.target.value, hideResigned); }}>
                                <option value="">ทั้งหมด</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", marginLeft: 8, height: 42 }}>
                            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 10 }}>
                                <div style={{ width: 44, height: 24, background: hideResigned ? "#3b82f6" : "#e5e7eb", borderRadius: 24, padding: 2, position: "relative", transition: "background 0.3s" }} onClick={(e) => { e.preventDefault(); const v = !hideResigned; setHideResigned(v); loadReport(reportMonth, reportBranch, v); }}>
                                    <div style={{ width: 20, height: 20, background: "white", borderRadius: "50%", transform: hideResigned ? "translateX(20px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}></div>
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 500, color: "#374151" }} onClick={() => { const v = !hideResigned; setHideResigned(v); loadReport(reportMonth, reportBranch, v); }}>ซ่อนลาออก</span>
                            </label>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ padding: "8px 16px", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, fontWeight: 500, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} onClick={() => exportData("monthly-excel", { month: reportMonth, branch: reportBranch })} >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Excel
                        </button>
                        <button style={{ padding: "8px 16px", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, fontWeight: 500, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} onClick={() => exportData("monthly-pdf", { month: reportMonth, branch: reportBranch })} >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            PDF
                        </button>
                    </div>
                </div>



                {reportLoading ? (
                    <div className={styles.loader} style={{ height: 200 }}><div className={styles.spinner} />กำลังโหลดข้อมูล...</div>
                ) : !report ? (
                    <div style={{ padding: "60px 20px", textAlign: "center", color: "#9ca3af" }}>
                        การโหลดข้อมูลล้มเหลว หรือยังไม่มีข้อมูล
                    </div>
                ) : (
                    <div className={styles.tableWrap} style={{ boxShadow: "none", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                        <div className={styles.tableScroll}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                                <thead>
                                    <tr style={{ background: "#fcFdfd", textAlign: "center", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                                        <th style={{ padding: "16px 16px", fontWeight: 500, textAlign: "left" }}>พนักงาน</th>
                                        <th style={{ padding: "16px 16px", fontWeight: 500, textAlign: "left" }}>สาขา</th>
                                        <th style={{ padding: "16px 16px", fontWeight: 500 }}>วันทำงาน</th>
                                        <th style={{ padding: "16px 16px", fontWeight: 500 }}>ตรงเวลา</th>
                                        <th style={{ padding: "16px 16px", fontWeight: 500 }}>สาย</th>
                                        <th style={{ padding: "16px 16px", fontWeight: 500 }}>OT</th>
                                        <th style={{ padding: "16px 16px", fontWeight: 500 }}>สายรวม (นาที)</th>
                                        <th style={{ padding: "16px 16px", fontWeight: 500, textAlign: "right" }}>รายละเอียด</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>ไม่พบข้อมูลพนักงาน</td>
                                        </tr>
                                    ) : filteredEmployees.map(e => {
                                        const onTime = e.presentDays - e.lateTimes;
                                        return (
                                            <React.Fragment key={e.emp_id}>
                                                <tr style={{ borderBottom: "1px solid #f3f4f6", color: "#111827", textAlign: "center", background: expandedEmpId === e.emp_id ? "#f9fafb" : "white" }}>
                                                    <td style={{ padding: "16px", textAlign: "left", fontWeight: 600 }}>{e.name}</td>
                                                    <td style={{ padding: "16px", textAlign: "left", color: "#4b5563" }}>{e.branch}</td>
                                                    <td style={{ padding: "16px" }}>{e.presentDays}</td>
                                                    <td style={{ padding: "16px", color: onTime > 0 ? "#10b981" : "#d1d5db" }}>{onTime}</td>
                                                    <td style={{ padding: "16px", color: e.lateTimes > 0 ? "#f59e0b" : "#d1d5db" }}>{e.lateTimes}</td>
                                                    <td style={{ padding: "16px", color: e.otHours !== "0" ? "#3b82f6" : "#d1d5db" }}>{e.otHours}</td>
                                                    <td style={{ padding: "16px", color: "#111827" }}>{e.lateMins > 0 ? e.lateMins : "-"}</td>
                                                    <td style={{ padding: "16px", textAlign: "right" }}>
                                                        <button style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", fontWeight: 500 }} onClick={() => toggleEmpDetail(e)}>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                            ดู
                                                        </button>
                                                    </td>
                                                </tr>
                                                {/* Expanded Details Row using existing component */}
                                                {expandedEmpId === e.emp_id && (
                                                    <tr className={styles.expandedRowBoundary}>
                                                        <td colSpan={8} style={{ padding: 0 }}>
                                                            <div className={styles.dropdownContent}>
                                                                {empDetailLoading && !empDetailsCache[e.emp_id] ? (
                                                                    <div className={styles.loader} style={{ padding: "20px" }}>
                                                                        <div className={styles.spinner} /> กำลังโหลดข้อมูล...
                                                                    </div>
                                                                ) : empDetailsCache[e.emp_id] ? (
                                                                    <div className={styles.dropdownGrid}>
                                                                        {/* Left Column: Stats & Export */}
                                                                        <div className={styles.dropdownSidebar}>
                                                                            <div className={styles.sidebarHeader}>ข้อมูลรายบุคคล</div>
                                                                            <div className={styles.dropdownStats}>
                                                                                {[
                                                                                    { label: "วันมา", val: e.presentDays, color: "var(--ok)" },
                                                                                    { label: "ครั้งสาย", val: e.lateTimes, color: e.lateTimes > 0 ? "var(--late)" : "var(--text4)" },
                                                                                    { label: "OT (h)", val: e.otHours, color: e.otHours !== "0" ? "var(--ot)" : "var(--text4)" },
                                                                                    { label: "ค่าล่วงเวลา", val: e.otPay > 0 ? `฿${e.otPay.toLocaleString()}` : "—", color: e.otPay > 0 ? "var(--ot)" : "var(--text4)" },
                                                                                    { label: "วันลา", val: e.leaveDays, color: "var(--blue)" },
                                                                                    { label: "วันขาด", val: e.absentDays, color: e.absentDays > 0 ? "var(--bad)" : "var(--text4)" },
                                                                                    { label: "ชม.งาน", val: e.workHours || "—", color: "var(--text)" },
                                                                                ].map(s => (
                                                                                    <div key={s.label} className={styles.dropdownStatItem}>
                                                                                        <span className={styles.dropdownStatLabel}>{s.label}</span>
                                                                                        <span className={styles.dropdownStatVal} style={{ color: s.color }}>{s.val}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                            {empDetailsCache[e.emp_id].dailyRows.length > 0 && (
                                                                                <div className={styles.dropdownExportBox}>
                                                                                    <button className={styles.btnExcelSm} onClick={() => exportEmpData(e.emp_id, e.name, "excel")} style={{ width: "100%", justifyContent: "center" }}>⬇ โหลด Excel</button>
                                                                                    <button className={styles.btnPdfSm} onClick={() => exportEmpData(e.emp_id, e.name, "pdf")} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>⬇ โหลด PDF</button>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Right Column: Daily Log Table */}
                                                                        <div className={styles.dropdownMain}>
                                                                            {empDetailsCache[e.emp_id].dailyRows.length === 0 ? (
                                                                                <div className={styles.emptyStateContainer}>ไม่มีประวัติลงเวลาเดือนนี้</div>
                                                                            ) : (
                                                                                <div className={styles.dropdownInnerTableScroll}>
                                                                                    <table className={styles.innerTable}>
                                                                                        <thead><tr>
                                                                                            <th>วันที่</th><th>เข้างาน</th><th>ออกงาน</th><th>ชม.งาน</th><th>สถานะ</th><th>หมายเหตุ</th>
                                                                                        </tr></thead>
                                                                                        <tbody>{empDetailsCache[e.emp_id].dailyRows.map(row => (
                                                                                            <tr key={row.date}>
                                                                                                <td><span className={styles.monoText}>{row.date}</span></td>
                                                                                                <td><span className={styles.monoText} style={{ color: "var(--ok)" }}>{row.checkIn || "—"}</span></td>
                                                                                                <td><span className={styles.monoText} style={{ color: "var(--warn)" }}>{row.checkOut || "—"}</span></td>
                                                                                                <td><span className={styles.monoText}>{row.workHours || "—"}</span></td>
                                                                                                <td>
                                                                                                    {row.late_status
                                                                                                        ? <span className={badgeClass(row.late_status)}>{row.late_label || row.late_status}</span>
                                                                                                        : row.leaveType
                                                                                                            ? <span className={`${styles.badge} ${styles.leave}`}>{row.leaveType}</span>
                                                                                                            : <span style={{ color: "var(--text5)", fontSize: 12 }}>—</span>
                                                                                                    }
                                                                                                </td>
                                                                                                <td style={{ fontSize: 12, color: "var(--text4)" }}>
                                                                                                    {row.note && <div>{row.note}</div>}
                                                                                                    {row.project_string && <div style={{ color: "var(--blue)", marginTop: 2 }}>{row.project_string}</div>}
                                                                                                    {(!row.note && !row.project_string) && "—"}
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}</tbody>
                                                                                    </table>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    function renderProjects() {
        return (
            <div style={{ background: "white", padding: 24, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", minHeight: "calc(100vh - 120px)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>
                        ลูกค้า / โปรเจกต์
                    </div>
                    <button style={{
                        padding: "8px 16px",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8
                    }} onClick={() => {
                        setProjectForm({ id: 0, code: "", name: "", address: "", is_active: true, status: "CURRENT", contact: "", phone: "", lat: null, lng: null, radius_m: 200 });
                        setShowProjectModal(true);
                    }}>
                        <span>+</span> เพิ่มลูกค้า
                    </button>
                </div>

                <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                        <div style={{ position: "absolute", left: 14, top: 10, color: "#9ca3af" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <input type="text" placeholder="ค้นหาชื่อหรือรหัส..."
                            style={{ width: "100%", padding: "10px 16px 10px 40px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", outline: "none", fontSize: 14 }}
                            value={projectsSearch} onChange={e => setProjectsSearch(e.target.value)} />
                    </div>
                    <div>
                        <select style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", outline: "none", fontSize: 14, color: "#374151", "appearance": "none", minWidth: 120 }}>
                            <option value="">ทั้งหมด</option>
                        </select>
                    </div>
                </div>

                <div className={styles.tableWrap} style={{ boxShadow: "none", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <div className={styles.tableScroll}>
                        {projectsLoading ? (
                            <div className={styles.loader} style={{ height: 200 }}><div className={styles.spinner} />กำลังโหลด...</div>
                        ) : filteredProjects.length === 0 ? (
                            <div style={{ padding: "60px 20px", textAlign: "center", color: "#9ca3af" }}>
                                ไม่พบข้อมูลลูกค้า
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                                <thead>
                                    <tr style={{ background: "#f9fafb", textAlign: "left", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>รหัส</th>
                                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>ชื่อบริษัท</th>
                                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>ผู้ติดต่อ</th>
                                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>เบอร์โทร</th>
                                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>สถานะ</th>
                                        <th style={{ padding: "12px 16px", width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProjects.map(p => {
                                        let badgeCfg = { bg: "#f3f4f6", text: "#6b7280", label: "ไม่ใช้งาน" };
                                        if (p.is_active) {
                                            if (p.status === "NEW") badgeCfg = { bg: "#fef3c7", text: "#d97706", label: "ลูกค้าใหม่" };
                                            else badgeCfg = { bg: "#dcfce7", text: "#16a34a", label: "ลูกค้าปัจจุบัน" };
                                        }

                                        return (
                                            <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6", color: "#111827" }}>
                                                <td style={{ padding: "16px", color: "#6b7280", fontFamily: "monospace", fontSize: 13 }}>{p.code || "—"}</td>
                                                <td style={{ padding: "16px" }}>
                                                    <div style={{ fontWeight: 600, color: "#111827", marginBottom: 2 }}>{p.name}</div>
                                                    <div style={{ fontSize: 12, color: "#6b7280" }}>{p.address ? p.address.substring(0, 40) + (p.address.length > 40 ? "..." : "") : "ไม่มีที่อยู่"}</div>
                                                </td>
                                                <td style={{ padding: "16px", fontWeight: 500 }}>{p.contact || "—"}</td>
                                                <td style={{ padding: "16px" }}>{p.phone || "—"}</td>
                                                <td style={{ padding: "16px" }}>
                                                    <span style={{
                                                        background: badgeCfg.bg, color: badgeCfg.text,
                                                        padding: "4px 8px", borderRadius: 20, fontSize: 12, fontWeight: 600
                                                    }}>
                                                        {badgeCfg.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "16px" }}>
                                                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }} onClick={() => {
                                                        setProjectForm(p);
                                                        setShowProjectModal(true);
                                                    }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Project Modal */}
                {showProjectModal && (
                    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowProjectModal(false); }}>
                        <div className={styles.modal} style={{ maxWidth: 550 }}>
                            <div className={styles.modalHeader}>
                                <span className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: "20px" }}>{projectForm.id ? "✏️" : "✨"}</span>
                                    {projectForm.id ? "แก้ไขข้อมูลโครงการ" : "เพิ่มโครงการเวฟใหม่"}
                                </span>
                                <button className={styles.modalClose} onClick={() => setShowProjectModal(false)}>✕</button>

                                <div style={{ padding: "0 4px" }}>
                                    <div className={styles.settingsFieldGrid} style={{ gridTemplateColumns: "1fr 1fr" }}>
                                        <div className={styles.settingsField}>
                                            <input className={styles.settingsFieldInput} value={projectForm.code || ""} onChange={e => setProjectForm({ ...projectForm, code: e.target.value })} placeholder="เช่น PRJ-001" />
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                        <div className={styles.settingsField}>
                                            <label className={styles.settingsFieldLabel}>เบอร์โทรติดต่อ</label>
                                            <input className={styles.settingsFieldInput} value={projectForm.phone || ""} onChange={e => setProjectForm({ ...projectForm, phone: e.target.value })} placeholder="08X-XXX-XXXX" />
                                        </div>
                                        <div className={styles.settingsField}>
                                            <label className={styles.settingsFieldLabel}>ชื่อผู้ติดต่อ</label>
                                            <input className={styles.settingsFieldInput} value={projectForm.contact || ""} onChange={e => setProjectForm({ ...projectForm, contact: e.target.value })} placeholder="คุณสมชาย" />
                                        </div>
                                    </div>
                                    <div className={styles.settingsField}>
                                        <label className={styles.settingsFieldLabel}>ที่อยู่ (Address)</label>
                                        <textarea className={styles.settingsFieldInput} value={projectForm.address || ""} onChange={e => setProjectForm({ ...projectForm, address: e.target.value })} placeholder="ระบุที่อยู่ไซต์งาน / โครงการเพื่อประโยชน์ในการอ้างอิง" rows={3} style={{ resize: "vertical" }} />
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "16px" }}>
                                        <div className={styles.settingsField}>
                                            <label className={styles.settingsFieldLabel}>สถานะลูกค้า</label>
                                            <select className={styles.settingsFieldInput} value={projectForm.status || "CURRENT"} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}>
                                                <option value="NEW">ลูกค้าใหม่ (NEW)</option>
                                                <option value="CURRENT">ลูกค้าปัจจุบัน (CURRENT)</option>
                                                <option value="INACTIVE">เลิกติดต่อ (INACTIVE)</option>
                                            </select>
                                        </div>
                                        <div className={styles.settingsField}>
                                            <label className={styles.settingsFieldLabel}>Lat (ละติจูด)</label>
                                            <input type="number" step="any" className={styles.settingsFieldInput} value={projectForm.lat || ""} onChange={e => setProjectForm({ ...projectForm, lat: parseFloat(e.target.value) || null })} placeholder="13.75..." />
                                        </div>
                                        <div className={styles.settingsField}>
                                            <label className={styles.settingsFieldLabel}>Lng (ลองจิจูด)</label>
                                            <input type="number" step="any" className={styles.settingsFieldInput} value={projectForm.lng || ""} onChange={e => setProjectForm({ ...projectForm, lng: parseFloat(e.target.value) || null })} placeholder="100.5..." />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "12px 16px", background: "var(--surface2)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                                    <input type="checkbox" id="projectActive" checked={projectForm.is_active} onChange={e => setProjectForm({ ...projectForm, is_active: e.target.checked })} style={{ width: 18, height: 18, accentColor: "var(--ok)" }} />
                                    <label htmlFor="projectActive" style={{ cursor: "pointer", fontWeight: 600, color: "var(--text2)", fontSize: 14 }}>
                                        เปิดใช้งานโครงการนี้ (Active)
                                    </label>
                                </div>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                                    <button className={styles.btnSettingsCancel} onClick={() => setShowProjectModal(false)} style={{ padding: "10px 20px" }}>ยกเลิก</button>
                                    <button style={{
                                        padding: "10px 24px",
                                        background: "#10b981",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontSize: "14.5px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)"
                                    }} onClick={saveProject}>✓ บันทึกข้อมูล</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const TAB_TITLES: Record<TabKey, string> = {
        dashboard: "Dashboard",
        attendance: "การเข้างาน",
        leave: "การลา",
        holiday: "วันหยุด",
        report: "สรุปรายเดือน",
        projects: "โครงการ / ลูกค้า",
    };

    return (
        <div className={styles.content}>
            <div className={styles.pageHeader}>
                <h2 className={styles.pageTitle}>
                    {TAB_TITLES[activeTab]}
                    <span className={styles.pageSubtitle}>TERA GROUP · HR Admin System</span>
                </h2>


            </div>

            {activeTab === "dashboard" && renderDashboard()}
            {activeTab === "attendance" && renderAttendance()}
            {activeTab === "leave" && renderLeave()}
            {activeTab === "holiday" && renderHoliday()}
            {activeTab === "report" && renderReport()}
            {activeTab === "projects" && renderProjects()}

            {/* ── PHOTO MODAL ── */}
            {photoModal && (
                <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setPhotoModal(null); }}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>📷 ภาพประกอบการเช็คอิน</span>
                            <button className={styles.modalClose} onClick={() => setPhotoModal(null)}>✕</button>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoModal.url} alt="check-in" className={styles.modalPhoto} />
                        <div className={styles.modalKV}>
                            <span className={styles.modalKey}>รหัส</span>   <span className={styles.modalValue}>{photoModal.empId}</span>
                            <span className={styles.modalKey}>ชื่อ</span>    <span className={styles.modalValue}>{photoModal.name}</span>
                            <span className={styles.modalKey}>ประเภท</span>  <span className={styles.modalValue}>{photoModal.type}</span>
                            <span className={styles.modalKey}>เวลา</span>    <span className={styles.modalValue}>{photoModal.time}</span>
                            <span className={styles.modalKey}>สถานะ</span>  <span className={styles.modalValue}>{photoModal.lateLabel || "—"}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SETTINGS MODAL ── */}
            {showSettings && (
                <div className={styles.settingsOverlay} onClick={e => { if (e.target === e.currentTarget) closeSettings(); }}>
                    <div className={styles.settingsModal}>
                        <div className={styles.settingsModalHeader}>
                            <div>
                                <div className={styles.settingsModalTitle}>⚙️ ตั้งค่าระบบ</div>
                                <div className={styles.settingsModalSub}>TERA GROUP · HR Admin</div>
                            </div>
                            <button className={styles.modalClose} onClick={closeSettings}>✕</button>
                        </div>

                        <div className={styles.settingsBody}>
                            <div className={styles.settingsNav}>
                                <div className={styles.settingsNavSection}>ทั่วไป</div>
                                <button
                                    className={`${styles.settingsNavItem} ${settingsTab === "shift" ? styles.settingsNavActive : ""}`}
                                    onClick={() => setSettingsTab("shift")}
                                >
                                    <span>🕘</span> เวลางาน
                                </button>
                                <button
                                    className={`${styles.settingsNavItem} ${settingsTab === "payroll" ? styles.settingsNavActive : ""}`}
                                    onClick={() => setSettingsTab("payroll")}
                                >
                                    <span>💰</span> Payroll
                                </button>
                            </div>

                            <div className={styles.settingsContent}>
                                {settingsTab === "shift" && (
                                    <div className={styles.settingsSection}>
                                        <div className={styles.settingsSectionTitle}>🕘 ตั้งค่าเวลางาน</div>
                                        <div className={styles.settingsSectionDesc}>
                                            กำหนดเวลาเข้า-ออกงานและเวลาผ่อนผัน ใช้สำหรับคำนวณ Payroll CSV
                                        </div>

                                        <div className={styles.settingsFieldGrid}>
                                            <div className={styles.settingsField}>
                                                <label className={styles.settingsFieldLabel}>เวลาเข้างาน</label>
                                                <input type="time" className={styles.settingsFieldInput} value={draftStart} onChange={e => setDraftStart(e.target.value)} />
                                            </div>
                                            <div className={styles.settingsField}>
                                                <label className={styles.settingsFieldLabel}>เวลาออกงาน</label>
                                                <input type="time" className={styles.settingsFieldInput} value={draftEnd} onChange={e => setDraftEnd(e.target.value)} />
                                            </div>
                                            <div className={styles.settingsField}>
                                                <label className={styles.settingsFieldLabel}>เวลาผ่อนผัน (นาที)</label>
                                                <input type="number" className={styles.settingsFieldInput} min={0} max={60}
                                                    value={draftGrace} onChange={e => setDraftGrace(Number(e.target.value))} />
                                                <span className={styles.settingsFieldHint}>
                                                    นับว่า "ตรงเวลา" ถ้าเข้าไม่เกิน {draftGrace} นาทีหลังเวลาเข้างาน
                                                </span>
                                            </div>
                                        </div>

                                        <div className={styles.settingsPreviewCard}>
                                            <div className={styles.settingsPreviewRow}>
                                                <span className={styles.settingsPreviewLabel}>ค่าที่ใช้งานอยู่</span>
                                                <span className={styles.settingsPreviewVal}>{shiftStart} – {shiftEnd} · ผ่อนผัน {graceMin} นาที</span>
                                            </div>
                                            <div className={styles.settingsPreviewRow}>
                                                <span className={styles.settingsPreviewLabel}>ค่าใหม่ (ยังไม่บันทึก)</span>
                                                <span className={`${styles.settingsPreviewVal} ${(draftStart !== shiftStart || draftEnd !== shiftEnd || draftGrace !== graceMin) ? styles.settingsPreviewChanged : ""}`}>
                                                    {draftStart} – {draftEnd} · ผ่อนผัน {draftGrace} นาที
                                                </span>
                                            </div>
                                        </div>

                                        <div className={styles.settingsActions}>
                                            <button className={styles.btnSettingsCancel} onClick={closeSettings}>ยกเลิก</button>
                                            <button className={styles.btnSettingsSave} onClick={saveSettings}>✓ บันทึก</button>
                                        </div>
                                    </div>
                                )}

                                {settingsTab === "payroll" && (
                                    <div className={styles.settingsSection}>
                                        <div className={styles.settingsSectionTitle}>💰 ดาวน์โหลด Payroll</div>
                                        <div className={styles.settingsSectionDesc}>
                                            ดาวน์โหลด Payroll CSV โดยใช้ค่าเวลางานที่บันทึกไว้
                                        </div>

                                        <div className={styles.settingsPreviewCard}>
                                            <div className={styles.settingsPreviewRow}>
                                                <span className={styles.settingsPreviewLabel}>Shift</span>
                                                <span className={styles.settingsPreviewVal}>{shiftStart} – {shiftEnd}</span>
                                            </div>
                                            <div className={styles.settingsPreviewRow}>
                                                <span className={styles.settingsPreviewLabel}>ผ่อนผัน</span>
                                                <span className={styles.settingsPreviewVal}>{graceMin > 0 ? `${graceMin} นาที` : "ไม่มี"}</span>
                                            </div>
                                            <div className={styles.settingsPreviewRow}>
                                                <span className={styles.settingsPreviewLabel}>เดือน</span>
                                                <span className={styles.settingsPreviewVal}>{reportMonth || "—"}</span>
                                            </div>
                                        </div>

                                        {!reportMonth && (
                                            <div className={styles.settingsWarn}>
                                                ⚠️ กรุณาเลือกเดือนในหน้า "สรุปรายเดือน" ก่อนดาวน์โหลด
                                            </div>
                                        )}

                                        <button
                                            className={styles.btnPayrollModal}
                                            disabled={!reportMonth}
                                            onClick={() => {
                                                if (!reportMonth) return;
                                                const p = new URLSearchParams({
                                                    format: "csv", month: reportMonth,
                                                    shiftStart, shiftEnd, graceMin: String(graceMin),
                                                });
                                                if (reportBranch) p.append("branch", reportBranch);
                                                window.location.href = `/api/admin/payroll?${p.toString()}`;
                                            }}
                                        >
                                            ⬇ ดาวน์โหลด Payroll CSV
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TOAST ── */}
            {toast && (
                <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.msg}</div>
            )}
        </div>
    );
}

export default function AdminPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#666" }}>กำลังโหลดข้อมูล...</div>}>
            <AdminPageInner />
        </Suspense>
    );
}