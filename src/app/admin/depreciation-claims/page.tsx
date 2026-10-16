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
    ArrowDownTrayIcon,
    BanknotesIcon,
    ClockIcon,
    ArrowUturnLeftIcon,
    DocumentTextIcon,
    SparklesIcon,
    TagIcon
} from "@heroicons/react/24/outline";
import { Car, Fuel } from "lucide-react";
import {
    getAllClaims,
    approveClaim,
    returnClaimForRevision,
    markClaimAsPaid,
    markMultipleClaimsAsPaid,
    unmarkClaimAsPaid
} from "@/app/actions/depreciation-claims";

export default function AdminDepreciationClaimsPage() {
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<any[]>([]);
    const [supervisors, setSupervisors] = useState<{ id: string, name: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const [pendingAction, setPendingAction] = useState<{ 
        id?: number; 
        ids?: number[]; 
        action: "approve" | "return" | "pay" | "bulk_pay" | "unpay";
    } | null>(null);
    const [returnReason, setReturnReason] = useState("");
    const [saving, setSaving] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        status: "all",
        claim_type: "all",
        startDate: "",
        endDate: "",
        supervisor_id: "all"
    });

    useEffect(() => {
        fetchClaims();
    }, [filters.status, filters.claim_type, filters.startDate, filters.endDate, filters.supervisor_id]);

    async function fetchClaims() {
        setLoading(true);
        setSelectedIds([]);
        try {
            const data = await getAllClaims({
                status: filters.status === "all" ? undefined : filters.status,
                claim_type: filters.claim_type === "all" ? undefined : filters.claim_type,
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

    const handleActionClick = (id: number, action: "approve" | "return" | "pay" | "unpay") => {
        setPendingAction({ id, action });
        if (action === "approve") {
            setAlert({
                visible: true,
                message: `ยืนยันการอนุมัติรายการเบิกนี้?`,
                type: "ok"
            });
        } else if (action === "pay") {
            setAlert({
                visible: true,
                message: `ยืนยันการบันทึกสถานะว่า "จ่ายเงินแล้ว" สำหรับรายการนี้?`,
                type: "ok"
            });
        } else if (action === "unpay") {
            setAlert({
                visible: true,
                message: `ต้องการยกเลิกสถานะจ่ายเงิน และเปลี่ยนกลับเป็น "รอรอบจ่ายเงิน" หรือไม่?`,
                type: "ok"
            });
        }
    };

    const handleBulkPayClick = () => {
        if (selectedIds.length === 0) return;
        setPendingAction({ ids: selectedIds, action: "bulk_pay" });
        setAlert({
            visible: true,
            message: `ยืนยันการบันทึกจ่ายเงินสำหรับ ${selectedIds.length} รายการที่เลือก?`,
            type: "ok"
        });
    };

    const executeAction = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!pendingAction) return;
        const { id, ids, action } = pendingAction;

        if (action === "return" && !returnReason.trim()) {
            setAlert({ visible: true, message: "กรุณาระบุเหตุผลในการตีกลับ", type: "error" });
            return;
        }

        setSaving(true);
        try {
            if (action === "approve" && id) {
                await approveClaim(id);
                setAlert({ visible: true, message: "อนุมัติรายการสำเร็จ (สถานะ: อนุมัติแล้ว รอจ่ายเงินรอบสิ้นเดือน)", type: "ok" });
            } else if (action === "pay" && id) {
                await markClaimAsPaid(id);
                setAlert({ visible: true, message: "บันทึกจ่ายเงินเรียบร้อยแล้ว (สถานะ: PAID)", type: "ok" });
            } else if (action === "bulk_pay" && ids && ids.length > 0) {
                const res = await markMultipleClaimsAsPaid(ids);
                setAlert({ visible: true, message: `บันทึกจ่ายเงินสำเร็จทั้งหมด ${res.count} รายการ`, type: "ok" });
                setSelectedIds([]);
            } else if (action === "unpay" && id) {
                await unmarkClaimAsPaid(id);
                setAlert({ visible: true, message: "ยกเลิกสถานะจ่ายเงินแล้ว (กลับเป็นสถานะอนุมัติแล้ว)", type: "ok" });
            } else if (action === "return" && id) {
                await returnClaimForRevision(id, returnReason);
                setAlert({ visible: true, message: "ตีกลับรายการสำเร็จ", type: "ok" });
            }
            await fetchClaims();
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
                (c.employee?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.emp_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.supervisor?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [claims, searchQuery]);

    // KPI Summary Calculations
    const kpiData = useMemo(() => {
        const depItems = claims.filter(c => c.claim_type === "DEPRECIATION" || !c.claim_type);
        const fuelItems = claims.filter(c => c.claim_type === "FUEL");
        const awaitingPayItems = claims.filter(c => c.status === "APPROVED");
        const paidItems = claims.filter(c => c.status === "PAID");
        const pendingItems = claims.filter(c => ["PENDING", "PENDING_INITIAL", "PENDING_HR"].includes(c.status));

        return {
            depSum: depItems.reduce((acc, c) => acc + Number(c.amount || 0), 0),
            depCount: depItems.length,
            fuelSum: fuelItems.reduce((acc, c) => acc + Number(c.amount || 0), 0),
            fuelCount: fuelItems.length,
            awaitingSum: awaitingPayItems.reduce((acc, c) => acc + Number(c.amount || 0), 0),
            awaitingCount: awaitingPayItems.length,
            paidSum: paidItems.reduce((acc, c) => acc + Number(c.amount || 0), 0),
            paidCount: paidItems.length,
            pendingCount: pendingItems.length
        };
    }, [claims]);

    // Selection helpers
    const approvedClaims = useMemo(() => {
        return filteredClaims.filter(c => c.status === "APPROVED");
    }, [filteredClaims]);

    const isAllSelected = approvedClaims.length > 0 && approvedClaims.every(c => selectedIds.includes(c.id));

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(approvedClaims.map(c => c.id));
        }
    };

    const toggleSelectOne = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // Export to Excel API
    const exportToExcel = () => {
        const params = new URLSearchParams();
        if (filters.status && filters.status !== "all") params.set("status", filters.status);
        if (filters.claim_type && filters.claim_type !== "all") params.set("claim_type", filters.claim_type);
        if (filters.startDate) params.set("startDate", filters.startDate);
        if (filters.endDate) params.set("endDate", filters.endDate);
        if (filters.supervisor_id && filters.supervisor_id !== "all") params.set("supervisor_id", filters.supervisor_id);

        const url = `/api/admin/depreciation-claims/export?${params.toString()}`;
        window.open(url, "_blank");
    };

    // Export to CSV
    const exportToCSV = () => {
        if (!filteredClaims.length) {
            setAlert({ visible: true, message: "ไม่มีข้อมูลสำหรับ Export", type: "error" });
            return;
        }

        const headers = [
            "พนักงาน",
            "รหัสพนักงาน",
            "ประเภทค่าใช้จ่าย",
            "หัวหน้าผู้ส่ง",
            "เดือนที่ขอเบิก",
            "จำนวนเงิน (บาท)",
            "สถานะคำขอ",
            "สถานะการจ่ายเงิน",
            "วันที่จ่ายเงิน",
            "ผู้บันทึกจ่ายเงิน",
            "อนุมัติเบื้องต้น",
            "ลิงก์เอกสาร"
        ];
        
        const rows = filteredClaims.map(c => {
            const catName = c.claim_type === "FUEL" ? "ค่าน้ำมัน (Fuel)" : "ค่าเสื่อมสภาพรถ (Depreciation)";
            
            let statusText = "รออนุมัติ";
            if (c.status === "PENDING_INITIAL") statusText = "รออนุมัติเบื้องต้น (คุณณัฎธินี)";
            else if (c.status === "PENDING_HR") statusText = "รอ HR อนุมัติ (ผ่านคุณณัฎธินีแล้ว)";
            else if (c.status === "APPROVED") statusText = "อนุมัติแล้ว (รอรอบจ่ายเงินสิ้นเดือน)";
            else if (c.status === "PAID") statusText = "จ่ายเงินเรียบร้อยแล้ว (PAID)";
            else if (c.status === "RETURNED") statusText = `ตีกลับแก้ไข: ${c.return_reason || ""}`;

            const payStatus = c.status === "PAID" 
                ? "จ่ายเงินแล้ว" 
                : (c.status === "APPROVED" ? "รอจ่ายเงินรอบสิ้นเดือน" : "-");

            return [
                c.employee?.name || "",
                c.emp_id || "",
                catName,
                c.supervisor?.name || "",
                format(new Date(c.claim_month), "yyyy-MM-dd"),
                c.amount.toString(),
                statusText,
                payStatus,
                c.paid_at ? format(new Date(c.paid_at), "yyyy-MM-dd HH:mm") : "-",
                c.paid_by || "-",
                c.initial_approved_by ? `อนุมัติแล้ว (${c.initial_approved_by})` : "-",
                c.receipt_url || ""
            ];
        });

        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `depreciation-fuel-claims-${filters.claim_type}-${format(new Date(), "yyyyMMdd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={styles.wrap}>
            <AlertModal
                alert={alert}
                onClose={closeAlert}
                onConfirm={pendingAction && pendingAction.action !== "return" ? executeAction : undefined}
                confirmText={pendingAction ? "ยืนยัน" : "ตกลง"}
            />

            {/* Custom Modal for Return Reason */}
            {pendingAction?.action === "return" && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                    <form onSubmit={executeAction} style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
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
                    <h1 className={styles.h1}>จัดการค่าเสื่อม / ค่าน้ำมัน</h1>
                    <p className={styles.sub}>ตรวจสอบ อนุมัติ ส่งกลับแก้ไข และบันทึกจ่ายเงินรอบสิ้นเดือน แยกหมวดหมู่ค่าเสื่อมและค่าน้ำมัน</p>
                </div>
            </header>

            {/* ── KPI Summary Cards ── */}
            <div className={styles.kpiGrid}>
                <div className={`${styles.kpiCard} ${styles.kpiDepreciation}`}>
                    <div className={styles.kpiTitle}>
                        <Car size={15} style={{ color: "#2563eb" }} />
                        <span>รวมค่าเสื่อมสภาพรถ</span>
                    </div>
                    <div className={styles.kpiValue}>
                        ฿{kpiData.depSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={styles.kpiSub}>
                        {kpiData.depCount} รายการ
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiFuel}`}>
                    <div className={styles.kpiTitle}>
                        <Fuel size={15} style={{ color: "#d97706" }} />
                        <span>รวมค่าน้ำมัน</span>
                    </div>
                    <div className={styles.kpiValue}>
                        ฿{kpiData.fuelSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={styles.kpiSub}>
                        {kpiData.fuelCount} รายการ
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiAwaiting}`}>
                    <div className={styles.kpiTitle}>
                        <ClockIcon width={15} style={{ color: "#8b5cf6" }} />
                        <span>รอจ่ายเงินรอบสิ้นเดือน</span>
                    </div>
                    <div className={styles.kpiValue}>
                        ฿{kpiData.awaitingSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={styles.kpiSub} style={{ color: "#7c3aed", fontWeight: 700 }}>
                        {kpiData.awaitingCount} รายการ (อนุมัติแล้ว)
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiPaid}`}>
                    <div className={styles.kpiTitle}>
                        <CheckCircleIcon width={15} style={{ color: "#10b981" }} />
                        <span>จ่ายเงินเรียบร้อยแล้ว</span>
                    </div>
                    <div className={styles.kpiValue} style={{ color: "#059669" }}>
                        ฿{kpiData.paidSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={styles.kpiSub} style={{ color: "#059669" }}>
                        {kpiData.paidCount} รายการที่ชำระแล้ว
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiPending}`}>
                    <div className={styles.kpiTitle}>
                        <DocumentTextIcon width={15} style={{ color: "#ea580c" }} />
                        <span>รออนุมัติ</span>
                    </div>
                    <div className={styles.kpiValue} style={{ color: "#ea580c" }}>
                        {kpiData.pendingCount}
                    </div>
                    <div className={styles.kpiSub}>
                        รอตรวจเบื้องต้น / HR
                    </div>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>ประเภทค่าใช้จ่าย</label>
                    <select 
                        className={styles.select}
                        value={filters.claim_type} 
                        onChange={e => setFilters(f => ({ ...f, claim_type: e.target.value }))}
                    >
                        <option value="all">ทุกประเภท (ค่าเสื่อม + น้ำมัน)</option>
                        <option value="DEPRECIATION">เฉพาะ ค่าเสื่อมสภาพรถ</option>
                        <option value="FUEL">เฉพาะ ค่าน้ำมัน</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>STATUS</label>
                    <select 
                        className={styles.select}
                        value={filters.status} 
                        onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                    >
                        <option value="all">ทุกสถานะ</option>
                        <option value="APPROVED">อนุมัติแล้ว - รอจ่ายเงิน (APPROVED)</option>
                        <option value="PAID">จ่ายเงินเรียบร้อยแล้ว (PAID)</option>
                        <option value="PENDING">รออนุมัติทั้งหมด</option>
                        <option value="PENDING_HR">รอ HR อนุมัติ (ผ่านคุณณัฎธินีแล้ว)</option>
                        <option value="PENDING_INITIAL">รออนุมัติเบื้องต้น (คุณณัฎธินี)</option>
                        <option value="RETURNED">ตีกลับแก้ไข (RETURNED)</option>
                    </select>
                </div>
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
                <div className={styles.filterGroup} style={{ flex: 1, minWidth: 180 }}>
                    <label className={styles.filterLabel}>SEARCH</label>
                    <div style={{ position: 'relative' }}>
                        <input 
                            className={styles.input}
                            style={{ width: '100%', paddingLeft: 35 }}
                            type="text" 
                            placeholder="ค้นหาชื่อ, รหัส..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <MagnifyingGlassIcon width={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text5)' }} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button 
                        className={styles.btnExcelExport} 
                        onClick={exportToExcel} 
                        disabled={loading} 
                        title="ดาวน์โหลดรายงาน Excel แยกหมวดหมู่"
                    >
                        <ArrowDownTrayIcon width={16} /> Excel รายงานแยกหมวด
                    </button>
                    <button 
                        className={styles.btnCsvExport} 
                        onClick={exportToCSV} 
                        disabled={loading} 
                        title="ดาวน์โหลด CSV"
                    >
                        <DocumentTextIcon width={16} /> CSV
                    </button>
                    <button className={styles.btnRefresh} onClick={() => fetchClaims()} disabled={loading} title="รีเฟรชข้อมูล">
                        <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* ── Bulk Action Bar ── */}
            {selectedIds.length > 0 && (
                <div className={styles.bulkBar}>
                    <div className={styles.bulkInfo}>
                        <BanknotesIcon width={20} />
                        <span>เลือก <strong>{selectedIds.length}</strong> รายการที่อนุมัติแล้ว</span>
                    </div>
                    <button 
                        type="button" 
                        onClick={handleBulkPayClick}
                        className={styles.bulkBtn}
                    >
                        <CheckIcon width={16} /> บันทึกจ่ายเงินรอบสิ้นเดือน ({selectedIds.length} รายการ)
                    </button>
                </div>
            )}

            {/* ── Table Card ── */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        <FolderOpenIcon width={20} /> รายการขอเบิกค่าเสื่อมและค่าน้ำมัน
                        {kpiData.awaitingCount > 0 && (
                            <span style={{
                                background: "#7c3aed",
                                color: "white",
                                padding: "2px 8px",
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 700,
                                marginLeft: 8
                            }}>
                                {kpiData.awaitingCount} รอจ่ายเงินรอบสิ้นเดือน
                            </span>
                        )}
                        {kpiData.pendingCount > 0 && (
                            <span style={{
                                background: "#ea580c",
                                color: "white",
                                padding: "2px 8px",
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 700,
                                marginLeft: 6
                            }}>
                                {kpiData.pendingCount} รออนุมัติ
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
                                    <th style={{ width: 40, textAlign: "center" }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isAllSelected}
                                            onChange={toggleSelectAll}
                                            disabled={approvedClaims.length === 0}
                                            title="เลือกรายการที่อนุมัติแล้วทั้งหมด"
                                        />
                                    </th>
                                    <th>พนักงาน</th>
                                    <th>ประเภท</th>
                                    <th>หัวหน้าผู้ส่ง</th>
                                    <th>เดือนที่ขอเบิก</th>
                                    <th>จำนวนเงิน</th>
                                    <th>เอกสารแนบ</th>
                                    <th>สถานะ</th>
                                    <th style={{ textAlign: "right" }}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClaims.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} style={{ textAlign: "center", padding: 60, color: "var(--text4)" }}>
                                            ไม่พบรายการที่ตรงกับเงื่อนไข
                                        </td>
                                    </tr>
                                ) : (
                                    filteredClaims.map(c => {
                                        const isApproved = c.status === "APPROVED";
                                        const isPaid = c.status === "PAID";
                                        const isFuel = c.claim_type === "FUEL";

                                        return (
                                            <tr key={c.id}>
                                                <td style={{ textAlign: "center" }}>
                                                    {isApproved ? (
                                                        <input 
                                                            type="checkbox"
                                                            checked={selectedIds.includes(c.id)}
                                                            onChange={() => toggleSelectOne(c.id)}
                                                        />
                                                    ) : (
                                                        <span style={{ color: "#cbd5e1" }}>-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className={styles.empName}>
                                                        {c.employee?.name} {c.employee?.nickname ? `(${c.employee.nickname})` : ''}
                                                    </div>
                                                    <div className={styles.empId}>{c.emp_id}</div>
                                                </td>
                                                <td>
                                                    {isFuel ? (
                                                        <span className={`${styles.typeBadge} ${styles.typeFuel}`}>
                                                            <Fuel size={13} />
                                                            <span>ค่าน้ำมัน</span>
                                                        </span>
                                                    ) : (
                                                        <span className={`${styles.typeBadge} ${styles.typeDepreciation}`}>
                                                            <Car size={13} />
                                                            <span>ค่าเสื่อมสภาพรถ</span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text2)" }}>
                                                        {c.supervisor?.name || c.submitted_by}
                                                    </div>
                                                </td>
                                                <td>{format(new Date(c.claim_month), "MMM yy", { locale: th })}</td>
                                                <td>
                                                    <span style={{ color: isFuel ? "#b45309" : "#1d4ed8", fontWeight: 700, fontSize: 14 }}>
                                                        ฿{Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td>
                                                    {c.receipt_url ? (
                                                        <a 
                                                            href={c.receipt_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className={styles.docLink}
                                                            title="คลิกเพื่อดูไฟล์แนบเอกสาร (บิล/ใบเสร็จ)"
                                                        >
                                                            <PaperClipIcon width={14} /> เปิดดูเอกสาร
                                                        </a>
                                                    ) : (
                                                        <span style={{ color: "#94a3b8", fontSize: 12 }}>ไม่มีเอกสาร</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {c.status === "PENDING_INITIAL" ? (
                                                        <span className={`${styles.statusBadge} ${styles.status_pending_initial}`}>
                                                            รออนุมัติเบื้องต้น (คุณณัฎธินี)
                                                        </span>
                                                    ) : (c.status === "PENDING_HR" || c.status === "PENDING") ? (
                                                        <div>
                                                            <span className={`${styles.statusBadge} ${styles.status_pending_hr}`}>
                                                                รอ HR อนุมัติ
                                                            </span>
                                                            {c.initial_approved_by && (
                                                                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2, fontWeight: 600 }}>
                                                                    ✓ ผ่านคุณณัฎธินีแล้ว
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : isApproved ? (
                                                        <div>
                                                            <span className={`${styles.statusBadge} ${styles.status_approved}`}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <ClockIcon width={14} /> อนุมัติแล้ว (รอจ่ายเงิน)
                                                                </span>
                                                            </span>
                                                            {c.approved_at && (
                                                                <div style={{ fontSize: 11, color: '#6d28d9', marginTop: 2 }}>
                                                                    อนุมัติ: {format(new Date(c.approved_at), "d MMM yy", { locale: th })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : isPaid ? (
                                                        <div>
                                                            <span className={`${styles.statusBadge} ${styles.status_paid}`}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <CheckCircleIcon width={14} /> จ่ายเงินแล้ว (PAID)
                                                                </span>
                                                            </span>
                                                            {c.paid_at && (
                                                                <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                                                                    จ่าย: {format(new Date(c.paid_at), "d MMM yy", { locale: th })} {c.paid_by ? `(${c.paid_by})` : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className={`${styles.statusBadge} ${styles.status_returned}`}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <XCircleIcon width={14} /> ตีกลับแก้ไข
                                                                </span>
                                                            </span>
                                                            {c.return_reason && (
                                                                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.return_reason}>
                                                                    {c.return_reason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: "right" }}>
                                                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                                                        <a href={c.receipt_url} target="_blank" rel="noopener noreferrer" className={styles.btnExport} title="ดูไฟล์แนบ" style={{ textDecoration: 'none' }}>
                                                            <PaperClipIcon width={16} />
                                                        </a>

                                                        {/* Approvals for Pending items */}
                                                        {(c.status === "PENDING_HR" || c.status === "PENDING" || c.status === "PENDING_INITIAL") && (
                                                            <>
                                                                <button 
                                                                    className={styles.btnApprove} 
                                                                    onClick={() => handleActionClick(c.id, "approve")}
                                                                    title={c.status === "PENDING_INITIAL" ? "อนุมัติ (HR Override)" : "อนุมัติคำขอ"}
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

                                                        {/* Mark as Paid for Approved items */}
                                                        {isApproved && (
                                                            <button 
                                                                className={styles.btnPay}
                                                                onClick={() => handleActionClick(c.id, "pay")}
                                                                title="ทำรายการจ่ายเงิน (Mark as Paid)"
                                                            >
                                                                <BanknotesIcon width={15} /> จ่ายเงินแล้ว
                                                            </button>
                                                        )}

                                                        {/* Revert Paid status if needed */}
                                                        {isPaid && (
                                                            <button 
                                                                className={styles.btnUnpay}
                                                                onClick={() => handleActionClick(c.id, "unpay")}
                                                                title="ยกเลิกสถานะจ่ายเงิน (เปลี่ยนกลับเป็นรอจ่าย)"
                                                            >
                                                                <ArrowUturnLeftIcon width={15} />
                                                            </button>
                                                        )}
                                                    </div>
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
