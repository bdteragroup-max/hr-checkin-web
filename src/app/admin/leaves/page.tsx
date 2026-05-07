"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../page.module.css"; // ✅ ใช้ CSS admin ใหญ่
import { ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon, DocumentTextIcon, InboxIcon, ChartBarIcon, ClipboardDocumentListIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { formatTime24h, formatDateThai } from "@/utils/time";

type LeaveRow = {
    id: string;
    emp_id: string;
    name: string | null;
    leave_type: string | null; // จาก API
    reason: string | null;
    start_date: string; // ISO
    end_date: string; // ISO
    start_at?: string; // ISO
    end_at?: string; // ISO
    status: "pending" | "approved" | "rejected" | string;
    approved_by?: string | null;
    approved_at?: string | null;
    days?: number;
    minutes?: number;
    handover_person?: string | null;
    attachment_url?: string | null;
    employees?: {
        supervisor_id?: string | null;
        departments?: {
            name: string;
        };
    };
};

// ปรับได้ตามจริงของบริษัทคุณ
const DEFAULT_LEAVE_TYPES = [
    { id: "annual", name: "ลาพักร้อน", quota: 6, color: "#22c55e" },
    { id: "sick", name: "ลาป่วย", quota: 30, color: "#f59e0b" },
    { id: "personal", name: "ลากิจ", quota: 6, color: "#3b82f6" },
    { id: "maternity", name: "ลาคลอด", quota: 120, color: "#ec4899" },
    { id: "other", name: "อื่นๆ", quota: 0, color: "#64748b" },
];

function todayISO_BKK() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
}

function fmtDate(d: string) {
    return formatDateThai(d);
}

function fmtDateTime(d: string) {
    return `${formatDateThai(d)} ${formatTime24h(d)}`;
}

function badgeClass(status: string) {
    if (status === "approved") return `${styles.badge} ${styles.approved}`;
    if (status === "rejected") return `${styles.badge} ${styles.rejected}`;
    if (status === "cancelled") return `${styles.badge} ${styles.cancelled}`;
    return `${styles.badge} ${styles.pending}`;
}

function formatLeaveMins(totalMins?: number) {
    if (!totalMins || totalMins === 0) return "0 วัน";
    const days = Math.floor(totalMins / 480);
    const remainingMins = totalMins % 480;
    const hours = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;

    let res = "";
    if (days > 0) res += `${days} วัน `;
    if (hours > 0) res += `${hours} ชม. `;
    if (mins > 0) res += `${mins} นาที`;
    return res.trim() || "0 วัน";
}

function normalizeReason(s: string) {
    // กันเหตุผลว่าง/สั้น/แตกต่างกันเล็กน้อย
    const t = (s || "").trim();
    if (!t) return "—";
    return t;
}

