"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";
import AlertModal, { AlertState } from "@/components/AlertModal";
import {
    MagnifyingGlassIcon,
    CubeIcon,
    XMarkIcon,
    CameraIcon,
    ArrowRightIcon,
    CalendarIcon,
    MapPinIcon,
    DocumentTextIcon,
    CheckCircleIcon,
    ClockIcon,
    ClipboardDocumentListIcon,
    ArrowLeftIcon,
    UserIcon,
    InboxStackIcon
} from "@heroicons/react/24/outline";

/** 24-hour time picker using two selects */
function TimePicker({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
    const [h, m] = (value || "00:00").split(":");
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
    const mins = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
    return (
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <select
                value={h}
                onChange={e => onChange(`${e.target.value}:${m}`)}
                required={required}
                style={{ flex: 1, padding: "8px 6px", borderRadius: "8px", border: "1px solid var(--border, #e2e8f0)", fontSize: "14px", backgroundColor: "var(--surface, #fff)", color: "var(--text1, #0f172a)", cursor: "pointer" }}
            >
                {hours.map(hh => <option key={hh} value={hh}>{hh}</option>)}
            </select>
            <span style={{ fontWeight: 700, color: "var(--text3, #64748b)", fontSize: "16px" }}>:</span>
            <select
                value={m}
                onChange={e => onChange(`${h}:${e.target.value}`)}
                required={required}
                style={{ flex: 1, padding: "8px 6px", borderRadius: "8px", border: "1px solid var(--border, #e2e8f0)", fontSize: "14px", backgroundColor: "var(--surface, #fff)", color: "var(--text1, #0f172a)", cursor: "pointer" }}
            >
                {mins.map(mm => <option key={mm} value={mm}>{mm}</option>)}
            </select>
        </div>
    );
}

type Asset = {
    id: number;
    asset_id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    status: string;
    stock: number;
    borrowed_count: number;
    company_name?: string | null;
    current_borrowings: Array<{
        borrower_name: string;
        borrow_date: string;
        expected_return_date: string;
        quantity: number;
    }>;
};

export default function AssetBorrowPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>กำลังโหลด...</div>}>
            <AssetBorrowPageInner />
        </Suspense>
    );
}

