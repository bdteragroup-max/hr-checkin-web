"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "../page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import AlertModal, { AlertState } from "@/components/AlertModal";

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
    employee: { name: string; departments: { name: string } | null };
};

export default function AdminOtPage() {
    const [requests, setRequests] = useState<OtRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const closeAlert = () => setAlert(p => ({ ...p, visible: false }));

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

    async function handleAction(id: number, status: "approved" | "rejected") {
        let remark = "";
        let approved_hours = undefined;

        if (status === "approved") {
            const hoursStr = prompt("จำนวนชั่วโมงที่อนุมัติ:", "1");
            if (hoursStr === null) return;
            approved_hours = Number(hoursStr);
            if (isNaN(approved_hours) || approved_hours <= 0) {
                setAlert({ visible: true, message: "กรุณาระบุจำนวนชั่วโมงให้ถูกต้อง", type: "error" });
                return;
            }
        } else {
            remark = prompt("เหตุผลที่ไม่อนุมัติ (ถ้ามี):") || "";
            if (remark === null) return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/admin/ot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, approved_hours, remark })
            });
            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: `ดำเนินการ${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}เรียบร้อยแล้ว`, type: "ok" });
                loadRequests();
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (e: any) {
            setAlert({ visible: true, message: e.message, type: "error" });
        } finally {
            setLoading(false);
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
                                                {format(new Date(req.date_for), "d MMM yyyy", { locale: th })}
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 600 }}>{format(new Date(req.start_time), "HH:mm")}</span>
                                            {" - "}
                                            <span style={{ fontWeight: 600 }}>{format(new Date(req.end_time), "HH:mm")}</span>
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
                                                    <button onClick={() => handleAction(req.id, "approved")} className={styles.btnApprove} title="อนุมัติ">✓</button>
                                                    <button onClick={() => handleAction(req.id, "rejected")} className={styles.btnReject} title="ไม่อนุมัติ">✕</button>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: 11, color: "var(--text5)" }}>ดำเนินการแล้ว</span>
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
