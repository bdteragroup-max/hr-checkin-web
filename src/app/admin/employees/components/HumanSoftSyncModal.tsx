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

    const [syncResult, setSyncResult] = useState<{
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
            setPreviewItems(data.previewItems || []);
            // Default to 'new' tab if there are new employees, otherwise 'all'
            setTabFilter(data.newCount > 0 ? "new" : "all");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "เกิดข้อผิดพลาดในการตรวจสอบข้อมูลจาก HumanSoft");
        } finally {
            setLoading(false);
        }
    }

    async function handleExecuteSync() {
        setSyncing(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/employees/humansoft-sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun: false })
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || data.errors?.join(", ") || "SYNC_FAILED");
            }

            setSyncResult({
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
            if (!matchCode && !matchName && !matchDept && !matchPos) return false;
        }
        return true;
    });

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
                                        className={`${styles.tabBtn} ${tabFilter === "new" ? styles.tabBtnActive : ""}`}
                                        onClick={() => setTabFilter("new")}
                                    >
                                        พนักงานใหม่ ({newCount})
                                    </button>
                                    <button
                                        className={`${styles.tabBtn} ${tabFilter === "existing" ? styles.tabBtnActive : ""}`}
                                        onClick={() => setTabFilter("existing")}
                                    >
                                        มีในระบบแล้ว ({existingCount})
                                    </button>
                                    <button
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
                                        placeholder="ค้นหารหัส, ชื่อ, แผนก..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>รหัส</th>
                                            <th>ชื่อ-นามสกุล</th>
                                            <th>แผนก</th>
                                            <th>ตำแหน่ง</th>
                                            <th>สังกัด</th>
                                            <th>สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                    ไม่มีรายการในหมวดหมู่นี้
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredItems.map(item => (
                                                <tr key={item.emp_id}>
                                                    <td style={{ fontWeight: 700 }}>{item.emp_id}</td>
                                                    <td>{item.name}</td>
                                                    <td>{item.department}</td>
                                                    <td>{item.position}</td>
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
                                            ))
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
                            className={styles.btnCancel}
                            onClick={onClose}
                            disabled={syncing}
                        >
                            {syncResult ? "ปิดหน้าต่าง" : "ยกเลิก"}
                        </button>
                        {!syncResult && (
                            <button
                                className={styles.btnPrimary}
                                onClick={handleExecuteSync}
                                disabled={loading || syncing || totalHumanSoft === 0}
                            >
                                <ArrowPathIcon width={16} height={16} className={syncing ? styles.spinner : ""} />
                                <span>{syncing ? "กำลังซิงค์ข้อมูล..." : `เริ่มซิงค์ข้อมูล (${totalHumanSoft})`}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