function AssetBorrowPageInner() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const type = searchParams.get("type") || "item";
    const isEquipment = type === "equipment";

    const [activeTab, setActiveTab] = useState<"borrow" | "my">("borrow");

    const { data: assets = [], isLoading: isLoadingAssets } = useQuery({
        queryKey: ["assets", "available", type],
        queryFn: async () => {
            const url = isEquipment 
                ? "/api/assets/available?category_exclude=Car&include_borrowed=true"
                : "/api/admin/products"; // Use products API for items to match admin
            const res = await fetch(url);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to fetch");
            }
            const data = await res.json();
            
            // Map fields based on type to ensure correct borrowing information
            const normalized = Array.isArray(data) ? data.map((item: any) => {
                if (isEquipment) {
                    // Equipment (Assets) - 1:1 tracking
                    // Find any active borrowing (borrowed or reserved)
                    const currentBorrow = (item.asset_borrowings || []).find((b: any) => 
                        ["borrowed", "reserved"].includes(b.status)
                    );
                    const borrowerName = currentBorrow?.employee?.nickname 
                        ? `${currentBorrow.employee.name} (${currentBorrow.employee.nickname})`
                        : currentBorrow?.employee?.name || "";

                    return {
                        id: item.id,
                        asset_id: item.asset_id,
                        name: item.name,
                        description: item.description,
                        image_url: item.image_url,
                        status: currentBorrow ? "borrowed" : (item.status || "available"),
                        stock: 1,
                        borrowed_count: currentBorrow ? 1 : (item.status === "borrowed" ? 1 : 0),
                        company_name: item.company_owner || item.company_name,
                        current_borrowings: currentBorrow ? [{
                            borrower_name: borrowerName,
                            borrow_date: currentBorrow.borrow_date,
                            expected_return_date: currentBorrow.expected_return_date,
                            quantity: 1
                        }] : []
                    };
                } else {
                    // Items (Products) - Quantity-based tracking
                    const borrowings = item.product_borrowings || [];
                    const activeBorrowings = borrowings.map((b: any) => ({
                        borrower_name: b.employee?.nickname 
                            ? `${b.employee.name} (${b.employee.nickname})`
                            : b.employee?.name || "ไม่ระบุชื่อ",
                        borrow_date: b.borrow_date,
                        expected_return_date: b.expected_return_date,
                        quantity: b.quantity || 1
                    }));

                    const borrowedCount = activeBorrowings.reduce((sum: number, b: any) => sum + b.quantity, 0);
                    const stock = item.stock || 0;
                    const available = stock - borrowedCount;

                    return {
                        id: item.id,
                        asset_id: item.product_code,
                        name: item.product_name,
                        description: item.description,
                        image_url: item.image_url,
                        status: available > 0 ? "available" : "borrowed",
                        stock: stock,
                        borrowed_count: borrowedCount,
                        company_name: item.company_name,
                        current_borrowings: activeBorrowings
                    };
                }
            }) : [];
            
            return normalized;
        },
        enabled: activeTab === "borrow"
    });

    const { data: myBorrowings = [], isLoading: isLoadingMy } = useQuery({
        queryKey: ["assets", "my", type],
        queryFn: async () => {
            const url = isEquipment 
                ? "/api/assets/my?category_exclude=Car"
                : "/api/products/my";
            const res = await fetch(url);
            const data = await res.json();
            
            // Normalize my borrowings
            const normalized = Array.isArray(data) ? data.map((b: any) => ({
                ...b,
                assets: b.product ? {
                    asset_id: b.product.product_code,
                    name: b.product.product_name
                } : b.assets
            })) : [];
            
            return normalized;
        },
        enabled: activeTab === "my"
    });

    const loading = activeTab === "borrow" ? isLoadingAssets : isLoadingMy;
    const [search, setSearch] = useState("");
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [statusFilter, setStatusFilter] = useState<"all" | "available" | "borrowed">("all");
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });

    // Photo states
    const [borrowPhoto, setBorrowPhoto] = useState<string | null>(null);
    const [returnPhoto, setReturnPhoto] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Return Modal State
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
    const [returnData, setReturnData] = useState({
        actual_return_date: new Date().toISOString().split("T")[0],
        actual_return_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        condition_at_return: "",
        is_damaged: false
    });

    const now = new Date();
    const [formData, setFormData] = useState({
        borrow_date: now.toISOString().split("T")[0],
        borrow_time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        expected_return_date: "",
        expected_return_time: "17:00",
        location: "",
        remark: "",
        quantity: 1
    });

    const filteredAssets = useMemo(() => {
        let result = assets;
        
        // For equipment, hide borrowed items by default in 'all' and 'available' views
        if (isEquipment) {
            if (statusFilter === "all" || statusFilter === "available") {
                result = result.filter(a => (a.stock - a.borrowed_count) > 0);
            } else if (statusFilter === "borrowed") {
                result = result.filter(a => a.borrowed_count > 0);
            }
        } else {
            // For items (products), keep original behavior
            if (statusFilter === "available") {
                result = result.filter(a => (a.stock - a.borrowed_count) > 0);
            } else if (statusFilter === "borrowed") {
                result = result.filter(a => a.borrowed_count > 0);
            }
        }

        // Apply search filter
        if (!search) return result;
        const low = search.toLowerCase();
        return result.filter(a => 
            a.name.toLowerCase().includes(low) || 
            a.asset_id.toLowerCase().includes(low) ||
            a.description?.toLowerCase().includes(low)
        );
    }, [assets, search, statusFilter, isEquipment]);

    // Data fetching is now handled by useQuery hooks

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, type: "borrow" | "return") {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const form = new FormData();
        form.append("file", file);
        form.append("prefix", `asset-${type}`);

        try {
            const res = await fetch("/api/upload", { method: "POST", body: form });
            const data = await res.json();
            if (data.ok) {
                if (type === "borrow") setBorrowPhoto(data.url);
                else setReturnPhoto(data.url);
            } else {
                setAlert({ visible: true, message: data.error || "Upload Failed", type: "error" });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedAsset) return;

        if (!formData.expected_return_date) {
            setAlert({ visible: true, message: "กรุณาระบุวันที่กำหนดคืน", type: "error" });
            return;
        }

        if (!borrowPhoto) {
            setAlert({ visible: true, message: "กรุณาถ่ายรูปหรือแนบรูปสภาพอุปกรณ์ก่อนยืม", type: "error" });
            return;
        }

        const borrowDatetime = `${formData.borrow_date}T${formData.borrow_time}:00`;
        const returnDatetime = `${formData.expected_return_date}T${formData.expected_return_time}:00`;

        setSubmitting(true);
        try {
            const url = isEquipment ? "/api/assets/borrow" : "/api/products/borrow";
            const bodyPayload: any = {
                borrow_date: borrowDatetime,
                expected_return_date: returnDatetime,
                location: formData.location,
                remark: formData.remark,
                photo_url_borrow: borrowPhoto,
                quantity: formData.quantity
            };
            if (isEquipment) bodyPayload.asset_id = selectedAsset.id;
            else bodyPayload.product_id = selectedAsset.id;

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyPayload)
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: `บันทึกการยืน${isEquipment ? 'อุปกรณ์' : 'สินค้า'}เรียบร้อยแล้ว`, type: "ok" });
                setSelectedAsset(null);
                setBorrowPhoto(null);
                const n = new Date();
                setFormData({
                    borrow_date: n.toISOString().split("T")[0],
                    borrow_time: n.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
                    expected_return_date: "",
                    expected_return_time: "17:00",
                    location: "",
                    remark: "",
                    quantity: 1
                });
                queryClient.invalidateQueries({ queryKey: ["assets"] });
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        } finally {
            setSubmitting(false);
        }
    }

    function openReturnModal(borrowing: any) {
        setSelectedReturn(borrowing);
        setReturnPhoto(null);
        const now = new Date();
        setReturnData({
            actual_return_date: now.toISOString().split("T")[0],
            actual_return_time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
            condition_at_return: "",
            is_damaged: false
        });
        setShowReturnModal(true);
    }

    async function handleReturnSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!returnPhoto) {
            setAlert({ visible: true, message: "กรุณาถ่ายรูปหรือแนบรูปสภาพอุปกรณ์ขณะคืน", type: "error" });
            return;
        }

        const returnDatetime = `${returnData.actual_return_date}T${returnData.actual_return_time}:00`;

        setSubmitting(true);
        try {
            const url = isEquipment ? "/api/assets/return" : "/api/products/return";
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    borrowing_id: selectedReturn.id,
                    actual_return_date: returnDatetime,
                    condition_at_return: returnData.condition_at_return,
                    is_damaged: returnData.is_damaged,
                    photo_url_return: returnPhoto
                })
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: `แจ้งคืน${isEquipment ? 'อุปกรณ์' : 'สินค้า'}เรียบร้อยแล้ว`, type: "ok" });
                setShowReturnModal(false);
                queryClient.invalidateQueries({ queryKey: ["assets"] });
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        } finally {
            setSubmitting(false);
        }
    }



    return (
        <div className={styles.wrapper}>
            <AlertModal alert={alert} onClose={() => setAlert({ ...alert, visible: false })} />

            <div className={styles.wrap}>
                {/* ── Hero Title ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>{isEquipment ? "ระบบจัดการอุปกรณ์" : "ระบบยืมสินค้า/สิ่งของ"}</h1>
                    <div className={styles.heroP} style={{ fontSize: 13, color: "var(--text3)", marginTop: -6, marginBottom: 12 }}>
                        ยืม-คืน{isEquipment ? "อุปกรณ์บริษัท" : "สินค้าและสิ่งของส่วนกลาง"}
                    </div>
                </div>

                {/* ── Tab Navigation ── */}
                <nav className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === "borrow" ? styles.tabActive : ""}`}
                        onClick={() => setActiveTab("borrow")}
                    >
                        <CubeIcon width={18} /> ยืม{isEquipment ? "อุปกรณ์" : "สินค้า"}
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === "my" ? styles.tabActive : ""}`}
                        onClick={() => setActiveTab("my")}
                    >
                        <ClipboardDocumentListIcon width={18} /> ของที่ต้องคืน ({myBorrowings.length})
                    </button>
                </nav>

                {activeTab === "borrow" ? (
                    <>
                        {/* Summary Section */}
                        <div className={styles.summary}>
                            <div 
                                className={`${styles.summaryItem} ${statusFilter === "all" ? styles.summaryActive : ""}`}
                                onClick={() => setStatusFilter("all")}
                                style={{ cursor: "pointer", transition: "all 0.2s" }}
                            >
                                <span className={styles.summaryLabel}>ทั้งหมด</span>
                                <span className={styles.summaryValue}>{assets.length}</span>
                            </div>
                            <div 
                                className={`${styles.summaryItem} ${statusFilter === "available" ? styles.summaryActive : ""}`}
                                onClick={() => setStatusFilter("available")}
                                style={{ cursor: "pointer", transition: "all 0.2s" }}
                            >
                                <span className={styles.summaryLabel}>พร้อมใช้งาน</span>
                                <span className={styles.summaryValue} style={{ color: "#16a34a" }}>
                                    {assets.filter(a => (a.stock - a.borrowed_count) > 0).length}
                                </span>
                            </div>
                            <div 
                                className={`${styles.summaryItem} ${statusFilter === "borrowed" ? styles.summaryActive : ""}`}
                                onClick={() => setStatusFilter("borrowed")}
                                style={{ cursor: "pointer", transition: "all 0.2s" }}
                            >
                                <span className={styles.summaryLabel}>ถูกยืมแล้ว</span>
                                <span className={styles.summaryValue} style={{ color: "#ea580c" }}>
                                    {assets.filter(a => a.borrowed_count > 0).length}
                                </span>
                            </div>
                        </div>

                        <div className={styles.searchBar}>
                            <div className={styles.searchIcon}><MagnifyingGlassIcon width={20} /></div>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="ค้นหาชื่ออุปกรณ์ หรือรหัส..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <div className={styles.card} style={{ textAlign: "center", padding: "40px" }}>
                                <ClockIcon width={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
                                <div style={{ fontSize: 14, color: "var(--text3)" }}>กำลังโหลดอุปกรณ์...</div>
                            </div>
                        ) : filteredAssets.length === 0 ? (
                            <div className={styles.card} style={{ textAlign: "center", padding: "40px" }}>
                                <MagnifyingGlassIcon width={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                                <div style={{ fontSize: 14, color: "var(--text3)" }}>ไม่พบอุปกรณ์ที่พร้อมใช้งาน</div>
                            </div>
                        ) : (
                            <div className={styles.assetGrid}>
                            {filteredAssets.map(asset => {
                                const isBorrowed = asset.status === "borrowed";
                                return (
                                    <div key={asset.id} className={`${styles.card} ${isBorrowed ? styles.cardBorrowed : ""}`}>
                                        <div className={styles.myHeader}>
                                            <span className={styles.assetId}>{asset.asset_id}</span>
                                        </div>
                                        <h3 className={styles.assetName}>{asset.name}</h3>
                                        
                                        <div className={styles.assetDesc} style={{ marginBottom: 12 }}>
                                            {asset.description || "—"}
                                        </div>


                                        {asset.current_borrowings.length > 0 && (
                                            <div className={styles.borrowerInfo} style={{ 
                                                maxHeight: "200px", 
                                                overflowY: "auto", 
                                                marginBottom: 16,
                                                background: "#eff6ff",
                                                border: "1px solid #bfdbfe",
                                                borderRadius: "12px",
                                                padding: "12px"
                                            }}>
                                                <div className={styles.borrowerTitle} style={{ color: "#1d4ed8", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <UserIcon width={16} /> ข้อมูลการยืมปัจจุบัน
                                                </div>
                                                {asset.current_borrowings.map((b: any, idx: number) => (
                                                    <div key={idx} style={{ 
                                                        background: "white",
                                                        padding: "10px",
                                                        borderRadius: "8px",
                                                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                                    }}>
                                                        <div style={{ color: "#1e293b", fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
                                                            {b.borrower_name}
                                                        </div>
                                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                                                                <div style={{ fontWeight: 700, color: "#1d4ed8" }}>ยืมตั้งแต่วันที่:</div>
                                                                {new Date(b.borrow_date).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                                                            </div>
                                                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                                                                <div style={{ fontWeight: 700, color: "#dc2626" }}>กำหนดคืนวันที่:</div>
                                                                {new Date(b.expected_return_date).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {asset.image_url && !isBorrowed && (
                                            <div className={styles.assetImageWrap}>
                                                <div className={styles.museumFrame}>
                                                    <img src={asset.image_url} alt={asset.name} className={styles.assetImage} />
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            className={`${styles.btn} ${asset.stock - asset.borrowed_count <= 0 ? styles.btnDisabled : styles.btnPrimary}`}
                                            onClick={() => asset.stock - asset.borrowed_count > 0 && setSelectedAsset(asset)}
                                            disabled={asset.stock - asset.borrowed_count <= 0}
                                            style={asset.stock - asset.borrowed_count <= 0 ? { background: "#f1f5f9", color: "#94a3b8", cursor: "not-allowed", border: "1px solid #e2e8f0" } : {}}
                                        >
                                            {asset.stock - asset.borrowed_count <= 0 ? "ไม่พร้อมใช้งาน" : `ดำเนินการยืม${isEquipment ? 'อุปกรณ์' : 'สินค้า'}`}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        )}
                    </>
                ) : (
                    <>
                        {loading ? (
                            <div className={styles.card} style={{ textAlign: "center", padding: "40px" }}>
                                <ClockIcon width={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
                                <div style={{ fontSize: 14, color: "var(--text3)" }}>กำลังโหลดข้อมูล...</div>
                            </div>
                        ) : myBorrowings.length === 0 ? (
                            <div className={styles.card} style={{ textAlign: "center", padding: "40px" }}>
                                <CubeIcon width={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                                <div style={{ fontSize: 14, color: "var(--text3)" }}>คุณยังไม่มีรายการยืมในขณะนี้</div>
                            </div>
                        ) : (
                            <div className={styles.assetGrid}>
                                {myBorrowings.map(b => (
                                    <div key={b.id} className={styles.card}>
                                        <div className={styles.myHeader}>
                                            <div className={styles.assetId}>{b.assets.asset_id}</div>
                                            <div className={styles.myStatus}>กำลังยืม</div>
                                        </div>
                                        <h3 className={styles.assetName}>{b.assets.name}</h3>

                                        <div className={styles.myDetails}>
                                            {b.employee && (
                                                <div className={styles.myDetailItem} style={{ 
                                                    marginBottom: 12, 
                                                    padding: "6px 10px", 
                                                    background: "#eff6ff", 
                                                    borderRadius: 6, 
                                                    color: "#1d4ed8", 
                                                    fontWeight: 700,
                                                    fontSize: "12px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    border: "1px solid #dbeafe"
                                                }}>
                                                    <UserIcon width={14} />
                                                    ผู้ยืม: {b.employee.nickname ? `${b.employee.name} (${b.employee.nickname})` : b.employee.name}
                                                </div>
                                            )}
                                            <div className={styles.myDetailItem}>
                                                <span>วันที่ยืม:</span> {new Date(b.borrow_date).toLocaleDateString("th-TH")}
                                            </div>
                                            <div className={styles.myDetailItem}>
                                                <span>กำหนดคืน:</span> {new Date(b.expected_return_date).toLocaleDateString("th-TH")}
                                            </div>
                                            <div className={styles.myDetailItem}>
                                                <span>สถานที่:</span> {b.location || "-"}
                                            </div>
                                        </div>

                                        <button
                                            className={styles.btn}
                                            onClick={() => openReturnModal(b)}
                                        >
                                            ดำเนินการคืน{isEquipment ? "อุปกรณ์" : "สินค้า"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Borrow Modal */}
            {selectedAsset && (
                <div className={styles.modalOverlay} onClick={() => !submitting && setSelectedAsset(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>ยืม{isEquipment ? "อุปกรณ์" : "สินค้า"}: {selectedAsset.name}</h2>
                            <button className={styles.closeBtn} onClick={() => setSelectedAsset(null)}><XMarkIcon width={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>วันที่เริ่มยืม <span style={{ color: "#dc2626" }}>*</span></label>
                                    <input
                                        type="date"
                                        value={formData.borrow_date}
                                        onChange={e => setFormData({ ...formData, borrow_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>เวลาที่ยืม <span style={{ color: "#dc2626" }}>*</span></label>
                                    <TimePicker value={formData.borrow_time} onChange={v => setFormData({ ...formData, borrow_time: v })} required />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>กำหนดวันคืน <span style={{ color: "#dc2626" }}>*</span></label>
                                    <input
                                        type="date"
                                        value={formData.expected_return_date}
                                        min={formData.borrow_date}
                                        onChange={e => setFormData({ ...formData, expected_return_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>เวลาที่คืน <span style={{ color: "#dc2626" }}>*</span></label>
                                    <TimePicker value={formData.expected_return_time} onChange={v => setFormData({ ...formData, expected_return_time: v })} required />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>สถานที่ใช้งาน / โปรเจกต์</label>
                                <input
                                    type="text"
                                    placeholder="ระบุสถานที่ หรือชื่อโปรเจกต์"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>หมายเหตุ / สภาพอุปกรณ์</label>
                                <textarea
                                    placeholder="เช่น รอยขีดข่วนเดิม หรืออุปกรณ์ไม่ครบ..."
                                    value={formData.remark}
                                    onChange={e => setFormData({ ...formData, remark: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>จำนวนที่ยืม <span style={{ color: "#dc2626" }}>*</span></label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                                    required
                                />
                            </div>

                            {/* Photo documentation */}
                            <div className={styles.photoGroup}>
                                <label>ถ่ายรูปสภาพอุปกรณ์ (ก่อนยืม) <span style={{ color: "#dc2626" }}>*</span></label>
                                <div className={styles.photoUploadBox}>
                                    {borrowPhoto ? (
                                        <div className={styles.photoPreview}>
                                            <div className={styles.museumFrame}>
                                                <img src={borrowPhoto} alt="Borrow Condition" />
                                                <button type="button" className={styles.removePhoto} onClick={() => setBorrowPhoto(null)}><XMarkIcon width={20} /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={styles.uploadTrigger}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                id="borrow-camera"
                                                className={styles.hiddenInput}
                                                onChange={(e) => handlePhotoUpload(e, "borrow")}
                                            />
                                            <label htmlFor="borrow-camera" className={styles.uploadBtn}>
                                                {uploading ? "กำลังอัปโหลด..." : <><CameraIcon width={20} /> ถ่ายรูปสภาพก่อนยืม</>}
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btn} onClick={() => setSelectedAsset(null)} disabled={submitting}>ยกเลิก</button>
                                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={submitting || uploading}>
                                    {submitting ? "กำลังบันทึก..." : `ยืนยันการยืม${isEquipment ? 'อุปกรณ์' : 'สินค้า'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Return Modal */}
            {showReturnModal && selectedReturn && (
                <div className={styles.modalOverlay} onClick={() => !submitting && setShowReturnModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>คืน{isEquipment ? "อุปกรณ์" : "สินค้า"}: {selectedReturn.assets.name}</h2>
                            <button className={styles.closeBtn} onClick={() => setShowReturnModal(false)}><XMarkIcon width={20} /></button>
                        </div>
                        <form onSubmit={handleReturnSubmit} className={styles.form}>
                            <div className={styles.compareSection}>
                                <div className={styles.compareItem}>
                                    <label>รูปสภาพเมื่อยืม</label>
                                    {selectedReturn.photo_url_borrow ? (
                                        <div className={styles.museumFrame}>
                                            <img src={selectedReturn.photo_url_borrow} alt="Before" className={styles.compareImg} />
                                        </div>
                                    ) : (
                                        <div className={styles.noPhoto}>ไม่มีรูปภาพ</div>
                                    )}
                                </div>
                                <div className={styles.compareArrow}><ArrowRightIcon width={24} /></div>
                                <div className={styles.compareItem}>
                                    <label>รูปสภาพขณะคืน <span style={{ color: "#dc2626" }}>*</span></label>
                                    <div className={styles.photoUploadBox}>
                                        {returnPhoto ? (
                                            <div className={styles.photoPreview}>
                                                <div className={styles.museumFrame}>
                                                    <img src={returnPhoto} alt="Return Condition" className={styles.compareImg} />
                                                    <button type="button" className={styles.removePhoto} onClick={() => setReturnPhoto(null)}><XMarkIcon width={20} /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={styles.uploadTrigger}>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    id="return-camera"
                                                    className={styles.hiddenInput}
                                                    onChange={(e) => handlePhotoUpload(e, "return")}
                                                />
                                                <label htmlFor="return-camera" className={styles.uploadBtnSmall}>
                                                    {uploading ? "..." : <><CameraIcon width={18} /> ถ่ายรูปขณะคืน</>}
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>วันที่คืนจริง <span style={{ color: "#dc2626" }}>*</span></label>
                                    <input
                                        type="date"
                                        value={returnData.actual_return_date}
                                        onChange={e => setReturnData({ ...returnData, actual_return_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>เวลาที่คืนจริง <span style={{ color: "#dc2626" }}>*</span></label>
                                    <TimePicker value={returnData.actual_return_time} onChange={v => setReturnData({ ...returnData, actual_return_time: v })} required />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>บันทึกสภาพอุปกรณ์ / ปัญหาที่พบ</label>
                                <textarea
                                    placeholder="เช่น ทำงานปกติ หรือมีรอยบุบเพิ่ม..."
                                    value={returnData.condition_at_return}
                                    onChange={e => setReturnData({ ...returnData, condition_at_return: e.target.value })}
                                />
                            </div>

                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={returnData.is_damaged}
                                    onChange={e => setReturnData({ ...returnData, is_damaged: e.target.checked })}
                                />
                                <span className={styles.checkboxText}>อุปกรณ์ชำรุด / เสียหาย</span>
                            </label>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btn} onClick={() => setShowReturnModal(false)} disabled={submitting}>ยกเลิก</button>
                                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={submitting || uploading}>
                                    {submitting ? "กำลังดำเนินการ..." : `ยืนยันการคืน${isEquipment ? 'อุปกรณ์' : 'สินค้า'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
