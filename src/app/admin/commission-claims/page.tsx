"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";
import AlertModal, { AlertState } from "@/components/AlertModal";
import { 
    BanknotesIcon, 
    CheckCircleIcon, 
    XCircleIcon, 
    ArrowDownTrayIcon, 
    ArrowPathIcon,
    FolderOpenIcon,
    MagnifyingGlassIcon,
    CheckIcon,
    ClockIcon,
    UserGroupIcon,
    ShieldCheckIcon,
    ArrowDownTrayIcon as DownloadIcon
} from "@heroicons/react/24/outline";
import { format, startOfMonth, endOfMonth } from "date-fns";

type CommissionClaim = {
    id: string;
    emp_id: string;
    date: string;
    customer_name: string;
    selling_price?: number;
    total_commission?: number;
    per_person_commission?: number;
    status: string;
    created_at: string;
    employee: {
        name: string;
    };
};

export default function AdminCommissionClaimsPage() {
    const queryClient = useQueryClient();
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const [pendingAction, setPendingAction] = useState<{ id: string, action: "approve" | "reject", perPersonCommission?: number } | null>(null);

    const closeAlert = () => {
        setAlert(p => ({ ...p, visible: false }));
        setPendingAction(null);
    };

    const { data: claims = [], isLoading: loading } = useQuery<CommissionClaim[]>({
        queryKey: ['admin-commission-claims', startDate, endDate],
        queryFn: async () => {
            const res = await fetch(`/api/admin/commission-claims?start_date=${startDate}&end_date=${endDate}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            return data.list || [];
        }
    });

    const handleExportExcel = () => {
        const url = `/api/admin/export/commission_claims_excel?start_date=${startDate}&end_date=${endDate}`;
        window.location.href = url;
    };

    const handleActionClick = (id: string, action: "approve" | "reject", perPersonCommission?: number) => {
        setPendingAction({ id, action, perPersonCommission });
        setAlert({
            visible: true,
            message: `ยืนยันการ${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'} รายการนี้?`,
            type: "ok"
        });
    };

    const executeAction = async () => {
        if (!pendingAction) return;
        const { id, action, perPersonCommission } = pendingAction;

        setSaving(true);
        try {
            const res = await fetch("/api/admin/commission-claims", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action, per_person_commission: perPersonCommission })
            });
            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "ดำเนินการเรียบร้อยแล้ว", type: "ok" });
                queryClient.invalidateQueries({ queryKey: ['admin-commission-claims'] });
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (error) {
            setAlert({ visible: true, message: "เกิดข้อผิดพลาดในการเชื่อมต่อ", type: "error" });
        } finally {
            setSaving(false);
            setPendingAction(null);
        }
    };

    const handleExport = (id: string) => {
        window.open(`/api/admin/commission-claims/export?id=${id}`, "_blank");
    };

    const filteredClaims = useMemo(() => {
        return claims.filter(c => {
            const matchesStatus = statusFilter === "all" || c.status === statusFilter;
            const matchesSearch = !searchQuery ||
                c.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.emp_id.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [claims, statusFilter, searchQuery]);

    const pendingCount = claims.filter(c => c.status === "pending_admin").length;

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "pending_supervisor": return "รอหัวหน้า";
            case "pending_admin": return "รอ HR";
            case "completed": return "อนุมัติแล้ว";
            case "rejected": return "ไม่อนุมัติ";
            default: return status;
        }
    };

    return (
        <div className={styles.wrap}>
            <AlertModal
                alert={alert}
                onClose={closeAlert}
                onConfirm={pendingAction ? executeAction : undefined}
                confirmText={pendingAction ? "ยืนยัน" : "ตกลง"}
            />

            <header className={styles.header}>
                <div>
                    <h1 className={styles.h1}>จัดการค่าคอมมิชชั่น</h1>
                    <p className={styles.sub}>ตรวจสอบและอนุมัติรายการเบิกค่าคอมมิชชั่น (Inverter)</p>
                </div>
            </header>

            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>DATE RANGE</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            type="date"
                            className={styles.input}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span style={{ color: "var(--text4)" }}>-</span>
                        <input
                            type="date"
                            className={styles.input}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>STATUS</label>
                    <select 
                        className={styles.select}
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="all">ทุกสถานะ</option>
                        <option value="pending_supervisor">รอหัวหน้า</option>
                        <option value="pending_admin">รอ HR</option>
                        <option value="completed">อนุมัติแล้ว</option>
                        <option value="rejected">ไม่อนุมัติ</option>
                    </select>
                </div>
                <div className={styles.filterGroup} style={{ flex: 1, minWidth: 200 }}>
                    <label className={styles.filterLabel}>SEARCH</label>
                    <div style={{ position: 'relative' }}>
                        <input 
                            className={styles.input}
                            style={{ width: '100%', paddingLeft: 35 }}
                            type="text" 
                            placeholder="ค้นหาชื่อ, รหัสพนักงาน, ลูกค้า..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <MagnifyingGlassIcon width={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text5)' }} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className={styles.btnRefresh} onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-commission-claims'] })} disabled={loading}>
                        <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button 
                        className={styles.btnRefresh} 
                        onClick={handleExportExcel} 
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: "var(--ok)", color: "white", borderColor: "var(--ok-bdr)" }}
                        title="Export Excel Summary"
                    >
                        <DownloadIcon width={16} /> Excel
                    </button>
                </div>
            </div>

            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        <FolderOpenIcon width={20} /> รายการเบิกค่าคอมมิชชั่น
                        {pendingCount > 0 && (
                            <span style={{
                                background: "var(--red)",
                                color: "white",
                                padding: "1px 7px",
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 800,
                                marginLeft: 8
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
                                    <th>ลูกค้า</th>
                                    <th>คอมมิชชั่น/คน</th>
                                    <th>สถานะ</th>
                                    <th style={{ textAlign: "right" }}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClaims.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: "center", padding: 60, color: "var(--text4)" }}>
                                            ไม่พบรายการเบิกค่าคอมมิชชั่น
                                        </td>
                                    </tr>
                                ) : (
                                    filteredClaims.map(claim => (
                                        <tr key={claim.id}>
                                            <td>
                                                <div className={styles.empName}>{claim.employee.name}</div>
                                                <div className={styles.empId}>{claim.emp_id}</div>
                                            </td>
                                            <td>{new Date(claim.date).toLocaleDateString("th-TH")}</td>
                                            <td style={{ fontWeight: 500 }}>{claim.customer_name}</td>
                                            <td>
                                                {claim.status === "pending_admin" || claim.status === "pending_supervisor" ? (
                                                    <input 
                                                        type="number" 
                                                        className={styles.inlineInput}
                                                        placeholder="ใส่ยอดคอมมิชชั่น..."
                                                        defaultValue={claim.per_person_commission ? Number(claim.per_person_commission) : ""}
                                                        onBlur={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            if (!isNaN(val)) claim.per_person_commission = val;
                                                        }}
                                                    />
                                                ) : (
                                                    <span style={{ color: "var(--red)", fontWeight: 700 }}>
                                                        {claim.per_person_commission ? `฿${claim.per_person_commission.toLocaleString()}` : "—"}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${styles["status_" + claim.status]}`}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        {claim.status === "pending_admin" ? <><ShieldCheckIcon width={14} /> รอ HR</> :
                                                         claim.status === "pending_supervisor" ? <><UserGroupIcon width={14} /> รอหัวหน้า</> :
                                                         claim.status === "completed" ? <><CheckCircleIcon width={14} /> สำเร็จ</> : <><XCircleIcon width={14} /> ไม่อนุมัติ</>}
                                                    </span>
                                                </span>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                                    {(claim.status === "pending_supervisor" || claim.status === "pending_admin") && (
                                                        <>
                                                            <button 
                                                                className={styles.btnApprove} 
                                                                onClick={() => handleActionClick(claim.id, "approve", Number(claim.per_person_commission))}
                                                                title="อนุมัติ"
                                                            >
                                                                <CheckIcon width={16} />
                                                            </button>
                                                            <button 
                                                                className={styles.btnReject} 
                                                                onClick={() => handleActionClick(claim.id, "reject")}
                                                                title="ไม่อนุมัติ"
                                                            >
                                                                <XCircleIcon width={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button 
                                                        className={styles.btnExport} 
                                                        onClick={() => handleExport(claim.id)}
                                                        title="ส่งออก PDF"
                                                    >
                                                        <ArrowDownTrayIcon width={16} />
                                                    </button>
                                                </div>
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
