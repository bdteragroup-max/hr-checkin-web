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
    ShieldCheckIcon,
    ArrowDownTrayIcon,
    CalendarIcon,
    ClockIcon
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
    const [exportingExcel, setExportingExcel] = useState(false);

    async function handleExportExcel() {
        setExportingExcel(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.set("start_date", startDate);
            if (endDate) params.set("end_date", endDate);
            if (statusFilter) params.set("status", statusFilter);
            if (searchQuery.trim()) params.set("q", searchQuery.trim());

            const res = await fetch(`/api/admin/missing-checkin-reports/export?${params.toString()}`);
            if (!res.ok) {
                throw new Error("ไม่สามารถส่งออกไฟล์ Excel ได้");
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `missing_checkin_reports_${startDate || "all"}_to_${endDate || "all"}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e: any) {
            setAlert({ visible: true, message: e.message || "เกิดข้อผิดพลาดในการส่งออก Excel", type: "error" });
        } finally {
            setExportingExcel(false);
        }
    }

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
            message: `ยืนยันการ${status === "approved" ? "อนุมัติรับทราบ" : "ไม่อนุมัติ"} รายงานการทำงานนี้?`,
            type: status === "approved" ? "ok" : "error"
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
            <div className={styles.header} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 className={styles.h1}>รายงานการทำงาน (Human Soft ลงเวลาไม่ครบ)</h1>
                    <div className={styles.sub}>ตรวจสอบและอนุมัติเอกสารรายงานการทำงานที่ผ่านการอนุมัติจากหัวหน้างาน</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={loading || exportingExcel}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            height: 40,
                            padding: "0 16px",
                            borderRadius: 10,
                            border: "1px solid #0b6a36",
                            background: "#107c41",
                            color: "#ffffff",
                            fontWeight: 700,
                            fontSize: 13.5,
                            cursor: loading || exportingExcel ? "not-allowed" : "pointer",
                            opacity: loading || exportingExcel ? 0.65 : 1,
                            boxShadow: "0 2px 6px rgba(16, 124, 65, 0.25)"
                        }}
                        title="ดาวน์โหลดรายงานเป็นไฟล์ Excel (.xlsx)"
                    >
                        <ArrowDownTrayIcon width={17} strokeWidth={2.2} />
                        <span>{exportingExcel ? "กำลังสร้างไฟล์ Excel..." : "Export Excel"}</span>
                    </button>
                </div>
            </div>

            {/* ── Symmetrical Filter Bar ── */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "340px 260px 1fr 42px",
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
                    <label className={styles.filterLabel}>ช่วงวันที่ทำงาน (วัน/เดือน/ปี)</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 16px 1fr", gap: 6, alignItems: "center" }}>
                        {/* Start Date DD/MM/YYYY */}
                        <div style={{
                            position: "relative",
                            height: 40,
                            borderRadius: "var(--radius-sm)",
                            border: "1.5px solid var(--line2)",
                            background: "var(--surface)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 11px",
                            boxSizing: "border-box",
                            boxShadow: "var(--shadow-xs)"
                        }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                                {formatDateDMY(startDate)}
                            </span>
                            <CalendarIcon width={15} style={{ color: "var(--text4)", pointerEvents: "none" }} />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                onClick={e => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                            />
                        </div>

                        <span style={{ color: "var(--text4)", textAlign: "center", fontWeight: 700 }}>–</span>

                        {/* End Date DD/MM/YYYY */}
                        <div style={{
                            position: "relative",
                            height: 40,
                            borderRadius: "var(--radius-sm)",
                            border: "1.5px solid var(--line2)",
                            background: "var(--surface)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 11px",
                            boxSizing: "border-box",
                            boxShadow: "var(--shadow-xs)"
                        }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                                {formatDateDMY(endDate)}
                            </span>
                            <CalendarIcon width={15} style={{ color: "var(--text4)", pointerEvents: "none" }} />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                onClick={e => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>สถานะเอกสาร (STATUS)</label>
                    <select
                        className={styles.select}
                        style={{ width: "100%", height: 40, boxSizing: "border-box" }}
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
                    <label className={styles.filterLabel}>ค้นหา (SEARCH)</label>
                    <input
                        className={styles.input}
                        style={{ width: "100%", height: 40, boxSizing: "border-box" }}
                        type="text"
                        placeholder="เลขที่รายการ, ชื่อพนักงาน, รหัสพนักงาน, รายละเอียดงาน..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button
                    className={styles.btnRefresh}
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-missing-checkin-reports"] })}
                    disabled={loading || saving}
                    style={{ width: 42, height: 40, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}
                    title="รีเฟรช"
                >
                    <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* ── Table Card ── */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FolderOpenIcon width={20} /> รายการเอกสารรายงานการทำงาน
                        {pendingCount > 0 && (
                            <span style={{
                                background: "var(--red)",
                                color: "white",
                                padding: "2px 8px",
                                borderRadius: 10,
                                fontSize: 10.5,
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
                        <table className={styles.table} style={{ tableLayout: "fixed", width: "100%", minWidth: 980 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: "13%", textAlign: "center" }}>เลขที่รายการ</th>
                                    <th style={{ width: "18%", textAlign: "left" }}>พนักงาน</th>
                                    <th style={{ width: "14%", textAlign: "center" }}>ประจำรอบเดือน</th>
                                    <th style={{ width: "26%", textAlign: "left" }}>รายการวันที่ไม่ได้ลงเวลา & รายละเอียดงาน</th>
                                    <th style={{ width: "11%", textAlign: "center" }}>หลักฐานการทำงาน</th>
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
                                    filteredReports.map((r: any) => {
                                        const items = Array.isArray(r.items) && r.items.length > 0
                                            ? r.items
                                            : [{
                                                work_date: r.work_date,
                                                check_in_time: r.check_in_time,
                                                check_out_time: r.check_out_time,
                                                work_details: r.work_details
                                            }];
                                        const evidences = r.evidence_urls
                                            ? r.evidence_urls.split(",").map((s: string) => s.trim()).filter(Boolean)
                                            : [];

                                        return (
                                            <tr key={r.id}>
                                                {/* 1. เลขที่รายการ */}
                                                <td style={{ fontWeight: 800, color: "var(--red)", whiteSpace: "nowrap", textAlign: "center", verticalAlign: "middle" }}>
                                                    {r.doc_no}
                                                </td>

                                                {/* 2. พนักงาน */}
                                                <td style={{ verticalAlign: "middle" }}>
                                                    <div className={styles.empName}>{r.employee?.name}</div>
                                                    <div className={styles.empId} style={{ marginTop: 2 }}>
                                                        {r.emp_id} {r.employee?.departments?.name ? `· ${r.employee.departments.name}` : ""}
                                                    </div>
                                                </td>

                                                {/* 3. ประจำรอบเดือน */}
                                                <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                                        <span style={{
                                                            fontSize: 12,
                                                            fontWeight: 800,
                                                            color: "#1e40af",
                                                            background: "#eff6ff",
                                                            border: "1px solid #bfdbfe",
                                                            borderRadius: 8,
                                                            padding: "4px 10px",
                                                            whiteSpace: "nowrap"
                                                        }}>
                                                            {r.period_month ? formatPeriodMonthThai(r.period_month) : "-"}
                                                        </span>
                                                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text4)" }}>
                                                            รวม {items.length} วัน
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 4. รายการวันที่ไม่ได้ลงเวลา & รายละเอียดงาน (จัดสมมาตรรายวัน) */}
                                                <td style={{ verticalAlign: "middle" }}>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                        {items.map((it: any, idx: number) => (
                                                            <div
                                                                key={idx}
                                                                style={{
                                                                    background: "#f8fafc",
                                                                    border: "1px solid #e2e8f0",
                                                                    borderRadius: 8,
                                                                    padding: "7px 10px",
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                    gap: 3
                                                                }}
                                                            >
                                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                                                    <span style={{ fontWeight: 800, fontSize: 12.5, color: "#0f172a" }}>
                                                                        {idx + 1}. วันที่ {formatDateDMY(it.work_date)}
                                                                    </span>
                                                                    <span className={styles.typeTag} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                                                        <ClockIcon width={11} />
                                                                        {it.check_in_time} - {it.check_out_time} น.
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: 12.5, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                                                                    {it.work_details || "-"}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {r.supervisor_approved_at && (
                                                        <div style={{ fontSize: 11, color: "var(--ok)", marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                                                            <CheckIcon width={12} strokeWidth={3} style={{ flexShrink: 0 }} />
                                                            <span>หัวหน้าอนุมัติแล้ว ({r.supervisor?.name || r.supervisor_id || "-"}){r.supervisor_remark ? `: ${r.supervisor_remark}` : ""}</span>
                                                        </div>
                                                    )}
                                                    {r.hr_remark && (
                                                        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                                                            หมายเหตุ HR: {r.hr_remark}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 5. หลักฐานการทำงาน (ปุ่มบรรทัดเดียว ไม่ตกบรรทัด) */}
                                                <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", gap: 6, minWidth: 96 }}>
                                                        {evidences.map((url: string, index: number) => (
                                                            <a
                                                                key={index}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                style={{
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    gap: 5,
                                                                    padding: "5px 10px",
                                                                    borderRadius: 6,
                                                                    background: "#fef2f2",
                                                                    border: "1px solid #fecaca",
                                                                    color: "var(--red)",
                                                                    fontSize: 11.5,
                                                                    fontWeight: 700,
                                                                    textDecoration: "none",
                                                                    whiteSpace: "nowrap"
                                                                }}
                                                            >
                                                                <DocumentTextIcon width={13} style={{ flexShrink: 0 }} />
                                                                <span>หลักฐาน {evidences.length > 1 ? index + 1 : ""}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* 6. สถานะ */}
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

                                                {/* 7. จัดการ */}
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
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
