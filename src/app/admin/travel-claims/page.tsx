"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "./page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import AlertModal, { AlertState } from "@/components/AlertModal";

export default function AdminTravelClaimsPage() {
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<any[]>([]);

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const [pendingAction, setPendingAction] = useState<{ id: string, status: string } | null>(null);

    const [statusFilter, setStatusFilter] = useState("pending_admin");
    const [searchQuery, setSearchQuery] = useState("");

    const closeAlert = () => {
        setAlert(p => ({ ...p, visible: false }));
        setPendingAction(null);
    };

    useEffect(() => {
        fetchClaims();
    }, []);

    async function fetchClaims() {
        setLoading(true);
        try {
            const r = await fetch("/api/admin/travel-claims");
            const data = await r.json();
            if (data.ok) setClaims(data.list || []);
        } catch (e) {
            console.error("Fetch claims failed", e);
        } finally {
            setLoading(false);
        }
    }

    async function handleActionClick(id: string, status: string) {
        setPendingAction({ id, status });
        setAlert({
            visible: true,
            message: `ยืนยันการ${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} รายการนี้?`,
            type: "ok"
        });
    }

    async function executeAction(remark: string) {
        if (!pendingAction) return;
        const { id, status } = pendingAction;

        setLoading(true);
        try {
            const r = await fetch("/api/admin/travel-claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, remark })
            });
            const data = await r.json();
            if (data.ok) {
                setAlert({ visible: true, message: `บันทึกรายการเรียบร้อยแล้ว`, type: "ok" });
                fetchClaims();
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
                setLoading(false);
            }
        } catch (e: any) {
            setAlert({ visible: true, message: e.message, type: "error" });
            setLoading(false);
        } finally {
            setPendingAction(null);
        }
    }

    const filteredClaims = useMemo(() => {
        return claims.filter(c => {
            const matchesStatus = statusFilter === "all" || c.status === statusFilter;
            const matchesSearch = !searchQuery ||
                c.employee?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.emp_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.site_name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [claims, statusFilter, searchQuery]);

    const pendingCount = claims.filter(c => c.status === "pending_admin").length;

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
                    <h1 className={styles.h1}>อนุมัติเบี้ยเลี้ยง & ที่พัก</h1>
                    <div className={styles.sub}>ตรวจสอบและอนุมัติรายการเบิกจ่ายค่าเดินทางและที่พัก</div>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>STATUS</label>
                    <select
                        className={styles.select}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">ทุกสถานะ</option>
                        <option value="pending_admin">รออนุมัติ (HR)</option>
                        <option value="pending_supervisor">รออนุมัติ (หัวหน้า)</option>
                        <option value="approved">อนุมัติแล้ว</option>
                        <option value="rejected">ไม่อนุมัติ</option>
                    </select>
                </div>
                <div className={styles.filterGroup} style={{ flex: 1, minWidth: 250 }}>
                    <label className={styles.filterLabel}>SEARCH</label>
                    <input
                        className={styles.input}
                        type="text"
                        placeholder="ชื่อ, รหัสพนักงาน, สถานที่..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className={styles.btnRefresh} onClick={fetchClaims} disabled={loading}>
                    {loading ? <div className={styles.spinner} style={{ width: 14, height: 14, borderWidth: 2 }} /> : "↻ Refresh"}
                </button>
            </div>

            {/* ── Table Card ── */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        📂 รายการเบิกจ่าย
                        {pendingCount > 0 && (
                            <span style={{
                                background: "var(--red)",
                                color: "white",
                                padding: "1px 7px",
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 800
                            }}>
                                {pendingCount} PENDING
                            </span>
                        )}
                    </div>
                    <span className={styles.rowCount}>{filteredClaims.length} รายการ</span>
                </div>

                <div className={styles.tableScroll}>
                    {loading ? (
                        <div className={styles.loader}>
                            <div className={styles.spinner} />
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>พนักงาน</th>
                                    <th>วันที่</th>
                                    <th>ประเภท / สถานที่</th>
                                    <th>รายละเอียดที่พัก</th>
                                    <th>หลักฐาน</th>
                                    <th>สถานะ</th>
                                    <th style={{ textAlign: "right" }}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClaims.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: "center", padding: 60, color: "var(--text4)" }}>
                                            ไม่พบรายการเบิกจ่าย
                                        </td>
                                    </tr>
                                ) : (
                                    filteredClaims.map((c: any) => (
                                        <tr key={c.id}>
                                            <td>
                                                <div className={styles.empName}>{c.employee?.name}</div>
                                                <div className={styles.empId}>{c.emp_id}</div>
                                            </td>
                                            <td className={styles.tdDate}>
                                                <div className={styles.dateWrap}>
                                                    <span className={styles.dateText}>{format(new Date(c.date), 'dd/MM/yyyy')}</span>
                                                    {c.end_date && format(new Date(c.end_date), 'dd/MM/yyyy') !== format(new Date(c.date), 'dd/MM/yyyy') && (
                                                        <>
                                                            <span className={styles.dateSeparator}>-</span>
                                                            <span className={styles.dateText}>{format(new Date(c.end_date), 'dd/MM/yyyy')}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.typeTag}>{c.claim_type}</div>
                                                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{c.site_name}</div>
                                                {c.supervisor_approved_at && (
                                                    <div style={{ fontSize: 11, color: "var(--ok)", marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        หัวหน้าอนุมัติแล้ว: {c.supervisor_remark || "-"}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {c.is_overnight ? (
                                                    <div>
                                                        <div style={{ color: "var(--late)", fontWeight: 800, fontSize: 10, textTransform: "uppercase", marginBottom: 2 }}>ค้างคืน</div>
                                                        <div style={{ fontWeight: 700, fontSize: 14 }}>฿{Number(c.accommodation_amount).toLocaleString()}</div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                                            {c.is_supervisor_shared && <span className={styles.miniBadge}>พักกับหัวหน้า</span>}
                                                            {c.has_pre_approval && <span className={styles.miniBadge} style={{ background: 'var(--ok-bg)', color: 'var(--ok)', borderColor: 'var(--ok-bdr)' }}>อนุมัติล่วงหน้า</span>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text5)' }}>—</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                                    <a href={c.report_url} target="_blank" className={styles.link}>📄 รายงานผล</a>
                                                    {c.accommodation_receipt_url && (
                                                        <a href={c.accommodation_receipt_url} target="_blank" className={styles.link} style={{ color: "var(--ot)" }}>🧾 ใบเสร็จที่พัก</a>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={getStatusBadge(c.status)}>
                                                    {c.status === "pending_admin" ? "รอ HR" :
                                                        c.status === "pending_supervisor" ? "รอหัวหน้า" :
                                                            c.status === "approved" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}
                                                </span>
                                                {c.approved_by && (
                                                    <div style={{ fontSize: 10, color: "var(--text4)", marginTop: 5 }}>
                                                        โดย {c.approved_by}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                {c.status === "pending_admin" ? (
                                                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                                        <button onClick={() => handleActionClick(c.id, "approved")} className={styles.btnApprove} title="อนุมัติ">✓</button>
                                                        <button onClick={() => handleActionClick(c.id, "rejected")} className={styles.btnReject} title="ปฏิเสธ">✕</button>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 11, color: 'var(--text5)', fontWeight: 500 }}>ดำเนินการแล้ว</span>
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
