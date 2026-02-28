"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "../page.module.css";
import AlertModal, { AlertState } from "@/components/AlertModal";

type Claim = {
    id: string;
    emp_id: string;
    name: string;
    amount_cash: number;
    amount_meal: number;
    status: string;
    transfer_slip_url?: string;
    celebration_photo_url?: string;
    created_at: string;
    substitute_date: string | null;
};

export default function AdminBirthdayClaimsPage() {
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("pending");
    const [searchQuery, setSearchQuery] = useState("");

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const [pendingAction, setPendingAction] = useState<{ id: string, status: 'approved' | 'rejected' } | null>(null);

    const closeAlert = () => {
        setAlert(p => ({ ...p, visible: false }));
        setPendingAction(null);
    };

    async function load() {
        setLoading(true);
        try {
            const r = await fetch("/api/admin/birthday-claims");
            const t = await r.json();
            if (t.ok) setClaims(t.claims || []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function confirmAction(id: string, status: 'approved' | 'rejected') {
        setPendingAction({ id, status });
        setAlert({
            visible: true,
            message: `ยืนยันการ ${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} คำขอนี้ใช่หรือไม่?`,
            type: "ok"
        });
    }

    async function executeAction() {
        if (!pendingAction) return;
        const { id, status } = pendingAction;
        setLoading(true);
        try {
            const r = await fetch(`/api/admin/birthday-claims/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            });
            if (r.ok) {
                setAlert({ visible: true, message: `ดำเนินการเรียบร้อยแล้ว`, type: "ok" });
                load();
            } else {
                setAlert({ visible: true, message: "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (e: any) {
            setAlert({ visible: true, message: e.message, type: "error" });
        } finally {
            setPendingAction(null);
            setLoading(false);
        }
    }

    const filteredClaims = useMemo(() => {
        return claims.filter(c => {
            const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
            const matchesSearch = !searchQuery ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.emp_id.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [claims, filterStatus, searchQuery]);

    const pendingCount = claims.filter(c => c.status === "pending").length;

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
                onConfirm={pendingAction ? executeAction : undefined}
                confirmText={pendingAction ? "ยืนยัน" : "ตกลง"}
            />
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>สวัสดิการวันเกิด</h1>
                    <div className={styles.pageSubtitle}>จัดการคำขอรับเงินขวัญถุงและค่าอาหารวันเกิดของพนักงาน</div>
                </div>
            </div>

            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <div className={styles.filterLabel}>STATUS</div>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="all">ทั้งหมด</option>
                        <option value="pending">รอดำเนินการ</option>
                        <option value="approved">อนุมัติแล้ว</option>
                        <option value="rejected">ปฏิเสธ</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <div className={styles.filterLabel}>SEARCH</div>
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อ หรือ รหัสพนักงาน"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className={styles.btnPrimary} onClick={load} disabled={loading}>
                    {loading ? "กำลังโหลด..." : "Refresh"}
                </button>
            </div>

            <div className={styles.tableWrap}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        รายการคำขอ {pendingCount > 0 && <span className={styles.pendingCountBadge}>{pendingCount}</span>}
                    </div>
                    <span className={styles.rowCount}>{filteredClaims.length} รายการ</span>
                </div>

                <div className={styles.tableScroll}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>พนักงาน</th>
                                <th>เงินขวัญถุง</th>
                                <th>ค่าอาหาร</th>
                                <th>หลักฐานการเบิก</th>
                                <th>วันที่ยื่น</th>
                                <th>สถานะ / จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClaims.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={6} className={styles.emptyState}>ไม่พบรายการคำขอ</td>
                                </tr>
                            ) : (
                                filteredClaims.map(c => (
                                    <tr key={c.id}>
                                        <td>
                                            <div className={styles.empName}>{c.name}</div>
                                            <div className={styles.empId}>{c.emp_id}</div>
                                            {c.substitute_date && (
                                                <div className={styles.badge} style={{ marginTop: 4, background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
                                                    ชดเชยวันหยุด
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 700, color: 'var(--text)' }}>
                                            ฿{Number(c.amount_cash).toLocaleString()}
                                        </td>
                                        <td style={{ fontWeight: 700, color: 'var(--text)' }}>
                                            ฿{Number(c.amount_meal).toLocaleString()}
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                {c.transfer_slip_url && (
                                                    <a href={c.transfer_slip_url} target="_blank" rel="noreferrer" className={styles.btnExcelSm} style={{ textDecoration: 'none', fontSize: 11, height: 26, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        📄 ใบเสร็จค่าอาหาร
                                                    </a>
                                                )}
                                                {c.celebration_photo_url && (
                                                    <a href={c.celebration_photo_url} target="_blank" rel="noreferrer" className={styles.btnPdfSm} style={{ textDecoration: 'none', fontSize: 11, height: 26, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        📸 รูปภาพฉลอง
                                                    </a>
                                                )}
                                                {!c.transfer_slip_url && !c.celebration_photo_url && (
                                                    <span style={{ color: 'var(--text5)', fontSize: 12 }}>ไม่มีหลักฐาน</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.monoText}>
                                                {new Date(c.created_at).toLocaleDateString("th-TH")}
                                            </div>
                                        </td>
                                        <td>
                                            {c.status === 'pending' ? (
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className={styles.btnApprove} onClick={() => confirmAction(c.id, 'approved')}>อนุมัติ</button>
                                                    <button className={styles.btnReject} onClick={() => confirmAction(c.id, 'rejected')}>ปฏิเสธ</button>
                                                </div>
                                            ) : (
                                                <span className={getStatusBadge(c.status)}>
                                                    {c.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}
                                                </span>
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
