"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "../travel-claims/page.module.css";
import { format, startOfMonth, endOfMonth } from "date-fns";
import AlertModal, { AlertState } from "@/components/AlertModal";
import {
    FolderOpenIcon,
    DocumentTextIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    CheckIcon,
    UserGroupIcon,
    ShieldCheckIcon
} from "@heroicons/react/24/outline";

const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

function formatPeriodMonthThai(periodMonth?: string): string {
    if (!periodMonth || !periodMonth.includes("-")) return periodMonth || "-";
    const [y, m] = periodMonth.split("-").map(Number);
    if (!y || !m) return periodMonth;
    return `${THAI_MONTHS[m - 1] || m} ${y + 543}`;
}

function formatDateDMY(dateStr?: string): string {
    if (!dateStr) return "-";
    const clean = String(dateStr).slice(0, 10);
    const parts = clean.split("-");
    if (parts.length !== 3) return String(dateStr);
    const [y, m, d] = parts;
    const yearNum = parseInt(y, 10);
    if (isNaN(yearNum)) return String(dateStr);
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${yearNum + 543}`;
}

export default function AdminMissingCheckinReportsPage() {
    const queryClient = useQueryClient();
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    const [saving, setSaving] = useState(false);

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const [pendingAction, setPendingAction] = useState<{ id: string; status: string } | null>(null);

    const [statusFilter, setStatusFilter] = useState("pending_hr");
    const [searchQuery, setSearchQuery] = useState("");

    const closeAlert = () => {
        setAlert(p => ({ ...p, visible: false }));
        setPendingAction(null);
    };

    const { data: reports = [], isLoading: loading } = useQuery<any[]>({
        queryKey: ["admin-missing-checkin-reports", startDate, endDate],
        queryFn: async () => {
            const r = await fetch(`/api/admin/missing-checkin-reports?start_date=${startDate}&end_date=${endDate}`);
            if (!r.ok) throw new Error("Failed to fetch");
            const data = await r.json();
            return data.list || [];
        }
    });

    function handleActionClick(id: string, status: string) {
        setPendingAction({ id, status });
        setAlert({
            visible: true,
            message: `ยืนยันการ${status === "approved" ? "อนุมัติรับทราบ" : "ปฏิเสธ"} รายงานการทำงานนี้?`,
            type: "ok"
        });
    }

    async function executeAction(remark: string) {
        if (!pendingAction) return;
        const { id, status } = pendingAction;

        setSaving(true);
        try {
            const r = await fetch("/api/admin/missing-checkin-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, remark })
            });
            const data = await r.json();
            if (data.ok) {
                setAlert({ visible: true, message: "บันทึกรายการเรียบร้อยแล้ว", type: "ok" });
                queryClient.invalidateQueries({ queryKey: ["admin-missing-checkin-reports"] });
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (e: any) {
            setAlert({ visible: true, message: e.message, type: "error" });
        } finally {
            setSaving(false);
            setPendingAction(null);
        }
    }

    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            const matchesStatus = statusFilter === "all" || r.status === statusFilter;
            const q = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                r.doc_no?.toLowerCase().includes(q) ||
                r.employee?.name?.toLowerCase().includes(q) ||
                r.emp_id?.toLowerCase().includes(q) ||
                r.work_details?.toLowerCase().includes(q);
            return matchesStatus && matchesSearch;
        });
    }, [reports, statusFilter, searchQuery]);

    const pendingCount = reports.filter(r => r.status === "pending_hr").length;

    function getStatusBadge(status: string) {
        if (status === "approved") return `${styles.statusBadge} ${styles.status_approved}`;
        if (status === "rejected") return `${styles.statusBadge} ${styles.status_rejected}`;
        if (status === "pending_supervisor") return `${styles.statusBadge} ${styles.status_pending}`;
        return `${styles.statusBadge} ${styles.status_pending_admin || styles.status_pending}`;
    }

    return (
        <div className={styles.wrap}>
            <AlertModal
                alert={alert}
                onClose={closeAlert}
                onConfirmInput={pendingAction ? executeAction : undefined}
                inputPlaceholder="ระบุหมายเหตุ (ถ้ามี)..."
                confirmText={pendingAction ? "ยืนยัน" : "ตกลง"}
            />

            {/* ── Header ── */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.h1}>รายงานการทำงาน (Human Soft ลงเวลาไม่ครบ)</h1>
                    <div className={styles.sub}>ตรวจสอบและอนุมัติเอกสารรายงานการทำงานที่ผ่านการอนุมัติจากหัวหน้างาน</div>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "auto 240px 1fr auto",
                gap: 16,
                alignItems: "end",
                marginBottom: 20,
                background: "var(--surface)",
                padding: "16px 20px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--line)",
                boxShadow: "var(--shadow-sm)"
            }}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>DATE RANGE (วันที่ทำงาน)</label>
                    <div style={{ display: "grid", gridTemplateColumns: "150px auto 150px", gap: 8, alignItems: "center" }}>
                        <input
                            type="date"
                            className={styles.input}
                            style={{ width: "100%" }}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span style={{ color: "var(--text4)", textAlign: "center" }}>-</span>
                        <input
                            type="date"
                            className={styles.input}
                            style={{ width: "100%" }}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>STATUS</label>
                    <select
                        className={styles.select}
                        style={{ width: "100%" }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">ทุกสถานะ</option>
                        <option value="pending_hr">รอ HR ตรวจสอบ (หัวหน้าอนุมัติแล้ว)</option>
                        <option value="pending_supervisor">รอหัวหน้างานอนุมัติ</option>
                        <option value="approved">HR อนุมัติแล้ว</option>
                        <option value="rejected">ไม่อนุมัติ</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>SEARCH</label>
                    <input
                        className={styles.input}
                        style={{ width: "100%" }}
                        type="text"
                        placeholder="เลขที่รายการ, ชื่อพนักงาน, รหัสพนักงาน, รายละเอียดงาน..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        className={styles.btnRefresh}
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-missing-checkin-reports"] })}
                        disabled={loading || saving}
                        style={{ width: 40, height: 40, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="รีเฟรช"
                    >
                        <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* ── Table Card ── */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <FolderOpenIcon width={20} /> รายการเอกสารรายงานการทำงาน
                        {pendingCount > 0 && (
                            <span style={{
                                background: "var(--red)",
                                color: "white",
                                padding: "1px 7px",
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 800
                            }}>
                                {pendingCount} รอ HR
                            </span>
                        )}
                    </div>
                    <span className={styles.rowCount}>{filteredReports.length} รายการ</span>
                </div>

                <div className={styles.tableScroll}>
                    {loading ? (
                        <div className={styles.loader}>
                            <div className={styles.spinner} />
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : (
                        <table className={styles.table} style={{ tableLayout: "fixed", width: "100%" }}>
                            <thead>
                                <tr>
                                    <th style={{ width: "14%", textAlign: "center" }}>เลขที่รายการ</th>
                                    <th style={{ width: "20%", textAlign: "left" }}>พนักงาน</th>
                                    <th style={{ width: "16%", textAlign: "center" }}>วันที่ไม่ได้ลงเวลา / เวลาเข้า-ออก</th>
                                    <th style={{ width: "22%", textAlign: "left" }}>รายละเอียดงานที่ทำ</th>
                                    <th style={{ width: "10%", textAlign: "center" }}>หลักฐานการทำงาน</th>
                                    <th style={{ width: "10%", textAlign: "center" }}>สถานะ</th>
                                    <th style={{ width: "8%", textAlign: "center" }}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReports.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: "center", padding: 60, color: "var(--text4)" }}>
                                            ไม่พบรายการเอกสารรายงานการทำงาน
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReports.map((r: any) => (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 800, color: "var(--red)", whiteSpace: "nowrap", textAlign: "center", verticalAlign: "middle" }}>
                                                {r.doc_no}
                                            </td>
                                            <td style={{ verticalAlign: "middle" }}>
                                                <div className={styles.empName}>{r.employee?.name}</div>
                                                <div className={styles.empId}>{r.emp_id} {r.employee?.departments?.name ? `· ${r.employee.departments.name}` : ""}</div>
                                            </td>
                                            <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                                {r.period_month && (
                                                    <div style={{
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        color: "#1d4ed8",
                                                        background: "#eff6ff",
                                                        border: "1px solid #bfdbfe",
                                                        borderRadius: 6,
                                                        padding: "2px 8px",
                                                        display: "inline-block",
                                                        marginBottom: 6
                                                    }}>
                                                        เดือน{formatPeriodMonthThai(r.period_month)} ({Array.isArray(r.items) ? r.items.length : 1} วัน)
                                                    </div>
                                                )}
                                                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                                                    {(Array.isArray(r.items) && r.items.length > 0 ? r.items : [{
                                                        work_date: r.work_date,
                                                        check_in_time: r.check_in_time,
                                                        check_out_time: r.check_out_time
                                                    }]).map((it: any, idx: number) => (
                                                        <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                                            <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 12.5 }}>
                                                                {formatDateDMY(it.work_date)}
                                                            </div>
                                                            <span className={styles.typeTag}>
                                                                {it.check_in_time} - {it.check_out_time} น.
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ verticalAlign: "middle" }}>
                                                <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.45, color: "var(--text)" }}>{r.work_details}</div>
                                                {r.supervisor_approved_at && (
                                                    <div style={{ fontSize: 11, color: "var(--ok)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                                        <CheckIcon width={12} strokeWidth={3} />
                                                        หัวหน้าอนุมัติแล้ว ({r.supervisor?.name || r.supervisor_id || "-"}): {r.supervisor_remark || "-"}
                                                    </div>
                                                )}
                                                {r.hr_remark && (
                                                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                                                        หมายเหตุ HR: {r.hr_remark}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                                <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                                    {r.evidence_urls && r.evidence_urls.split(",").map((url: string, index: number) => (
                                                        <a
                                                            key={index}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className={styles.link}
                                                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                                                        >
                                                            <DocumentTextIcon width={14} /> หลักฐาน {r.evidence_urls.includes(",") ? `(${index + 1})` : ""}
                                                        </a>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                                    <span className={getStatusBadge(r.status)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                                        {r.status === "pending_hr" ? <><ShieldCheckIcon width={14} /> รอ HR</> :
                                                         r.status === "pending_supervisor" ? <><UserGroupIcon width={14} /> รอหัวหน้า</> :
                                                         r.status === "approved" ? <><CheckCircleIcon width={14} /> อนุมัติแล้ว</> :
                                                         <><XCircleIcon width={14} /> ไม่อนุมัติ</>}
                                                    </span>
                                                    {r.hr_approved_by && (
                                                        <div style={{ fontSize: 10, color: "var(--text4)", marginTop: 5 }}>
                                                            โดย {r.hr_approved_by}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                                {r.status === "pending_hr" ? (
                                                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                                                        <button
                                                            onClick={() => handleActionClick(r.id, "approved")}
                                                            className={styles.btnApprove}
                                                            title="อนุมัติ"
                                                        >
                                                            <CheckIcon width={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleActionClick(r.id, "rejected")}
                                                            className={styles.btnReject}
                                                            title="ไม่อนุมัติ"
                                                        >
                                                            <XCircleIcon width={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 11, color: "var(--text5)", fontWeight: 500 }}>
                                                        {r.status === "pending_supervisor" ? "รอหัวหน้าอนุมัติ" : "ดำเนินการแล้ว"}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
