"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "./page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import AlertModal, { AlertState } from "@/components/AlertModal";
import {
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    FolderOpenIcon,
    MagnifyingGlassIcon,
    CheckIcon,
    PaperClipIcon,
    ArrowDownTrayIcon
} from "@heroicons/react/24/outline";
import {
    getAllClaims,
    approveClaim,
    returnClaimForRevision
} from "@/app/actions/depreciation-claims";

export default function AdminDepreciationClaimsPage() {
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<any[]>([]);
    const [supervisors, setSupervisors] = useState<{ id: string, name: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const [pendingAction, setPendingAction] = useState<{ id: number, action: "approve" | "return" } | null>(null);
    const [returnReason, setReturnReason] = useState("");
    const [saving, setSaving] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        status: "all",
        startDate: "",
        endDate: "",
        supervisor_id: "all"
    });

    useEffect(() => {
        fetchClaims();
    }, [filters.status, filters.startDate, filters.endDate, filters.supervisor_id]);

    async function fetchClaims() {
        setLoading(true);
        try {
            const data = await getAllClaims({
                status: filters.status === "all" ? undefined : filters.status,
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
                supervisor_id: filters.supervisor_id === "all" ? undefined : filters.supervisor_id
            });
            setClaims(data || []);

            if (!filters.supervisor_id || filters.supervisor_id === "all") {
                const uniqueSups = new Map();
                data.forEach((c: any) => {
                    if (c.supervisor && !uniqueSups.has(c.submitted_by)) {
                        uniqueSups.set(c.submitted_by, {
                            id: c.submitted_by,
                            name: `${c.supervisor.name} ${c.supervisor.nickname ? `(${c.supervisor.nickname})` : ''}`
                        });
                    }
                });
                setSupervisors(Array.from(uniqueSups.values()));
            }
        } catch (e: any) {
            console.error(e);
            setAlert({ visible: true, message: "ไม่สามารถโหลดข้อมูลได้: " + e.message, type: "error" });
        } finally {
            setLoading(false);
        }
    }

    const closeAlert = () => {
        setAlert(p => ({ ...p, visible: false }));
        setPendingAction(null);
        setReturnReason("");
    };

    const handleActionClick = (id: number, action: "approve" | "return") => {
        setPendingAction({ id, action });
        if (action === "approve") {
            setAlert({
                visible: true,
                message: `ยืนยันการอนุมัติรายการเบิกนี้?`,
                type: "ok"
            });
        }
    };

    const executeAction = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!pendingAction) return;
        const { id, action } = pendingAction;

        if (action === "return" && !returnReason.trim()) {
            setAlert({ visible: true, message: "กรุณาระบุเหตุผลในการตีกลับ", type: "error" });
            return;
        }

        setSaving(true);
        try {
            if (action === "approve") {
                await approveClaim(id);
                setAlert({ visible: true, message: "อนุมัติรายการสำเร็จ", type: "ok" });
            } else {
                await returnClaimForRevision(id, returnReason);
                setAlert({ visible: true, message: "ตีกลับรายการสำเร็จ", type: "ok" });
            }
            fetchClaims();
        } catch (e: any) {
            setAlert({ visible: true, message: e.message || "เกิดข้อผิดพลาด", type: "error" });
        } finally {
            setSaving(false);
            setPendingAction(null);
            setReturnReason("");
        }
    };

    const filteredClaims = useMemo(() => {
        return claims.filter(c => {
            const matchesSearch = !searchQuery ||
                c.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.emp_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.supervisor?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [claims, searchQuery]);

    const pendingCount = claims.filter(c => c.status === "PENDING").length;

    const exportToCSV = () => {
        if (!filteredClaims.length) {
            setAlert({ visible: true, message: "ไม่มีข้อมูลสำหรับ Export", type: "error" });
            return;
        }

        const headers = ["พนักงาน", "รหัสพนักงาน", "หัวหน้าผู้ส่ง", "เดือนที่ขอเบิก", "จำนวนเงิน", "สถานะ"];
        
        const rows = filteredClaims.map(c => {
            const statusText = c.status === "PENDING" ? "รออนุมัติ" : c.status === "APPROVED" ? "อนุมัติแล้ว" : "ตีกลับแก้ไข";
            return [
                c.employee?.name || "",
                c.emp_id || "",
                c.supervisor?.name || "",
                format(new Date(c.claim_month), "yyyy-MM-dd"),
                c.amount.toString(),
                statusText
            ];
        });

        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `depreciation-claims-${format(new Date(), "yyyyMMdd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={styles.wrap}>
            <AlertModal
                alert={alert}
                onClose={closeAlert}
                onConfirm={pendingAction?.action === "approve" ? executeAction : undefined}
                confirmText={pendingAction ? "ยืนยัน" : "ตกลง"}
            />

            {/* Custom Modal for Return Reason */}
            {pendingAction?.action === "return" && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                    <form onSubmit={executeAction} style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#111827' }}>ตีกลับเพื่อแก้ไข</h3>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>เหตุผลการตีกลับ</label>
                            <input 
                                type="text"
                                value={returnReason}
                                onChange={e => setReturnReason(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
                                placeholder="ระบุสิ่งที่ต้องแก้ไข..."
                                required
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button type="button" onClick={closeAlert} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>ยกเลิก</button>
                            <button type="submit" disabled={saving} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>ยืนยันตีกลับ</button>
                        </div>
                    </form>
                </div>
            )}

            <header className={styles.header}>
                <div>
                    <h1 className={styles.h1}>จัดการค่าเสื่อม/ค่าน้ำมัน</h1>
                    <p className={styles.sub}>ตรวจสอบ อนุมัติ และส่งกลับแก้ไขรายการขอเบิกค่าเสื่อมจากทุกทีม</p>
                </div>
            </header>

            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>START DATE</label>
                    <input
                        type="date"
                        className={styles.input}
                        value={filters.startDate}
                        onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>END DATE</label>
                    <input
                        type="date"
                        className={styles.input}
                        value={filters.endDate}
                        onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>STATUS</label>
                    <select 
                        className={styles.select}
                        value={filters.status} 
                        onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                    >
                        <option value="all">ทุกสถานะ</option>
                        <option value="PENDING">รออนุมัติ (PENDING)</option>
                        <option value="APPROVED">อนุมัติแล้ว (APPROVED)</option>
                        <option value="RETURNED">ตีกลับแก้ไข (RETURNED)</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>SUPERVISOR</label>
                    <select 
                        className={styles.select}
                        value={filters.supervisor_id} 
                        onChange={e => setFilters(f => ({ ...f, supervisor_id: e.target.value }))}
                    >
                        <option value="all">ทุกหัวหน้างาน</option>
                        {supervisors.map(sup => (
                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                        ))}
                    </select>
                </div>
                <div className={styles.filterGroup} style={{ flex: 1, minWidth: 200 }}>
                    <label className={styles.filterLabel}>SEARCH</label>
                    <div style={{ position: 'relative' }}>
                        <input 
                            className={styles.input}
                            style={{ width: '100%', paddingLeft: 35 }}
                            type="text" 
                            placeholder="ค้นหาชื่อ, รหัสพนักงาน..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <MagnifyingGlassIcon width={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text5)' }} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className={styles.btnRefresh} onClick={exportToCSV} disabled={loading} title="Export CSV" style={{ background: '#10b981', color: 'white' }}>
                        <ArrowDownTrayIcon width={16} />
                    </button>
                    <button className={styles.btnRefresh} onClick={() => fetchClaims()} disabled={loading}>
                        <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        <FolderOpenIcon width={20} /> รายการขอเบิกทั้งหมด
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
                                    <th>หัวหน้าผู้ส่ง</th>
                                    <th>เดือนที่ขอเบิก</th>
                                    <th>จำนวนเงิน</th>
                                    <th>สถานะ</th>
                                    <th style={{ textAlign: "right" }}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClaims.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: "center", padding: 60, color: "var(--text4)" }}>
                                            ไม่พบรายการที่ตรงกับเงื่อนไข
                                        </td>
                                    </tr>
                                ) : (
                                    filteredClaims.map(c => (
                                        <tr key={c.id}>
                                            <td>
                                                <div className={styles.empName}>{c.employee?.name}</div>
                                                <div className={styles.empId}>{c.emp_id}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500, fontSize: 13.5, color: "var(--text2)" }}>{c.supervisor?.name}</div>
                                            </td>
                                            <td>{format(new Date(c.claim_month), "MMM yy", { locale: th })}</td>
                                            <td>
                                                <span style={{ color: "var(--red)", fontWeight: 700 }}>
                                                    ฿{Number(c.amount).toLocaleString()}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${styles["status_" + c.status.toLowerCase()]}`}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        {c.status === "PENDING" ? "รออนุมัติ" :
                                                         c.status === "APPROVED" ? <><CheckCircleIcon width={14} /> อนุมัติแล้ว</> : 
                                                         <><XCircleIcon width={14} /> ตีกลับแก้ไข</>}
                                                    </span>
                                                </span>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                                    <a href={c.receipt_url} target="_blank" className={styles.btnExport} title="ดูไฟล์แนบ" style={{ textDecoration: 'none' }}>
                                                        <PaperClipIcon width={16} />
                                                    </a>
                                                    {c.status === "PENDING" && (
                                                        <>
                                                            <button 
                                                                className={styles.btnApprove} 
                                                                onClick={() => handleActionClick(c.id, "approve")}
                                                                title="อนุมัติ"
                                                            >
                                                                <CheckIcon width={16} />
                                                            </button>
                                                            <button 
                                                                className={styles.btnReject} 
                                                                onClick={() => handleActionClick(c.id, "return")}
                                                                title="ตีกลับแก้ไข"
                                                            >
                                                                <XCircleIcon width={16} />
                                                            </button>
                                                        </>
                                                    )}
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
