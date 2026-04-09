"use client";

import { useState, useEffect } from "react";
import styles from "../assets/borrow/page.module.css";
import AlertModal, { AlertState } from "@/components/AlertModal";
import {
    MagnifyingGlassIcon,
    TruckIcon,
    XMarkIcon,
    CameraIcon,
    ArrowRightIcon,
    CalendarIcon,
    MapPinIcon,
    DocumentTextIcon,
    CheckCircleIcon,
    ClockIcon,
    ClipboardDocumentListIcon,
    UserIcon
} from "@heroicons/react/24/outline";

type Asset = {
    id: number;
    asset_id: string; // License Plate
    name: string; // Car Model
    company_owner: string | null;
    vehicle_type: string | null;
    brand: string | null;
    vehicle_model: string | null;
    main_user: string | null;
    usage_remark: string | null;
    description: string | null;
    image_url: string | null;
    status: string;
};

export default function CarBorrowPage() {
    const [activeTab, setActiveTab] = useState<"borrow" | "my">("borrow");
    const [assets, setAssets] = useState<Asset[]>([]);
    const [myBorrowings, setMyBorrowings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });

    // Photo states
    const [borrowPhotos, setBorrowPhotos] = useState<{ [key: string]: string | null }>({
        front: null, back: null, left: null, right: null, mileage: null
    });
    const [returnPhotos, setReturnPhotos] = useState<{ [key: string]: string | null }>({
        front: null, back: null, left: null, right: null, mileage: null
    });
    const [uploading, setUploading] = useState<string | null>(null); // Track which slot is uploading

    // Return Modal State
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
    const [returnData, setReturnData] = useState({
        actual_return_date: new Date().toISOString().split("T")[0],
        condition_at_return: "",
        is_damaged: false
    });

    const [formData, setFormData] = useState({
        borrow_date: new Date().toISOString().split("T")[0],
        expected_return_date: "",
        location: "",
        remark: "",
        // New Inspection Checklist
        borrow_vehicle_status: "รถอยู่ Tera",
        borrow_is_clean: true,
        borrow_is_lights_ok: true,
        borrow_is_tires_ok: true,
        borrow_is_body_ok: true,
        borrow_is_insurance_ok: true,
        borrow_inspection_remark: ""
    });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    async function loadData() {
        setLoading(true);
        try {
            if (activeTab === "borrow") {
                const res = await fetch("/api/assets/available?category=Car");
                const data = await res.json();
                setAssets(Array.isArray(data) ? data : []);
            } else {
                const res = await fetch("/api/assets/my?category=Car");
                const data = await res.json();
                setMyBorrowings(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, type: "borrow" | "return", slot: string) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(`${type}-${slot}`);
        const form = new FormData();
        form.append("file", file);
        form.append("prefix", `car-${type}-${slot}`);

        try {
            const res = await fetch("/api/upload", { method: "POST", body: form });
            const data = await res.json();
            if (data.ok) {
                if (type === "borrow") {
                    setBorrowPhotos(prev => ({ ...prev, [slot]: data.url }));
                } else {
                    setReturnPhotos(prev => ({ ...prev, [slot]: data.url }));
                }
            } else {
                setAlert({ visible: true, message: data.error || "Upload Failed", type: "error" });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUploading(null);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedAsset) return;

        if (!formData.expected_return_date) {
            setAlert({ visible: true, message: "กรุณาระบุวันที่กำหนดคืน", type: "error" });
            return;
        }

        const missingPhotos = Object.entries(borrowPhotos).filter(([_, url]) => !url);
        if (missingPhotos.length > 0) {
            setAlert({ visible: true, message: "กรุณาถ่ายรูปให้ครบทั้ง 5 จุด (หน้า, หลัง, ซ้าย, ขวา และเลขไมล์)", type: "error" });
            return;
        }

        if (!formData.location) {
            setAlert({ visible: true, message: "กรุณาระบุสถานที่ปลายทางที่เดินทางไป", type: "error" });
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/assets/borrow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    asset_id: selectedAsset.id,
                    ...formData,
                    photo_url_borrow: JSON.stringify(borrowPhotos)
                })
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "ทำการจองและยืมรถยนต์เรียบร้อยแล้ว แจ้งเตือนส่งไปยัง HR แล้ว", type: "ok" });
                setSelectedAsset(null);
                setBorrowPhotos({ front: null, back: null, left: null, right: null, mileage: null });
                setFormData({
                    borrow_date: new Date().toISOString().split("T")[0],
                    expected_return_date: "",
                    location: "",
                    remark: "",
                    borrow_vehicle_status: "รถอยู่ Tera",
                    borrow_is_clean: true,
                    borrow_is_lights_ok: true,
                    borrow_is_tires_ok: true,
                    borrow_is_body_ok: true,
                    borrow_is_insurance_ok: true,
                    borrow_inspection_remark: ""
                });
                loadData();
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
        setReturnPhotos({ front: null, back: null, left: null, right: null, mileage: null });
        setReturnData({
            actual_return_date: new Date().toISOString().split("T")[0],
            condition_at_return: "",
            is_damaged: false
        });
        setShowReturnModal(true);
    }

    async function handleReturnSubmit(e: React.FormEvent) {
        e.preventDefault();
        const missingPhotos = Object.entries(returnPhotos).filter(([_, url]) => !url);
        if (missingPhotos.length > 0) {
            setAlert({ visible: true, message: "กรุณาถ่ายรูปความเรียบร้อยทั้ง 5 จุดให้ครบถ้วนก่อนส่งคืน", type: "error" });
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/assets/return", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    borrowing_id: selectedReturn.id,
                    ...returnData,
                    photo_url_return: JSON.stringify(returnPhotos)
                })
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "แจ้งคืนรถยนต์สำเร็จ แจ้งเตือนไปยังหัวหน้าและ HR แล้ว", type: "ok" });
                setShowReturnModal(false);
                loadData();
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        } finally {
            setSubmitting(false);
        }
    }

    const filteredAssets = assets.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.asset_id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className={styles.wrapper}>
            <AlertModal alert={alert} onClose={() => setAlert({ ...alert, visible: false })} />

            <div className={styles.wrap}>
                {/* ── Hero Title ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>ระบบจองและยืมรถยนต์</h1>
                    <div className={styles.heroP} style={{ fontSize: 13, color: "var(--text3)", marginTop: -6, marginBottom: 12 }}>
                        เพื่อการใช้งานรถแท็กซี่ หรือรถยนต์บริษัทในงานเอกสาร/โครงการ
                    </div>
                </div>

                {/* ── Tab Navigation ── */}
                <nav className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === "borrow" ? styles.tabActive : ""}`}
                        onClick={() => setActiveTab("borrow")}
                        style={{ display: "flex", gap: "6px", alignItems: "center" }}
                    >
                        <TruckIcon width={18} /> ยืมรถยนต์
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === "my" ? styles.tabActive : ""}`}
                        onClick={() => setActiveTab("my")}
                        style={{ display: "flex", gap: "6px", alignItems: "center" }}
                    >
                        <ClipboardDocumentListIcon width={18} /> รถที่ยืมอยู่ ({myBorrowings.length})
                    </button>
                </nav>

                {activeTab === "borrow" ? (
                    <>
                        <div className={styles.searchBar}>
                            <div className={styles.searchIcon}><MagnifyingGlassIcon width={20} /></div>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="ค้นหารถยนต์ รุ่น ทะเบียน..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <div className={styles.card} style={{ textAlign: "center", padding: "40px" }}>
                                <ClockIcon width={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
                                <div style={{ fontSize: 14, color: "var(--text3)" }}>กำลังโหลดข้อมูลรถยนต์...</div>
                            </div>
                        ) : filteredAssets.length === 0 ? (
                            <div className={styles.card} style={{ textAlign: "center", padding: "40px" }}>
                                <TruckIcon width={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                                <div style={{ fontSize: 14, color: "var(--text3)" }}>ไม่มีรถยนต์ว่างในขณะนี้</div>
                            </div>
                        ) : (
                            <div className={styles.assetGrid}>
                                {filteredAssets.map(asset => (
                                    <div key={asset.id} className={styles.card}>
                                        <div style={{display: "flex", justifyContent: "space-between", marginBottom: "8px"}}>
                                            <span className={styles.assetId} style={{backgroundColor: "#f1f5f9", color: "#334155", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600}}>
                                                ทะเบียน: {asset.asset_id}
                                            </span>
                                            {asset.company_owner && (
                                                <span style={{fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase"}}>
                                                    {asset.company_owner}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className={styles.assetName}>
                                            {asset.brand && <span style={{opacity: 0.7, marginRight: "4px"}}>{asset.brand}</span>}
                                            {asset.vehicle_model || asset.name}
                                        </h3>
                                        {asset.main_user && (
                                            <div style={{ fontSize: "0.80rem", color: "var(--text3)", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                                                <UserIcon width={12} /> ผู้ถือครองประจำ: {asset.main_user}
                                            </div>
                                        )}
                                        <p className={styles.assetDesc}>{asset.usage_remark || asset.description || "รถส่วนกลาง"}</p>

                                        {asset.image_url && (
                                            <div className={styles.assetImageWrap}>
                                                <img src={asset.image_url} alt={asset.name} className={styles.assetImage} />
                                            </div>
                                        )}

                                        <button
                                            className={`${styles.btn} ${styles.btnPrimary}`}
                                            onClick={() => setSelectedAsset(asset)}
                                            style={{ marginTop: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
                                        >
                                            ดำเนินการจองรถ
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {loading ? (
                            <div className={styles.card} style={{ textAlign: "center", padding: "40px" }}>
                                <ClockIcon width={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
                                <div style={{ fontSize: 14, color: "var(--text3)" }}>กำลังโหลดข้อมูลข้อมูลของท่าน...</div>
                            </div>
                        ) : myBorrowings.length === 0 ? (
                            <div className={styles.card} style={{ textAlign: "center", padding: "40px" }}>
                                <TruckIcon width={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                                <div style={{ fontSize: 14, color: "var(--text3)" }}>คุณยังไม่มีรายการยืมรถยนต์ในขณะนี้</div>
                            </div>
                        ) : (
                            <div className={styles.assetGrid}>
                                {myBorrowings.map(b => (
                                    <div key={b.id} className={styles.card}>
                                        <div className={styles.myHeader}>
                                            <div className={styles.assetId}>{b.assets.asset_id}</div>
                                            <div className={styles.myStatus} style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>กำลังใช้งานรถยนต์</div>
                                        </div>
                                        <h3 className={styles.assetName}>{b.assets.name}</h3>

                                        <div className={styles.myDetails}>
                                            <div className={styles.myDetailItem}>
                                                <span>วันที่ยืม:</span> {new Date(b.borrow_date).toLocaleDateString("th-TH")}
                                            </div>
                                            <div className={styles.myDetailItem}>
                                                <span>กำหนดคืน:</span> {new Date(b.expected_return_date).toLocaleDateString("th-TH")}
                                            </div>
                                            <div className={styles.myDetailItem}>
                                                <span>สถานที่/ผู้ติดต่อ:</span> {b.location || "-"}
                                            </div>
                                        </div>

                                        <button
                                            className={styles.btn}
                                            onClick={() => openReturnModal(b)}
                                            style={{ marginTop: 12, backgroundColor: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1" }}
                                        >
                                            ดำเนินการคืนรถ
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
                            <h2>ยืมรถยนต์: {selectedAsset.name}</h2>
                            <p style={{ fontSize: "12px", color: "var(--text3)", margin: 0 }}>ทะเบียน: {selectedAsset.asset_id}</p>
                            <button className={styles.closeBtn} onClick={() => setSelectedAsset(null)}><XMarkIcon width={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>วันที่เริ่มใช้งาน <span style={{ color: "#dc2626" }}>*</span></label>
                                    <input
                                        type="date"
                                        value={formData.borrow_date}
                                        onChange={e => setFormData({ ...formData, borrow_date: e.target.value })}
                                        required
                                    />
                                </div>
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
                            </div>
                            <div className={styles.formGroup}>
                                <label>สถานที่ปลายทาง หรือชื่อผู้ติดต่องาน <span style={{ color: "#dc2626" }}>*</span></label>
                                <input
                                    type="text"
                                    placeholder="เช่น ไปพบลูกค้าที่ นิคมอุตสาหกรรมบางปู"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>แนบเลขไมล์รถก่อนใช้ หรือตำหนิอื่นๆ</label>
                                <textarea
                                    placeholder="เช่น รถมีรอยขูดขีดที่ประตู หรือเลขไมล์ปัจจุบัน"
                                    value={formData.remark}
                                    onChange={e => setFormData({ ...formData, remark: e.target.value })}
                                />
                            </div>

                            {/* 📋 VEHICLE INSPECTION CHECKLIST (ตามภาพ) */}
                            <div className={styles.checklistSection} style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
                                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <ClipboardDocumentListIcon width={18} /> ตรวจเช็คสภาพรถยนต์ก่อนใช้งาน
                                </h3>

                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    {/* 1. Status */}
                                    <div className={styles.checkItem}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>สถานะ <span style={{color:"red"}}>*</span></label>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                            {["รถอยู่ Tera", "รถอยู่หน้างาน", "รถไม่อยู่ส่งซ่อม"].map(opt => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, borrow_vehicle_status: opt })}
                                                    style={{
                                                        padding: "6px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid",
                                                        backgroundColor: formData.borrow_vehicle_status === opt ? "#1e293b" : "#fff",
                                                        color: formData.borrow_vehicle_status === opt ? "#fff" : "#64748b",
                                                        borderColor: formData.borrow_vehicle_status === opt ? "#1e293b" : "#cbd5e1",
                                                        transition: "all 0.2s"
                                                    }}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. Cleanliness */}
                                    <div className={styles.checkItem}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>การตรวจเช็คความสะอาด ภายนอก/ภายใน <span style={{color:"red"}}>*</span></label>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {[
                                                { label: "สะอาด", val: true },
                                                { label: "ไม่สะอาด", val: false }
                                            ].map(opt => (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, borrow_is_clean: opt.val })}
                                                    style={{
                                                        padding: "6px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid",
                                                        backgroundColor: formData.borrow_is_clean === opt.val ? "#1e293b" : "#fff",
                                                        color: formData.borrow_is_clean === opt.val ? "#fff" : "#64748b",
                                                        borderColor: formData.borrow_is_clean === opt.val ? "#1e293b" : "#cbd5e1"
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 3. Lights */}
                                    <div className={styles.checkItem}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>ไฟหน้า ไฟท้าย ไฟเลี้ยว หน้าจอแสดงผล <span style={{color:"red"}}>*</span></label>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {[
                                                { label: "ปกติ", val: true },
                                                { label: "ไม่ปกติ", val: false }
                                            ].map(opt => (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, borrow_is_lights_ok: opt.val })}
                                                    style={{
                                                        padding: "6px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid",
                                                        backgroundColor: formData.borrow_is_lights_ok === opt.val ? "#1e293b" : "#fff",
                                                        color: formData.borrow_is_lights_ok === opt.val ? "#fff" : "#64748b",
                                                        borderColor: formData.borrow_is_lights_ok === opt.val ? "#1e293b" : "#cbd5e1"
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4. Tires */}
                                    <div className={styles.checkItem}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>สภาพยาง และลมยางล้อรถ <span style={{color:"red"}}>*</span></label>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {[
                                                { label: "ปกติ", val: true },
                                                { label: "ไม่ปกติ", val: false }
                                            ].map(opt => (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, borrow_is_tires_ok: opt.val })}
                                                    style={{
                                                        padding: "6px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid",
                                                        backgroundColor: formData.borrow_is_tires_ok === opt.val ? "#1e293b" : "#fff",
                                                        color: formData.borrow_is_tires_ok === opt.val ? "#fff" : "#64748b",
                                                        borderColor: formData.borrow_is_tires_ok === opt.val ? "#1e293b" : "#cbd5e1"
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 5. Body */}
                                    <div className={styles.checkItem}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>สภาพรถ สีรถ และอุปกรณ์อื่นๆ <span style={{color:"red"}}>*</span></label>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {[
                                                { label: "ปกติ", val: true },
                                                { label: "ไม่ปกติ", val: false }
                                            ].map(opt => (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, borrow_is_body_ok: opt.val })}
                                                    style={{
                                                        padding: "6px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid",
                                                        backgroundColor: formData.borrow_is_body_ok === opt.val ? "#1e293b" : "#fff",
                                                        color: formData.borrow_is_body_ok === opt.val ? "#fff" : "#64748b",
                                                        borderColor: formData.borrow_is_body_ok === opt.val ? "#1e293b" : "#cbd5e1"
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 6. Insurance */}
                                    <div className={styles.checkItem}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>ประกัน พรบ. ภาษี มีอายุมากกว่า 1 เดือน <span style={{color:"red"}}>*</span></label>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {[
                                                { label: "มากกว่า 1 เดือน", val: true },
                                                { label: "น้อยกว่า 1 เดือน", val: false }
                                            ].map(opt => (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, borrow_is_insurance_ok: opt.val })}
                                                    style={{
                                                        padding: "6px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid",
                                                        backgroundColor: formData.borrow_is_insurance_ok === opt.val ? "#1e293b" : "#fff",
                                                        color: formData.borrow_is_insurance_ok === opt.val ? "#fff" : "#64748b",
                                                        borderColor: formData.borrow_is_insurance_ok === opt.val ? "#1e293b" : "#cbd5e1"
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 7. Remark */}
                                    <div className={styles.checkItem}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>ภาพรวมการตรวจเช็คและสาเหตุที่ไม่ปกติ</label>
                                        <textarea
                                            placeholder="ระบุรายละเอียดเพิ่มเติม..."
                                            style={{ minHeight: "60px", fontSize: "12px" }}
                                            value={formData.borrow_inspection_remark}
                                            onChange={e => setFormData({ ...formData, borrow_inspection_remark: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Photo documentation */}
                            <div className={styles.photoGroup}>
                                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span>ถ่ายภาพความเรียบร้อยของรถยนต์ (5 จุด) <span style={{ color: "#dc2626" }}>*</span></span>
                                </label>
                                
                                <div className={styles.photoGrid}>
                                    {[
                                        { id: "front", name: "ด้านหน้า" },
                                        { id: "back", name: "ด้านหลัง" },
                                        { id: "left", name: "ด้านซ้าย" },
                                        { id: "right", name: "ด้านขวา" },
                                        { id: "mileage", name: "เลขไมล์หน้าปัด" }
                                    ].map(slot => (
                                        <div key={slot.id} className={`${styles.photoItem} ${slot.id === 'mileage' ? styles.mileageSlot : ''}`}>
                                            <span className={styles.photoLabel}>{slot.name}</span>
                                            {borrowPhotos[slot.id] ? (
                                                <div className={styles.photoPreviewSlot}>
                                                    <img src={borrowPhotos[slot.id]!} alt={slot.name} className={styles.photoThumb} />
                                                    <button type="button" className={styles.removePhotoSmall} onClick={() => setBorrowPhotos(prev => ({ ...prev, [slot.id]: null }))}>
                                                        เปลี่ยนรูป {slot.name}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className={styles.uploadTrigger}>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        capture="environment"
                                                        id={`borrow-${slot.id}`}
                                                        className={styles.hiddenInput}
                                                        onChange={(e) => handlePhotoUpload(e, "borrow", slot.id)}
                                                    />
                                                    <label htmlFor={`borrow-${slot.id}`} className={styles.uploadBtn}>
                                                        {uploading === `borrow-${slot.id}` ? "..." : <><CameraIcon width={20} /> ถ่ายรูป</>}
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btn} onClick={() => setSelectedAsset(null)} disabled={submitting}>ยกเลิก</button>
                                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={submitting || !!uploading}>
                                    {submitting ? "ระบบกำลังดำเนินการ..." : "ยืนยันการยืมรถยนต์"}
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
                            <h2>ส่งรถคืน: {selectedReturn.assets.name}</h2>
                            <p style={{ fontSize: "12px", color: "var(--text3)", margin: 0 }}>ทะเบียน: {selectedReturn.assets.asset_id}</p>
                            <button className={styles.closeBtn} onClick={() => setShowReturnModal(false)}><XMarkIcon width={20} /></button>
                        </div>
                        <form onSubmit={handleReturnSubmit} className={styles.form}>
                            <div className={styles.photoGroup}>
                                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                    <span>ถ่ายภาพความเรียบร้อยก่อนส่งคืน (5 จุด) <span style={{ color: "#dc2626" }}>*</span></span>
                                </label>
                                
                                <div className={styles.photoGrid}>
                                    {[
                                        { id: "front", name: "ด้านหน้า" },
                                        { id: "back", name: "ด้านหลัง" },
                                        { id: "left", name: "ด้านซ้าย" },
                                        { id: "right", name: "ด้านขวา" },
                                        { id: "mileage", name: "เลขไมล์หน้าปัด" }
                                    ].map(slot => (
                                        <div key={slot.id} className={`${styles.photoItem} ${slot.id === 'mileage' ? styles.mileageSlot : ''}`}>
                                            <span className={styles.photoLabel}>{slot.name}</span>
                                            {returnPhotos[slot.id] ? (
                                                <div className={styles.photoPreviewSlot}>
                                                    <img src={returnPhotos[slot.id]!} alt={slot.name} className={styles.photoThumb} />
                                                    <button type="button" className={styles.removePhotoSmall} onClick={() => setReturnPhotos(prev => ({ ...prev, [slot.id]: null }))}>
                                                        เปลี่ยนรูป {slot.name}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className={styles.uploadTrigger}>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        capture="environment"
                                                        id={`return-${slot.id}`}
                                                        className={styles.hiddenInput}
                                                        onChange={(e) => handlePhotoUpload(e, "return", slot.id)}
                                                    />
                                                    <label htmlFor={`return-${slot.id}`} className={styles.uploadBtn}>
                                                        {uploading === `return-${slot.id}` ? "..." : <><CameraIcon width={20} /> ถ่ายรูป</>}
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>วันที่ส่งคืน <span style={{ color: "#dc2626" }}>*</span></label>
                                <input
                                    type="date"
                                    value={returnData.actual_return_date}
                                    onChange={e => setReturnData({ ...returnData, actual_return_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>บันทึกค่าน้ำมัน เลขไมล์ หรือปัญหาที่พบ</label>
                                <textarea
                                    placeholder="เช่น รถมีคราบดิน หรือน้ำมันเต็มถังแล้ว..."
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
                                <span className={styles.checkboxText}>ฉันพบว่ารถมีปัญหา หรือมีความเสียหาย</span>
                            </label>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btn} onClick={() => setShowReturnModal(false)} disabled={submitting}>ยกเลิก</button>
                                <button type="submit" className={`${styles.btn}`} style={{ backgroundColor: "#0f172a", color: "#fff" }} disabled={submitting || !!uploading}>
                                    {submitting ? "กำลังดำเนินการ..." : "กดยืนยันเพื่อบันทึกการส่งคืน"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
