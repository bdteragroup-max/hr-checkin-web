"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "../page.module.css";
import localStyles from "./page.module.css";
import { formatTime24h, formatDateThai } from "@/utils/time";
import AlertModal, { AlertState } from "@/components/AlertModal";
import { CheckCircleIcon, XCircleIcon, PencilSquareIcon, ClockIcon } from "@heroicons/react/24/outline";

type OtRequest = {
    id: number;
    emp_id: string;
    date_for: string;
    start_time: string;
    end_time: string;
    total_hours: number;
    approved_hours: number | null;
    reason: string;
    status: "pending" | "approved" | "rejected";
    supervisor_name: string | null;
    supervisor_remark: string | null;
    employee: { name: string; departments: { name: string } | null };
};

export default function AdminOtPage() {
    const [requests, setRequests] = useState<OtRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

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

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const matchesStatus = !statusFilter || req.status === statusFilter;
            const matchesSearch = !searchQuery ||
                req.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                req.emp_id.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [requests, statusFilter, searchQuery]);

    const pendingCount = requests.filter(r => r.status === "pending").length;

    function getStatusBadge(status: string) {
        if (status === "approved") return `${styles.badge} ${styles.approved}`;
        if (status === "rejected") return `${styles.badge} ${styles.rejected}`;
        return `${styles.badge} ${styles.pending}`;
    }

    function getStatusText(status: string) {
        if (status === "approved") return "อนุมัติแล้ว";
        if (status === "rejected") return "ไม่อนุมัติ";
        return "รอพิจารณา";
    }

    return (
        <div className={styles.content}>
            <AlertModal alert={alert} onClose={closeAlert} />
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>จัดการคำขอ OT</h1>
                    <div className={styles.pageSubtitle}>ตรวจสอบและจัดการการทำงานล่วงเวลาของพนักงาน</div>
                </div>
            </div>

            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <div className={styles.filterLabel}>STATUS</div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">ทุกสถานะ</option>
                        <option value="pending">รอพิจารณา</option>
                        <option value="approved">อนุมัติแล้ว</option>
                        <option value="rejected">ไม่อนุมัติ</option>
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
                <button className={styles.btnPrimary} onClick={loadRequests} disabled={loading}>
                    {loading ? "กำลังโหลด..." : "Refresh"}
                </button>
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
                                <th>ความเห็นหัวหน้างาน</th>
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
                                    <tr key={req.id}>
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
                                            <span className={`${styles.badge} ${styles.ot}`}>{req.total_hours} ชม.</span>
                                        </td>
                                        <td>
                                            {req.approved_hours ? (
                                                <div className={styles.empName}>{Number(req.approved_hours)} ชม.</div>
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
                                            {req.status === "pending" ? (
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button onClick={() => openAdjustment(req)} className={localStyles.btnApprove} title="อนุมัติ/จัดการ">จัดการคำขอ</button>
                                                </div>
                                            ) : (
                                                <button 
                                                    disabled 
                                                    className={localStyles.btnEdit} 
                                                    style={{ 
                                                        opacity: 0.5, 
                                                        cursor: "not-allowed", 
                                                        filter: "grayscale(100%)",
                                                        background: "#e5e7eb",
                                                        color: "#9ca3af",
                                                        borderColor: "#e5e7eb"
                                                    }}
                                                >
                                                    <CheckCircleIcon width={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                    ดำเนินการแล้ว
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                                    <label className={localStyles.inputLabel}>จำนวนชั่วโมงที่อนุมัติ (Requested: {selectedReq.total_hours})</label>
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
