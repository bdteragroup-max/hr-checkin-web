"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import { 
    PlusIcon, 
    ArrowPathRoundedSquareIcon, 
    TrashIcon, 
    PencilSquareIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ClockIcon,
    UserIcon,
    ClipboardDocumentListIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
    ArrowPathIcon,
    ChevronLeftIcon,
    CalendarIcon,
    CheckIcon,
    MapPinIcon,
    InboxStackIcon,
    HandThumbUpIcon,
    ChartBarIcon,
    ArrowDownTrayIcon
} from "@heroicons/react/24/outline";
import AlertModal, { AlertState } from "@/components/AlertModal";
import AdminBorrowModal from "@/components/AdminBorrowModal";

type Asset = {
    id: number;
    asset_id: string;
    name: string;
    category: string | null;
    company_name?: string | null;
    status: "available" | "borrowed" | "maintenance" | "damaged";
    stock: number;
    borrowed_count: number;
    asset_borrowings: Array<{
        id: number;
        emp_id: string;
        employee: { name: string, nickname?: string };
        borrow_date: string;
        expected_return_date: string;
        status: string;
        quantity: number;
    }>;
};

export default function AdminAssetsPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>กำลังโหลด...</div>}>
            <AdminAssetsPageInner />
        </Suspense>
    );
}

