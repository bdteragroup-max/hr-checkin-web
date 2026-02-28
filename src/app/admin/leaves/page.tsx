"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../page.module.css"; // ✅ ใช้ CSS admin ใหญ่

type LeaveRow = {
    id: string;
    emp_id: string;
    name: string | null;
    leave_type: string | null; // จาก API
    reason: string | null;
    start_date: string; // ISO
    end_date: string; // ISO
    status: "pending" | "approved" | "rejected" | string;
    approved_by?: string | null;
    approved_at?: string | null;
    days?: number;
    minutes?: number;
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
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function badgeClass(status: string) {
    if (status === "approved") return `${styles.badge} ${styles.approved}`;
    if (status === "rejected") return `${styles.badge} ${styles.rejected}`;
    return `${styles.badge} ${styles.pending}`;
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

    // Filters
    const [status, setStatus] = useState<string>(""); // "", pending, approved, rejected
    const [date, setDate] = useState<string>(""); // filter overlap (server filter)
    const [empId, setEmpId] = useState<string>("");

    // เพิ่ม filter เหตุผล (client filter)
    const [reasonQuery, setReasonQuery] = useState<string>("");

    const [leaveRequests, setLeaveRequests] = useState<LeaveRow[]>([]);

    const qs = useMemo(() => {
        const sp = new URLSearchParams();
        if (status) sp.set("status", status);
        if (date) sp.set("date", date);
        if (empId.trim()) sp.set("emp_id", empId.trim());
        return sp.toString();
    }, [status, date, empId]);

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

        // summary by leave_type
        const byTypeMap = new Map<string, number>();
        for (const r of filteredByReason) {
            const t = (r.leave_type || "อื่นๆ").trim() || "อื่นๆ";
            byTypeMap.set(t, (byTypeMap.get(t) || 0) + 1);
        }
        const byType = Array.from(byTypeMap.entries()).sort((a, b) => b[1] - a[1]);

        return { total, pending, approved, rejected, byType };
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

    async function approveLeave(id: string, nextStatus: "approved" | "rejected") {
        if (nextStatus === "approved") {
            if (!confirm("ยืนยันอนุมัติใบลานี้?")) return;
            setLeaveLoading(true);
            setErr("");
            try {
                const res = await fetch(`/api/admin/leaves/${id}/approve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                });
                const data = await res.json().catch(() => null);
                if (!res.ok) {
                    setErr(data?.error || `HTTP_${res.status}`);
                    return;
                }
                await load();
            } catch (e: any) {
                setErr(e?.message || "APPROVE_FAILED");
            } finally {
                setLeaveLoading(false);
            }
            return;
        }

        // rejected
        const reason = prompt("ระบุเหตุผลที่ไม่อนุมัติ (Reject reason):") || "";
        if (!reason.trim()) return;

        setLeaveLoading(true);
        setErr("");
        try {
            const res = await fetch(`/api/admin/leaves/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setErr(data?.error || `HTTP_${res.status}`);
                return;
            }
            await load();
        } catch (e: any) {
            setErr(e?.message || "REJECT_FAILED");
        } finally {
            setLeaveLoading(false);
        }
    }

    function renderLeave() {
        const historyRows = filteredByReason;

        return (
            <>
                {/* ✅ FILTER BAR */}
                <div className={styles.filterBar}>
                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>STATUS</div>
                        <select value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="">ทุกสถานะ</option>
                            <option value="pending">รออนุมัติ</option>
                            <option value="approved">อนุมัติแล้ว</option>
                            <option value="rejected">ไม่อนุมัติ</option>
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>DATE</div>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>

                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>EMP ID</div>
                        <input
                            type="text"
                            placeholder="ค้นหา emp_id"
                            value={empId}
                            onChange={(e) => setEmpId(e.target.value)}
                        />
                    </div>

                    {/* ✅ เหตุผลการลา (ค้นหา) */}
                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>REASON</div>
                        <input
                            type="text"
                            placeholder="ค้นหาเหตุผลการลา"
                            value={reasonQuery}
                            onChange={(e) => setReasonQuery(e.target.value)}
                        />
                    </div>

                    <button className={styles.btnPrimary} onClick={load} disabled={leaveLoading}>
                        {leaveLoading ? "Loading..." : "Refresh"}
                    </button>
                </div>

                {err ? <div className={styles.errorMsg}>⚠️ {err}</div> : null}

                {/* ✅ หน้ารวม (Summary) */}
                <div className={styles.leaveGrid} style={{ marginBottom: 16 }}>
                    {/* Card: Summary (kept empty for now) */}
                </div>

                {/* ── Pending approvals (separate full-width card) ── */}
                <div className={styles.tableWrap} style={{ marginBottom: 18 }}>
                    <div className={styles.tableHeader}>
                        <div className={styles.tableHeaderTitle}>รออนุมัติ</div>
                        <span className={styles.rowCount}>{pendingLeave.length} รายการ</span>
                    </div>

                    <div className={styles.tableScroll}>
                        {pendingLeave.length === 0 && !leaveLoading ? (
                            <div className={styles.emptyState} style={{ padding: 16 }}>ไม่มีรายการรออนุมัติ</div>
                        ) : (
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>พนักงาน</th>
                                        <th>ประเภท</th>
                                        <th>วันที่</th>
                                        <th>จำนวน</th>
                                        <th>เหตุผล</th>
                                        <th>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingLeave.map((r) => {
                                        const days = typeof r.days === 'number' ? r.days :
                                            Math.max(1, Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                        return (
                                            <tr key={r.id}>
                                                <td>
                                                    <div style={{ fontWeight: 700 }}>{r.name || "-"}</div>
                                                    <div className={styles.monoText} style={{ marginTop: 6 }}>{r.emp_id}</div>
                                                </td>
                                                <td>{r.leave_type || "-"}</td>
                                                <td style={{ fontSize: 13 }}>{fmtDate(r.start_date)} - {fmtDate(r.end_date)}</td>
                                                <td style={{ textAlign: "center" }}>{days} วัน</td>
                                                <td style={{ maxWidth: 420, color: "var(--text3)" }}>{normalizeReason(r.reason || "")}</td>
                                                <td style={{ whiteSpace: "nowrap" }}>
                                                    <button className={styles.btnApprove} onClick={() => approveLeave(r.id, "approved")} style={{ marginRight: 8 }}>✅ อนุมัติ</button>
                                                    <button className={styles.btnReject} onClick={() => approveLeave(r.id, "rejected")}>❌ ไม่อนุมัติ</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ✅ TABLE HISTORY (เพิ่มคอลัมน์เหตุผลอยู่แล้ว) */}
                <div className={styles.tableWrap}>
                    <div className={styles.tableHeader}>
                        <div className={styles.tableHeaderTitle}>📜 ประวัติการลาทั้งหมด</div>
                        <span className={styles.rowCount}>{historyRows.length} รายการ</span>
                    </div>

                    <div className={styles.tableScroll}>
                        {historyRows.length === 0 && !leaveLoading ? (
                            <div className={styles.emptyState}>
                                <span className={styles.emptyIcon}>📭</span>ยังไม่มีประวัติการลา
                            </div>
                        ) : (
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>รหัส</th>
                                        <th>ชื่อ</th>
                                        <th>ประเภท</th>
                                        <th>วันที่</th>
                                        <th>เหตุผลการลา</th>
                                        <th>สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyRows.map((r) => (
                                        <tr key={r.id}>
                                            <td>
                                                <span className={styles.monoText}>{r.emp_id}</span>
                                            </td>
                                            <td>{r.name || "-"}</td>
                                            <td>{r.leave_type || "-"}</td>
                                            <td style={{ fontSize: 12 }}>
                                                {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                                                {r.days ? <><br />({r.days} วัน)</> : ""}
                                            </td>
                                            <td style={{ fontSize: 12, color: "var(--text3)", maxWidth: 520 }}>
                                                {normalizeReason(r.reason || "")}
                                            </td>
                                            <td>
                                                <span className={badgeClass(r.status)}>
                                                    {r.status === "approved"
                                                        ? "อนุมัติ"
                                                        : r.status === "rejected"
                                                            ? "ไม่อนุมัติ"
                                                            : (r.status === "pending_supervisor" ? "รอหัวหน้าอนุมัติ" : "รอ HR อนุมัติ")}
                                                </span>
                                                {r.approved_by ? (
                                                    <div style={{ fontSize: 11, color: "var(--text5)", marginTop: 4 }}>
                                                        by {r.approved_by}
                                                    </div>
                                                ) : null}
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </>
        );
    }

    return (
        <div className={styles.content}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>การลา</h1>
                    <div className={styles.pageSubtitle}>จัดการคำขอลาของพนักงาน</div>
                </div>
            </div>
            {renderLeave()}
        </div>
    );
}