export default function AdminLeavesPage() {
    const [leaveLoading, setLeaveLoading] = useState(false);
    const [err, setErr] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null); // ✅ Track which row is being processed
    const [viewMode, setViewMode] = useState<"list" | "report">("list");
    const [showEmployeeDetail, setShowEmployeeDetail] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(""); // YYYY-MM

    // Filters
    const [status, setStatus] = useState<string>(""); // "", pending, approved, rejected
    const [startDate, setStartDate] = useState<string>(""); // From date
    const [endDate, setEndDate] = useState<string>(""); // To date
    const [empId, setEmpId] = useState<string>("");

    // เพิ่ม filter เหตุผล (client filter)
    const [reasonQuery, setReasonQuery] = useState<string>("");

    const [leaveRequests, setLeaveRequests] = useState<LeaveRow[]>([]);

    const qs = useMemo(() => {
        const sp = new URLSearchParams();
        if (status) sp.set("status", status);
        if (startDate) sp.set("startDate", startDate);
        if (endDate) sp.set("endDate", endDate);
        if (empId.trim()) sp.set("emp_id", empId.trim());
        return sp.toString();
    }, [status, startDate, endDate, empId]);

    async function load() {
        setLeaveLoading(true);
        setErr("");
        try {
            const res = await fetch(`/api/admin/leaves?${qs}`, { cache: "no-store" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setErr(data?.error || `HTTP_${res.status}`);
                setLeaveRequests([]);
                return;
            }
            setLeaveRequests(data?.list || []);
        } catch (e: any) {
            setErr(e?.message || "LOAD_FAILED");
            setLeaveRequests([]);
        } finally {
            setLeaveLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qs]);

    // ✅ Client filter by reason
    const filteredByReason = useMemo(() => {
        const q = reasonQuery.trim().toLowerCase();
        if (!q) return leaveRequests;
        return leaveRequests.filter((r) => normalizeReason(r.reason || "").toLowerCase().includes(q));
    }, [leaveRequests, reasonQuery]);

    const pendingLeave = useMemo(
        () => filteredByReason.filter((r) => r.status === "pending" || r.status === "pending_hr"),
        [filteredByReason]
    );

    // ✅ Summary (หน้ารวม)
    const summary = useMemo(() => {
        const total = filteredByReason.length;
        const pending = filteredByReason.filter((r) => r.status === "pending" || r.status === "pending_hr").length;
        const approved = filteredByReason.filter((r) => r.status === "approved").length;
        const rejected = filteredByReason.filter((r) => r.status === "rejected").length;
        const cancelled = filteredByReason.filter((r) => r.status === "cancelled").length;

        // summary by leave_type
        const byTypeMap = new Map<string, number>();
        for (const r of filteredByReason) {
            const t = (r.leave_type || "อื่นๆ").trim() || "อื่นๆ";
            byTypeMap.set(t, (byTypeMap.get(t) || 0) + 1);
        }
        const byType = Array.from(byTypeMap.entries()).sort((a, b) => b[1] - a[1]);

        return { total, pending, approved, rejected, cancelled, byType };
    }, [filteredByReason]);

    // ✅ Summary เหตุผลการลา (Top reasons)
    const topReasons = useMemo(() => {
        const map = new Map<string, number>();
        for (const r of filteredByReason) {
            const key = normalizeReason(r.reason || "");
            map.set(key, (map.get(key) || 0) + 1);
        }
        const arr = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        return arr.slice(0, 10); // top 10
    }, [filteredByReason]);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        leaveRequests.forEach(r => {
            const date = new Date(r.start_date);
            months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
        });
        return Array.from(months).sort((a, b) => b.localeCompare(a));
    }, [leaveRequests]);

    const reportData = useMemo(() => {
        const groups: Record<string, Record<string, { 
            total_requests: number,
            total_minutes: number,
            emp_ids: Set<string>,
            leave_types: Record<string, number>,
            employees: Record<string, { name: string, emp_id: string, total_requests: number, total_minutes: number, types: Record<string, number> }>
        }>> = {};
        
        filteredByReason.forEach(req => {
            const date = new Date(req.start_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (selectedMonth && monthKey !== selectedMonth) return;
            const deptName = req.employees?.departments?.name || "ไม่ระบุแผนก";
            const leaveType = req.leave_type || "อื่นๆ";
            const mins = req.minutes || (req.days ? req.days * 480 : 0);
            
            if (!groups[monthKey]) groups[monthKey] = {};
            if (!groups[monthKey][deptName]) {
                groups[monthKey][deptName] = { 
                    total_requests: 0, 
                    total_minutes: 0, 
                    emp_ids: new Set(),
                    leave_types: {},
                    employees: {}
                };
            }
            
            const g = groups[monthKey][deptName];
            g.total_requests++;
            g.total_minutes += mins;
            g.emp_ids.add(req.emp_id);
            g.leave_types[leaveType] = (g.leave_types[leaveType] || 0) + 1;
            
            if (!g.employees[req.emp_id]) {
                g.employees[req.emp_id] = { name: req.name || "Unknown", emp_id: req.emp_id, total_requests: 0, total_minutes: 0, types: {} };
            }
            
            const emp = g.employees[req.emp_id];
            emp.total_requests++;
            emp.total_minutes += mins;
            emp.types[leaveType] = (emp.types[leaveType] || 0) + 1;
        });
        
        // Convert to sorted array
        const result: { 
            month: string, 
            depts: { 
                name: string, 
                total_requests: number, 
                total_minutes: number, 
                emp_count: number, 
                leave_types: [string, number][],
                employees: { name: string, emp_id: string, total_requests: number, total_minutes: number, types: [string, number][] }[] 
            }[] 
        }[] = [];

        Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(month => {
            const depts = Object.keys(groups[month]).map(name => ({
                name,
                ...groups[month][name],
                emp_count: groups[month][name].emp_ids.size,
                leave_types: Object.entries(groups[month][name].leave_types).sort((a, b) => b[1] - a[1]),
                employees: Object.values(groups[month][name].employees).map(emp => ({
                    ...emp,
                    types: Object.entries(emp.types).sort((a, b) => b[1] - a[1])
                })).sort((a, b) => b.total_minutes - a.total_minutes)
            })).sort((a, b) => b.total_minutes - a.total_minutes);
            
            result.push({ month, depts });
        });
        
        return result;
    }, [filteredByReason, selectedMonth]);

    function exportToCSV() {
        const BOM = "\uFEFF";
        let csvContent = "Month,Department,Employee ID,Employee Name,Leave Type counts,Total Minutes,Total Days\n";
        reportData.forEach(m => {
            m.depts.forEach(d => {
                d.employees.forEach(emp => {
                    const typeSummary = emp.types.map(([t, c]) => `${t}: ${c}`).join(" | ");
                    const days = (emp.total_minutes / 480).toFixed(2);
                    csvContent += `${m.month},"${d.name}","${emp.emp_id}","${emp.name}","${typeSummary}",${emp.total_minutes},${days}\n`;
                });
                const deptTypeSummary = d.leave_types.map(([t, c]) => `${t}: ${c}`).join(" | ");
                const deptDays = (d.total_minutes / 480).toFixed(2);
                csvContent += `${m.month},"${d.name} TOTAL",-,-,"${deptTypeSummary}",${d.total_minutes},${deptDays}\n`;
            });
        });
        
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Leave_Report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportListToCSV() {
        const BOM = "\uFEFF";
        let csvContent = "Employee ID,Name,Department,Leave Type,Start,End,Duration,Reason,Handover Person,Status\n";
        
        filteredByReason.forEach(r => {
            const dept = r.employees?.departments?.name || "-";
            const duration = formatLeaveMins(r.minutes || (r.days ? r.days * 480 : undefined));
            const startStr = fmtDateTime(r.start_at || r.start_date);
            const endStr = fmtDateTime(r.end_at || r.end_date);
            const statusStr = r.status === "approved" ? "อนุมัติ" : r.status === "rejected" ? "ไม่อนุมัติ" : r.status === "cancelled" ? "ยกเลิกแล้ว" : "รออนุมัติ";
            
            csvContent += `"${r.emp_id}","${r.name || ""}","${dept}","${r.leave_type || ""}","${startStr}","${endStr}","${duration}","${normalizeReason(r.reason || "")}","${r.handover_person || ""}","${statusStr}"\n`;
        });

        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Leaves_List_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function approveLeave(id: string, nextStatus: "approved" | "rejected") {
        if (processingId) return; // ✅ Block if already processing another row

        if (nextStatus === "approved") {
            if (!confirm("ยืนยันอนุมัติใบลานี้?")) return;
            setProcessingId(id);
            setErr("");
            try {
                const res = await fetch(`/api/admin/leaves/${id}/approve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                });
                const data = await res.json().catch(() => null);
                if (!res.ok) {
                    if (data?.error === "ALREADY_PROCESSED") {
                        setErr("คำขอนี้ดำเนินการไปแล้ว");
                    } else {
                        setErr(data?.error || `HTTP_${res.status}`);
                    }
                    await load();
                    return;
                }
                await load();
            } catch (e: any) {
                setErr(e?.message || "APPROVE_FAILED");
            } finally {
                setProcessingId(null);
            }
            return;
        }

        // rejected
        const reason = prompt("ระบุเหตุผลที่ไม่อนุมัติ (Reject reason):") || "";
        if (!reason.trim()) return;

        setProcessingId(id);
        setErr("");
        try {
            const res = await fetch(`/api/admin/leaves/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                if (data?.error === "ALREADY_PROCESSED") {
                    setErr("คำขอนี้ดำเนินการไปแล้ว");
                } else {
                    setErr(data?.error || `HTTP_${res.status}`);
                }
                await load();
                return;
            }
            await load();
        } catch (e: any) {
            setErr(e?.message || "REJECT_FAILED");
        } finally {
            setProcessingId(null);
        }
    }

    async function deleteLeave(id: string) {
        if (!confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้? การลบจะไม่สามารถกู้คืนได้")) return;
        setProcessingId(id);
        setErr("");
        try {
            const res = await fetch(`/api/admin/leaves/${id}`, {
                method: "DELETE",
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setErr(data?.error || `DELETE_FAILED_${res.status}`);
            } else {
                await load();
            }
        } catch (e: any) {
            setErr(e?.message || "DELETE_ERROR");
        } finally {
            setProcessingId(null);
        }
    }

    function renderLeave() {
        return (
            <>
                <div className={styles.pageHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>จัดการการลา</h1>
                        <div className={styles.pageSubtitle}>ตรวจสอบและสรุปข้อมูลการลาของพนักงาน</div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        {/* Report toggle removed as requested */}
                    </div>
                </div>

                {viewMode === "list" ? (
                    <>
                        <div className={styles.filterCard}>
                            <div className={styles.filterCardHeader}>
                                <DocumentTextIcon width={18} style={{ color: "var(--red3)" }} />
                                <span className={styles.filterCardTitle}>ตัวกรองข้อมูล (Filters)</span>
                            </div>
                            <div className={styles.filterBar}>
                                <div className={styles.filterGroup}>
                                    <div className={styles.filterLabel}>STATUS</div>
                                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                        <option value="">ทุกสถานะ</option>
                                        <option value="pending">รออนุมัติ</option>
                                        <option value="approved">อนุมัติแล้ว</option>
                                        <option value="rejected">ไม่อนุมัติ</option>
                                        <option value="cancelled">ยกเลิกแล้ว</option>
                                    </select>
                                </div>

                                <div className={styles.filterGroup}>
                                    <div className={styles.filterLabel}>FROM</div>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>

                                <div className={styles.filterGroup}>
                                    <div className={styles.filterLabel}>TO</div>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>

                                <div className={styles.filterGroup}>
                                    <div className={styles.filterLabel}>EMP ID</div>
                                    <input
                                        type="text"
                                        placeholder="รหัสพนักงาน/ชื่อ"
                                        value={empId}
                                        onChange={(e) => setEmpId(e.target.value)}
                                    />
                                </div>

                                <div className={styles.filterGroup}>
                                    <div className={styles.filterLabel}>REASON</div>
                                    <input
                                        type="text"
                                        placeholder="เหตุผลการลา..."
                                        value={reasonQuery}
                                        onChange={(e) => setReasonQuery(e.target.value)}
                                    />
                                </div>

                                <button className={styles.btnPrimary} onClick={load} disabled={leaveLoading}>
                                    {leaveLoading ? "Loading..." : "Refresh"}
                                </button>

                                <button className={styles.btnExport} onClick={exportListToCSV}>
                                    <ArrowDownTrayIcon width={16} /> Export List
                                </button>
                            </div>
                        </div>

                        {err ? <div className={styles.errorMsg} style={{ display: "flex", alignItems: "center", gap: 6 }}><ExclamationTriangleIcon width={18} /> {err}</div> : null}

                        <div className={styles.tableWrap} style={{ marginBottom: 18 }}>
                            <div className={styles.tableHeader}>
                                <div className={styles.tableHeaderTitle}>รออนุมัติ</div>
                                <span className={styles.rowCount}>{pendingLeave.length} รายการ</span>
                            </div>

                            <div className={styles.tableScroll}>
                                {pendingLeave.length === 0 && !leaveLoading ? (
                                    <div className={styles.emptyState} style={{ padding: 16 }}>ไม่มีรายการรออนุมัติ</div>
                                ) : (
                                    <table className={styles.table} style={{ tableLayout: "fixed" }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: "20%" }}>พนักงาน (Employee)</th>
                                                <th style={{ width: "12%" }}>ประเภท (Type)</th>
                                                <th style={{ width: "18%" }}>วันที่ (Date)</th>
                                                <th style={{ width: "10%", textAlign: "center" }}>จำนวน (Duration)</th>
                                                <th style={{ width: "15%" }}>เหตุผล (Reason)</th>
                                                <th style={{ width: "10%" }}>ผู้รับผิดชอบแทน</th>
                                                <th style={{ width: "60px", textAlign: "center" }}>ไฟล์</th>
                                                <th style={{ width: "140px", textAlign: "center" }}>จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingLeave.map((r) => {
                                                const displayDuration = formatLeaveMins(r.minutes || (r.days ? r.days * 480 : undefined));
                                                return (
                                                    <tr key={r.id} className={styles.clickableRow}>
                                                        <td style={{ overflow: "hidden" }}>
                                                            <div style={{ fontWeight: 700, color: "var(--text)", wordBreak: "break-word" }}>{r.name || "-"}</div>
                                                            <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 4, display: "flex", gap: 4, alignItems: "center" }}>
                                                                <span className={styles.monoText}>{r.emp_id}</span> <span style={{ opacity: 0.5 }}>•</span> <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.employees?.departments?.name || "ไม่ระบุแผนก"}</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ fontWeight: 500, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.leave_type || "-"}</td>
                                                        <td style={{ fontSize: 12, color: "var(--text2)" }}>
                                                            <div style={{ fontWeight: 600 }}>{fmtDateTime(r.start_at || r.start_date)}</div>
                                                            <div style={{ opacity: 0.6 }}>ถึง {fmtDateTime(r.end_at || r.end_date)}</div>
                                                        </td>
                                                        <td style={{ textAlign: "center" }}>
                                                            <span className={`${styles.badge} ${styles.blue}`} style={{ fontWeight: 700 }}>{displayDuration}</span>
                                                        </td>
                                                        <td style={{ overflow: "hidden" }}>
                                                            <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }} title={r.reason || undefined}>
                                                                {normalizeReason(r.reason || "")}
                                                            </div>
                                                        </td>
                                                        <td style={{ color: "var(--text2)", fontSize: 11, fontWeight: 500, lineHeight: 1.4 }}>{r.handover_person || "—"}</td>
                                                        <td style={{ textAlign: "center" }}>
                                                            {r.attachment_url ? (
                                                                <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                                                                    {r.attachment_url.split(",").map((url, i) => (
                                                                        <a key={i} href={url} target="_blank" rel="noreferrer" title={`ดูเอกสารแนบ ${i+1}`} style={{ color: "var(--blue)" }}>
                                                                            <DocumentTextIcon width={24} />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            ) : "—"}
                                                        </td>
                                                        <td>
                                                            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                                                                <span className={badgeClass(r.status)} style={{ fontSize: 10, padding: "2px 8px" }}>
                                                                    {r.status === "pending_hr" ? "รอ HR อนุมัติ" : "รอหัวหน้าอนุมัติ"}
                                                                </span>
                                                                <div style={{ display: "flex", gap: 6 }}>
                                                                    <button 
                                                                        className={styles.btnApprove} 
                                                                        onClick={() => approveLeave(r.id, "approved")} 
                                                                        disabled={!!processingId || (r.status !== "pending" && r.status !== "pending_hr")} 
                                                                        style={{ height: 28, padding: "0 8px", fontSize: 11 }}
                                                                    >
                                                                        <CheckCircleIcon width={12} /> อนุมัติ
                                                                    </button>
                                                                    <button 
                                                                        className={styles.btnReject} 
                                                                        onClick={() => approveLeave(r.id, "rejected")} 
                                                                        disabled={!!processingId || (r.status !== "pending" && r.status !== "pending_hr")} 
                                                                        style={{ height: 28, padding: "0 8px", fontSize: 11 }}
                                                                    >
                                                                        <XCircleIcon width={12} /> ไม่อนุมัติ
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <div className={styles.tableWrap}>
                            <div className={styles.tableHeader}>
                                <div className={styles.tableHeaderTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}><DocumentTextIcon width={20} /> ประวัติการลาทั้งหมด</div>
                                <span className={styles.rowCount}>{filteredByReason.length} รายการ</span>
                            </div>

                            <div className={styles.tableScroll}>
                                {filteredByReason.length === 0 && !leaveLoading ? (
                                    <div className={styles.emptyState}>
                                        <span className={styles.emptyIcon}><InboxIcon width={32} /></span>ยังไม่มีประวัติการลา
                                    </div>
                                ) : (
                                    <table className={styles.table} style={{ tableLayout: "fixed" }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: "20%" }}>พนักงาน (Employee)</th>
                                                <th style={{ width: "10%" }}>ประเภท (Type)</th>
                                                <th style={{ width: "18%" }}>วันที่ (Date)</th>
                                                <th style={{ width: "10%", textAlign: "center" }}>จํานวน (Days)</th>
                                                <th style={{ width: "17%" }}>เหตุผล (Reason)</th>
                                                <th style={{ width: "10%" }}>ผู้รับผิดชอบแทน</th>
                                                <th style={{ width: "60px", textAlign: "center" }}>ไฟล์</th>
                                                <th style={{ width: "160px", textAlign: "center" }}>สถานะ / จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredByReason.map((r) => (
                                                <tr key={r.id} className={styles.clickableRow}>
                                                    <td style={{ overflow: "hidden" }}>
                                                        <div style={{ fontWeight: 700, color: "var(--text)", wordBreak: "break-word" }}>
                                                            {r.name || "-"}
                                                            {!r.employees?.supervisor_id && (
                                                                <span style={{ 
                                                                    marginLeft: 8, 
                                                                    fontSize: 10, 
                                                                    color: "#f59e0b", 
                                                                    background: "rgba(245, 158, 11, 0.1)", 
                                                                    padding: "2px 6px", 
                                                                    borderRadius: 4,
                                                                    fontWeight: 600,
                                                                    border: "1px solid rgba(245, 158, 11, 0.2)"
                                                                }}>
                                                                    ⚠️ ข้ามขั้นตอนหัวหน้า (ไม่มีผู้คุมงาน)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 4, display: "flex", gap: 4, alignItems: "center" }}>
                                                            <span className={styles.monoText}>{r.emp_id}</span> <span style={{ opacity: 0.5 }}>•</span> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.employees?.departments?.name || "ไม่ระบุแผนก"}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontWeight: 500, color: "var(--text2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.leave_type || "-"}</td>
                                                    <td style={{ fontSize: 12, color: "var(--text2)" }}>
                                                        <div style={{ fontWeight: 600 }}>{fmtDateTime(r.start_at || r.start_date)}</div>
                                                        <div style={{ opacity: 0.6 }}>ถึง {fmtDateTime(r.end_at || r.end_date)}</div>
                                                        <div style={{ color: "var(--blue)", fontWeight: 700, marginTop: 4 }}>
                                                            ({formatLeaveMins(r.minutes || (r.days ? r.days * 480 : undefined))})
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: "center" }}>
                                                        <div style={{ fontSize: 12, color: "var(--text4)", fontWeight: 600 }}>
                                                            {( (r.minutes || (r.days ? r.days * 480 : 0)) / 480 ).toFixed(1)} วัน
                                                        </div>
                                                    </td>
                                                    <td style={{ overflow: "hidden" }}>
                                                        <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }} title={r.reason || undefined}>
                                                            {normalizeReason(r.reason || "")}
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: 11, color: "var(--text2)", fontWeight: 500, lineHeight: 1.4 }}>{r.handover_person || "—"}</td>
                                                    <td style={{ textAlign: "center" }}>
                                                        {r.attachment_url ? (
                                                            <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                                                                {r.attachment_url.split(",").map((url, i) => (
                                                                    <a key={i} href={url} target="_blank" rel="noreferrer" title={`ดูเอกสารแนบ ${i+1}`} style={{ color: "var(--blue)" }}>
                                                                        <DocumentTextIcon width={24} />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        ) : "—"}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
                                                            <span className={badgeClass(r.status)}>
                                                                {r.status === "approved" ? "อนุมัติ" 
                                                                  : r.status === "rejected" ? "ไม่อนุมัติ" 
                                                                  : r.status === "cancelled" ? "ยกเลิกแล้ว" 
                                                                  : (r.status === "pending_hr" ? "รอ HR อนุมัติ" : "รอหัวหน้าอนุมัติ")}
                                                            </span>
                                                            <button 
                                                                className={styles.btnDangerGhost} 
                                                                style={{ padding: '0 10px', height: 32, fontSize: 11 }}
                                                                onClick={() => deleteLeave(r.id)}
                                                                disabled={!!processingId}
                                                                title="ลบรายการ"
                                                            >
                                                                <XCircleIcon width={14} /> ลบ
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className={styles.tableWrap} style={{ padding: 0 }}>
                        <div className={styles.filterCard} style={{ margin: 20 }}>
                            <div className={styles.filterCardHeader}>
                                <ChartBarIcon width={18} style={{ color: "var(--red3)" }} />
                                <span className={styles.filterCardTitle}>ตัวกรองสรุปผล (Summary Filters)</span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div className={styles.filterGroup}>
                                    <div className={styles.filterLabel}>MONTH</div>
                                    <select 
                                        style={{ height: 32, fontSize: 13, padding: '0 8px', borderRadius: 6, border: '1px solid var(--line2)', background: '#fff', minWidth: 140 }}
                                        value={selectedMonth}
                                        onChange={e => setSelectedMonth(e.target.value)}
                                    >
                                        <option value="">ทุกเดือน</option>
                                        {availableMonths.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.filterGroup}>
                                    <div className={styles.filterLabel}>FROM</div>
                                    <input 
                                        type="date" 
                                        style={{ height: 32, fontSize: 13, padding: '0 8px', borderRadius: 6, border: '1px solid var(--line2)' }}
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className={styles.filterGroup}>
                                    <div className={styles.filterLabel}>TO</div>
                                    <input 
                                        type="date" 
                                        style={{ height: 32, fontSize: 13, padding: '0 8px', borderRadius: 6, border: '1px solid var(--line2)' }}
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                    />
                                </div>

                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <label className={styles.toggleDetail} title="แสดงรายบุคคล">
                                        <input 
                                            type="checkbox" 
                                            checked={showEmployeeDetail} 
                                            onChange={e => setShowEmployeeDetail(e.target.checked)} 
                                        />
                                        <span className={styles.toggleDetailLabel}>แสดงรายละเอียดรายบุคคล</span>
                                    </label>
                                    <button className={styles.btnExport} onClick={exportToCSV}>
                                        <ArrowDownTrayIcon width={16} /> Export CSV
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={styles.tableHeader}>
                            <div className={styles.tableHeaderTitle} style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <ChartBarIcon width={20} style={{ marginRight: 8 }} />
                                    สรุปการลา แยกตามแผนกและเดือน
                                </div>
                            </div>
                        </div>

                        <div className={styles.tableScroll}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>เดือน</th>
                                        <th>แผนก / พนักงาน</th>
                                        <th style={{ textAlign: "center" }}>จำนวนครั้ง / ID</th>
                                        <th style={{ textAlign: "right" }}>ประเภทการลา</th>
                                        <th style={{ textAlign: "right" }}>รวมเวลาลา</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className={styles.emptyState}>ไม่มีข้อมูลสำหรับรายงาน</td>
                                        </tr>
                                    ) : (
                                        reportData.flatMap((m) => 
                                            m.depts.flatMap((d, dIdx) => [
                                                // Dept Summary Row
                                                <tr key={`${m.month}-${d.name}`} style={{ background: 'var(--surface2)' }}>
                                                    {dIdx === 0 && (
                                                        <td rowSpan={m.depts.reduce((acc, curr) => acc + (showEmployeeDetail ? curr.employees.length + 1 : 1), 0)} style={{ verticalAlign: 'top', fontWeight: 700, background: 'var(--surface2)', borderRight: '1px solid var(--line)' }}>
                                                            {m.month}
                                                        </td>
                                                    )}
                                                    <td style={{ fontWeight: 700, color: 'var(--text)' }}>{d.name}</td>
                                                    <td style={{ textAlign: "center", fontWeight: 700 }}>{d.total_requests} ครั้ง ({d.emp_count} คน)</td>
                                                    <td style={{ textAlign: "right", fontSize: 12 }}>
                                                        {d.leave_types.map(([t, c]) => (
                                                            <div key={t}>{t}: {c}</div>
                                                        ))}
                                                    </td>
                                                    <td style={{ textAlign: "right" }}>
                                                        <span className={`${styles.badge} ${styles.approved}`} style={{ fontSize: 13, minWidth: 80, textAlign: 'center', fontWeight: 700 }}>
                                                            {formatLeaveMins(d.total_minutes)}
                                                        </span>
                                                    </td>
                                                </tr>,
                                                // Employee Detail Rows
                                                ...(showEmployeeDetail ? d.employees.map(emp => (
                                                    <tr key={`${m.month}-${d.name}-${emp.emp_id}`} style={{ background: '#fff' }}>
                                                        <td style={{ paddingLeft: 40, color: 'var(--text2)' }}>
                                                            <span style={{ color: 'var(--text4)', marginRight: 8 }}>↳</span>
                                                            {emp.name}
                                                        </td>
                                                        <td style={{ textAlign: "center", fontSize: 12, color: 'var(--text3)' }}>{emp.emp_id}</td>
                                                        <td style={{ textAlign: "right", fontSize: 11, color: 'var(--text4)' }}>
                                                            {emp.types.map(([t, c]) => `${t}(${c})`).join(", ")}
                                                        </td>
                                                        <td style={{ textAlign: "right" }}>
                                                            <span style={{ fontWeight: 600, color: 'var(--ok)', fontSize: 12 }}>
                                                                {formatLeaveMins(emp.total_minutes)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )) : [])
                                            ])
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className={styles.content} style={{ padding: 0 }}>
            {renderLeave()}
        </div>
    );
}