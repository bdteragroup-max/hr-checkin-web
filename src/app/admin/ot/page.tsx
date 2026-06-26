"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "../page.module.css";
import localStyles from "./page.module.css";
import { formatTime24h, formatDateThai, formatDecimalHoursToHHMM } from "@/utils/time";
import AlertModal, { AlertState } from "@/components/AlertModal";
import { CheckCircleIcon, XCircleIcon, PencilSquareIcon, ClockIcon, ChartBarIcon, ClipboardDocumentListIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

type OtRequest = {
    id: number;
    emp_id: string;
    date_for: string;
    start_time: string;
    end_time: string;
    total_hours: number;
    approved_hours: number | null;
    reason: string;
    status: "pending_supervisor" | "pending_hr" | "approved" | "rejected";
    supervisor_name: string | null;
    supervisor_remark: string | null;
    employee: { name: string; departments: { name: string } | null };
};

export default function AdminOtPage() {
    const [requests, setRequests] = useState<OtRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [viewMode, setViewMode] = useState<"list" | "report">("list");
    const [showEmployeeDetail, setShowEmployeeDetail] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(""); // YYYY-MM
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const closeAlert = () => setAlert(p => ({ ...p, visible: false }));

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedReq, setSelectedReq] = useState<OtRequest | null>(null);
    const [modalData, setModalData] = useState({ 
        status: "approved" as "approved" | "rejected", 
        hours: "", 
        remark: "" 
    });
    const [saving, setSaving] = useState(false);

    async function loadRequests() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/ot");
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadRequests();
    }, []);

    function openAdjustment(req: OtRequest) {
        setSelectedReq(req);
        setModalData({
            status: req.status === "rejected" ? "rejected" : "approved",
            hours: String(req.approved_hours || req.total_hours),
            remark: req.supervisor_remark || ""
        });
        setShowModal(true);
    }

    async function submitAdjustment() {
        if (!selectedReq) return;
        
        const { status, hours, remark } = modalData;
        const approved_hours = status === "approved" ? Number(hours) : undefined;

        if (status === "approved" && (isNaN(Number(hours)) || Number(hours) <= 0)) {
            setAlert({ visible: true, message: "กรุณาระบุจำนวนชั่วโมงที่ถูกต้อง", type: "error" });
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/admin/ot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: selectedReq.id, 
                    status, 
                    approved_hours, 
                    remark 
                })
            });
            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: `บันทึกรายการเรียบร้อยแล้ว`, type: "ok" });
                setShowModal(false);
                loadRequests();
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (e: any) {
            setAlert({ visible: true, message: e.message, type: "error" });
        } finally {
            setSaving(false);
        }
    }

    async function deleteOt(id: number) {
        if (!confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้? การลบจะไม่สามารถกู้คืนได้")) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/ot/${id}`, {
                method: "DELETE",
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setAlert({ visible: true, message: data?.error || `DELETE_FAILED_${res.status}`, type: "error" });
            } else {
                setAlert({ visible: true, message: "ลบรายการเรียบร้อยแล้ว", type: "ok" });
                loadRequests();
            }
        } catch (e: any) {
            setAlert({ visible: true, message: e.message || "DELETE_ERROR", type: "error" });
        } finally {
            setSaving(false);
        }
    }

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const matchesStatus = !statusFilter || req.status === statusFilter;
            const matchesSearch = !searchQuery ||
                req.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                req.emp_id.toLowerCase().includes(searchQuery.toLowerCase());
            
            let matchesDate = true;
            if (startDate || endDate) {
                const reqDate = new Date(req.date_for).toISOString().split('T')[0];
                if (startDate && reqDate < startDate) matchesDate = false;
                if (endDate && reqDate > endDate) matchesDate = false;
            }
            
            return matchesStatus && matchesSearch && matchesDate;
        });
    }, [requests, statusFilter, searchQuery, startDate, endDate]);

    const pendingCount = requests.filter(r => r.status === "pending_hr").length;
    
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        requests.forEach(r => {
            const date = new Date(r.date_for);
            let cycleMonth = date.getMonth() + 1;
            let cycleYear = date.getFullYear();
            
            if (date.getDate() > 25) {
                cycleMonth += 1;
                if (cycleMonth > 12) {
                    cycleMonth = 1;
                    cycleYear += 1;
                }
            }
            months.add(`${cycleYear}-${String(cycleMonth).padStart(2, '0')}`);
        });
        return Array.from(months).sort((a, b) => b.localeCompare(a));
    }, [requests]);

    const reportData = useMemo(() => {
        const groups: Record<string, Record<string, { 
            approved_hours: number, 
            total_hours: number, 
            emp_ids: Set<string>,
            employees: Record<string, { name: string, emp_id: string, total_hours: number, approved_hours: number }>
        }>> = {};
        
        requests.forEach(req => {
            const date = new Date(req.date_for);
            let cycleMonth = date.getMonth() + 1;
            let cycleYear = date.getFullYear();
            
            if (date.getDate() > 25) {
                cycleMonth += 1;
                if (cycleMonth > 12) {
                    cycleMonth = 1;
                    cycleYear += 1;
                }
            }
            const monthKey = `${cycleYear}-${String(cycleMonth).padStart(2, '0')}`;
            if (selectedMonth && monthKey !== selectedMonth) return;
            
            const reqDate = date.toISOString().split('T')[0];
            if (startDate && reqDate < startDate) return;
            if (endDate && reqDate > endDate) return;

            const deptName = req.employee.departments?.name || "ไม่ระบุแผนก";
            
            if (!groups[monthKey]) groups[monthKey] = {};
            if (!groups[monthKey][deptName]) {
                groups[monthKey][deptName] = { 
                    approved_hours: 0, 
                    total_hours: 0, 
                    emp_ids: new Set(),
                    employees: {}
                };
            }
            
            const g = groups[monthKey][deptName];
            g.total_hours += Number(req.total_hours);
            if (req.status === "approved") {
                g.approved_hours += Number(req.approved_hours || req.total_hours);
            }
            g.emp_ids.add(req.emp_id);
            
            if (!g.employees[req.emp_id]) {
                g.employees[req.emp_id] = { name: req.employee.name, emp_id: req.emp_id, total_hours: 0, approved_hours: 0 };
            }
            
            const emp = g.employees[req.emp_id];
            emp.total_hours += Number(req.total_hours);
            if (req.status === "approved") {
                emp.approved_hours += Number(req.approved_hours || req.total_hours);
            }
        });
        
        // Convert to sorted array
        const result: { 
            month: string, 
            depts: { 
                name: string, 
                approved_hours: number, 
                total_hours: number, 
                emp_count: number, 
                employees: { name: string, emp_id: string, total_hours: number, approved_hours: number }[] 
            }[] 
        }[] = [];

        Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(month => {
            const depts = Object.keys(groups[month]).map(name => ({
                name,
                ...groups[month][name],
                emp_count: groups[month][name].emp_ids.size,
                employees: Object.values(groups[month][name].employees).sort((a, b) => b.approved_hours - a.approved_hours)
            })).sort((a, b) => b.approved_hours - a.approved_hours);
            
            result.push({ month, depts });
        });
        
        return result;
    }, [requests, selectedMonth]);

    function exportToCSV() {
        const BOM = "\uFEFF";
        let csvContent = "Month,Department,Employee ID,Employee Name,Approved Hours,Total Hours\n";
        reportData.forEach(m => {
            m.depts.forEach(d => {
                d.employees.forEach(emp => {
                    csvContent += `${m.month},"${d.name}","${emp.emp_id}","${emp.name}",${emp.approved_hours.toFixed(2)},${emp.total_hours.toFixed(2)}\n`;
                });
                // Add subtotal row for department
                csvContent += `${m.month},"${d.name} TOTAL",-,-,${d.approved_hours.toFixed(2)},${d.total_hours.toFixed(2)}\n`;
            });
        });
        
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `OT_Report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportListToCSV() {
        const BOM = "\uFEFF";
        let csvContent = "Employee Name,Employee ID,Department,Date,Start,End,Requested Hours,Reason,Status\n";
        
        filteredRequests.forEach(req => {
            const rowStatus = getStatusText(req.status);
            const dept = req.employee.departments?.name || "-";
            const dateStr = formatDateThai(req.date_for);
            const startTime = formatTime24h(req.start_time);
            const endTime = formatTime24h(req.end_time);
            
            csvContent += `"${req.employee.name}","${req.emp_id}","${dept}","${dateStr}","${startTime}","${endTime}",${req.total_hours},"${req.reason || ""}","${rowStatus}"\n`;
        });

        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `OT_List_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function getStatusBadge(status: string) {
        if (status === "approved") return `${styles.badge} ${styles.approved}`;
        if (status === "rejected") return `${styles.badge} ${styles.rejected}`;
        if (status === "pending_hr") return `${styles.badge} ${styles.pending}`;
        return `${styles.badge} ${styles.pending_supervisor || styles.pending}`;
    }

    function getStatusText(status: string) {
        if (status === "approved") return "อนุมัติแล้ว";
        if (status === "rejected") return "ไม่อนุมัติ";
        if (status === "pending_hr") return "รอ HR อนุมัติ";
        return "รอหัวหน้าอนุมัติ";
    }

    return (
        <div className={styles.content}>
            <AlertModal alert={alert} onClose={closeAlert} />
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>จัดการคำขอ OT</h1>
                    <div className={styles.pageSubtitle}>ตรวจสอบและจัดการการทำงานล่วงเวลาของพนักงาน</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    {/* Report toggle removed as requested */}
                </div>
            </div>

            {viewMode === "list" ? (
                <>
                    <div className={styles.filterCard}>
                        <div className={styles.filterCardHeader}>
                            <ClockIcon width={18} style={{ color: "var(--red3)" }} />
                            <span className={styles.filterCardTitle}>ตัวกรองข้อมูล OT (Filters)</span>
                        </div>
                        <div className={styles.filterBar}>
                            <div className={styles.filterGroup}>
                                <div className={styles.filterLabel}>STATUS</div>
                                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                    <option value="">ทุกสถานะ</option>
                                    <option value="pending_supervisor">รอหัวหน้าอนุมัติ</option>
                                    <option value="pending_hr">รอ HR อนุมัติ</option>
                                    <option value="approved">อนุมัติแล้ว</option>
                                    <option value="rejected">ไม่อนุมัติ</option>
                                </select>
                            </div>
                            <div className={styles.filterGroup}>
                                <div className={styles.filterLabel}>SEARCH</div>
                                <input
                                    type="text"
                                    placeholder="ชื่อ หรือ รหัสพนักงาน"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <div className={styles.filterLabel}>FROM</div>
                                <input
                                    type="date"
                                    className={styles.filterInput}
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <div className={styles.filterLabel}>TO</div>
                                <input
                                    type="date"
                                    className={styles.filterInput}
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <button className={styles.btnPrimary} onClick={loadRequests} disabled={loading}>
                                {loading ? "กำลังโหลด..." : "Refresh"}
                            </button>
                            <button className={styles.btnExport} onClick={exportListToCSV}>
                                <ArrowDownTrayIcon width={16} /> Export List
                            </button>
                        </div>
                    </div>

                    <div className={styles.tableWrap}>
                        <div className={styles.tableHeader}>
                            <div className={styles.tableHeaderTitle}>
                                คำขอ OT {pendingCount > 0 && <span className={styles.pendingCountBadge}>{pendingCount}</span>}
                            </div>
                            <span className={styles.rowCount}>{filteredRequests.length} รายการ</span>
                        </div>

                        <div className={styles.tableScroll}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>พนักงาน</th>
                                        <th>วันที่</th>
                                        <th>เวลาเริ่ม - สิ้นสุด</th>
                                        <th style={{ textAlign: "center" }}>รวม</th>
                                        <th>การอนุมัติ</th>
                                        <th>เหตุผล</th>
                                        <th>สถานะ</th>
                                        <th>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.length === 0 && !loading ? (
                                        <tr>
                                            <td colSpan={8} className={styles.emptyState}>ไม่พบรายการคำขอ OT</td>
                                        </tr>
                                    ) : (
                                        filteredRequests.map(req => (
                                            <tr key={req.id} className={styles.clickableRow}>
                                                <td>
                                                    <div className={styles.empName}>{req.employee.name}</div>
                                                    <div className={styles.empId}>{req.emp_id} • {req.employee.departments?.name || "-"}</div>
                                                </td>
                                                <td>
                                                    <div className={styles.monoText}>
                                                        {formatDateThai(req.date_for)}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 600 }}>{formatTime24h(req.start_time)}</span>
                                                    {" - "}
                                                    <span style={{ fontWeight: 600 }}>{formatTime24h(req.end_time)}</span>
                                                </td>
                                                <td style={{ textAlign: "center" }}>
                                                    <span className={`${styles.badge} ${styles.ot}`}>{formatDecimalHoursToHHMM(req.total_hours)}</span>
                                                </td>
                                                <td>
                                                    {req.approved_hours ? (
                                                        <div className={styles.empName}>{formatDecimalHoursToHHMM(req.approved_hours)}</div>
                                                    ) : (
                                                        <div style={{ color: "var(--text4)" }}>-</div>
                                                    )}
                                                    <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 2 }}>
                                                        {req.supervisor_name || "ไม่มีข้อมูลหัวหน้า"}
                                                    </div>
                                                    {req.supervisor_remark && (
                                                        <div style={{ fontSize: 11, color: "var(--ot)", marginTop: 4, fontStyle: 'italic' }}>
                                                            Admin: {req.supervisor_remark}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ maxWidth: 300 }}>
                                                    <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.4 }}>{req.reason}</div>
                                                </td>
                                                <td>
                                                    <span className={getStatusBadge(req.status)}>
                                                        {getStatusText(req.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button 
                                                            onClick={() => openAdjustment(req)} 
                                                            className={localStyles.btnApprove} 
                                                            disabled={saving}
                                                            title="อนุมัติ/จัดการ"
                                                        >
                                                            { (req.status === "approved" || req.status === "rejected") ? (
                                                                <>
                                                                    <PencilSquareIcon width={14} style={{ marginRight: 4 }} />
                                                                    แก้ไข
                                                                </>
                                                            ) : "จัดการ" }
                                                        </button>
                                                        <button 
                                                            onClick={() => deleteOt(req.id)} 
                                                            className={styles.btnDangerGhost} 
                                                            disabled={saving}
                                                            style={{ padding: '0 10px', height: 32, fontSize: 11 }}
                                                            title="ลบรายการ"
                                                        >
                                                            <XCircleIcon width={14} /> ลบ
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className={styles.tableWrap} style={{ padding: 0 }}>
                    <div className={styles.filterCard} style={{ margin: 20 }}>
                        <div className={styles.filterCardHeader}>
                            <ChartBarIcon width={18} style={{ color: "var(--red3)" }} />
                            <span className={styles.filterCardTitle}>ตัวกรองสรุปผล OT (Summary Filters)</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className={styles.filterGroup}>
                                <div className={styles.filterLabel}>MONTH</div>
                                <select 
                                    className={styles.filterInput} 
                                    style={{ height: 32, fontSize: 13, padding: '0 8px', borderRadius: 6, minWidth: 140 }}
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
                                    className={styles.filterInput} 
                                    style={{ height: 32, fontSize: 13, padding: '0 8px', borderRadius: 6 }}
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <div className={styles.filterLabel}>TO</div>
                                <input 
                                    type="date" 
                                    className={styles.filterInput} 
                                    style={{ height: 32, fontSize: 13, padding: '0 8px', borderRadius: 6 }}
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>

                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                                <label className={localStyles.toggleDetail} title="แสดงรายบุคคล">
                                    <input 
                                        type="checkbox" 
                                        checked={showEmployeeDetail} 
                                        onChange={e => setShowEmployeeDetail(e.target.checked)} 
                                    />
                                    <span className={localStyles.toggleDetailLabel}>แสดงรายละเอียดรายบุคคล</span>
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
                                สรุป OT แยกตามแผนกและเดือน
                            </div>
                        </div>
                    </div>

                    <div className={styles.tableScroll}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>เดือน</th>
                                    <th>แผนก / พนักงาน</th>
                                    <th style={{ textAlign: "center" }}>จํานวนพนักงาน / ID</th>
                                    <th style={{ textAlign: "right" }}>ชั่วโมงที่ขอ (ทั้งหมด)</th>
                                    <th style={{ textAlign: "right" }}>ชั่วโมงที่อนุมัติแล้ว</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className={styles.emptyState}>ไม่มีข้อมูลสำหรับรายงาน</td>
                                    </tr>
                                ) : (
                                    reportData.flatMap((m, mIdx) => 
                                        m.depts.flatMap((d, dIdx) => [
                                            // Department Header Row
                                            <tr key={`${m.month}-${d.name}`} style={{ background: 'var(--surface2)' }}>
                                                {dIdx === 0 && (
                                                    <td rowSpan={m.depts.reduce((acc, curr) => acc + (showEmployeeDetail ? curr.employees.length + 1 : 1), 0)} style={{ verticalAlign: 'top', fontWeight: 700, background: 'var(--surface2)', borderRight: '1px solid var(--line)' }}>
                                                        {m.month}
                                                    </td>
                                                )}
                                                <td style={{ fontWeight: 700, color: 'var(--text)' }}>
                                                    {d.name}
                                                </td>
                                                <td style={{ textAlign: "center", fontWeight: 700 }}>{d.emp_count} คน</td>
                                                <td style={{ textAlign: "right", color: 'var(--text3)', fontWeight: 700 }}>{formatDecimalHoursToHHMM(d.total_hours)}</td>
                                                <td style={{ textAlign: "right" }}>
                                                    <span className={`${styles.badge} ${styles.approved}`} style={{ fontSize: 13, minWidth: 80, textAlign: 'center', fontWeight: 700 }}>
                                                        {formatDecimalHoursToHHMM(d.approved_hours)}
                                                    </span>
                                                </td>
                                            </tr>,
                                            // Employee Detail Rows (Conditional)
                                            ...(showEmployeeDetail ? d.employees.map(emp => (
                                                <tr key={`${m.month}-${d.name}-${emp.emp_id}`} style={{ background: '#fff' }}>
                                                    <td style={{ paddingLeft: 40, color: 'var(--text2)' }}>
                                                        <span style={{ color: 'var(--text4)', marginRight: 8 }}>↳</span>
                                                        {emp.name}
                                                    </td>
                                                    <td style={{ textAlign: "center", fontSize: 12, color: 'var(--text3)' }}>{emp.emp_id}</td>
                                                    <td style={{ textAlign: "right", color: 'var(--text3)', fontSize: 12 }}>{formatDecimalHoursToHHMM(emp.total_hours)}</td>
                                                    <td style={{ textAlign: "right" }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--ok)', fontSize: 12 }}>
                                                            {formatDecimalHoursToHHMM(emp.approved_hours)}
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

            {showModal && selectedReq && (
                <div className={localStyles.modalOverlay}>
                    <div className={localStyles.modalContent}>
                        <div className={localStyles.modalHeader}>
                            <h2>จัดการคำขอ OT</h2>
                        </div>
                        <div className={localStyles.modalBody}>
                            <div className={localStyles.inputField}>
                                <label className={localStyles.inputLabel}>สถานะการตัดสินใจ</label>
                                <div className={localStyles.statusOptions}>
                                    <div 
                                        className={`${localStyles.statusOption} ${localStyles.approved} ${modalData.status === "approved" ? localStyles.active : ""}`}
                                        onClick={() => setModalData({...modalData, status: "approved"})}
                                    >
                                        <CheckCircleIcon width={18} /> อนุมัติ
                                    </div>
                                    <div 
                                        className={`${localStyles.statusOption} ${localStyles.rejected} ${modalData.status === "rejected" ? localStyles.active : ""}`}
                                        onClick={() => setModalData({...modalData, status: "rejected"})}
                                    >
                                        <XCircleIcon width={18} /> ไม่อนุมัติ
                                    </div>
                                </div>
                            </div>

                            {modalData.status === "approved" && (
                                <div className={localStyles.inputField}>
                                    <label className={localStyles.inputLabel}>จำนวนชั่วโมงที่อนุมัติ (Requested: {formatDecimalHoursToHHMM(selectedReq.total_hours)})</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            className={localStyles.inputElement} 
                                            type="number" 
                                            step="0.5"
                                            value={modalData.hours} 
                                            onChange={e => setModalData({...modalData, hours: e.target.value})}
                                        />
                                        <ClockIcon width={18} style={{ position: 'absolute', right: 12, top: 11, color: 'var(--text4)' }} />
                                    </div>
                                </div>
                            )}

                            <div className={localStyles.inputField}>
                                <label className={localStyles.inputLabel}>บันทึก / ความเห็นของแอดมิน</label>
                                <textarea 
                                    className={`${localStyles.inputElement} ${localStyles.textAreaElement}`}
                                    placeholder="ระบุเหตุผลหรือข้อความเพิ่มเติม..."
                                    value={modalData.remark}
                                    onChange={e => setModalData({...modalData, remark: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className={localStyles.modalFooter}>
                            <button className={localStyles.btnCancel} onClick={() => setShowModal(false)} disabled={saving}>
                                ยกเลิก
                            </button>
                            <button className={localStyles.btnConfirm} onClick={submitAdjustment} disabled={saving}>
                                {saving ? "กำลังบันทึก..." : "ยืนยันการตั้งค่า"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