function AdminAssetsPageInner() {
    const searchParams = useSearchParams();
    const type = searchParams.get("type") || "item";
    const isEquipment = type === "equipment";

    const queryClient = useQueryClient();
    const { data: assets = [], isLoading: loading } = useQuery<Asset[]>({
        queryKey: ['admin-assets', type],
        queryFn: async () => {
            const url = isEquipment 
                ? "/api/admin/assets?category_exclude=Car"
                : "/api/admin/products";
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            
            return data.map((p: any) => {
                const borrowings = p.product_borrowings || p.asset_borrowings || [];
                const activeBorrowings = borrowings.filter((b: any) => b.status === "borrowed" || b.status === "reserved");
                let borrowedCount = activeBorrowings.reduce((sum: number, b: any) => sum + (b.quantity || 1), 0);
                
                // For equipment, if status says borrowed but no records found, force it to 1 for display
                if (isEquipment && p.status === "borrowed" && borrowedCount === 0) {
                    borrowedCount = 1;
                }

                const stock = isEquipment ? 1 : (p.stock || 0);

                return {
                    id: p.id,
                    asset_id: p.product_code || p.asset_id,
                    name: p.product_name || p.name,
                    category: p.category,
                    company_name: p.company_name || p.company_owner,
                    status: p.status,
                    stock: stock,
                    borrowed_count: borrowedCount,
                    asset_borrowings: borrowings
                };
            });
        }
    });
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    
    // Deletion Modal state
    const [pendingDelete, setPendingDelete] = useState<{ id: number, name: string } | null>(null);

    // Return Modal State
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [returnData, setReturnData] = useState({
        actual_return_date: new Date().toISOString().split("T")[0],
        condition_at_return: "",
        is_damaged: false
    });

    const [showBorrowModal, setShowBorrowModal] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Asset Form Modal State
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [assetForm, setAssetForm] = useState({
        id: undefined as number | undefined,
        asset_id: "",
        name: "",
        avg_category: "", // internal placeholder
        category: "",
        description: "",
        stock: 50,
        status: "available"
    });
    const [assetSaving, setAssetSaving] = useState(false);

    // Report States
    const [viewMode, setViewMode] = useState<"list" | "dashboard">("dashboard");
    const [reportData, setReportData] = useState<any>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportStart, setReportStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [reportEnd, setReportEnd] = useState(() => new Date().toISOString().split('T')[0]);

    async function loadReport() {
        setReportLoading(true);
        try {
            const params = new URLSearchParams({ 
                start: reportStart, 
                end: reportEnd,
                type: type // item or equipment
            });
            const res = await fetch(`/api/admin/reports/products?${params.toString()}`);
            const json = await res.json();
            if (json.ok) {
                setReportData(json.stats);
            }
        } catch (e) {
            console.error("Load report failed", e);
        } finally {
            setReportLoading(false);
        }
    }

    useEffect(() => {
        if (viewMode === "dashboard") {
            loadReport();
        }
    }, [viewMode]);

    // Filtering State
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [assetHistory, setAssetHistory] = useState<any[]>([]);



    function openAddModal() {
        setIsEditing(false);
        setAssetForm({ id: undefined, asset_id: "", name: "", avg_category: "", category: "", description: "", stock: 0, status: "available" });
        setShowAssetModal(true);
    }

    function openEditModal(asset: Asset) {
        setIsEditing(true);
        setAssetForm({ 
            id: asset.id, 
            asset_id: asset.asset_id, 
            name: asset.name, 
            category: asset.category || "", 
            avg_category: asset.company_name || "",
            description: "", 
            stock: asset.stock,
            status: asset.status 
        });
        setShowAssetModal(true);
    }

    async function handleAssetSubmit(e: React.FormEvent) {
        e.preventDefault();
        setAssetSaving(true);
        try {
            const url = isEquipment 
                ? (isEditing ? `/api/admin/assets/${assetForm.id}` : "/api/admin/assets")
                : (isEditing ? `/api/admin/products/${assetForm.id}` : "/api/admin/products");
            const method = isEditing ? "PATCH" : "POST";

            const body: any = isEquipment ? {
                asset_id: assetForm.asset_id,
                name: assetForm.name,
                category: assetForm.category,
                description: assetForm.description,
                status: assetForm.status
            } : {
                product_code: assetForm.asset_id,
                product_name: assetForm.name,
                category: assetForm.category,
                company_name: assetForm.avg_category,
                description: assetForm.description,
                stock: assetForm.stock,
                status: assetForm.status
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: `บันทึกข้อมูล ${assetForm.name} เรียบร้อยแล้ว`, type: "ok" });
                setShowAssetModal(false);
                queryClient.invalidateQueries({ queryKey: ['admin-assets'] });
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        } finally {
            setAssetSaving(false);
        }
    }

    async function handleDelete(id: number, name: string) {
        setPendingDelete({ id, name });
        setAlert({ 
            visible: true, 
            message: `คุณแน่ใจหรือไม่ที่จะลบ${isEquipment ? 'อุปกรณ์' : 'สินค้า'} "${name}"?`, 
            type: "error" 
        });
    }

    async function confirmDelete() {
        if (!pendingDelete) return;
        const { id } = pendingDelete;
        setPendingDelete(null);

        try {
            const url = isEquipment ? `/api/admin/assets/${id}` : `/api/admin/products/${id}`;
            const res = await fetch(url, { method: "DELETE" });
            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "ลบข้อมูลเรียบร้อยแล้ว", type: "ok" });
                queryClient.invalidateQueries({ queryKey: ['admin-assets'] });
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        }
    }

    function openReturnModal(asset: Asset) {
        setSelectedAsset(asset);
        setShowReturnModal(true);
    }

    async function handleReturn() {
        if (!selectedAsset) return;

        const currentBorrow = selectedAsset.asset_borrowings.find(b => b.status === "borrowed" || b.status === "reserved");

        setProcessing(true);
        try {
            const bodyPayload: any = {
                ...returnData
            };

            if (currentBorrow) {
                bodyPayload.borrowing_id = currentBorrow.id;
            } else {
                bodyPayload.force_reset = true;
                bodyPayload.asset_id = selectedAsset.id;
            }

            const url = isEquipment ? "/api/admin/assets/return" : "/api/products/return";
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyPayload)
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: `รับคืน${isEquipment ? 'อุปกรณ์' : 'สินค้า'}เรียบร้อยแล้ว`, type: "ok" });
                setShowReturnModal(false);
                queryClient.invalidateQueries({ queryKey: ['admin-assets'] });
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        } finally {
            setProcessing(false);
        }
    }

    async function openHistoryModal(asset: Asset) {
        setSelectedAsset(asset);
        setShowHistoryModal(true);
        setHistoryLoading(true);
        try {
            const url = isEquipment 
                ? `/api/admin/assets/${asset.id}/history`
                : `/api/products/history?id=${asset.id}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.ok) {
                setAssetHistory(data.history);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    }

    function parsePhotoData(photoUrl: string | undefined): string[] {
        if (!photoUrl) return [];
        try {
            if (photoUrl.startsWith("{") || photoUrl.startsWith("[")) {
                const parsed = JSON.parse(photoUrl);
                if (typeof parsed === 'object' && parsed !== null) {
                    return Object.values(parsed).filter(val => typeof val === 'string' && !!val) as string[];
                }
            }
        } catch (e) {
            console.error("JSON parse error for photo_url:", e);
        }
        return [photoUrl];
    }

    function renderReport() {
        if (!reportData) return <div className={styles.loading}>กำลังโหลดข้อมูลรายงาน...</div>;
        const { statusDistribution, topProducts, topEmployees, borrowingsPerDay, recentBorrowings } = reportData;
        const maxDayCount = Math.max(...borrowingsPerDay.map((d: any) => d.count), 1);

        return (
            <div className={styles.reportContainer}>
                {/* Filter Bar */}
                <div className={styles.filterBar}>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>ตั้งแต่วันที่</label>
                        <input 
                            type="date" 
                            className={styles.dateInput} 
                            value={reportStart} 
                            onChange={(e) => setReportStart(e.target.value)} 
                        />
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>ถึงวันที่</label>
                        <input 
                            type="date" 
                            className={styles.dateInput} 
                            value={reportEnd} 
                            onChange={(e) => setReportEnd(e.target.value)} 
                        />
                    </div>
                    <button className={styles.actionBtn} onClick={loadReport} disabled={reportLoading}>
                        {reportLoading ? "กำลังโหลด..." : "ค้นหาข้อมูล"}
                    </button>
                    <div style={{ flex: 1 }}></div>
                    <button className={styles.exportBtn} onClick={() => window.print()} style={{ 
                        background: "#f1f5f9", 
                        border: "1px solid #e2e8f0", 
                        padding: "8px 16px", 
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer"
                    }}>
                        <ArrowDownTrayIcon width={16} /> พิมพ์รายงาน
                    </button>
                </div>

                {/* Status Grid */}
                <div className={styles.statsGrid} style={{ marginBottom: 32 }}>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>พร้อมใช้งาน (รวม)</span>
                        <div className={styles.statValue} style={{ color: "#16a34a" }}>{statusDistribution.available}</div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>กำลังถูกยืม (รวม)</span>
                        <div className={styles.statValue} style={{ color: "#ea580c" }}>{statusDistribution.borrowed}</div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>ชำรุด/ซ่อม (หมวดหมู่)</span>
                        <div className={styles.statValue} style={{ color: "#dc2626" }}>{statusDistribution.damaged + statusDistribution.maintenance}</div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>จำนวนสต็อกทั้งหมด</span>
                        <div className={styles.statValue}>{statusDistribution.total}</div>
                    </div>
                </div>

                {/* 30-Day Activity Chart */}
                <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>
                        <ChartBarIcon width={20} /> ความถี่การเบิก{isEquipment ? "อุปกรณ์" : "สินค้า"}รายวัน
                    </div>
                    <div className={styles.chartBarWrapper}>
                        {borrowingsPerDay.length === 0 ? (
                            <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8' }}>ไม่มีข้อมูลการใช้งาน</div>
                        ) : (
                            borrowingsPerDay.map((d: any, idx: number) => (
                                <div 
                                    key={idx} 
                                    className={styles.chartBar} 
                                    style={{ height: `${(d.count / maxDayCount) * 100}%` }}
                                    data-value={`${d.date}: ${d.count} ชิ้น`}
                                />
                            ))
                        )}
                    </div>
                </div>

                <div className={styles.grid2Col}>
                    {/* Top Products Table */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}><InboxStackIcon width={18} style={{ display: "inline", marginRight: 8 }} /> {isEquipment ? "อุปกรณ์" : "สินค้า"}ที่ใช้บ่อยที่สุด</div>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.miniTable}>
                                <thead>
                                    <tr>
                                        <th>{isEquipment ? "ชื่ออุปกรณ์" : "ชื่อสินค้า"}</th>
                                        <th style={{ textAlign: "right" }}>จำนวน (ชิ้น)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topProducts.map((p: any, idx: number) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                                            <td style={{ textAlign: "right", fontWeight: 700 }}>{p.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Top Employees Table */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}><UserIcon width={18} style={{ display: "inline", marginRight: 8 }} /> พนักงานที่เบิกบ่อยที่สุด</div>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.miniTable}>
                                <thead>
                                    <tr>
                                        <th>ชื่อพนักงาน</th>
                                        <th style={{ textAlign: "right" }}>จำนวน (ชิ้น)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topEmployees.map((e: any, idx: number) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{e.name}</td>
                                            <td style={{ textAlign: "right", fontWeight: 700 }}>{e.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Recent Log */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}><ClockIcon width={18} style={{ display: "inline", marginRight: 8 }} /> ประวัติการเบิก{isEquipment ? "อุปกรณ์" : "สินค้า"}ล่าสุด</div>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.miniTable}>
                            <thead>
                                <tr>
                                    <th>วันที่</th>
                                    <th>พนักงาน</th>
                                    <th>{isEquipment ? "อุปกรณ์" : "สินค้า"}</th>
                                    <th>จำนวน</th>
                                    <th>สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentBorrowings.map((b: any, idx: number) => (
                                    <tr key={idx}>
                                        <td>{new Date(b.borrow_date).toLocaleDateString('th-TH')}</td>
                                        <td style={{ fontWeight: 600 }}>{b.employee.name}</td>
                                        <td>{b.product?.product_name || b.assets?.name}</td>
                                        <td>{b.quantity || 1} ชิ้น</td>
                                        <td>
                                            <span className={`${styles.badge} ${styles[b.status] || styles.borrowed}`}>
                                                {b.status === "borrowed" ? "กำลังยืม" : b.status === "returned" ? "คืนแล้ว" : "รอดำเนินการ"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <AlertModal 
                alert={alert} 
                onClose={() => {
                    setAlert({ ...alert, visible: false });
                    setPendingDelete(null);
                }} 
                onConfirm={pendingDelete ? confirmDelete : undefined}
                confirmText={pendingDelete ? "ยืนยันการลบ" : "ตกลง"}
                cancelText="ยกเลิก"
            />
            
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>{isEquipment ? "ระบบจัดการอุปกรณ์" : "ระบบจัดการสินค้า"}</h1>
                    <p className={styles.subtitle}>จัดการข้อมูลและติดตามสถานะการยืม-คืน{isEquipment ? "อุปกรณ์" : "สินค้า"}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {viewMode === "list" && (
                        <div className={styles.searchWrapper} style={{ minWidth: 300 }}>
                            <MagnifyingGlassIcon width={18} className={styles.searchIcon} />
                            <input 
                                type="text" 
                                className={styles.searchInput}
                                placeholder={`ค้นหาชื่อ${isEquipment ? 'อุปกรณ์' : 'สินค้า'}...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    )}
                    <button className={styles.addBtn} onClick={() => openAddModal()}>
                        <PlusIcon width={20} /> เพิ่ม{isEquipment ? 'อุปกรณ์' : 'สินค้า'}ใหม่
                    </button>
                </div>
            </div>

            <div className={styles.viewToggle} style={{ marginBottom: 24 }}>
                <button 
                    className={`${styles.toggleBtn} ${viewMode === "list" ? styles.active : ""}`}
                    onClick={() => setViewMode("list")}
                >
                    <ClipboardDocumentListIcon width={18} style={{ display: "inline", marginRight: 6, verticalAlign: "text-bottom" }} />
                    จัดการรายการ{isEquipment ? 'อุปกรณ์' : 'สินค้า'}
                </button>
                <button 
                    className={`${styles.toggleBtn} ${viewMode === "dashboard" ? styles.active : ""}`}
                    onClick={() => setViewMode("dashboard")}
                >
                    <ChartBarIcon width={18} style={{ display: "inline", marginRight: 6, verticalAlign: "text-bottom" }} />
                    Dashboard & รายงาน
                </button>
            </div>

            {viewMode === "dashboard" ? (
                renderReport()
            ) : (
                <>

                <div className={styles.statsBar}>
                    <div 
                        className={`${styles.statCard} ${filterStatus === "all" ? styles.active : ""}`}
                        onClick={() => setFilterStatus("all")}
                    >
                        <span className={styles.statLabel}>ทั้งหมด</span>
                        <span className={styles.statVal}>{assets.length}</span>
                    </div>
                    <div 
                        className={`${styles.statCard} ${filterStatus === "available" ? styles.active : ""}`}
                        onClick={() => setFilterStatus("available")}
                    >
                        <span className={styles.statLabel}>พร้อมใช้งาน</span>
                        <span className={styles.statVal} style={{ color: "#16a34a" }}>
                            {assets.filter(a => {
                                const currentBorrow = a.asset_borrowings.find(b => b.status === "borrowed" || b.status === "reserved");
                                return !currentBorrow && a.status === "available";
                            }).length}
                        </span>
                    </div>
                    <div 
                        className={`${styles.statCard} ${filterStatus === "borrowed" ? styles.active : ""}`}
                        onClick={() => setFilterStatus("borrowed")}
                    >
                        <span className={styles.statLabel}>กำลังถูกยืม</span>
                        <span className={styles.statVal} style={{ color: "#2563eb" }}>
                            {assets.filter(a => {
                                const currentBorrow = a.asset_borrowings.find(b => b.status === "borrowed" || b.status === "reserved");
                                return !!currentBorrow || a.status === "borrowed";
                            }).length}
                        </span>
                    </div>
                    <div 
                        className={`${styles.statCard} ${filterStatus === "maintenance" ? styles.active : ""}`}
                        onClick={() => setFilterStatus("maintenance")}
                    >
                        <span className={styles.statLabel}>ซ่อมบำรุง</span>
                        <span className={styles.statVal} style={{ color: "#ea580c" }}>
                            {assets.filter(a => a.status === "maintenance").length}
                        </span>
                    </div>
                    <div 
                        className={`${styles.statCard} ${filterStatus === "damaged" ? styles.active : ""}`}
                        onClick={() => setFilterStatus("damaged")}
                    >
                        <span className={styles.statLabel}>ชำรุด</span>
                        <span className={styles.statVal} style={{ color: "#dc2626" }}>
                            {assets.filter(a => a.status === "damaged").length}
                        </span>
                    </div>
                </div>

            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>{isEquipment ? "อุปกรณ์" : "สินค้า"}</th>
                            <th>สถานะ</th>
                            <th>สต็อก (พร้อม/ทั้งหมด)</th>
                            <th>ผู้ยืมปัจจุบัน</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className={styles.loading}>กำลังโหลด...</td></tr>
                        ) : (() => {
                            const filtered = assets.filter(asset => {
                                const matchesSearch = 
                                    asset.asset_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    asset.name.toLowerCase().includes(searchQuery.toLowerCase());
                                
                                const currentBorrow = asset.asset_borrowings.find(b => b.status === "borrowed");
                                const effectiveStatus = currentBorrow ? "borrowed" : asset.status;
                                
                                const matchesStatus = filterStatus === "all" || effectiveStatus === filterStatus;
                                return matchesSearch && matchesStatus;
                            });

                            if (filtered.length === 0) {
                                return <tr><td colSpan={5} className={styles.loading}>ไม่พบข้อมูล{isEquipment ? "อุปกรณ์" : "สินค้า"}</td></tr>;
                            }

                            return filtered.map(asset => {
                                const currentBorrow = asset.asset_borrowings.find(b => b.status === "borrowed");
                                const effectiveStatus = currentBorrow ? "borrowed" : asset.status;
                                return (
                                    <tr key={asset.id}>
                                        <td>
                                            <div className={styles.assetName}>{asset.name}</div>
                                            <div className={styles.assetId}>
                                                {asset.asset_id} • {asset.category}
                                                {!isEquipment && asset.company_name && ` • ${asset.company_name}`}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[effectiveStatus]}`}>
                                                {effectiveStatus === "available" ? "พร้อมใช้งาน" : 
                                                 effectiveStatus === "borrowed" ? "ถูกยืม" : 
                                                 effectiveStatus === "damaged" ? "ชำรุด" : "ซ่อมบำรุง"}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ 
                                                    flex: 1, 
                                                    height: 6, 
                                                    background: "#f1f5f9", 
                                                    borderRadius: 3, 
                                                    overflow: "hidden",
                                                    minWidth: 60
                                                }}>
                                                    <div style={{ 
                                                        width: `${(asset.stock - asset.borrowed_count) / asset.stock * 100}%`, 
                                                        height: "100%", 
                                                        background: asset.stock - asset.borrowed_count > 0 ? "#16a34a" : "#dc2626" 
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: 12, fontWeight: 700 }}>
                                                    {asset.stock - asset.borrowed_count} / {asset.stock}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {asset.borrowed_count > 0 ? (
                                                <div className={styles.borrowerInfo} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#1e293b", fontSize: "13px" }}>
                                                        <UserIcon width={14} />
                                                        {asset.asset_borrowings.find(b => b.status === "borrowed" || b.status === "reserved")?.employee?.name || "ไม่ระบุชื่อ"}
                                                    </div>
                                                    {asset.asset_borrowings.filter(b => b.status === "borrowed" || b.status === "reserved").map((b, i) => (
                                                        <div key={i} style={{ fontSize: "11px", color: "#64748b", background: "#f8fafc", padding: "4px 8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                                                            <div><span style={{ fontWeight: 600, color: "#2563eb" }}>ยืม:</span> {new Date(b.borrow_date).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</div>
                                                            <div><span style={{ fontWeight: 600, color: "#dc2626" }}>คืน:</span> {new Date(b.expected_return_date).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : "—"}
                                        </td>
                                        <td>
                                            <div className={styles.actions}>
                                                {effectiveStatus === "borrowed" && (
                                                    <button 
                                                        className={styles.returnBtn}
                                                        onClick={() => openReturnModal(asset)}
                                                    >
                                                        <ArrowPathRoundedSquareIcon width={16} /> รับคืน
                                                    </button>
                                                )}
                                                <button 
                                                    className={styles.historyBtn}
                                                    onClick={() => openHistoryModal(asset)}
                                                    title="ดูประวัติการยืม"
                                                >
                                                    <ClipboardDocumentListIcon width={16} />
                                                </button>
                                                <button 
                                                    className={styles.editBtn}
                                                    onClick={() => openEditModal(asset)}
                                                    title="แก้ไข"
                                                >
                                                    <PencilSquareIcon width={16} />
                                                </button>
                                                {effectiveStatus === "available" && (
                                                    <button 
                                                        className={styles.borrowActionBtn}
                                                        onClick={() => { setSelectedAsset(asset); setShowBorrowModal(true); }}
                                                        title="ทำเรื่องยืม (Admin)"
                                                    >
                                                        <HandThumbUpIcon width={16} /> ยืม
                                                    </button>
                                                )}
                                                {effectiveStatus !== "borrowed" && (
                                                    <button 
                                                        className={styles.deleteBtn}
                                                        onClick={() => handleDelete(asset.id, asset.name)}
                                                        title="ลบ"
                                                    >
                                                        <TrashIcon width={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            });
                        })()}
                    </tbody>
                </table>
            </div>
            </>
            )}

            {/* Asset Add/Edit Modal */}
            {showAssetModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>{isEditing ? `แก้ไขข้อมูล${isEquipment ? 'อุปกรณ์' : 'สินค้า'}` : `เพิ่ม${isEquipment ? 'อุปกรณ์' : 'สินค้า'}ใหม่`}</h2>
                            <p>{isEditing ? `ปรับปรุงรายละเอียดของ${isEquipment ? 'อุปกรณ์' : 'สินค้า'}ในระบบ` : `ลงทะเบียน${isEquipment ? 'อุปกรณ์' : 'สินค้า'}ใหม่เข้าสู่ระบบ`}</p>
                        </div>
                        <form onSubmit={handleAssetSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.inputGroup}>
                                    <label>{isEquipment ? "Asset ID (รหัสอุปกรณ์)" : "Product Code (รหัสสินค้า)"}</label>
                                    <input 
                                        type="text" 
                                        placeholder={isEquipment ? "เช่น NB-001" : "เช่น P-001"}
                                        value={assetForm.asset_id}
                                        onChange={e => setAssetForm({...assetForm, asset_id: e.target.value})}
                                        required
                                        disabled={isEditing}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>{isEquipment ? "ชื่ออุปกรณ์" : "ชื่อสินค้า"}</label>
                                    <input 
                                        type="text" 
                                        placeholder={isEquipment ? "เช่น Laptop" : "เช่น สินค้า A"}
                                        value={assetForm.name}
                                        onChange={e => setAssetForm({...assetForm, name: e.target.value})}
                                        required
                                    />
                                </div>
                                {!isEquipment && (
                                    <div className={styles.inputGroup}>
                                        <label>Company Name (บริษัทเจ้าของ)</label>
                                        <input 
                                            type="text" 
                                            placeholder="ระบุชื่อบริษัท"
                                            value={assetForm.avg_category}
                                            onChange={e => setAssetForm({...assetForm, avg_category: e.target.value})}
                                        />
                                    </div>
                                )}
                                <div className={styles.inputGroup}>
                                    <label>หมวดหมู่</label>
                                    <select 
                                        value={assetForm.category}
                                        onChange={e => setAssetForm({...assetForm, category: e.target.value})}
                                    >
                                        <option value="">เลือกหมวดหมู่...</option>
                                        {isEquipment ? (
                                            <>
                                                <option value="Tool">Tool (เครื่องมือช่าง)</option>
                                                <option value="Machine">Machine (เครื่องจักร)</option>
                                                <option value="Safety">Safety Gear</option>
                                                <option value="Other">Other (อุปกรณ์อื่นๆ)</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="Stationery">Stationery (เครื่องเขียน)</option>
                                                <option value="Consumable">Consumable (วัสดุสิ้นเปลือง)</option>
                                                <option value="Furniture">Furniture (เฟอร์นิเจอร์)</option>
                                                <option value="Marketing">Marketing Material</option>
                                                <option value="Other">Other (อื่นๆ)</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>จำนวนสต็อกทั้งหมด</label>
                                    <input 
                                        type="number" 
                                        placeholder="ระบุจำนวนสต็อก"
                                        value={assetForm.stock}
                                        onChange={e => setAssetForm({...assetForm, stock: Number(e.target.value)})}
                                        required
                                        min={1}
                                    />
                                </div>
                                {isEditing && (
                                    <div className={styles.inputGroup}>
                                        <label>สถานะ</label>
                                        <select 
                                            value={assetForm.status}
                                            onChange={e => setAssetForm({...assetForm, status: e.target.value as any})}
                                        >
                                            <option value="available">พร้อมใช้งาน</option>
                                            <option value="borrowed">ถูกยืม</option>
                                            <option value="maintenance">ซ่อมบำรุง</option>
                                            <option value="damaged">ชำรุด</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className={styles.modalFooter}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setShowAssetModal(false)}>ยกเลิก</button>
                                <button type="submit" className={styles.confirmBtn} disabled={assetSaving}>
                                    {assetSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Return Modal */}
            {showReturnModal && selectedAsset && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>รับคืน{isEquipment ? 'อุปกรณ์' : 'สินค้า'}</h2>
                            <p>{selectedAsset.name} ({selectedAsset.asset_id})</p>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label>วันที่คืนจริง</label>
                                <input 
                                    type="date" 
                                    value={returnData.actual_return_date}
                                    onChange={e => setReturnData({...returnData, actual_return_date: e.target.value})}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>สภาพ{isEquipment ? 'อุปกรณ์' : 'สินค้า'}เมื่อคืน</label>
                                <textarea 
                                    placeholder={isEquipment ? "ระบุความเสียหาย หรือ สภาพหลังการใช้งาน..." : "ระบุสภาพของสินค้า..."}
                                    value={returnData.condition_at_return}
                                    onChange={e => setReturnData({...returnData, condition_at_return: e.target.value})}
                                />
                            </div>
                            <div className={styles.checkboxGroup}>
                                <input 
                                    type="checkbox" 
                                    id="is_damaged"
                                    checked={returnData.is_damaged}
                                    onChange={e => setReturnData({...returnData, is_damaged: e.target.checked})}
                                />
                                <label htmlFor="is_damaged">
                                    <ExclamationTriangleIcon width={18} style={{ color: "#dc2626" }} /> 
                                    {isEquipment ? 'อุปกรณ์' : 'สินค้า'}ชำรุด / เสียหาย
                                </label>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowReturnModal(false)} disabled={processing}>ยกเลิก</button>
                            <button className={styles.confirmBtn} onClick={handleReturn} disabled={processing}>
                                {processing ? "กำลังบันทึก..." : "ยืนยันการรับคืน"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* History Modal */}
            {showHistoryModal && selectedAsset && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.largeModal}`}>
                        <div className={styles.modalHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2>ประวัติการยืม: {selectedAsset.name}</h2>
                                <p>รหัส{isEquipment ? 'ครุภัณฑ์' : 'สินค้า'}: {selectedAsset.asset_id}</p>
                            </div>
                            <button className={styles.editBtn} onClick={() => setShowHistoryModal(false)}>
                                <XMarkIcon width={24} />
                            </button>
                        </div>
                        <div className={styles.modalScroll} style={{ padding: "0 24px" }}>
                            {historyLoading ? (
                                <div className={styles.loading}>กำลังโหลดประวัติ...</div>
                            ) : assetHistory.length === 0 ? (
                                <div className={styles.loading}>ไม่พบประวัติการใช้งาน</div>
                            ) : (
                                assetHistory.map((item) => {
                                    const borrowPhotos = parsePhotoData(item.photo_url_borrow);
                                    const returnPhotos = parsePhotoData(item.photo_url_return);
                                    return (
                                        <div key={item.id} className={styles.historyItem}>
                                            <div className={styles.historyInfo}>
                                                <div className={styles.historyField}>
                                                    <span className={styles.historyLabel}>ผู้ยืม:</span> {item.employee.name}
                                                </div>
                                                {(() => {
                                                    const isReturned = item.status === 'returned' || !!item.actual_return_date;
                                                    const isPendingKey = item.return_status === 'PENDING_KEY';
                                                    const now = new Date();
                                                    const isOverdue = !isReturned && !isPendingKey && item.expected_return_date && now > new Date(item.expected_return_date);
                                                    const isReserved = !isReturned && (item.status === 'reserved' && new Date(item.borrow_date) > now);

                                                    let statusText = 'อยู่ระหว่างการยืม';
                                                    let statusBg = '#dbeafe';
                                                    let statusColor = '#1d4ed8';

                                                    if (isReturned) {
                                                        statusText = 'คืนแล้ว';
                                                        statusBg = '#dcfce7';
                                                        statusColor = '#15803d';
                                                    } else if (isPendingKey) {
                                                        statusText = 'รอคืนกุญแจ';
                                                        statusBg = '#ffedd5';
                                                        statusColor = '#c2410c';
                                                    } else if (isOverdue) {
                                                        statusText = 'ยังไม่คืน (เกินกำหนด)';
                                                        statusBg = '#fee2e2';
                                                        statusColor = '#b91c1c';
                                                    } else if (isReserved) {
                                                        statusText = 'จองล่วงหน้า';
                                                        statusBg = '#fef3c7';
                                                        statusColor = '#92400e';
                                                    }

                                                    return (
                                                        <div className={styles.historyField}>
                                                            <span className={styles.historyLabel}>สถานะ:</span>
                                                            <span style={{
                                                                backgroundColor: statusBg,
                                                                color: statusColor,
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                display: 'inline-block',
                                                                width: 'fit-content'
                                                            }}>
                                                                {statusText}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                                <div className={styles.historyField}>
                                                    <span className={styles.historyLabel}>วันที่ยืม:</span> {new Date(item.borrow_date).toLocaleDateString('th-TH')}
                                                </div>
                                                <div className={styles.historyField}>
                                                    <span className={styles.historyLabel}>วันที่คืน:</span> {item.actual_return_date ? new Date(item.actual_return_date).toLocaleDateString('th-TH') : '-'}
                                                </div>
                                                <div className={styles.historyField} style={{ gridColumn: 'span 2' }}>
                                                    <span className={styles.historyLabel}>หมายเหตุ/สภาพเมื่อยืม:</span> {item.condition_at_borrow || '-'}
                                                </div>
                                                {item.condition_at_return && (
                                                    <div className={styles.historyField} style={{ gridColumn: 'span 2' }}>
                                                        <span className={styles.historyLabel}>สภาพเมื่อคืน:</span> {item.condition_at_return}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {(borrowPhotos.length > 0 || returnPhotos.length > 0) && (
                                                <div style={{ marginTop: 12 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text3)' }}>
                                                        รูปภาพบันทึก (ยืม/คืน)
                                                    </div>
                                                    <div className={styles.historyPhotos}>
                                                        {borrowPhotos.map((url, idx) => (
                                                            <a key={`b-${idx}`} href={url} target="_blank" rel="noreferrer">
                                                                <img src={url} alt="Borrow" className={styles.historyPhoto} title="สภาพเมื่อยืม" />
                                                            </a>
                                                        ))}
                                                        {returnPhotos.map((url, idx) => (
                                                            <a key={`r-${idx}`} href={url} target="_blank" rel="noreferrer">
                                                                <img src={url} alt="Return" className={styles.historyPhoto} style={{ border: '2px solid var(--ok)' }} title="สภาพเมื่อคืน" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className={styles.modalFooter} style={{ padding: "0 32px 32px" }}>
                            <button className={styles.cancelBtn} onClick={() => setShowHistoryModal(false)}>ปิดหน้าย่อย</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Admin Borrow Modal */}
            <AdminBorrowModal 
                isOpen={showBorrowModal}
                onClose={() => { setShowBorrowModal(false); setSelectedAsset(null); }}
                asset={selectedAsset}
                type={type as any}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['admin-assets'] });
                    setAlert({ visible: true, message: `บันทึกการยืม${isEquipment ? 'อุปกรณ์' : 'สินค้า'}สำเร็จ`, type: "ok" });
                }}
            />
        </div>
    );
}
