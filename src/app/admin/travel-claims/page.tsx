"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "../page.module.css";
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
        if (status === "approved") return `${styles.badge} ${styles.approved}`;
        if (status === "rejected") return `${styles.badge} ${styles.rejected}`;
        return `${styles.badge} ${styles.pending}`;
    }

    return (
        <div className={styles.content}>
            <AlertModal
                alert={alert}
                onClose={closeAlert}
                onConfirmInput={pendingAction ? executeAction : undefined}
                inputPlaceholder="ระบุหมายเหตุ (ถ้ามี)..."
                confirmText={pendingAction ? "ยืนยัน" : "ตกลง"}
            />
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>อนุมัติเบี้ยเลี้ยง & ที่พัก</h1>
                    <div className={styles.pageSubtitle}>ตรวจสอบและอนุมัติรายการเบิกจ่ายค่าเดินทางและที่พัก</div>
                </div>
            </div>

            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <div className={styles.filterLabel}>STATUS</div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">ทุกสถานะ</option>
                        <option value="pending_admin">รออนุมัติ (HR)</option>
                        <option value="pending">รออนุมัติ (หัวหน้า)</option>
                        <option value="approved">อนุมัติแล้ว</option>
                        <option value="rejected">ไม่อนุมัติ</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <div className={styles.filterLabel}>SEARCH</div>
                    <input
                        type="text"
                        placeholder="ชื่อ, รหัสพนักงาน, สถานที่"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className={styles.btnPrimary} onClick={fetchClaims} disabled={loading}>
                    {loading ? "กำลังโหลด..." : "Refresh"}
                </button>
            </div>

            <div className={styles.tableWrap}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        รายการเบิกจ่าย {pendingCount > 0 && <span className={styles.pendingCountBadge}>{pendingCount}</span>}
                    </div>
                    <span className={styles.rowCount}>{filteredClaims.length} รายการ</span>
                </div>

                <div className={styles.tableScroll}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>พนักงาน</th>
                                <th>วันที่</th>
                                <th>ประเภท / สถานที่</th>
                                <th>รายละเอียดที่พัก</th>
                                <th>หลักฐาน</th>
                                <th>สถานะ</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClaims.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={7} className={styles.emptyState}>ไม่พบรายการเบิกจ่าย</td>
                                </tr>
                            ) : (
                                filteredClaims.map((c: any) => (
                                    <tr key={c.id}>
                                        <td>
                                            <div className={styles.empName}>{c.employee?.name}</div>
                                            <div className={styles.empId}>{c.emp_id}</div>
                                        </td>
                                        <td>
                                            <div className={styles.monoText}>
                                                {format(new Date(c.date), "d MMM yy", { locale: th })}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.badge} style={{ background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe', marginBottom: 4 }}>
                                                {c.claim_type}
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 500 }}>{c.site_name}</div>
                                            {c.supervisor_approved_at && (
                                                <div style={{ fontSize: 11, color: "var(--ok)", marginTop: 4 }}>
                                                    ✓ หัวหน้าอนุมัติแล้ว: {c.supervisor_remark || "-"}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {c.is_overnight ? (
                                                <div>
                                                    <div style={{ color: "var(--ot)", fontWeight: 700, fontSize: 12 }}>ค้างคืน</div>
                                                    <div className={styles.empName}>฿{Number(c.accommodation_amount).toLocaleString()}</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                                        {c.is_supervisor_shared && <span className={styles.badge} style={{ fontSize: 9, padding: '1px 6px' }}>พักกับหัวหน้า</span>}
                                                        {c.has_pre_approval && <span className={styles.badge} style={{ fontSize: 9, padding: '1px 6px', background: '#ecfdf5', color: '#047857' }}>อนุมัติล่วงหน้า</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text5)' }}>-</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                <a href={c.report_url} target="_blank" className={styles.btnExcelSm} style={{ textDecoration: 'none', fontSize: 11, height: 26 }}>รายงาน</a>
                                                {c.accommodation_receipt_url && (
                                                    <a href={c.accommodation_receipt_url} target="_blank" className={styles.btnPdfSm} style={{ textDecoration: 'none', fontSize: 11, height: 26 }}>ใบเสร็จ</a>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={getStatusBadge(c.status)}>
                                                {c.status === "pending_admin" ? "รอ HR" :
                                                    c.status === "pending" ? "รอหัวหน้างาน" :
                                                        c.status === "approved" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}
                                            </span>
                                            {c.approved_by && (
                                                <div style={{ fontSize: 10, color: "var(--text5)", marginTop: 4 }}>
                                                    โดย {c.approved_by}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {c.status === "pending_admin" ? (
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button onClick={() => handleActionClick(c.id, "approved")} className={styles.btnApprove}>✓</button>
                                                    <button onClick={() => handleActionClick(c.id, "rejected")} className={styles.btnReject}>✕</button>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: 11, color: 'var(--text5)' }}>เรียบร้อยแล้ว</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
