"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./page.module.css";
import {
    CalendarIcon,
    ArrowDownTrayIcon,
    MagnifyingGlassIcon,
    ArrowPathIcon,
    SunIcon,
    ClockIcon,
    TruckIcon,
    ArchiveBoxIcon,
    CubeIcon,
    BanknotesIcon,
    PaperClipIcon,
    ArrowTopRightOnSquareIcon,
    ChartBarIcon,
    DocumentTextIcon,
} from "@heroicons/react/24/outline";

type TabKey = "daily" | "leaves" | "ot" | "travel" | "clothing" | "assets" | "payments" | "uploads";

function toBkkDate(d: Date | string | null | undefined) {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Bangkok",
    });
}

function toBkkTime(d: Date | string | null | undefined) {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
    });
}

function toBkkDateTime(d: Date | string | null | undefined) {
    if (!d) return "-";
    return `${toBkkDate(d)} ${toBkkTime(d)}`;
}

export default function ActivityReportPage() {
    // Default to the requested date range 2026-09-22 to 2026-09-25
    const [startDate, setStartDate] = useState("2026-09-22");
    const [endDate, setEndDate] = useState("2026-09-25");
    const [activePreset, setActivePreset] = useState("sep22_25");

    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabKey>("daily");
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch report data
    const fetchReport = async (s = startDate, e = endDate) => {
        if (!s || !e) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/reports/activity?start_date=${s}&end_date=${e}`);
            const json = await res.json();
            if (json.ok) {
                setReportData(json);
            } else {
                alert(`เกิดข้อผิดพลาด: ${json.error}`);
            }
        } catch (err: any) {
            console.error("Fetch report error:", err);
            alert("ไม่สามารถดึงข้อมูลรายงานได้ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    // Preset handlers
    const applyPreset = (preset: string) => {
        setActivePreset(preset);
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();

        let s = "";
        let e = "";

        if (preset === "sep22_25") {
            s = "2026-09-22";
            e = "2026-09-25";
        } else if (preset === "today") {
            const todayStr = new Date(Date.UTC(y, m, d)).toISOString().split("T")[0];
            s = todayStr;
            e = todayStr;
        } else if (preset === "last7") {
            const past7 = new Date(Date.UTC(y, m, d - 6));
            s = past7.toISOString().split("T")[0];
            e = new Date(Date.UTC(y, m, d)).toISOString().split("T")[0];
        } else if (preset === "thisMonth") {
            const startM = new Date(Date.UTC(y, m, 1));
            s = startM.toISOString().split("T")[0];
            e = new Date(Date.UTC(y, m, d)).toISOString().split("T")[0];
        } else if (preset === "lastMonth") {
            const startLastM = new Date(Date.UTC(y, m - 1, 1));
            const endLastM = new Date(Date.UTC(y, m, 0));
            s = startLastM.toISOString().split("T")[0];
            e = endLastM.toISOString().split("T")[0];
        }

        if (s && e) {
            setStartDate(s);
            setEndDate(e);
            fetchReport(s, e);
        }
    };

    // Excel export handler
    const handleExportExcel = () => {
        if (!startDate || !endDate) {
            alert("กรุณาเลือกช่วงวันที่ให้ครบถ้วนก่อนส่งออก");
            return;
        }
        const exportUrl = `/api/admin/reports/activity/export?start_date=${startDate}&end_date=${endDate}`;
        window.location.href = exportUrl;
    };

    // Badge styling helper
    const renderBadge = (status: string) => {
        const s = (status || "").toLowerCase();
        let className = styles.badgeNeutral;

        if (s.includes("approved") || s.includes("อนุมัติ") || s.includes("fulfilled") || s.includes("complete") || s.includes("คืนแล้ว") || s.includes("สำเร็จ")) {
            className = styles.badgeSuccess;
        } else if (s.includes("pending") || s.includes("รอ") || s.includes("borrowed") || s.includes("กำลังยืม")) {
            className = styles.badgeWarning;
        } else if (s.includes("reject") || s.includes("ไม่อนุมัติ") || s.includes("damaged") || s.includes("ชำรุด") || s.includes("ยกเลิก")) {
            className = styles.badgeDanger;
        } else if (s.includes("info") || s.includes("ตรวจสอบ")) {
            className = styles.badgeInfo;
        }

        return <span className={`${styles.badge} ${className}`}>{status || "-"}</span>;
    };

    // Filtered data based on search query
    const leavesList = useMemo(() => {
        const list = reportData?.data?.leaves || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((x: any) =>
            x.emp_id?.toLowerCase().includes(q) ||
            x.name?.toLowerCase().includes(q) ||
            x.leave_type?.toLowerCase().includes(q) ||
            x.status?.toLowerCase().includes(q) ||
            x.reason?.toLowerCase().includes(q)
        );
    }, [reportData, searchQuery]);

    const otList = useMemo(() => {
        const list = reportData?.data?.otRequests || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((x: any) =>
            x.emp_id?.toLowerCase().includes(q) ||
            x.employee?.name?.toLowerCase().includes(q) ||
            x.status?.toLowerCase().includes(q) ||
            x.reason?.toLowerCase().includes(q)
        );
    }, [reportData, searchQuery]);

    const travelList = useMemo(() => {
        const list = reportData?.data?.travelClaims || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((x: any) =>
            x.emp_id?.toLowerCase().includes(q) ||
            x.employee?.name?.toLowerCase().includes(q) ||
            x.site_name?.toLowerCase().includes(q) ||
            x.status?.toLowerCase().includes(q) ||
            x.claim_type?.toLowerCase().includes(q)
        );
    }, [reportData, searchQuery]);

    const clothingList = useMemo(() => {
        const list = reportData?.data?.clothingRequests || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((x: any) =>
            x.emp_id?.toLowerCase().includes(q) ||
            x.employee?.name?.toLowerCase().includes(q) ||
            x.variant?.item?.name?.toLowerCase().includes(q) ||
            x.status?.toLowerCase().includes(q) ||
            x.reason?.toLowerCase().includes(q)
        );
    }, [reportData, searchQuery]);

    const assetList = useMemo(() => {
        const list = reportData?.data?.assetBorrowings || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((x: any) =>
            x.emp_id?.toLowerCase().includes(q) ||
            x.employee?.name?.toLowerCase().includes(q) ||
            x.assets?.asset_id?.toLowerCase().includes(q) ||
            x.assets?.name?.toLowerCase().includes(q) ||
            x.status?.toLowerCase().includes(q)
        );
    }, [reportData, searchQuery]);

    const paymentList = useMemo(() => {
        const list = reportData?.data?.paymentTasks || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((x: any) =>
            x.jobs?.jobNumber?.toLowerCase().includes(q) ||
            x.jobs?.customerName?.toLowerCase().includes(q) ||
            x.invoiceNumber?.toLowerCase().includes(q) ||
            x.status?.toLowerCase().includes(q) ||
            x.note?.toLowerCase().includes(q)
        );
    }, [reportData, searchQuery]);

    const uploadsList = useMemo(() => {
        const list = reportData?.data?.uploadedFiles || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((x: any) =>
            x.name?.toLowerCase().includes(q) ||
            x.type?.toLowerCase().includes(q) ||
            x.date?.toLowerCase().includes(q)
        );
    }, [reportData, searchQuery]);

    const totals = reportData?.totals || {
        leaves: 0,
        ot: 0,
        travel: 0,
        clothing: 0,
        assets: 0,
        payments: 0,
        uploads: 0,
    };

    const grandTotal = totals.leaves + totals.ot + totals.travel + totals.clothing + totals.assets + totals.payments + totals.uploads;

    return (
        <div className={styles.container}>
            {/* ── HEADER ── */}
            <div className={styles.header}>
                <div className={styles.titleArea}>
                    <h1 className={styles.title}>
                        <ChartBarIcon width={28} height={28} color="#2563eb" />
                        รายงานสรุปกิจกรรมและไฟล์แนบ
                    </h1>
                    <p className={styles.subtitle}>
                        ตรวจสอบและส่งออกข้อมูลคำขอทุกประเภทในระบบ พร้อมไฟล์แนบตามช่วงเวลาที่กำหนด
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={styles.btnExcel}
                        onClick={handleExportExcel}
                        disabled={loading || !reportData}
                        title="ดาวน์โหลดไฟล์ Excel (.xlsx) ทุกหมวดหมู่ตามช่วงวันที่เลือก"
                    >
                        <ArrowDownTrayIcon width={18} height={18} />
                        ส่งออก Excel (.xlsx)
                    </button>
                </div>
            </div>

            {/* ── DATE FILTER BAR ── */}
            <div className={styles.filterCard}>
                <div className={styles.filterRow}>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>วันที่เริ่มต้น</label>
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setActivePreset("");
                            }}
                        />
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>วันที่สิ้นสุด</label>
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setActivePreset("");
                            }}
                        />
                    </div>
                    <button
                        className={styles.btnPrimary}
                        onClick={() => fetchReport()}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <ArrowPathIcon width={18} height={18} className={styles.spinner} style={{ width: 16, height: 16 }} />
                                กำลังดึงข้อมูล...
                            </>
                        ) : (
                            <>
                                <MagnifyingGlassIcon width={18} height={18} />
                                ค้นหาข้อมูล
                            </>
                        )}
                    </button>
                </div>

                {/* Quick Presets */}
                <div className={styles.presetChips}>
                    <span className={styles.presetLabel}>ช่วงเวลาด่วน:</span>
                    <button
                        className={`${styles.presetBtn} ${activePreset === "sep22_25" ? styles.presetBtnActive : ""}`}
                        onClick={() => applyPreset("sep22_25")}
                    >
                        22 - 25 ก.ย. 2569
                    </button>
                    <button
                        className={`${styles.presetBtn} ${activePreset === "today" ? styles.presetBtnActive : ""}`}
                        onClick={() => applyPreset("today")}
                    >
                        วันนี้
                    </button>
                    <button
                        className={`${styles.presetBtn} ${activePreset === "last7" ? styles.presetBtnActive : ""}`}
                        onClick={() => applyPreset("last7")}
                    >
                        7 วันล่าสุด
                    </button>
                    <button
                        className={`${styles.presetBtn} ${activePreset === "thisMonth" ? styles.presetBtnActive : ""}`}
                        onClick={() => applyPreset("thisMonth")}
                    >
                        เดือนนี้
                    </button>
                    <button
                        className={`${styles.presetBtn} ${activePreset === "lastMonth" ? styles.presetBtnActive : ""}`}
                        onClick={() => applyPreset("lastMonth")}
                    >
                        เดือนก่อนหน้า
                    </button>
                </div>
            </div>

            {/* ── KPI STATS CARDS ── */}
            <div className={styles.kpiGrid}>
                <div className={`${styles.kpiCard}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiTitle}>รวมทุกรายการ</span>
                        <div className={styles.kpiIconWrapper}><ChartBarIcon width={18} height={18} /></div>
                    </div>
                    <div className={styles.kpiValue}>{grandTotal.toLocaleString()}</div>
                    <div className={styles.kpiSub}>ทุกคำขอและไฟล์แนบ</div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiLeaves}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiTitle}>คำขอลางาน</span>
                        <div className={styles.kpiIconWrapper} style={{ color: "#2563eb", background: "#eff6ff" }}><SunIcon width={18} height={18} /></div>
                    </div>
                    <div className={styles.kpiValue}>{totals.leaves.toLocaleString()}</div>
                    <div className={styles.kpiSub}>รายการลางาน</div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiOt}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiTitle}>คำขอทำ OT</span>
                        <div className={styles.kpiIconWrapper} style={{ color: "#7c3aed", background: "#f5f3ff" }}><ClockIcon width={18} height={18} /></div>
                    </div>
                    <div className={styles.kpiValue}>{totals.ot.toLocaleString()}</div>
                    <div className={styles.kpiSub}>รายการล่วงเวลา</div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiTravel}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiTitle}>เบิกค่าเดินทาง</span>
                        <div className={styles.kpiIconWrapper} style={{ color: "#d97706", background: "#fffbeb" }}><TruckIcon width={18} height={18} /></div>
                    </div>
                    <div className={styles.kpiValue}>{totals.travel.toLocaleString()}</div>
                    <div className={styles.kpiSub}>ค่าที่พัก/เดินทาง</div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiClothing}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiTitle}>เบิกยูนิฟอร์ม</span>
                        <div className={styles.kpiIconWrapper} style={{ color: "#db2777", background: "#fdf2f8" }}><ArchiveBoxIcon width={18} height={18} /></div>
                    </div>
                    <div className={styles.kpiValue}>{totals.clothing.toLocaleString()}</div>
                    <div className={styles.kpiSub}>ชุดฟอร์มพนักงาน</div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiAssets}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiTitle}>ยืมทรัพย์สิน-รถ</span>
                        <div className={styles.kpiIconWrapper} style={{ color: "#0891b2", background: "#ecfeff" }}><CubeIcon width={18} height={18} /></div>
                    </div>
                    <div className={styles.kpiValue}>{totals.assets.toLocaleString()}</div>
                    <div className={styles.kpiSub}>อุปกรณ์/ยานพาหนะ</div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiPayments}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiTitle}>งานสั่งจ่าย</span>
                        <div className={styles.kpiIconWrapper} style={{ color: "#059669", background: "#ecfdf5" }}><BanknotesIcon width={18} height={18} /></div>
                    </div>
                    <div className={styles.kpiValue}>{totals.payments.toLocaleString()}</div>
                    <div className={styles.kpiSub}>งานบัญชีสั่งจ่าย</div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiUploads}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiTitle}>ไฟล์เอกสารแนบ</span>
                        <div className={styles.kpiIconWrapper} style={{ color: "#4f46e5", background: "#eef2ff" }}><PaperClipIcon width={18} height={18} /></div>
                    </div>
                    <div className={styles.kpiValue}>{totals.uploads.toLocaleString()}</div>
                    <div className={styles.kpiSub}>เอกสารในระบบจัดเก็บ</div>
                </div>
            </div>

            {/* ── MAIN CONTENT TABS & TABLES ── */}
            <div className={styles.mainCard}>
                {/* Tabs Navigation */}
                <div className={styles.tabsBar}>
                    <button
                        className={`${styles.tabItem} ${activeTab === "daily" ? styles.tabItemActive : ""}`}
                        onClick={() => { setActiveTab("daily"); setSearchQuery(""); }}
                    >
                        <ChartBarIcon width={16} height={16} />
                        สรุปรายวัน
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === "leaves" ? styles.tabItemActive : ""}`}
                        onClick={() => { setActiveTab("leaves"); setSearchQuery(""); }}
                    >
                        <SunIcon width={16} height={16} />
                        การลางาน
                        <span className={styles.tabBadge}>{totals.leaves}</span>
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === "ot" ? styles.tabItemActive : ""}`}
                        onClick={() => { setActiveTab("ot"); setSearchQuery(""); }}
                    >
                        <ClockIcon width={16} height={16} />
                        ขอทำ OT
                        <span className={styles.tabBadge}>{totals.ot}</span>
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === "travel" ? styles.tabItemActive : ""}`}
                        onClick={() => { setActiveTab("travel"); setSearchQuery(""); }}
                    >
                        <TruckIcon width={16} height={16} />
                        ค่าเดินทาง
                        <span className={styles.tabBadge}>{totals.travel}</span>
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === "clothing" ? styles.tabItemActive : ""}`}
                        onClick={() => { setActiveTab("clothing"); setSearchQuery(""); }}
                    >
                        <ArchiveBoxIcon width={16} height={16} />
                        ยูนิฟอร์ม
                        <span className={styles.tabBadge}>{totals.clothing}</span>
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === "assets" ? styles.tabItemActive : ""}`}
                        onClick={() => { setActiveTab("assets"); setSearchQuery(""); }}
                    >
                        <CubeIcon width={16} height={16} />
                        ยืมทรัพย์สิน
                        <span className={styles.tabBadge}>{totals.assets}</span>
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === "payments" ? styles.tabItemActive : ""}`}
                        onClick={() => { setActiveTab("payments"); setSearchQuery(""); }}
                    >
                        <BanknotesIcon width={16} height={16} />
                        งานสั่งจ่าย
                        <span className={styles.tabBadge}>{totals.payments}</span>
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === "uploads" ? styles.tabItemActive : ""}`}
                        onClick={() => { setActiveTab("uploads"); setSearchQuery(""); }}
                    >
                        <PaperClipIcon width={16} height={16} />
                        ไฟล์แนบ
                        <span className={styles.tabBadge}>{totals.uploads}</span>
                    </button>
                </div>

                {/* Tab Content */}
                <div className={styles.tabContent}>
                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.spinner}></div>
                            <p>กำลังประมวลผลข้อมูลรายงาน...</p>
                        </div>
                    ) : (
                        <>
                            {/* Toolbar for sub-tabs (except daily) */}
                            {activeTab !== "daily" && (
                                <div className={styles.tableToolbar}>
                                    <div className={styles.searchBox}>
                                        <MagnifyingGlassIcon className={styles.searchIcon} />
                                        <input
                                            type="text"
                                            className={styles.searchInput}
                                            placeholder="ค้นหาชื่อพนักงาน, รหัส, สถานะ..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <span className={styles.recordCount}>
                                        แสดงผล {
                                            activeTab === "leaves" ? leavesList.length :
                                            activeTab === "ot" ? otList.length :
                                            activeTab === "travel" ? travelList.length :
                                            activeTab === "clothing" ? clothingList.length :
                                            activeTab === "assets" ? assetList.length :
                                            activeTab === "payments" ? paymentList.length : uploadsList.length
                                        } รายการ
                                    </span>
                                </div>
                            )}

                            {/* 1. Daily Breakdown Tab */}
                            {activeTab === "daily" && (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>วันที่</th>
                                                <th style={{ textAlign: "right" }}>ลางาน</th>
                                                <th style={{ textAlign: "right" }}>ขอ OT</th>
                                                <th style={{ textAlign: "right" }}>ค่าเดินทาง</th>
                                                <th style={{ textAlign: "right" }}>ยูนิฟอร์ม</th>
                                                <th style={{ textAlign: "right" }}>ยืมทรัพย์สิน</th>
                                                <th style={{ textAlign: "right" }}>สั่งจ่าย</th>
                                                <th style={{ textAlign: "right" }}>ไฟล์แนบ</th>
                                                <th style={{ textAlign: "right", background: "#e2e8f0" }}>รวมทั้งหมด</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData?.summaryByDate?.length > 0 ? (
                                                reportData.summaryByDate.map((row: any) => {
                                                    const rowSum = (row.leaves || 0) + (row.ot || 0) + (row.travel || 0) + (row.clothing || 0) + (row.assets || 0) + (row.payments || 0) + (row.uploads || 0);
                                                    return (
                                                        <tr key={row.date}>
                                                            <td style={{ fontWeight: 600 }}>{toBkkDate(row.date)}</td>
                                                            <td style={{ textAlign: "right" }}>{row.leaves}</td>
                                                            <td style={{ textAlign: "right" }}>{row.ot}</td>
                                                            <td style={{ textAlign: "right" }}>{row.travel}</td>
                                                            <td style={{ textAlign: "right" }}>{row.clothing}</td>
                                                            <td style={{ textAlign: "right" }}>{row.assets}</td>
                                                            <td style={{ textAlign: "right" }}>{row.payments}</td>
                                                            <td style={{ textAlign: "right" }}>{row.uploads}</td>
                                                            <td style={{ textAlign: "right", fontWeight: 700, background: "#f8fafc" }}>
                                                                {rowSum}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                        ไม่พบข้อมูลในช่วงวันที่เลือก
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 2. Leaves Tab */}
                            {activeTab === "leaves" && (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>วันที่ยื่นคำขอ</th>
                                                <th>รหัส</th>
                                                <th>ชื่อพนักงาน</th>
                                                <th>ประเภทการลา</th>
                                                <th>ช่วงเวลาที่ลา</th>
                                                <th>ระยะเวลา</th>
                                                <th>เหตุผล</th>
                                                <th>สถานะ</th>
                                                <th>เอกสารแนบ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leavesList.length > 0 ? (
                                                leavesList.map((lv: any) => (
                                                    <tr key={lv.id}>
                                                        <td>{toBkkDateTime(lv.timestamp)}</td>
                                                        <td><strong>{lv.emp_id}</strong></td>
                                                        <td>{lv.name}</td>
                                                        <td><span style={{ fontWeight: 600 }}>{lv.leave_type}</span></td>
                                                        <td>
                                                            <div style={{ fontSize: 12 }}>
                                                                {toBkkDateTime(lv.start_at)}
                                                                <br />
                                                                ถึง {toBkkDateTime(lv.end_at)}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {lv.days > 0 ? `${lv.days} วัน ` : ""}
                                                            {lv.minutes > 0 ? `${Math.floor(lv.minutes / 60)} ชม. ${lv.minutes % 60} นาที` : ""}
                                                        </td>
                                                        <td style={{ maxWidth: 200, whiteSpace: "normal" }}>{lv.reason || "-"}</td>
                                                        <td>{renderBadge(lv.status)}</td>
                                                        <td>
                                                            {lv.attachment_url ? (
                                                                <a
                                                                    href={lv.attachment_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className={styles.linkBtn}
                                                                >
                                                                    <ArrowTopRightOnSquareIcon width={14} height={14} />
                                                                    เปิดดูไฟล์
                                                                </a>
                                                            ) : (
                                                                <span style={{ color: "#94a3b8" }}>-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                        ไม่พบคำขอลางานในช่วงเวลานี้
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 3. OT Tab */}
                            {activeTab === "ot" && (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>วันที่ยื่นคำขอ</th>
                                                <th>วันที่ทำ OT</th>
                                                <th>รหัส</th>
                                                <th>ชื่อพนักงาน</th>
                                                <th>ช่วงเวลา OT</th>
                                                <th>รวม ชม.</th>
                                                <th>รายละเอียดงาน</th>
                                                <th>สถานะ</th>
                                                <th>รูปหลักฐาน</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {otList.length > 0 ? (
                                                otList.map((ot: any) => (
                                                    <tr key={ot.id}>
                                                        <td>{toBkkDateTime(ot.created_at)}</td>
                                                        <td><strong>{toBkkDate(ot.date_for)}</strong></td>
                                                        <td>{ot.emp_id}</td>
                                                        <td>{ot.employee?.name || "-"}</td>
                                                        <td>
                                                            <div style={{ fontSize: 12 }}>
                                                                {toBkkTime(ot.start_time)} - {toBkkTime(ot.end_time)}
                                                            </div>
                                                        </td>
                                                        <td><strong>{Number(ot.total_hours || 0)} ชม.</strong></td>
                                                        <td style={{ maxWidth: 200, whiteSpace: "normal" }}>{ot.reason || "-"}</td>
                                                        <td>{renderBadge(ot.status)}</td>
                                                        <td>
                                                            {ot.proof_url ? (
                                                                <a
                                                                    href={ot.proof_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className={styles.linkBtn}
                                                                >
                                                                    <ArrowTopRightOnSquareIcon width={14} height={14} />
                                                                    หลักฐาน
                                                                </a>
                                                            ) : (
                                                                <span style={{ color: "#94a3b8" }}>-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                        ไม่พบคำขอ OT ในช่วงเวลานี้
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 4. Travel Tab */}
                            {activeTab === "travel" && (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>วันที่ยื่นคำขอ</th>
                                                <th>วันที่เดินทาง</th>
                                                <th>รหัส</th>
                                                <th>ชื่อพนักงาน</th>
                                                <th>สถานที่ / ไซต์งาน</th>
                                                <th>ประเภท</th>
                                                <th>ค้างคืน</th>
                                                <th>ค่าที่พัก</th>
                                                <th>สถานะ</th>
                                                <th>เอกสารแนบ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {travelList.length > 0 ? (
                                                travelList.map((tc: any) => (
                                                    <tr key={tc.id}>
                                                        <td>{toBkkDateTime(tc.created_at)}</td>
                                                        <td><strong>{toBkkDate(tc.date)}</strong></td>
                                                        <td>{tc.emp_id}</td>
                                                        <td>{tc.employee?.name || "-"}</td>
                                                        <td>{tc.site_name}</td>
                                                        <td>{tc.claim_type}</td>
                                                        <td>{tc.is_overnight ? "ใช่" : "ไม่ใช่"}</td>
                                                        <td>{tc.accommodation_amount ? `฿${Number(tc.accommodation_amount).toLocaleString()}` : "-"}</td>
                                                        <td>{renderBadge(tc.status)}</td>
                                                        <td>
                                                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                                {tc.report_url && (
                                                                    <a href={tc.report_url} target="_blank" rel="noreferrer" className={styles.linkBtn}>
                                                                        รายงาน
                                                                    </a>
                                                                )}
                                                                {tc.accommodation_receipt_url && (
                                                                    <a href={tc.accommodation_receipt_url} target="_blank" rel="noreferrer" className={styles.linkBtn}>
                                                                        ใบเสร็จ
                                                                    </a>
                                                                )}
                                                                {!tc.report_url && !tc.accommodation_receipt_url && "-"}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={10} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                        ไม่พบคำขอเบิกค่าเดินทางในช่วงเวลานี้
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 5. Clothing Tab */}
                            {activeTab === "clothing" && (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>วันที่ยื่นคำขอ</th>
                                                <th>รหัส</th>
                                                <th>ชื่อพนักงาน</th>
                                                <th>รายการสินค้า</th>
                                                <th>ไซส์</th>
                                                <th>จำนวน</th>
                                                <th>เหตุผล</th>
                                                <th>สถานะ</th>
                                                <th>โน้ตแอดมิน</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clothingList.length > 0 ? (
                                                clothingList.map((cr: any) => (
                                                    <tr key={cr.id}>
                                                        <td>{toBkkDateTime(cr.requested_at)}</td>
                                                        <td>{cr.emp_id}</td>
                                                        <td>{cr.employee?.name || "-"}</td>
                                                        <td><strong>{cr.variant?.item?.name || `Variant #${cr.variant_id}`}</strong></td>
                                                        <td>{cr.variant?.size || "-"}</td>
                                                        <td>{cr.quantity} ชิ้น</td>
                                                        <td>{cr.reason || "-"}</td>
                                                        <td>{renderBadge(cr.status)}</td>
                                                        <td>{cr.admin_note || "-"}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                        ไม่พบคำขอเบิกชุดยูนิฟอร์มในช่วงเวลานี้
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 6. Assets Tab */}
                            {activeTab === "assets" && (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>วันที่ยื่นคำขอ</th>
                                                <th>รหัส</th>
                                                <th>ชื่อพนักงาน</th>
                                                <th>รหัสทรัพย์สิน</th>
                                                <th>ชื่อทรัพย์สิน</th>
                                                <th>วันที่เริ่มยืม</th>
                                                <th>กำหนดคืน</th>
                                                <th>สถานที่</th>
                                                <th>สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {assetList.length > 0 ? (
                                                assetList.map((ab: any) => (
                                                    <tr key={ab.id}>
                                                        <td>{toBkkDateTime(ab.created_at)}</td>
                                                        <td>{ab.emp_id}</td>
                                                        <td>{ab.employee?.name || "-"}</td>
                                                        <td><strong>{ab.assets?.asset_id || "-"}</strong></td>
                                                        <td>{ab.assets?.name || `Asset #${ab.asset_id}`}</td>
                                                        <td>{toBkkDateTime(ab.borrow_date)}</td>
                                                        <td>{toBkkDateTime(ab.expected_return_date)}</td>
                                                        <td>{ab.location || "-"}</td>
                                                        <td>{renderBadge(ab.status)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                        ไม่พบคำขอยืมทรัพย์สินในช่วงเวลานี้
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 7. Payments Tab */}
                            {activeTab === "payments" && (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>วันที่สร้างรายการ</th>
                                                <th>รหัสงาน/โครงการ</th>
                                                <th>ลูกค้า</th>
                                                <th>งวดที่</th>
                                                <th>ยอดเงิน</th>
                                                <th>เลขที่ใบแจ้งหนี้</th>
                                                <th>สถานะ</th>
                                                <th>หมายเหตุ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paymentList.length > 0 ? (
                                                paymentList.map((pt: any) => (
                                                    <tr key={pt.id}>
                                                        <td>{toBkkDateTime(pt.createdAt)}</td>
                                                        <td><strong>{pt.jobs?.jobNumber || pt.jobId}</strong></td>
                                                        <td>{pt.jobs?.customerName || "-"}</td>
                                                        <td>{pt.installmentNo ? `${pt.installmentNo}/${pt.installmentTotal || "-"}` : "-"}</td>
                                                        <td>
                                                            {pt.installmentAmount ? (
                                                                <strong style={{ color: "#059669" }}>
                                                                    ฿{Number(pt.installmentAmount).toLocaleString()}
                                                                </strong>
                                                            ) : "-"}
                                                        </td>
                                                        <td>{pt.invoiceNumber || "-"}</td>
                                                        <td>{renderBadge(pt.status)}</td>
                                                        <td>{pt.note || "-"}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                        ไม่พบงานสั่งจ่ายในช่วงเวลานี้
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 8. Uploads Tab */}
                            {activeTab === "uploads" && (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>วันที่จัดเก็บ</th>
                                                <th>ชื่อไฟล์</th>
                                                <th>หมวดหมู่เอกสาร</th>
                                                <th>ขนาด</th>
                                                <th>ลิงก์ไฟล์</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uploadsList.length > 0 ? (
                                                uploadsList.map((f: any, idx: number) => (
                                                    <tr key={`${f.date}-${f.name}-${idx}`}>
                                                        <td>{toBkkDate(f.date)}</td>
                                                        <td style={{ wordBreak: "break-all" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                                <DocumentTextIcon width={16} height={16} color="#64748b" />
                                                                <span>{f.name}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className={styles.badge} style={{ background: "#f1f5f9", color: "#334155" }}>
                                                                {f.type}
                                                            </span>
                                                        </td>
                                                        <td>{f.size ? `${(f.size / 1024).toFixed(1)} KB` : "-"}</td>
                                                        <td>
                                                            <a
                                                                href={f.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className={styles.linkBtn}
                                                            >
                                                                <ArrowTopRightOnSquareIcon width={14} height={14} />
                                                                ดาวน์โหลด / เปิดดู
                                                            </a>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                                                        ไม่พบเอกสารแนบที่อัปโหลดในช่วงเวลานี้
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
