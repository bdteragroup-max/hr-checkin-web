"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "../page.module.css";
import localStyles from "./page.module.css";
import AlertModal, { AlertState } from "@/components/AlertModal";
import { 
    DocumentTextIcon, 
    MagnifyingGlassIcon, 
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ArrowDownTrayIcon,
    PencilSquareIcon,
    PaperClipIcon
} from "@heroicons/react/24/outline";

const META_LABELS: Record<string, string> = {
    gpa: "เกรดเฉลี่ย (GPA)",
    child_name: "ชื่อ-นามสกุลบุตร",
    education_level: "ระดับชั้นการศึกษา",
    service_years_at_claim: "อายุงานขณะยื่น",
    remark: "หมายเหตุ"
};

const EDU_LEVELS: Record<string, string> = {
    P1_3: "ประถมศึกษาตอนต้น (ป.1-ป.3)",
    P4_6: "ประถมศึกษาตอนปลาย (ป.4-ป.6)",
    M1_3: "มัธยมศึกษาตอนต้น (ม.1-ม.3)",
    M4_6: "มัธยมศึกษาตอนปลาย/ปวช. (ม.4-ม.6)",
    UNI: "ปริญญาตรี/ปวส."
};

type Claim = {
    id: string;
    emp_id: string;
    welfare_type: string;
    amount: number;
    status: string;
    supervisor_status: string;
    supervisor_approved_by?: string;
    supervisor_approved_at?: string;
    attachment_url?: string;
    remark?: string;
    metadata?: any;
    created_at: string;
    employees: {
        name: string;
        nickname?: string;
    };
};

const WELFARE_TITLES: Record<string, string> = {
    CHILD_EDUCATION: "ทุนการศึกษาบุตร",
    MARRIAGE: "เงินแสดงความยินดีมงคลสมรส",
    CHILDBIRTH: "เงินรับขวัญบุตร",
    ORDINATION: "เงินช่วยเหลืองานอุปสมบท",
    FUNERAL: "เงินช่วยเหลืองานฌาปนกิจ"
};

