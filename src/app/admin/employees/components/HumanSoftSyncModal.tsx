"use client";

import { useState, useEffect } from "react";
import styles from "./HumanSoftSyncModal.module.css";
import {
    ArrowPathIcon,
    XMarkIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    UserPlusIcon,
    BuildingOffice2Icon,
    MagnifyingGlassIcon
} from "@heroicons/react/24/outline";

interface PreviewItem {
    emp_id: string;
    name: string;
    department: string;
    position: string;
    company: string;
    branch_id?: string;
    branch_name?: string;
    is_new: boolean;
    is_active: boolean;
}

interface HumanSoftSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSyncSuccess: () => void;
}

export default function HumanSoftSyncModal({
    isOpen,
    onClose,
    onSyncSuccess
}: HumanSoftSyncModalProps) {
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [totalHumanSoft, setTotalHumanSoft] = useState(0);
    const [newCount, setNewCount] = useState(0);
    const [existingCount, setExistingCount] = useState(0);
    const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
    const [tabFilter, setTabFilter] = useState<"all" | "new" | "existing">("new");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());

    const [syncResult, setSyncResult] = useState<{
        selectedCount?: number;
        createdCount: number;
        updatedCount: number;
        skippedCount: number;
        errors?: string[];
    } | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSyncResult(null);
            setError(null);
            return;
        }

        // Fetch dry run preview on open
        loadPreview();
    }, [isOpen]);

    async function loadPreview() {
        setLoading(true);
        setError(null);
        setSyncResult(null);
        try {
            const res = await fetch("/api/admin/employees/humansoft-sync?dry_run=true");
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || data.errors?.join(", ") || "FAILED_TO_FETCH_PREVIEW");
            }

            setTotalHumanSoft(data.totalHumanSoft || 0);
            setNewCount(data.newCount || 0);
            setExistingCount(data.existingCount || 0);
            const items: PreviewItem[] = data.previewItems || [];
            setPreviewItems(items);

            // Pre-select: if there are new employees, select only new employees by default; otherwise select all
            if ((data.newCount || 0) > 0) {
                const newIds = items.filter(p => p.is_new).map(p => p.emp_id);
                setSelectedEmpIds(new Set(newIds));
                setTabFilter("new");
            } else {
                setSelectedEmpIds(new Set(items.map(p => p.emp_id)));
                setTabFilter("all");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "เกิดข้อผิดพลาดในการตรวจสอบข้อมูลจาก HumanSoft");
        } finally {
            setLoading(false);
        }
    }

    async function handleExecuteSync() {
        if (selectedEmpIds.size === 0) return;
        setSyncing(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/employees/humansoft-sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dryRun: false,
                    selectedEmpIds: Array.from(selectedEmpIds)
                })
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || data.errors?.join(", ") || "SYNC_FAILED");
            }

            setSyncResult({
                selectedCount: data.selectedCount,
                createdCount: data.createdCount || 0,
                updatedCount: data.updatedCount || 0,
                skippedCount: data.skippedCount || 0,
                errors: data.errors
            });

            // Trigger list reload in parent page
            onSyncSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "เกิดข้อผิดพลาดในการซิงค์ข้อมูล");
        } finally {
            setSyncing(false);
        }
    }

    function toggleSelectOne(empId: string) {
        setSelectedEmpIds(prev => {
            const next = new Set(prev);
            if (next.has(empId)) next.delete(empId);
            else next.add(empId);
            return next;
        });
    }

    function selectOnlyNew() {
        const newIds = previewItems.filter(i => i.is_new).map(i => i.emp_id);
        setSelectedEmpIds(new Set(newIds));
    }

    function selectAll() {
        setSelectedEmpIds(new Set(previewItems.map(i => i.emp_id)));
    }

    function clearAllSelection() {
        setSelectedEmpIds(new Set());
    }

    if (!isOpen) return null;

    const filteredItems = previewItems.filter(item => {
        if (tabFilter === "new" && !item.is_new) return false;
        if (tabFilter === "existing" && item.is_new) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchCode = item.emp_id.toLowerCase().includes(q);
            const matchName = item.name.toLowerCase().includes(q);
            const matchDept = item.department.toLowerCase().includes(q);
            const matchPos = item.position.toLowerCase().includes(q);
            const matchBranch = item.branch_name?.toLowerCase().includes(q);
            if (!matchCode && !matchName && !matchDept && !matchPos && !matchBranch) return false;
        }
        return true;
    });

    const isAllFilteredSelected = filteredItems.length > 0 && filteredItems.every(i => selectedEmpIds.has(i.emp_id));
    const isSomeFilteredSelected = filteredItems.some(i => selectedEmpIds.has(i.emp_id));

    function toggleSelectFiltered() {
        setSelectedEmpIds(prev => {
            const next = new Set(prev);
            if (isAllFilteredSelected) {
                filteredItems.forEach(i => next.delete(i.emp_id));
            } else {
                filteredItems.forEach(i => next.add(i.emp_id));
            }
            return next;
        });
    }

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && !syncing && onClose()}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.titleArea}>
                        <div className={styles.iconWrap}>
                            <ArrowPathIcon width={22} height={22} className={syncing ? styles.spinner : ""} />
                        </div>
                        <div>
                            <h2 className={styles.title}>ซิงค์ข้อมูลพนักงานจาก HumanSoft</h2>
                            <div className={styles.subtitle}>
                                เชื่อมต่อ HumanSoft Open API เพื่อนำเข้าและอัปเดตข้อมูลพนักงาน
                            </div>
                        </div>
                    </div>
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        disabled={syncing}
                        title="ปิด"
                    >
                        <XMarkIcon width={20} height={20} />
                    </button>
                </div>

                {/* Body */}
                <div className={styles.body}>
                    {error && (
                        <div className={styles.errorBanner}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <ExclamationTriangleIcon width={18} height={18} />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className={styles.loadingBox}>
                            <div className={styles.spinner} />
                            <span>กำลังตรวจสอบและดึงรายชื่อพนักงานจาก HumanSoft Open API...</span>
                        </div>
                    ) : syncResult ? (
                        /* Sync Finished Result Card */
                        <div className={styles.successCard}>
                            <div className={styles.successHeader}>
                                <CheckCircleIcon width={24} height={24} />
                                <span>การซิงค์ข้อมูลเสร็จสมบูรณ์เรียบร้อย</span>
                                {syncResult.selectedCount != null && (
                                    <span style={{ fontSize: 13, fontWeight: 500, color: "#166534", marginLeft: "auto" }}>
                                        (ดำเนินการซิงค์ตามที่เลือก {syncResult.selectedCount} คน)
                                    </span>
                                )}
                            </div>
                            <div className={styles.successMetrics}>
                                <div className={styles.metricBox}>
                                    <div className={styles.metricBoxTitle}>เพิ่มพนักงานใหม่</div>
                                    <div className={styles.metricBoxValue}>+{syncResult.createdCount} คน</div>
                                </div>
                                <div className={styles.metricBox}>
                                    <div className={styles.metricBoxTitle}>อัปเดตข้อมูลพนักงานเดิม</div>
                                    <div className={styles.metricBoxValue}>{syncResult.updatedCount} คน</div>
                                </div>
                                <div className={styles.metricBox}>
                                    <div className={styles.metricBoxTitle}>ข้าม / ไม่เปลี่ยนแปลง</div>
                                    <div className={styles.metricBoxValue}>{syncResult.skippedCount} คน</div>
                                </div>
                            </div>
                            {syncResult.errors && syncResult.errors.length > 0 && (
                                <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 8 }}>
                                    <strong>ข้อสังเกตบางรายการ:</strong>
                                    <ul style={{ paddingLeft: 18, margin: "4px 0 0" }}>
                                        {syncResult.errors.slice(0, 5).map((e, idx) => (
                                            <li key={idx}>{e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Preview Stage */
                        <>
                            {/* Stats */}
                            <div className={styles.statsGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>พนักงานทั้งหมดใน HumanSoft</span>
                                    <span className={styles.statValue}>{totalHumanSoft} คน</span>
                                </div>
                                <div className={`${styles.statCard} ${newCount > 0 ? styles.statCardHighlight : ""}`}>
                                    <span className={styles.statLabel}>พนักงานใหม่ที่ตรวจพบ</span>
                                    <span className={styles.statValue}>+{newCount} คน</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>พนักงานที่มีในระบบแล้ว</span>
                                    <span className={styles.statValue}>{existingCount} คน</span>
                                </div>
                            </div>

                            {/* Filter Tabs & Search */}
                            <div className={styles.filterRow}>
                                <div className={styles.filterTabs}>
                                    <button
                                        type="button"
                                        className={`${styles.tabBtn} ${tabFilter === "new" ? styles.tabBtnActive : ""}`}
                                        onClick={() => setTabFilter("new")}
                                    >
                                        พนักงานใหม่ ({newCount})
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.tabBtn} ${tabFilter === "existing" ? styles.tabBtnActive : ""}`}
                                        onClick={() => setTabFilter("existing")}
                                    >
                                        มีในระบบแล้ว ({existingCount})
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.tabBtn} ${tabFilter === "all" ? styles.tabBtnActive : ""}`}
                                        onClick={() => setTabFilter("all")}
                                    >
                                        ทั้งหมด ({totalHumanSoft})
                                    </button>
                                </div>
                                <div className={styles.searchWrap}>
                                    <MagnifyingGlassIcon width={16} height={16} className={styles.searchIcon} />
                                    <input
                                        type="text"
                                        className={styles.searchInput}
                                        placeholder="ค้นหารหัส, ชื่อ, แผนก, สาขา..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Selection Toolbar */}
                            <div className={styles.selectionBar}>
                                <div className={styles.selectionCountWrap}>
                                    <span>เลือกที่จะซิงค์:</span>
                                    <span className={styles.selectionCountBadge}>
                                        {selectedEmpIds.size} / {totalHumanSoft} คน
                                    </span>
                                </div>
                                <div className={styles.quickActions}>
                                    {newCount > 0 && (
                                        <button
                                            type="button"
                                            className={`${styles.quickBtn} ${styles.quickBtnHighlight}`}
                                            onClick={selectOnlyNew}
                                            title="เลือกเฉพาะพนักงานใหม่ที่ตรวจพบ"
                                        >
                                            + เลือกเฉพาะคนใหม่ ({newCount})
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.quickBtn}
                                        onClick={selectAll}
                                    >
                                        เลือกทั้งหมด ({totalHumanSoft})
                                    </button>
                                    {filteredItems.length > 0 && filteredItems.length !== totalHumanSoft && (
                                        <button
                                            type="button"
                                            className={styles.quickBtn}
                                            onClick={toggleSelectFiltered}
                                        >
                                            {isAllFilteredSelected ? `ยกเลิกในหน้านี้ (${filteredItems.length})` : `เลือกในหน้านี้ (${filteredItems.length})`}
                                        </button>
                                    )}
                                    {selectedEmpIds.size > 0 && (
                                        <button
                                            type="button"
                                            className={styles.quickBtn}
                                            onClick={clearAllSelection}
                                            style={{ color: "#ef4444" }}
                                        >
                                            ล้างการเลือก
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 44, textAlign: "center" }}>
                                                <input
                                                    type="checkbox"
                                                    className={styles.checkbox}
                                                    checked={isAllFilteredSelected}
                                                    ref={el => {
                                                        if (el) el.indeterminate = isSomeFilteredSelected && !isAllFilteredSelected;
                                                    }}
                                                    onChange={toggleSelectFiltered}
                                                    title={isAllFilteredSelected ? "ยกเลิกเลือกรายการในหน้านี้" : "เลือกทั้งหมดในหน้านี้"}
                                                />
                                            </th>
                                            <th>รหัส</th>
                                            <th>ชื่อ-นามสกุล</th>
                                            <th>แผนก</th>
                                            <th>ตำแหน่ง</th>
                                            <th>สาขา</th>
                                            <th>สังกัด</th>
                                            <th>สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                    ไม่มีรายการในหมวดหมู่นี้
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredItems.map(item => {
                                                const isSelected = selectedEmpIds.has(item.emp_id);
                                                return (
                                                    <tr
                                                        key={item.emp_id}
                                                        className={isSelected ? styles.selectedRow : ""}
                                                        onClick={() => toggleSelectOne(item.emp_id)}
                                                        style={{ cursor: "pointer" }}
                                                    >
                                                        <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                className={styles.checkbox}
                                                                checked={isSelected}
                                                                onChange={() => toggleSelectOne(item.emp_id)}
                                                            />
                                                        </td>
                                                        <td style={{ fontWeight: 700 }}>{item.emp_id}</td>
                                                        <td>{item.name}</td>
                                                        <td>{item.department}</td>
                                                        <td>{item.position}</td>
                                                        <td>
                                                            <span style={{
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                                color: item.branch_name && item.branch_name !== "สำนักงานใหญ่" ? "#0284c7" : "#475569",
                                                                background: item.branch_name && item.branch_name !== "สำนักงานใหญ่" ? "#e0f2fe" : "#f1f5f9",
                                                                padding: "2px 8px",
                                                                borderRadius: 6,
                                                                display: "inline-block",
                                                                border: item.branch_name && item.branch_name !== "สำนักงานใหญ่" ? "1px solid #bae6fd" : "1px solid #e2e8f0"
                                                            }}>
                                                                {item.branch_name || "สำนักงานใหญ่"}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span style={{ fontSize: 12, color: "#64748b" }}>
                                                                {item.company}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {item.is_new ? (
                                                                <span className={styles.badgeNew}>
                                                                    <UserPlusIcon width={13} height={13} />
                                                                    พนักงานใหม่
                                                                </span>
                                                            ) : (
                                                                <span className={styles.badgeExisting}>
                                                                    มีในระบบแล้ว
                                                                </span>
                                                            )}
                                                            {!item.is_active && (
                                                                <span className={styles.badgeResigned} style={{ marginLeft: 4 }}>
                                                                    ลาออก
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <div className={styles.footerInfo}>
                        {syncing
                            ? "กำลังดำเนินการซิงค์ข้อมูล กรุณารอสักครู่..."
                            : syncResult
                                ? "ข้อมูลพนักงานในระบบได้รับการอัปเดตแล้ว"
                                : "* ระบบจะแมป แผนก, ตำแหน่ง และบริษัท (TG, TE, TP) ให้อัตโนมัติ"}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            type="button"
                            className={styles.btnCancel}
                            onClick={onClose}
                            disabled={syncing}
                        >
                            {syncResult ? "ปิดหน้าต่าง" : "ยกเลิก"}
                        </button>
                        {!syncResult && (
                            <button
                                type="button"
                                className={styles.btnPrimary}
                                onClick={handleExecuteSync}
                                disabled={loading || syncing || selectedEmpIds.size === 0}
                            >
                                <ArrowPathIcon width={16} height={16} className={syncing ? styles.spinner : ""} />
                                <span>
                                    {syncing
                                        ? "กำลังซิงค์ข้อมูล..."
                                        : selectedEmpIds.size === 0
                                            ? "กรุณาเลือกพนักงานที่จะซิงค์"
                                            : selectedEmpIds.size === totalHumanSoft
                                                ? `เริ่มซิงค์ข้อมูลทั้งหมด (${totalHumanSoft})`
                                                : `เริ่มซิงค์ข้อมูล (เลือก ${selectedEmpIds.size} คน)`}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
