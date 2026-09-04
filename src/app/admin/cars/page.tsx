"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
    ChartBarIcon,
    MagnifyingGlassIcon,
    ArrowDownTrayIcon,
    WrenchScrewdriverIcon,
    ShieldExclamationIcon,
    PaperClipIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import AlertModal, { AlertState } from "@/components/AlertModal";

type Asset = {
    id: number;
    asset_id: string;
    name: string;
    category: string | null;
    company_owner: string | null;
    vehicle_type: string | null;
    brand: string | null;
    vehicle_model: string | null;
    main_user: string | null;
    usage_remark: string | null;
    status: "available" | "borrowed" | "maintenance" | "damaged" | "unavailable";
    asset_borrowings: Array<{
        id: number;
        emp_id: string;
        employee: { name: string };
        borrow_date: string;
        expected_return_date: string;
        status: string;
        is_claim?: boolean;
        claim_doc_no?: string | null;
        claim_details?: string | null;
        claim_photo_url?: string | null;
        claim_cost?: any;
        claim_is_billed?: boolean | null;
        is_maintenance?: boolean;
        maintenance_mileage?: number | null;
        maintenance_cost?: any;
        maintenance_doc_url?: string | null;
    }>;
};

export default function AdminAssetsPage() {
    const queryClient = useQueryClient();
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });

    const { data: assets = [], isLoading: loading } = useQuery<Asset[]>({
        queryKey: ['admin-cars'],
        queryFn: async () => {
            const res = await fetch("/api/admin/assets?category=Car");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            return data;
        }
    });

    // Deletion Modal state
    const [pendingDelete, setPendingDelete] = useState<{ id: number, name: string } | null>(null);

    // Return Modal State
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [returnData, setReturnData] = useState({
        actual_return_date: new Date().toISOString().split("T")[0],
        actual_return_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        condition_at_return: "",
        is_damaged: false,
        claim_cost: "" as string | number,
        claim_is_billed: false,
        maintenance_cost: "" as string | number,
        maintenance_doc_url: ""
    });
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Asset Form Modal State
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [assetForm, setAssetForm] = useState({
        id: undefined as number | undefined,
        asset_id: "",
        name: "", // Will be auto-generated or used as fallback
        avg_category: "Car", // Force Car
        category: "Car",
        description: "",
        company_owner: "",
        vehicle_type: "",
        brand: "",
        vehicle_model: "",
        main_user: "",
        usage_remark: "",
        status: "available"
    });
    const [assetSaving, setAssetSaving] = useState(false);

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [assetHistory, setAssetHistory] = useState<any[]>([]);

    // Filtering State
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");



    function openAddModal() {
        setIsEditing(false);
        setAssetForm({
            id: undefined,
            asset_id: "",
            name: "",
            avg_category: "Car",
            category: "Car",
            description: "",
            company_owner: "",
            vehicle_type: "",
            brand: "",
            vehicle_model: "",
            main_user: "",
            usage_remark: "",
            status: "available"
        });
        setShowAssetModal(true);
    }

    function openEditModal(asset: Asset) {
        setIsEditing(true);
        setAssetForm({
            id: asset.id,
            asset_id: asset.asset_id,
            name: asset.name,
            category: asset.category || "",
            avg_category: "Car",
            description: "", // internal placeholder if needed
            company_owner: asset.company_owner || "",
            vehicle_type: asset.vehicle_type || "",
            brand: asset.brand || "",
            vehicle_model: asset.vehicle_model || "",
            main_user: asset.main_user || "",
            usage_remark: asset.usage_remark || "",
            status: asset.status
        });
        setShowAssetModal(true);
    }

    async function handleAssetSubmit(e: React.FormEvent) {
        e.preventDefault();
        setAssetSaving(true);
        const payload = { ...assetForm };
        if (!payload.name) {
            payload.name = `${payload.brand || ""} ${payload.vehicle_model || ""}`.trim();
            if (!payload.name) payload.name = "Unknown Vehicle";
        }

        try {
            const url = isEditing ? `/api/admin/assets/${payload.id}` : "/api/admin/assets";
            const method = isEditing ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: `บันทึกข้อมูล ${assetForm.name} เรียบร้อยแล้ว`, type: "ok" });
                setShowAssetModal(false);
                queryClient.invalidateQueries({ queryKey: ['admin-cars'] });
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
            message: `คุณแน่ใจหรือไม่ที่จะลบอุปกรณ์ "${name}"?`,
            type: "error"
        });
    }

    async function confirmDelete() {
        if (!pendingDelete) return;
        const { id } = pendingDelete;
        setPendingDelete(null);

        try {
            const res = await fetch(`/api/admin/assets/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "ลบข้อมูลเรียบร้อยแล้ว", type: "ok" });
                queryClient.invalidateQueries({ queryKey: ['admin-cars'] });
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        }
    }

    function openReturnModal(asset: Asset) {
        setSelectedAsset(asset);
        const currentBorrow = asset.asset_borrowings.find(b => b.status === "borrowed" || b.status === "reserved");
        setReturnData({
            actual_return_date: new Date().toISOString().split("T")[0],
            actual_return_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
            condition_at_return: "",
            is_damaged: false,
            claim_cost: currentBorrow?.claim_cost != null ? String(currentBorrow.claim_cost) : "",
            claim_is_billed: currentBorrow?.claim_is_billed ?? false,
            maintenance_cost: currentBorrow?.maintenance_cost != null ? String(currentBorrow.maintenance_cost) : "",
            maintenance_doc_url: currentBorrow?.maintenance_doc_url || ""
        });
        setShowReturnModal(true);
    }

    async function handleMaintenanceDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingDoc(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("prefix", "maintenance-doc");
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.url) {
                setReturnData(prev => ({ ...prev, maintenance_doc_url: data.url }));
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาดในการอัปโหลดไฟล์", type: "error" });
            }
        } catch (err: any) {
            setAlert({ visible: true, message: err.message || "เกิดข้อผิดพลาดในการอัปโหลด", type: "error" });
        } finally {
            setUploadingDoc(false);
        }
    }

    async function handleReturn() {
        if (!selectedAsset) return;

        const currentBorrow = selectedAsset.asset_borrowings.find(b => b.status === "borrowed" || b.status === "reserved");

        setProcessing(true);
        try {
            const returnDatetime = `${returnData.actual_return_date}T${returnData.actual_return_time}:00`;
            const bodyPayload: any = {
                ...returnData,
                actual_return_date: returnDatetime
            };

            if (currentBorrow) {
                bodyPayload.borrowing_id = currentBorrow.id;
            } else {
                bodyPayload.force_reset = true;
                bodyPayload.asset_id = selectedAsset.id;
            }

            const res = await fetch("/api/admin/assets/return", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyPayload)
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "รับคืนรถยนต์เรียบร้อยแล้ว", type: "ok" });
                setShowReturnModal(false);
                queryClient.invalidateQueries({ queryKey: ['admin-cars'] });
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
            const res = await fetch(`/api/admin/assets/${asset.id}/history`);
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
                if (Array.isArray(parsed)) return parsed.filter(v => !!v);
            }
        } catch (e) { }
        return [photoUrl];
    }

    const now = new Date();
    const filteredAssets = assets.filter(asset => {
        const matchesSearch =
            asset.asset_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (asset.main_user || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (asset.company_owner || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (asset.vehicle_type || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (asset.vehicle_model || "").toLowerCase().includes(searchQuery.toLowerCase());

        // Determine effective status for filtering
        const currentBorrow = asset.asset_borrowings.find(b => {
            const start = new Date(b.borrow_date);
            return b.status === "borrowed" || (b.status === "reserved" && start <= now);
        });
        const upcomingBorrow = asset.asset_borrowings.find(b => b.status === "reserved" && new Date(b.borrow_date) > now);
        const effectiveStatus = currentBorrow ? "borrowed" : (upcomingBorrow ? "reserved" : asset.status);

        const matchesStatus = filterStatus === "all" || effectiveStatus === filterStatus || (filterStatus === "borrowed" && effectiveStatus === "reserved");
        return matchesSearch && matchesStatus;
    });

    async function exportToExcel() {
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Cars');

            worksheet.columns = [
                { header: 'เจ้าของรถ (Company)', key: 'company', width: 25 },
                { header: 'ประเภทรถ', key: 'type', width: 15 },
                { header: 'ยี่ห้อ (Brand)', key: 'brand', width: 15 },
                { header: 'รุ่น (Model)', key: 'model', width: 20 },
                { header: 'ทะเบียนรถ', key: 'asset_id', width: 15 },
                { header: 'ผู้ใช้งานหลัก', key: 'main_user', width: 20 },
                { header: 'สถานะปัจจุบัน', key: 'status', width: 20 },
                { header: 'ผู้ยืม (ถ้ามี)', key: 'borrower', width: 20 },
                { header: 'กำหนดคืน (ถ้ามี)', key: 'return_date', width: 20 }
            ];

            worksheet.getRow(1).font = { bold: true };

            filteredAssets.forEach(asset => {
                const now = new Date();
                const currentBorrow = asset.asset_borrowings.find(b => {
                    const start = new Date(b.borrow_date);
                    return b.status === "borrowed" || (b.status === "reserved" && start <= now);
                });
                const effectiveStatus = currentBorrow ? "borrowed" : asset.status;

                let statusText = "";
                if (effectiveStatus === "available") statusText = "พร้อมใช้งาน";
                else if (effectiveStatus === "borrowed") statusText = "ถูกยืม";
                else if (effectiveStatus === "damaged") statusText = "ชำรุด";
                else if (effectiveStatus === "unavailable") statusText = "ไม่พร้อมใช้งาน";
                else statusText = "ซ่อมบำรุง";

                worksheet.addRow({
                    company: asset.company_owner || "-",
                    type: asset.vehicle_type || "-",
                    brand: asset.brand || "-",
                    model: asset.vehicle_model || "-",
                    asset_id: asset.asset_id,
                    main_user: asset.main_user || "-",
                    status: statusText,
                    borrower: currentBorrow ? currentBorrow.employee.name : "-",
                    return_date: currentBorrow ? new Date(currentBorrow.expected_return_date).toLocaleString("th-TH", {
                        day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"
                    }) : "-"
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `cars_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
            setAlert({ visible: true, message: "เกิดข้อผิดพลาดในการส่งออกไฟล์", type: "error" });
        }
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
                    <h1 className={styles.title}>จัดการรถยนต์ (Cars)</h1>
                    <p className={styles.subtitle}>จัดการรถยนต์บริษัท การยืม-คืน และประวัติการใช้งาน</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className={styles.searchWrapper}>
                        <MagnifyingGlassIcon width={18} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="ค้นหาทะเบียน, รุ่น, ผู้ใช้งาน..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Link href="/admin/reports/vehicles" className={styles.reportBtn}>
                        <ChartBarIcon width={20} /> ดูรายงานสรุป
                    </Link>
                    <button className={styles.exportBtn} onClick={exportToExcel}>
                        <ArrowDownTrayIcon width={20} /> ส่งออก Excel
                    </button>
                    <button className={styles.addBtn} onClick={openAddModal}>
                        <PlusIcon width={20} /> เพิ่มรถยนต์
                    </button>
                </div>
            </div>

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
                    <span className={styles.statVal} style={{ color: "var(--ok)" }}>
                        {assets.filter(a => {
                            const currentBorrow = a.asset_borrowings.find(b => {
                                const start = new Date(b.borrow_date);
                                return b.status === "borrowed" || (b.status === "reserved" && start <= now);
                            });
                            return !currentBorrow && a.status === "available";
                        }).length}
                    </span>
                </div>
                <div
                    className={`${styles.statCard} ${filterStatus === "borrowed" ? styles.active : ""}`}
                    onClick={() => setFilterStatus("borrowed")}
                >
                    <span className={styles.statLabel}>กำลังถูกยืม</span>
                    <span className={styles.statVal} style={{ color: "var(--blue)" }}>
                        {assets.filter(a => {
                            const currentBorrow = a.asset_borrowings.find(b => {
                                const start = new Date(b.borrow_date);
                                return b.status === "borrowed" || (b.status === "reserved" && start <= now);
                            });
                            return !!currentBorrow;
                        }).length}
                    </span>
                </div>
                <div
                    className={`${styles.statCard} ${filterStatus === "maintenance" ? styles.active : ""}`}
                    onClick={() => setFilterStatus("maintenance")}
                >
                    <span className={styles.statLabel}>ซ่อมบำรุง</span>
                    <span className={styles.statVal} style={{ color: "var(--late)" }}>{assets.filter(a => a.status === "maintenance").length}</span>
                </div>
                <div
                    className={`${styles.statCard} ${filterStatus === "damaged" ? styles.active : ""}`}
                    onClick={() => setFilterStatus("damaged")}
                >
                    <span className={styles.statLabel}>ชำรุด</span>
                    <span className={styles.statVal} style={{ color: "var(--bad)" }}>{assets.filter(a => a.status === "damaged").length}</span>
                </div>
                <div
                    className={`${styles.statCard} ${filterStatus === "unavailable" ? styles.active : ""}`}
                    onClick={() => setFilterStatus("unavailable")}
                >
                    <span className={styles.statLabel}>ไม่พร้อมใช้งาน</span>
                    <span className={styles.statVal} style={{ color: "#64748b" }}>{assets.filter(a => a.status === "unavailable").length}</span>
                </div>
            </div>

            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>เจ้าของรถ (Company)</th>
                            <th>ทะเบียน / รุ่นรถ</th>
                            <th>ผู้ใช้งานหลัก</th>
                            <th>สถานะปัจจุบัน</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className={styles.loading}>กำลังโหลด...</td></tr>
                        ) : filteredAssets.length === 0 ? (
                            <tr><td colSpan={5} className={styles.loading}>ไม่พบข้อมูลรถยนต์ที่ค้นหา</td></tr>
                        ) : (
                            filteredAssets.map(asset => {
                                const now = new Date();
                                const currentBorrow = asset.asset_borrowings.find(b => {
                                    const start = new Date(b.borrow_date);
                                    return b.status === "borrowed" || (b.status === "reserved" && start <= now);
                                });
                                const upcomingBorrow = asset.asset_borrowings.find(b => b.status === "reserved" && new Date(b.borrow_date) > now);
                                const activeBorrowing = currentBorrow || upcomingBorrow;
                                const effectiveStatus = currentBorrow ? "borrowed" : (upcomingBorrow ? "reserved" : asset.status);

                                const isOverdue = currentBorrow ? now > new Date(currentBorrow.expected_return_date) : false;

                                return (
                                    <tr key={asset.id}>
                                        <td>
                                            <div style={{ fontWeight: 500, color: "#1e293b" }}>{asset.company_owner || "—"}</div>
                                            <div style={{ fontSize: "0.80rem", color: "#64748b" }}>{asset.vehicle_type || "—"}</div>
                                        </td>
                                        <td>
                                            <div className={styles.assetName}>{asset.asset_id}</div>
                                            <div className={styles.assetId}>{asset.name}</div>
                                        </td>
                                        <td>
                                            <div className={styles.assetName}>{asset.main_user || "—"}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                <span className={`${styles.statusBadge} ${isOverdue ? styles.damaged : styles[effectiveStatus] || styles.available}`}>
                                                    {isOverdue ? "ยังไม่คืนรถ" :
                                                        effectiveStatus === "available" ? "พร้อมใช้งาน" :
                                                            effectiveStatus === "borrowed" ? "ถูกยืม" :
                                                                effectiveStatus === "reserved" ? "จองล่วงหน้า" :
                                                                    effectiveStatus === "damaged" ? "ชำรุด" :
                                                                        effectiveStatus === "unavailable" ? "ไม่พร้อมใช้งาน" : "ซ่อมบำรุง"}
                                                </span>
                                                {activeBorrowing && (
                                                    <div className={styles.borrowerInfo} style={{ fontSize: "0.8rem", marginTop: 4 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                            <UserIcon width={12} /> {activeBorrowing.employee.name}
                                                        </div>
                                                        <div style={{ color: effectiveStatus === "reserved" ? "#b45309" : "var(--bad)", fontWeight: 500, marginTop: "2px" }}>
                                                            {effectiveStatus === "reserved" ? (
                                                                <>เริ่ม: {new Date(activeBorrowing.borrow_date).toLocaleString("th-TH", {
                                                                    day: "2-digit", month: "2-digit", year: "2-digit",
                                                                    hour: "2-digit", minute: "2-digit"
                                                                })}</>
                                                            ) : (
                                                                <>คืน: {new Date(activeBorrowing.expected_return_date).toLocaleString("th-TH", {
                                                                    day: "2-digit", month: "2-digit", year: "2-digit",
                                                                    hour: "2-digit", minute: "2-digit"
                                                                })}</>
                                                            )}
                                                        </div>
                                                        {activeBorrowing.is_claim && (
                                                            <div style={{ marginTop: "3px" }}>
                                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 5px", borderRadius: "4px", fontWeight: 600 }}>
                                                                    <ShieldExclamationIcon width={12} /> ส่งเคลมรถ
                                                                </span>
                                                            </div>
                                                        )}
                                                        {activeBorrowing.is_maintenance && (
                                                            <div style={{ marginTop: "3px" }}>
                                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", backgroundColor: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", padding: "1px 5px", borderRadius: "4px", fontWeight: 600 }}>
                                                                    <WrenchScrewdriverIcon width={12} /> เช็คระยะ/ซ่อม
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.actions}>
                                                {(effectiveStatus === "borrowed" || effectiveStatus === "reserved") && (
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
                                                {effectiveStatus !== "borrowed" && effectiveStatus !== "reserved" && (
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
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Asset Add/Edit Modal */}
            {showAssetModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>{isEditing ? "แก้ไขข้อมูลรถยนต์" : "เพิ่มรถยนต์ใหม่"}</h2>
                            <p>{isEditing ? "ปรับปรุงรายละเอียดและผู้ถือครองรถในระบบ" : "ลงทะเบียนรถเข้าสู่ระบบ"}</p>
                        </div>
                        <form onSubmit={handleAssetSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.formRow}>
                                    <div className={styles.inputGroup}>
                                        <label>เจ้าของรถ (Company) <span style={{ color: "#ef4444" }}>*</span></label>
                                        <select
                                            value={assetForm.company_owner}
                                            onChange={e => setAssetForm({ ...assetForm, company_owner: e.target.value })}
                                            required
                                        >
                                            <option value="">เลือกบริษัท...</option>
                                            <option value="TERA GROUP">TERA GROUP</option>
                                            <option value="TERA POWER">TERA POWER</option>
                                            <option value="TERA ELECTRIC">TERA ELECTRIC</option>
                                        </select>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>ประเภทรถ <span style={{ color: "#ef4444" }}>*</span></label>
                                        <select
                                            value={assetForm.vehicle_type}
                                            onChange={e => setAssetForm({ ...assetForm, vehicle_type: e.target.value })}
                                            required
                                        >
                                            <option value="">เลือกประเภท...</option>
                                            <option value="กระบะ">กระบะ</option>
                                            <option value="เก๋ง">เก๋ง</option>
                                            <option value="รถตู้">รถตู้</option>
                                            <option value="เฮี้ยบ">เฮี้ยบ</option>
                                        </select>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.inputGroup}>
                                        <label>ยี่ห้อ (Brand) <span style={{ color: "#ef4444" }}>*</span></label>
                                        <input
                                            type="text"
                                            placeholder="เช่น MITSUBISHI, ISUZU"
                                            value={assetForm.brand}
                                            onChange={e => setAssetForm({ ...assetForm, brand: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>รุ่น (Model) <span style={{ color: "#ef4444" }}>*</span></label>
                                        <input
                                            type="text"
                                            placeholder="เช่น XPANDER, D-Cab"
                                            value={assetForm.vehicle_model}
                                            onChange={e => setAssetForm({ ...assetForm, vehicle_model: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.inputGroup}>
                                        <label>ทะเบียนรถ <span style={{ color: "#ef4444" }}>*</span></label>
                                        <input
                                            type="text"
                                            placeholder="เช่น กท 1234"
                                            value={assetForm.asset_id}
                                            onChange={e => setAssetForm({ ...assetForm, asset_id: e.target.value })}
                                            required
                                            disabled={isEditing}
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>ผู้ใช้งานหลัก <span style={{ color: "#ef4444" }}>*</span></label>
                                        <input
                                            type="text"
                                            placeholder="เช่น เอกชัย (เอก)"
                                            value={assetForm.main_user}
                                            onChange={e => setAssetForm({ ...assetForm, main_user: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>หมายเหตุ</label>
                                    <input
                                        type="text"
                                        placeholder="เช่น ใช้เมื่อออกไปหน้างาน, รถผู้บริหาร"
                                        value={assetForm.usage_remark}
                                        onChange={e => setAssetForm({ ...assetForm, usage_remark: e.target.value })}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>สถานะ</label>
                                    <select
                                        value={assetForm.status}
                                        onChange={e => setAssetForm({ ...assetForm, status: e.target.value as any })}
                                    >
                                        <option value="available">พร้อมใช้งาน (แสดงในหน้าจอง)</option>
                                        <option value="unavailable">ไม่พร้อมใช้งาน (ไม่แสดงในหน้าจอง)</option>
                                        <option value="maintenance">ซ่อมบำรุง</option>
                                        <option value="damaged">ชำรุด</option>
                                    </select>
                                </div>
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
                            <h2>รับคืนอุปกรณ์</h2>
                            <p>{selectedAsset.name} ({selectedAsset.asset_id})</p>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label>วันที่คืนจริง</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="date"
                                        value={returnData.actual_return_date}
                                        onChange={e => setReturnData({ ...returnData, actual_return_date: e.target.value })}
                                        style={{ flex: 1 }}
                                    />
                                    <input
                                        type="time"
                                        value={returnData.actual_return_time}
                                        onChange={e => setReturnData({ ...returnData, actual_return_time: e.target.value })}
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </div>
                            <div className={styles.inputGroup}>
                                <label>สภาพอุปกรณ์เมื่อคืน</label>
                                <textarea
                                    placeholder="ระบุความเสียหาย หรือ สภาพหลังการใช้งาน..."
                                    value={returnData.condition_at_return}
                                    onChange={e => setReturnData({ ...returnData, condition_at_return: e.target.value })}
                                />
                            </div>
                            <div className={styles.checkboxGroup}>
                                <input
                                    type="checkbox"
                                    id="is_damaged"
                                    checked={returnData.is_damaged}
                                    onChange={e => setReturnData({ ...returnData, is_damaged: e.target.checked })}
                                />
                                <label htmlFor="is_damaged">
                                    <ExclamationTriangleIcon width={18} style={{ color: "#dc2626" }} />
                                    อุปกรณ์ชำรุด / เสียหาย
                                </label>
                            </div>

                            {/* Claim Settlement */}
                            {(() => {
                                const currentBorrow = selectedAsset.asset_borrowings.find(b => b.status === "borrowed" || b.status === "reserved");
                                if (!currentBorrow?.is_claim) return null;
                                return (
                                    <div style={{ padding: "14px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                                            <ShieldExclamationIcon width={16} /> สรุปการส่งเคลมรถยนต์ (Claim Settlement)
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#78350f" }}>
                                            <div><strong>เลขที่เอกสารเคลม:</strong> {currentBorrow.claim_doc_no || "-"}</div>
                                            <div><strong>รายละเอียดการเคลม:</strong> {currentBorrow.claim_details || "-"}</div>
                                            {currentBorrow.claim_photo_url && (
                                                <div style={{ marginTop: "4px" }}>
                                                    <a href={currentBorrow.claim_photo_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                        <PaperClipIcon width={12} /> ดูรูปเอกสารเคลม
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                            <label style={{ fontSize: "12px", fontWeight: 600, color: "#92400e" }}>ค่าใช้จ่ายในการเคลม (บาท)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="ระบุค่าใช้จ่าย (ถ้ามี)"
                                                value={returnData.claim_cost}
                                                onChange={e => setReturnData({ ...returnData, claim_cost: e.target.value })}
                                                style={{ backgroundColor: "#fff" }}
                                            />
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <input
                                                type="checkbox"
                                                id="admin_claim_is_billed"
                                                checked={returnData.claim_is_billed}
                                                onChange={e => setReturnData({ ...returnData, claim_is_billed: e.target.checked })}
                                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                            />
                                            <label htmlFor="admin_claim_is_billed" style={{ fontSize: "12px", fontWeight: 600, color: "#92400e", cursor: "pointer", margin: 0 }}>
                                                มีการเรียกเก็บเงิน / วางบิล (Billed)
                                            </label>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Scheduled Maintenance Settlement */}
                            {(() => {
                                const currentBorrow = selectedAsset.asset_borrowings.find(b => b.status === "borrowed" || b.status === "reserved");
                                if (!currentBorrow?.is_maintenance) return null;
                                return (
                                    <div style={{ padding: "14px", backgroundColor: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "8px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#6b21a8", display: "flex", alignItems: "center", gap: "6px" }}>
                                            <WrenchScrewdriverIcon width={16} /> สรุปการเช็คระยะ / ซ่อมบำรุง (Maintenance Settlement)
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#581c87" }}>
                                            <div><strong>เลขไมล์ตอนนำเข้าเช็คระยะ:</strong> {currentBorrow.maintenance_mileage ? `${currentBorrow.maintenance_mileage.toLocaleString()} กม.` : "-"}</div>
                                        </div>
                                        <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                            <label style={{ fontSize: "12px", fontWeight: 600, color: "#6b21a8" }}>ค่าใช้จ่ายเช็คระยะ/ซ่อมบำรุง (บาท)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="ระบุค่าใช้จ่าย (ถ้ามี)"
                                                value={returnData.maintenance_cost}
                                                onChange={e => setReturnData({ ...returnData, maintenance_cost: e.target.value })}
                                                style={{ backgroundColor: "#fff" }}
                                            />
                                        </div>
                                        <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                            <label style={{ fontSize: "12px", fontWeight: 600, color: "#6b21a8" }}>
                                                แนบเอกสารใบเสร็จ / บิลเช็คระยะ <span style={{ fontWeight: 400, color: "#888" }}>(ไม่บังคับ)</span>
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                onChange={handleMaintenanceDocUpload}
                                                disabled={uploadingDoc}
                                                style={{ fontSize: "12px" }}
                                            />
                                            {uploadingDoc && <span style={{ fontSize: "11px", color: "#6b21a8" }}>กำลังอัปโหลด...</span>}
                                            {returnData.maintenance_doc_url && (
                                                <div style={{ marginTop: "4px" }}>
                                                    <a href={returnData.maintenance_doc_url} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#2563eb", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                        <PaperClipIcon width={12} /> ดูเอกสารที่แนบแล้ว
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
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
                                <p>รหัสคุณครุภัณฑ์/ทะเบียน: {selectedAsset.asset_id}</p>
                            </div>
                            <button className={styles.editBtn} onClick={() => setShowHistoryModal(false)}>
                                <XMarkIcon width={24} />
                            </button>
                        </div>
                        <div className={styles.modalScroll}>
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
                                                        statusText = 'ยังไม่คืนรถ (เกินกำหนด)';
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
                                                    <span className={styles.historyLabel}>วันที่ยืม:</span> {new Date(item.borrow_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className={styles.historyField}>
                                                    <span className={styles.historyLabel}>กำหนดคืน:</span> {item.expected_return_date ? new Date(item.expected_return_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </div>
                                                <div className={styles.historyField}>
                                                    <span className={styles.historyLabel}>คืนจริง:</span> {item.actual_return_date ? new Date(item.actual_return_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
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

                                            {/* 📋 รายงานสภาพเมื่อยืม (ถ้ามี) */}
                                            {item.borrow_vehicle_status && (
                                                <div style={{ marginTop: 12, padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                                    <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#1e293b", display: "flex", alignItems: "center", gap: "4px" }}>
                                                        <ClipboardDocumentListIcon width={14} /> รายงานสภาพรถยนต์ก่อนใช้งาน
                                                    </div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                                                        {[
                                                            { label: "สถานะ", val: item.borrow_vehicle_status, bad: item.borrow_vehicle_status.includes("ซ่อม") },
                                                            { label: "ความสะอาด", val: item.borrow_is_clean ? "สะอาด" : "ไม่สะอาด", bad: !item.borrow_is_clean },
                                                            { label: "ระบบไฟ/จอ", val: item.borrow_is_lights_ok ? "ปกติ" : "ไม่ปกติ", bad: !item.borrow_is_lights_ok },
                                                            { label: "ยาง/ลมยาง", val: item.borrow_is_tires_ok ? "ปกติ" : "ไม่ปกติ", bad: !item.borrow_is_tires_ok },
                                                            { label: "ตัวถัง/อุปกรณ์", val: item.borrow_is_body_ok ? "ปกติ" : "ไม่ปกติ", bad: !item.borrow_is_body_ok },
                                                            { label: "ประกัน/พรบ.", val: item.borrow_is_insurance_ok ? "ปกติ (>1ด.)" : "ใกล้หมด (<1ด.)", bad: !item.borrow_is_insurance_ok },
                                                        ].map((check, idx) => (
                                                            <div key={idx} style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", padding: "4px 8px", backgroundColor: "#fff", borderRadius: "4px", border: "1px solid #f1f5f9" }}>
                                                                <span style={{ color: "#64748b" }}>{check.label}:</span>
                                                                <span style={{ fontWeight: 600, color: check.bad ? "#dc2626" : "#16a34a" }}>{check.val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {item.borrow_inspection_remark && (
                                                        <div style={{ marginTop: 8, fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>
                                                            บันทึกเพิ่มเติม: {item.borrow_inspection_remark}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ข้อมูลการส่งเคลม (ถ้ามี) */}
                                            {item.is_claim && (
                                                <div style={{ marginTop: 12, padding: "12px", backgroundColor: "#fffbeb", borderRadius: "8px", border: "1px solid #fde68a" }}>
                                                    <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#92400e", display: "flex", alignItems: "center", gap: "4px" }}>
                                                        <ShieldExclamationIcon width={14} /> รายละเอียดการส่งเคลมรถยนต์
                                                    </div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px", fontSize: "11px" }}>
                                                        <div><strong style={{ color: "#78350f" }}>เลขที่เอกสารเคลม:</strong> {item.claim_doc_no || "-"}</div>
                                                        <div><strong style={{ color: "#78350f" }}>ค่าใช้จ่ายเคลม:</strong> {item.claim_cost != null ? `฿${Number(item.claim_cost).toLocaleString()}` : "-"}</div>
                                                        <div><strong style={{ color: "#78350f" }}>การเรียกเก็บเงิน:</strong> {item.claim_is_billed === true ? "เรียกเก็บเงิน / วางบิล" : item.claim_is_billed === false ? "ไม่เรียกเก็บเงิน" : "-"}</div>
                                                    </div>
                                                    {item.claim_details && (
                                                        <div style={{ marginTop: 6, fontSize: "11px", color: "#78350f" }}>
                                                            <strong>รายละเอียดเคลม:</strong> {item.claim_details}
                                                        </div>
                                                    )}
                                                    {item.claim_photo_url && (
                                                        <div style={{ marginTop: 6 }}>
                                                            <a href={item.claim_photo_url} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: "#2563eb", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                                <PaperClipIcon width={12} /> ดูรูปถ่ายเอกสารเคลม
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ข้อมูลเช็คระยะ / ซ่อมบำรุง (ถ้ามี) */}
                                            {item.is_maintenance && (
                                                <div style={{ marginTop: 12, padding: "12px", backgroundColor: "#faf5ff", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
                                                    <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#6b21a8", display: "flex", alignItems: "center", gap: "4px" }}>
                                                        <WrenchScrewdriverIcon width={14} /> รายละเอียดการเช็คระยะ / ซ่อมบำรุง
                                                    </div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px", fontSize: "11px" }}>
                                                        <div><strong style={{ color: "#581c87" }}>เลขไมล์ตอนส่งซ่อม:</strong> {item.maintenance_mileage != null ? `${Number(item.maintenance_mileage).toLocaleString()} กม.` : "-"}</div>
                                                        <div><strong style={{ color: "#581c87" }}>ค่าใช้จ่าย:</strong> {item.maintenance_cost != null ? `฿${Number(item.maintenance_cost).toLocaleString()}` : "-"}</div>
                                                    </div>
                                                    {item.maintenance_doc_url && (
                                                        <div style={{ marginTop: 6 }}>
                                                            <a href={item.maintenance_doc_url} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: "#2563eb", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                                <PaperClipIcon width={12} /> ดูเอกสารใบเสร็จ / บิลเช็คระยะ
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

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
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowHistoryModal(false)}>ปิดหน้าย่อย</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