export default function AdminWelfarePage() {
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("pending");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const closeAlert = () => setAlert(p => ({ ...p, visible: false }));

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
    const [modalData, setModalData] = useState({ 
        status: "approved" as "approved" | "rejected", 
        remark: "" 
    });
    const [saving, setSaving] = useState(false);

    async function loadClaims() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/welfare");
            if (res.ok) {
                const data = await res.json();
                setClaims(data.list || []);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadClaims();
    }, []);

    function openAdjustment(claim: Claim) {
        setSelectedClaim(claim);
        setModalData({
            status: claim.status === "rejected" ? "rejected" : "approved",
            remark: claim.remark || ""
        });
        setShowModal(true);
    }

    async function submitAdjustment() {
        if (!selectedClaim) return;
        
        setSaving(true);
        try {
            const res = await fetch("/api/admin/welfare", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: selectedClaim.id, 
                    status: modalData.status, 
                    admin_comment: modalData.remark 
                })
            });
            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: `บันทึกรายการเรียบร้อยแล้ว`, type: "ok" });
                setShowModal(false);
                loadClaims();
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (e: any) {
            setAlert({ visible: true, message: e.message, type: "error" });
        } finally {
            setSaving(false);
        }
    }

    const filteredClaims = useMemo(() => {
        return claims.filter(c => {
            const matchesStatus = !statusFilter || 
                (statusFilter === "pending_hr" ? (c.status === "pending" && c.supervisor_status === "approved") : c.status === statusFilter);
            const matchesSearch = !searchQuery ||
                c.employees.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.emp_id.toLowerCase().includes(searchQuery.toLowerCase());
            
            let matchesDate = true;
            if (startDate || endDate) {
                const reqDate = new Date(c.created_at).toISOString().split('T')[0];
                if (startDate && reqDate < startDate) matchesDate = false;
                if (endDate && reqDate > endDate) matchesDate = false;
            }
            
            return matchesStatus && matchesSearch && matchesDate;
        });
    }, [claims, statusFilter, searchQuery, startDate, endDate]);

    const pendingCount = claims.filter(c => c.status === "pending" && c.supervisor_status === "approved").length;

    function getStatusBadge(status: string, supervisorStatus: string) {
        if (status === "approved") return `${styles.badge} ${styles.approved}`;
        if (status === "rejected") return `${styles.badge} ${styles.rejected}`;
        if (supervisorStatus === "approved") return `${styles.badge} ${styles.pending}`; // Waiting for HR
        return `${styles.badge} ${styles.pending_supervisor || styles.pending}`;
    }

    function getStatusText(status: string, supervisorStatus: string) {
        if (status === "approved") return "อนุมัติแล้ว";
        if (status === "rejected") return "ไม่อนุมัติ";
        if (supervisorStatus === "approved") return "รอ HR อนุมัติ";
        if (supervisorStatus === "rejected") return "หัวหน้าไม่อนุมัติ";
        return "รอหัวหน้าอนุมัติ";
    }

    return (
        <div className={localStyles.page}>
            <AlertModal alert={alert} onClose={closeAlert} />
            
            <div className={localStyles.header}>
                <h1 className={localStyles.title}>จัดการคำขอสวัสดิการ</h1>
                <div className={localStyles.subtitle}>ตรวจสอบและอนุมัติเงินช่วยเหลือสวัสดิการทั่วไป</div>
            </div>

            <div className={styles.filterCard}>
                <div className={styles.filterCardHeader}>
                    <ClockIcon width={18} style={{ color: "var(--red3)" }} />
                    <span className={styles.filterCardTitle}>ตัวกรองข้อมูลสวัสดิการ (Filters)</span>
                </div>
                <div className={styles.filterBar}>
                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>STATUS</div>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">ทั้งหมด</option>
                            <option value="pending_hr">รอ HR อนุมัติ</option>
                            <option value="pending">รอหัวหน้าอนุมัติ</option>
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
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>TO</div>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <button className={styles.btnPrimary} onClick={loadClaims} disabled={loading}>
                        {loading ? "..." : <ArrowPathIcon width={16} />}
                    </button>
                </div>
            </div>

            <div className={styles.tableWrap}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        รายการสวัสดิการ {pendingCount > 0 && <span className={styles.pendingCountBadge}>{pendingCount}</span>}
                    </div>
                    <span className={styles.rowCount}>{filteredClaims.length} รายการ</span>
                </div>

                <div className={styles.tableScroll}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>พนักงาน</th>
                                <th>ประเภท</th>
                                <th>จำนวนเงิน</th>
                                <th>ข้อมูลเพิ่มเติม</th>
                                <th style={{ textAlign: 'center' }}>File</th>
                                <th>การอนุมัติ</th>
                                <th>สถานะ</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClaims.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={8} className={styles.emptyState}>ไม่พบรายการคำขอสวัสดิการ</td>
                                </tr>
                            ) : (
                                filteredClaims.map(c => (
                                    <tr key={c.id}>
                                        <td>
                                            <div className={styles.empName}>{c.employees.name}</div>
                                            <div className={styles.empId}>{c.emp_id} {c.employees.nickname && `(${c.employees.nickname})`}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{WELFARE_TITLES[c.welfare_type] || c.welfare_type}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text4)' }}>{new Date(c.created_at).toLocaleDateString("th-TH")}</div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 700, color: 'var(--red3)' }}>฿{Number(c.amount).toLocaleString()}</span>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                                                {c.metadata && typeof c.metadata === 'object' && Object.entries(c.metadata).map(([k, v]) => {
                                                    let displayVal = String(v);
                                                    if (k === 'education_level') displayVal = EDU_LEVELS[v as string] || displayVal;
                                                    return (
                                                        <div key={k} style={{ marginBottom: 2 }}>
                                                            <span style={{ color: 'var(--text4)', fontWeight: 500 }}>{META_LABELS[k] || k}:</span> {displayVal}
                                                        </div>
                                                    );
                                                })}
                                                {c.remark && <div style={{ fontStyle: 'italic', marginTop: 4, color: 'var(--text4)' }}>บันทึกเพิ่มเติม: {c.remark}</div>}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                                                {(() => {
                                                    const urls = c.attachment_url ? (c.attachment_url.startsWith('[') ? JSON.parse(c.attachment_url) : [c.attachment_url]) : [];
                                                    if (urls.length === 0) return <span style={{ color: '#cbd5e1' }}>-</span>;
                                                    return urls.map((url: string, i: number) => (
                                                        <a key={i} href={url} target="_blank" rel="noreferrer" title={`เปิดดูเอกสารที่ ${i + 1}`}>
                                                            <PaperClipIcon width={20} style={{ color: 'var(--red3)', cursor: 'pointer' }} />
                                                        </a>
                                                    ));
                                                })()}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 12 }}>
                                                <div style={{ color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    หัวหน้า: 
                                                    {c.supervisor_status === 'approved' ? (
                                                        <span style={{ color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                                            <CheckCircleIcon width={14} /> อนุมัติแล้ว
                                                        </span>
                                                    ) : c.supervisor_status === 'rejected' ? (
                                                        <span style={{ color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                                            <XCircleIcon width={14} /> ไม่อนุมัติ
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#eab308', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                                            <ClockIcon width={14} /> รอพิจารณา
                                                        </span>
                                                    )}
                                                </div>
                                                {c.supervisor_approved_by && <div style={{ fontSize: 10, color: 'var(--text4)', marginLeft: 38 }}>โดย: {c.supervisor_approved_by}</div>}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={getStatusBadge(c.status, c.supervisor_status)}>
                                                {getStatusText(c.status, c.supervisor_status)}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button 
                                                    className={localStyles.btnApprove} 
                                                    onClick={() => openAdjustment(c)}
                                                    disabled={c.supervisor_status !== 'approved' && c.status === 'pending'}
                                                    style={{ opacity: (c.supervisor_status !== 'approved' && c.status === 'pending') ? 0.5 : 1 }}
                                                >
                                                    {c.status === 'pending' ? 'จัดการ' : 'แก้ไข'}
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

            {showModal && selectedClaim && (
                <div className={localStyles.modalOverlay}>
                    <div className={localStyles.modalContent}>
                        <div className={localStyles.modalHeader}>
                            <h2>จัดการคำขอสวัสดิการ (Final)</h2>
                        </div>
                        <div className={localStyles.modalBody}>
                            <div className={localStyles.inputField}>
                                <label className={localStyles.inputLabel}>สถานะการตัดสินใจ (HR)</label>
                                <div className={localStyles.statusOptions}>
                                    <div 
                                        className={`${localStyles.statusOption} ${modalData.status === "approved" ? localStyles.active : ""}`}
                                        onClick={() => setModalData({...modalData, status: "approved"})}
                                    >
                                        <CheckCircleIcon width={18} style={{ marginRight: 8 }} /> อนุมัติ
                                    </div>
                                    <div 
                                        className={`${localStyles.statusOption} ${modalData.status === "rejected" ? localStyles.active : ""}`}
                                        onClick={() => setModalData({...modalData, status: "rejected"})}
                                    >
                                        <XCircleIcon width={18} style={{ marginRight: 8 }} /> ไม่อนุมัติ
                                    </div>
                                </div>
                            </div>

                            <div className={localStyles.inputField}>
                                <label className={localStyles.inputLabel}>บันทึก / หมายเหตุของ HR</label>
                                <textarea 
                                    className={localStyles.inputElement}
                                    style={{ minHeight: 100 }}
                                    placeholder="ระบุเหตุผลหรือข้อความเพิ่มเติม..."
                                    value={modalData.remark}
                                    onChange={e => setModalData({...modalData, remark: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className={localStyles.modalFooter}>
                            <button className={localStyles.btnCancel} onClick={() => setShowModal(false)} disabled={saving}>ยกเลิก</button>
                            <button className={localStyles.btnConfirm} onClick={submitAdjustment} disabled={saving}>
                                {saving ? "กำลังบันทึก..." : "ยืนยันการทำรายการ"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
