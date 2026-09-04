"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "../assets/borrow/page.module.css";
import AlertModal, { AlertState } from "@/components/AlertModal";
import KeyReturnModal from "@/components/KeyReturnModal";
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
    UserIcon,
    WrenchScrewdriverIcon,
    ShieldExclamationIcon,
    BanknotesIcon,
    PaperClipIcon
} from "@heroicons/react/24/outline";

/** 24-hour time picker using two selects — avoids browser AM/PM locale issues */
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
    asset_borrowings?: {
        id: number;
        borrow_date: string;
        expected_return_date: string;
        status: string;
        employee: { name: string; nickname?: string | null };
    }[];
};

export default function CarBorrowPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<"borrow" | "my">("borrow");

    const { data: assets = [], isLoading: isLoadingAssets } = useQuery({
        queryKey: ["assets", "available", "Car"],
        queryFn: async () => {
            const res = await fetch("/api/assets/available?category=Car");
            const data = await res.json();
            return Array.isArray(data) ? data as Asset[] : [];
        },
        enabled: activeTab === "borrow"
    });

    const { data: myBorrowings = [], isLoading: isLoadingMy } = useQuery({
        queryKey: ["assets", "my", "Car"],
        queryFn: async () => {
            const res = await fetch("/api/assets/my?category=Car");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: activeTab === "my"
    });

    const loading = activeTab === "borrow" ? isLoadingAssets : isLoadingMy;
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
    const [showKeyReturnModal, setShowKeyReturnModal] = useState<any | null>(null);
    const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
    const [returnData, setReturnData] = useState({
        actual_return_date: new Date().toISOString().slice(0, 10),
        actual_return_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        condition_at_return: "",
        is_damaged: false,
        overnight_required: false,
        nights_count: 1,
        // Claim & Maintenance Settlement
        claim_cost: "",
        claim_is_billed: false,
        maintenance_cost: "",
        maintenance_doc_url: null as string | null
    });

    const nowRounded = (() => { const d = new Date(); d.setSeconds(0, 0); return d; })();
    const [formData, setFormData] = useState({
        borrow_date: nowRounded.toISOString().slice(0, 10),
        borrow_time: nowRounded.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        expected_return_date: "",
        expected_return_time: "17:00",
        location: "",
        remark: "",
        // New Inspection Checklist
        borrow_vehicle_status: "รถอยู่ Tera",
        borrow_is_clean: true,
        borrow_is_lights_ok: true,
        borrow_is_tires_ok: true,
        borrow_is_body_ok: true,
        borrow_is_insurance_ok: true,
        borrow_inspection_remark: "",
        // Vehicle Claim Submission
        is_claim: false,
        claim_doc_no: "",
        claim_details: "",
        claim_photo_url: null as string | null,
        // Scheduled Maintenance
        is_maintenance: false,
        maintenance_mileage: ""
    });

    useEffect(() => {
        if (selectedAsset) {
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const hour = now.getHours().toString().padStart(2, "0");
            const minute = (Math.floor(now.getMinutes() / 5) * 5).toString().padStart(2, "0");
            const timeStr = `${hour}:${minute}`;

            setFormData(prev => ({
                ...prev,
                borrow_date: dateStr,
                borrow_time: timeStr
            }));
        }
    }, [selectedAsset]);

    // Data fetching is now handled by useQuery hooks

    async function compressImage(file: File): Promise<File | Blob> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 1600; // Resize to max 1600px

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
                            } else {
                                resolve(file);
                            }
                        },
                        "image/jpeg",
                        0.8 // 80% quality
                    );
                };
            };
        });
    }

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, type: "borrow" | "return", slot: string) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(`${type}-${slot}`);

        try {
            // Compress image before upload
            const processedFile = file.type.startsWith("image/") ? await compressImage(file) : file;

            const form = new FormData();
            form.append("file", processedFile);
            form.append("prefix", `car-${type}-${slot}`);

            const res = await fetch("/api/upload", { method: "POST", body: form });
            const data = await res.json();
            if (data.ok) {
                if (type === "borrow") {
                    setBorrowPhotos(prev => ({ ...prev, [slot]: data.url }));
                } else {
                    setReturnPhotos(prev => ({ ...prev, [slot]: data.url }));
                }
            } else {
                setAlert({ visible: true, message: data.error === "FILE_TOO_LARGE" ? "ไฟล์รูปภาพใหญ่เกินไป กรุณาลดความละเอียด" : (data.error || "Upload Failed"), type: "error" });
            }
        } catch (err) {
            console.error(err);
            setAlert({ visible: true, message: "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง", type: "error" });
        } finally {
            setUploading(null);
            // Clear the input value so the same file can be selected again if needed
            e.target.value = "";
        }
    }

    async function handleClaimPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading("claim-photo");
        try {
            const processedFile = file.type.startsWith("image/") ? await compressImage(file) : file;
            const form = new FormData();
            form.append("file", processedFile);
            form.append("prefix", "car-claim-doc");

            const res = await fetch("/api/upload", { method: "POST", body: form });
            const data = await res.json();
            if (data.ok) {
                setFormData(prev => ({ ...prev, claim_photo_url: data.url }));
            } else {
                setAlert({ visible: true, message: data.error === "FILE_TOO_LARGE" ? "ไฟล์รูปภาพใหญ่เกินไป" : (data.error || "Upload Failed"), type: "error" });
            }
        } catch (err) {
            console.error(err);
            setAlert({ visible: true, message: "เกิดข้อผิดพลาดในการอัปโหลดเอกสารเคลม", type: "error" });
        } finally {
            setUploading(null);
            e.target.value = "";
        }
    }

    async function handleMaintenanceDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading("maintenance-doc");
        try {
            const processedFile = file.type.startsWith("image/") ? await compressImage(file) : file;
            const form = new FormData();
            form.append("file", processedFile);
            form.append("prefix", "car-maint-doc");

            const res = await fetch("/api/upload", { method: "POST", body: form });
            const data = await res.json();
            if (data.ok) {
                setReturnData(prev => ({ ...prev, maintenance_doc_url: data.url }));
            } else {
                setAlert({ visible: true, message: data.error === "FILE_TOO_LARGE" ? "ไฟล์เอกสารใหญ่เกินไป" : (data.error || "Upload Failed"), type: "error" });
            }
        } catch (err) {
            console.error(err);
            setAlert({ visible: true, message: "เกิดข้อผิดพลาดในการอัปโหลดเอกสารเช็คระยะ", type: "error" });
        } finally {
            setUploading(null);
            e.target.value = "";
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedAsset) return;

        if (!formData.expected_return_date || !formData.expected_return_time) {
            setAlert({ visible: true, message: "กรุณาระบุวันที่และเวลาที่กำหนดคืน", type: "error" });
            return;
        }

        const borrowDatetime = `${formData.borrow_date}T${formData.borrow_time}:00`;
        const returnDatetime = `${formData.expected_return_date}T${formData.expected_return_time}:00`;

        if (!formData.location) {
            setAlert({ visible: true, message: "กรุณาระบุสถานที่ปลายทางที่เดินทางไป", type: "error" });
            return;
        }

        // Validate claim inputs if checked
        if (formData.is_claim) {
            if (!formData.claim_doc_no || !formData.claim_doc_no.trim()) {
                setAlert({ visible: true, message: "กรุณาระบุเลขที่เอกสารเคลม", type: "error" });
                return;
            }
            if (!formData.claim_details || !formData.claim_details.trim()) {
                setAlert({ visible: true, message: "กรุณาระบุรายละเอียดการเคลม", type: "error" });
                return;
            }
            if (!formData.claim_photo_url) {
                setAlert({ visible: true, message: "กรุณาแนบรูปถ่ายเอกสารเคลม", type: "error" });
                return;
            }
        }

        // Validate scheduled maintenance inputs if checked
        if (formData.is_maintenance) {
            const mileageNum = Number(formData.maintenance_mileage);
            if (formData.maintenance_mileage === "" || isNaN(mileageNum) || mileageNum < 0) {
                setAlert({ visible: true, message: "กรุณาระบุเลขไมล์ที่นำรถเข้าเช็คระยะให้ถูกต้อง", type: "error" });
                return;
            }
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/assets/borrow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    asset_id: selectedAsset.id,
                    borrow_date: borrowDatetime,
                    expected_return_date: returnDatetime,
                    location: formData.location,
                    remark: formData.remark,
                    borrow_vehicle_status: formData.borrow_vehicle_status,
                    borrow_is_clean: formData.borrow_is_clean,
                    borrow_is_lights_ok: formData.borrow_is_lights_ok,
                    borrow_is_tires_ok: formData.borrow_is_tires_ok,
                    borrow_is_body_ok: formData.borrow_is_body_ok,
                    borrow_is_insurance_ok: formData.borrow_is_insurance_ok,
                    borrow_inspection_remark: formData.borrow_inspection_remark,
                    photo_url_borrow: JSON.stringify(borrowPhotos),
                    // Claim & Maintenance
                    is_claim: formData.is_claim,
                    claim_doc_no: formData.is_claim ? formData.claim_doc_no.trim() : null,
                    claim_details: formData.is_claim ? formData.claim_details.trim() : null,
                    claim_photo_url: formData.is_claim ? formData.claim_photo_url : null,
                    is_maintenance: formData.is_maintenance,
                    maintenance_mileage: formData.is_maintenance ? Number(formData.maintenance_mileage) : null
                })
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "ทำการจองและยืมรถยนต์เรียบร้อยแล้ว แจ้งเตือนส่งไปยัง HR แล้ว", type: "ok" });
                setSelectedAsset(null);
                setBorrowPhotos({ front: null, back: null, left: null, right: null, mileage: null });
                setFormData(prev => ({
                    ...prev,
                    borrow_date: new Date().toISOString().slice(0, 10),
                    borrow_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
                    expected_return_date: "",
                    expected_return_time: "17:00",
                    location: "",
                    remark: "",
                    borrow_vehicle_status: "รถอยู่ Tera",
                    borrow_is_clean: true,
                    borrow_is_lights_ok: true,
                    borrow_is_tires_ok: true,
                    borrow_is_body_ok: true,
                    borrow_is_insurance_ok: true,
                    borrow_inspection_remark: "",
                    is_claim: false,
                    claim_doc_no: "",
                    claim_details: "",
                    claim_photo_url: null,
                    is_maintenance: false,
                    maintenance_mileage: ""
                }));
                queryClient.invalidateQueries({ queryKey: ["assets"] });
            } else {
                const errMsg =
                    data.error === "TIME_OVERLAP" ? data.message :
                        data.error === "INVALID_DATE_RANGE" ? "กรุณากำหนดเวลาคืนให้หลังเวลายืม" :
                            data.error === "INVALID_DATE" ? data.message || "วันที่ไม่ถูกต้อง" :
                                data.message || data.error || "เกิดข้อผิดพลาด";
                setAlert({ visible: true, message: errMsg, type: "error" });
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
            actual_return_date: new Date().toISOString().slice(0, 10),
            actual_return_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
            condition_at_return: "",
            is_damaged: false,
            overnight_required: false,
            nights_count: 1,
            claim_cost: borrowing.claim_cost !== null && borrowing.claim_cost !== undefined ? String(borrowing.claim_cost) : "",
            claim_is_billed: borrowing.claim_is_billed ?? false,
            maintenance_cost: borrowing.maintenance_cost !== null && borrowing.maintenance_cost !== undefined ? String(borrowing.maintenance_cost) : "",
            maintenance_doc_url: borrowing.maintenance_doc_url || null
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
                    actual_return_date: `${returnData.actual_return_date}T${returnData.actual_return_time}:00`,
                    condition_at_return: returnData.condition_at_return,
                    is_damaged: returnData.is_damaged,
                    photo_url_return: JSON.stringify(returnPhotos),
                    overnight_required: returnData.overnight_required,
                    nights_count: returnData.overnight_required ? Number(returnData.nights_count) : null,
                    claim_cost: selectedReturn.is_claim ? (returnData.claim_cost !== "" ? Number(returnData.claim_cost) : null) : null,
                    claim_is_billed: selectedReturn.is_claim ? Boolean(returnData.claim_is_billed) : null,
                    maintenance_cost: selectedReturn.is_maintenance ? (returnData.maintenance_cost !== "" ? Number(returnData.maintenance_cost) : null) : null,
                    maintenance_doc_url: selectedReturn.is_maintenance ? returnData.maintenance_doc_url : null
                })
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "แจ้งคืนรถยนต์สำเร็จ กรุณาดำเนินการคืนกุญแจ", type: "ok" });
                setShowReturnModal(false);
                setShowKeyReturnModal(selectedReturn);
                queryClient.invalidateQueries({ queryKey: ["assets"] });
            } else {
                setAlert({ visible: true, message: data.message || data.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancelBooking(borrowing_id: number) {
        if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?")) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/assets/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ borrowing_id })
            });
            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "ยกเลิกการจองเรียบร้อยแล้ว", type: "ok" });
                queryClient.invalidateQueries({ queryKey: ["assets"] });
            } else {
                setAlert({ visible: true, message: data.error || "เกิดข้อผิดพลาดในการยกเลิก", type: "error" });
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
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                            <span className={styles.assetId} style={{ backgroundColor: "#f1f5f9", color: "#334155", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 }}>
                                                ทะเบียน: {asset.asset_id}
                                            </span>
                                            {asset.company_owner && (
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                                                    {asset.company_owner}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className={styles.assetName}>
                                            {asset.brand && <span style={{ opacity: 0.7, marginRight: "4px" }}>{asset.brand}</span>}
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

                                        {asset.asset_borrowings && asset.asset_borrowings.length > 0 && (
                                            <div style={{ marginTop: 12, padding: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                                                <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <CalendarIcon width={14} /> คิวการใช้งานรถยนต์:
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                                    {asset.asset_borrowings.map((b: any) => {
                                                        const isPendingKey = b.status === "returned" && b.return_status === "PENDING_KEY";
                                                        const now = new Date();
                                                        const expectedReturn = new Date(b.expected_return_date);
                                                        const borrowDate = new Date(b.borrow_date);
                    
                                                        const isOverdue = !isPendingKey && b.status !== "returned" && now > expectedReturn;
                                                        const isCurrentlyUsing = !isPendingKey && b.status !== "returned" && !isOverdue && now >= borrowDate;
                    
                                                        const displayStatus = isPendingKey ? "รอคืนกุญแจ" :
                                                            isOverdue ? "ยังไม่คืนรถ" :
                                                                isCurrentlyUsing ? "กำลังใช้งาน" :
                                                                    b.status === "reserved" ? "จองล่วงหน้า" : "กำลังใช้งาน";
                                                                    
                                                        const badgeStyle = isOverdue ? { bg: "#fee2e2", text: "#b91c1c" } : 
                                                                           displayStatus === "จองล่วงหน้า" ? { bg: "#fef3c7", text: "#92400e" } :
                                                                           isPendingKey ? { bg: "#ffedd5", text: "#ea580c" } : { bg: "#eff6ff", text: "#1d4ed8" };
                                                                           
                                                        return (
                                                            <div key={b.id} style={{ fontSize: "11px", color: "#334155", lineHeight: "1.4", paddingBottom: "6px", borderBottom: "1px solid #f1f5f9" }}>
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2px" }}>
                                                                    <span style={{ fontWeight: 600 }}>
                                                                        {new Date(b.borrow_date).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                                        {" - "}
                                                                        {new Date(b.expected_return_date).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                                    </span>
                                                                    <span style={{ padding: "2px 6px", borderRadius: "8px", fontSize: "9px", fontWeight: 700, backgroundColor: badgeStyle.bg, color: badgeStyle.text, whiteSpace: "nowrap" }}>
                                                                        {displayStatus}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: "10px", color: "#64748b" }}>
                                                                    ผู้ยืม: {b.employee.name} {b.employee.nickname ? `(${b.employee.nickname})` : ""}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
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
                                {myBorrowings.map(b => {
                                    const isPendingKey = b.status === "returned" && b.return_status === "PENDING_KEY";
                                    const now = new Date();
                                    const expectedReturn = new Date(b.expected_return_date);
                                    const borrowDate = new Date(b.borrow_date);

                                    const isOverdue = !isPendingKey && b.status !== "returned" && now > expectedReturn;
                                    const isCurrentlyUsing = !isPendingKey && b.status !== "returned" && !isOverdue && now >= borrowDate;

                                    const displayStatus = isPendingKey ? "รอคืนกุญแจ" :
                                        isOverdue ? "ยังไม่คืนรถ" :
                                            isCurrentlyUsing ? "กำลังใช้งานรถยนต์" :
                                                b.status === "reserved" ? "จองล่วงหน้า" : "กำลังใช้งานรถยนต์";

                                    const statusBg = isOverdue ? "#fee2e2" :
                                        displayStatus === "จองล่วงหน้า" ? "#fef3c7" :
                                            isPendingKey ? "#ffedd5" : "#eff6ff";

                                    const statusColor = isOverdue ? "#b91c1c" :
                                        displayStatus === "จองล่วงหน้า" ? "#92400e" :
                                            isPendingKey ? "#ea580c" : "#1d4ed8";

                                    return (
                                        <div key={b.id} className={styles.card}>
                                            <div className={styles.myHeader}>
                                                <div className={styles.assetId}>{b.assets.asset_id}</div>
                                                <div className={styles.myStatus} style={{
                                                    backgroundColor: statusBg,
                                                    color: statusColor,
                                                    padding: "2px 8px",
                                                    borderRadius: "12px",
                                                    fontSize: "11px",
                                                    fontWeight: 600
                                                }}>
                                                    {displayStatus}
                                                </div>
                                            </div>
                                            <h3 className={styles.assetName}>{b.assets.name}</h3>

                                            {/* Badges for Claim and Maintenance */}
                                            {(b.is_claim || b.is_maintenance) && (
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                                                    {b.is_claim && (
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                                                            <ShieldExclamationIcon width={13} /> ส่งเคลมรถยนต์
                                                        </span>
                                                    )}
                                                    {b.is_maintenance && (
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, backgroundColor: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe" }}>
                                                            <WrenchScrewdriverIcon width={13} /> เช็คระยะ/ซ่อมบำรุง
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className={styles.myDetails}>
                                                <div className={styles.myDetailItem}>
                                                    <span>เวลายืม:</span> {new Date(b.borrow_date).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                                <div className={styles.myDetailItem}>
                                                    <span>กำหนดคืน:</span> {new Date(b.expected_return_date).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                                <div className={styles.myDetailItem}>
                                                    <span>สถานที่/ผู้ติดต่อ:</span> {b.location || "-"}
                                                </div>
                                                {b.is_claim && (
                                                    <div className={styles.myDetailItem} style={{ color: "#92400e" }}>
                                                        <span>เลขที่เอกสารเคลม:</span> {b.claim_doc_no || "-"}
                                                        {b.claim_cost !== null && b.claim_cost !== undefined && (
                                                            <span style={{ marginLeft: 6, fontWeight: 600 }}>
                                                                (ค่าใช้จ่าย: ฿{Number(b.claim_cost).toLocaleString()} - {b.claim_is_billed ? 'เรียกเก็บเงิน' : 'ไม่เรียกเก็บเงิน'})
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {b.is_maintenance && (
                                                    <div className={styles.myDetailItem} style={{ color: "#1e40af" }}>
                                                        <span>ไมล์เข้าเช็ค:</span> {b.maintenance_mileage ? `${Number(b.maintenance_mileage).toLocaleString()} กม.` : "-"}
                                                        {b.maintenance_cost !== null && b.maintenance_cost !== undefined && (
                                                            <span style={{ marginLeft: 6, fontWeight: 600 }}>
                                                                (ค่าใช้จ่าย: ฿{Number(b.maintenance_cost).toLocaleString()})
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                                                {isPendingKey ? (
                                                    <button
                                                        className={styles.btn}
                                                        onClick={() => setShowKeyReturnModal(b)}
                                                        style={{ flex: 1, backgroundColor: "#fff7ed", color: "#ea580c", border: "1px solid #fdba74" }}
                                                    >
                                                        ดำเนินการคืนกุญแจ
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            className={styles.btn}
                                                            onClick={() => openReturnModal(b)}
                                                            style={{ flex: 1, backgroundColor: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1" }}
                                                        >
                                                            ดำเนินการคืนรถ
                                                        </button>
                                                        <button
                                                            className={styles.btn}
                                                            onClick={() => handleCancelBooking(b.id)}
                                                            style={{ flex: 1, backgroundColor: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }}
                                                            disabled={submitting}
                                                        >
                                                            ยกเลิกการจอง
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
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
                                        min={new Date().toISOString().slice(0, 10)}
                                        onChange={e => setFormData({ ...formData, borrow_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>เวลาเริ่มใช้งาน <span style={{ color: "#dc2626" }}>*</span></label>
                                    <TimePicker value={formData.borrow_time} onChange={v => setFormData({ ...formData, borrow_time: v })} required />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>วันที่ที่จะคืน <span style={{ color: "#dc2626" }}>*</span></label>
                                    <input
                                        type="date"
                                        value={formData.expected_return_date}
                                        min={formData.borrow_date || new Date().toISOString().slice(0, 10)}
                                        onChange={e => setFormData({ ...formData, expected_return_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>เวลาที่จะคืน <span style={{ color: "#dc2626" }}>*</span></label>
                                    <TimePicker value={formData.expected_return_time} onChange={v => setFormData({ ...formData, expected_return_time: v })} required />
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

                            {/* 🛡️ CLAIMS & MAINTENANCE OPTIONS */}
                            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
                                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <WrenchScrewdriverIcon width={18} /> ประเภทการใช้งานพิเศษ (ถ้ามี)
                                </h3>

                                {/* Checkbox 1: ส่งเคลมรถยนต์ */}
                                <div style={{ marginBottom: formData.is_claim ? "16px" : "12px" }}>
                                    <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_claim}
                                            onChange={e => setFormData(prev => ({ ...prev, is_claim: e.target.checked }))}
                                            style={{ width: "18px", height: "18px", accentColor: "#b45309", cursor: "pointer" }}
                                        />
                                        <span style={{ fontSize: "14px", fontWeight: 600, color: formData.is_claim ? "#b45309" : "#334155" }}>
                                            การส่งเคลมรถยนต์ (Vehicle Claim Submission)
                                        </span>
                                    </label>

                                    {formData.is_claim && (
                                        <div style={{ marginTop: "10px", padding: "14px", backgroundColor: "#fffbeb", borderRadius: "10px", border: "1px solid #fde68a", display: "flex", flexDirection: "column", gap: "12px" }}>
                                            <div className={styles.formGroup} style={{ margin: 0 }}>
                                                <label style={{ fontSize: "13px", fontWeight: 600, color: "#92400e", marginBottom: "4px", display: "block" }}>
                                                    เลขที่เอกสารเคลม <span style={{ color: "#dc2626" }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="เช่น CLM-2026-0089"
                                                    value={formData.claim_doc_no}
                                                    onChange={e => setFormData(prev => ({ ...prev, claim_doc_no: e.target.value }))}
                                                    required={formData.is_claim}
                                                    style={{ backgroundColor: "#fff", borderColor: "#fcd34d" }}
                                                />
                                            </div>

                                            <div className={styles.formGroup} style={{ margin: 0 }}>
                                                <label style={{ fontSize: "13px", fontWeight: 600, color: "#92400e", marginBottom: "4px", display: "block" }}>
                                                    รายละเอียดการเคลม <span style={{ color: "#dc2626" }}>*</span>
                                                </label>
                                                <textarea
                                                    placeholder="ระบุจุดที่เคลม สาเหตุ หรือศูนย์บริการที่ส่ง..."
                                                    value={formData.claim_details}
                                                    onChange={e => setFormData(prev => ({ ...prev, claim_details: e.target.value }))}
                                                    required={formData.is_claim}
                                                    style={{ minHeight: "70px", backgroundColor: "#fff", borderColor: "#fcd34d" }}
                                                />
                                            </div>

                                            <div className={styles.formGroup} style={{ margin: 0 }}>
                                                <label style={{ fontSize: "13px", fontWeight: 600, color: "#92400e", marginBottom: "4px", display: "block" }}>
                                                    รูปถ่ายเอกสารเคลม <span style={{ color: "#dc2626" }}>*</span>
                                                </label>
                                                {formData.claim_photo_url ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #fcd34d" }}>
                                                        <img src={formData.claim_photo_url} alt="Claim Doc" style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px" }} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>แนบเอกสารเคลมเรียบร้อย</div>
                                                            <a href={formData.claim_photo_url} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: "#2563eb", textDecoration: "underline" }}>ดูรูปเอกสาร</a>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, claim_photo_url: null }))}
                                                            style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "6px", cursor: "pointer" }}
                                                        >
                                                            เปลี่ยนรูป
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <input
                                                            type="file"
                                                            accept="image/*,application/pdf"
                                                            capture="environment"
                                                            id="claim-photo-input"
                                                            style={{ display: "none" }}
                                                            onChange={handleClaimPhotoUpload}
                                                        />
                                                        <label
                                                            htmlFor="claim-photo-input"
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "8px",
                                                                padding: "8px 16px",
                                                                backgroundColor: "#fff",
                                                                border: "1px dashed #f59e0b",
                                                                borderRadius: "8px",
                                                                cursor: "pointer",
                                                                fontSize: "13px",
                                                                color: "#b45309",
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            {uploading === "claim-photo" ? (
                                                                <><ClockIcon width={16} className="animate-spin" /> กำลังอัปโหลด...</>
                                                            ) : (
                                                                <><CameraIcon width={18} /> ถ่ายรูป / เลือกรูปเอกสารเคลม</>
                                                            )}
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Checkbox 2: การนำรถเข้าเช็คระยะ */}
                                <div>
                                    <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_maintenance}
                                            onChange={e => setFormData(prev => ({ ...prev, is_maintenance: e.target.checked }))}
                                            style={{ width: "18px", height: "18px", accentColor: "#2563eb", cursor: "pointer" }}
                                        />
                                        <span style={{ fontSize: "14px", fontWeight: 600, color: formData.is_maintenance ? "#1e40af" : "#334155" }}>
                                            การนำรถเข้าเช็คระยะ (Scheduled Maintenance)
                                        </span>
                                    </label>

                                    {formData.is_maintenance && (
                                        <div style={{ marginTop: "10px", padding: "14px", backgroundColor: "#eff6ff", borderRadius: "10px", border: "1px solid #bfdbfe" }}>
                                            <div className={styles.formGroup} style={{ margin: 0 }}>
                                                <label style={{ fontSize: "13px", fontWeight: 600, color: "#1e40af", marginBottom: "4px", display: "block" }}>
                                                    เลขไมล์ที่นำรถเข้าเช็คระยะ (กิโลเมตร) <span style={{ color: "#dc2626" }}>*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    placeholder="เช่น 45000"
                                                    value={formData.maintenance_mileage}
                                                    onChange={e => setFormData(prev => ({ ...prev, maintenance_mileage: e.target.value }))}
                                                    required={formData.is_maintenance}
                                                    min="0"
                                                    style={{ backgroundColor: "#fff", borderColor: "#93c5fd" }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 📋 VEHICLE INSPECTION CHECKLIST (ตามภาพ) */}
                            <div className={styles.checklistSection} style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
                                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <ClipboardDocumentListIcon width={18} /> ตรวจเช็คสภาพรถยนต์ก่อนใช้งาน
                                </h3>

                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    {/* 1. Status */}
                                    <div className={styles.checkItem}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>สถานะ <span style={{ color: "red" }}>*</span></label>
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
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>การตรวจเช็คความสะอาด ภายนอก/ภายใน <span style={{ color: "red" }}>*</span></label>
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
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>ไฟหน้า ไฟท้าย ไฟเลี้ยว หน้าจอแสดงผล <span style={{ color: "red" }}>*</span></label>
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
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>สภาพยาง และลมยางล้อรถ <span style={{ color: "red" }}>*</span></label>
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
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>สภาพรถ สีรถ และอุปกรณ์อื่นๆ <span style={{ color: "red" }}>*</span></label>
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
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "8px", display: "block" }}>ประกัน พรบ. ภาษี มีอายุมากกว่า 1 เดือน <span style={{ color: "red" }}>*</span></label>
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

                            {/* 
                                Photo documentation for borrowing has been removed at user request.
                                Only return photos are required now.
                            */}

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btn} onClick={() => setSelectedAsset(null)} disabled={submitting}>ยกเลิก</button>
                                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={submitting || !!uploading}>
                                    {submitting ? "ระบบกำลังดำเนินการ..." : (
                                        formData.borrow_date && new Date(`${formData.borrow_date}T${formData.borrow_time}`) > new Date()
                                            ? "ยืนยันการจองล่วงหน้า"
                                            : "ยืนยันการยืมรถยนต์"
                                    )}
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
                                                        {uploading === `return-${slot.id}` ? (
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <ClockIcon width={16} className="animate-spin" />
                                                                <span>กำลังอัปโหลด...</span>
                                                            </div>
                                                        ) : (
                                                            <><CameraIcon width={20} /> ถ่ายรูป</>
                                                        )}
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.formRow}>
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
                                    <label>เวลาที่ส่งคืน <span style={{ color: "#dc2626" }}>*</span></label>
                                    <TimePicker value={returnData.actual_return_time} onChange={v => setReturnData({ ...returnData, actual_return_time: v })} required />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>บันทึกค่าน้ำมัน เลขไมล์ หรือปัญหาที่พบ</label>
                                <textarea
                                    placeholder="เช่น รถมีคราบดิน หรือน้ำมันเต็มถังแล้ว..."
                                    value={returnData.condition_at_return}
                                    onChange={e => setReturnData({ ...returnData, condition_at_return: e.target.value })}
                                />
                            </div>

                            {/* 📄 CLAIM SETTLEMENT (ถ้าเป็นรายการส่งเคลม) */}
                            {selectedReturn.is_claim && (
                                <div style={{ padding: "16px", backgroundColor: "#fffbeb", borderRadius: "10px", marginBottom: "16px", border: "1px solid #fde68a" }}>
                                    <h4 style={{ margin: "0 0 10px 0", color: "#92400e", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700 }}>
                                        <ShieldExclamationIcon width={18} />
                                        สรุปผลการส่งเคลมรถยนต์ (Claim Settlement)
                                    </h4>
                                    <div style={{ fontSize: "12px", color: "#78350f", marginBottom: "12px", backgroundColor: "#fef3c7", padding: "8px 12px", borderRadius: "6px" }}>
                                        <div><strong>เลขที่เอกสารเคลม:</strong> {selectedReturn.claim_doc_no || "-"}</div>
                                        {selectedReturn.claim_details && <div style={{ marginTop: 2 }}><strong>รายละเอียด:</strong> {selectedReturn.claim_details}</div>}
                                        {selectedReturn.claim_photo_url && (
                                            <div style={{ marginTop: "4px" }}>
                                                <a href={selectedReturn.claim_photo_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                                                    ดูรูปถ่ายเอกสารเคลมที่แนบไว้
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup} style={{ margin: 0 }}>
                                            <label style={{ fontSize: "13px", fontWeight: 600, color: "#92400e", marginBottom: "4px", display: "block" }}>
                                                ค่าใช้จ่ายในการเคลม (บาท)
                                            </label>
                                            <input
                                                type="number"
                                                placeholder="ระบุจำนวนเงิน (ถ้ามี หรือใส่ 0)"
                                                value={returnData.claim_cost}
                                                onChange={e => setReturnData({ ...returnData, claim_cost: e.target.value })}
                                                min="0"
                                                step="0.01"
                                                style={{ backgroundColor: "#fff", borderColor: "#fcd34d" }}
                                            />
                                        </div>
                                        <div className={styles.formGroup} style={{ margin: 0 }}>
                                            <label style={{ fontSize: "13px", fontWeight: 600, color: "#92400e", marginBottom: "4px", display: "block" }}>
                                                สถานะการเรียกเก็บเงิน <span style={{ color: "#dc2626" }}>*</span>
                                            </label>
                                            <select
                                                value={returnData.claim_is_billed ? "billed" : "not_billed"}
                                                onChange={e => setReturnData({ ...returnData, claim_is_billed: e.target.value === "billed" })}
                                                style={{ backgroundColor: "#fff", borderColor: "#fcd34d", padding: "8px 12px", borderRadius: "8px", height: "42px", width: "100%" }}
                                            >
                                                <option value="not_billed">ไม่เรียกเก็บเงิน (Not to be billed)</option>
                                                <option value="billed">เรียกเก็บเงิน (To be billed)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 🔧 MAINTENANCE SETTLEMENT (ถ้าเป็นรายการนำรถเข้าเช็คระยะ) */}
                            {selectedReturn.is_maintenance && (
                                <div style={{ padding: "16px", backgroundColor: "#eff6ff", borderRadius: "10px", marginBottom: "16px", border: "1px solid #bfdbfe" }}>
                                    <h4 style={{ margin: "0 0 10px 0", color: "#1e40af", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700 }}>
                                        <WrenchScrewdriverIcon width={18} />
                                        สรุปผลการนำรถเข้าเช็คระยะ (Maintenance Settlement)
                                    </h4>
                                    <div style={{ fontSize: "12px", color: "#1e3a8a", marginBottom: "12px", backgroundColor: "#dbeafe", padding: "8px 12px", borderRadius: "6px" }}>
                                        <div><strong>เลขไมล์ที่บันทึกไว้เมื่อส่งรถ:</strong> {selectedReturn.maintenance_mileage ? `${Number(selectedReturn.maintenance_mileage).toLocaleString()} กม.` : "-"}</div>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#1e40af", marginBottom: "4px", display: "block" }}>
                                            ค่าใช้จ่ายในการเช็คระยะ / ซ่อมบำรุง (บาท)
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="ระบุค่าใช้จ่าย (ถ้ามี หรือใส่ 0)"
                                            value={returnData.maintenance_cost}
                                            onChange={e => setReturnData({ ...returnData, maintenance_cost: e.target.value })}
                                            min="0"
                                            step="0.01"
                                            style={{ backgroundColor: "#fff", borderColor: "#93c5fd" }}
                                        />
                                    </div>

                                    <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: "13px", fontWeight: 600, color: "#1e40af", display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                                            <PaperClipIcon width={16} /> เอกสารประกอบ / ใบเสร็จเช็คระยะ (ไม่บังคับ / Optional)
                                        </label>
                                        <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 8px" }}>
                                            * สามารถแนบภายหลังได้ เนื่องจากอาจนำรถไปใช้พบลูกค้าต่อ
                                        </p>
                                        {returnData.maintenance_doc_url ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #93c5fd" }}>
                                                <div style={{ flex: 1, fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>
                                                    แนบเอกสารเรียบร้อยแล้ว
                                                    <a href={returnData.maintenance_doc_url} target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: "11px", color: "#2563eb", textDecoration: "underline" }}>
                                                        ดูไฟล์เอกสาร
                                                    </a>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setReturnData(prev => ({ ...prev, maintenance_doc_url: null }))}
                                                    style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "6px", cursor: "pointer" }}
                                                >
                                                    ลบออก
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <input
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    capture="environment"
                                                    id="maint-doc-input"
                                                    style={{ display: "none" }}
                                                    onChange={handleMaintenanceDocUpload}
                                                />
                                                <label
                                                    htmlFor="maint-doc-input"
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "8px",
                                                        padding: "8px 16px",
                                                        backgroundColor: "#fff",
                                                        border: "1px dashed #3b82f6",
                                                        borderRadius: "8px",
                                                        cursor: "pointer",
                                                        fontSize: "13px",
                                                        color: "#1d4ed8",
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {uploading === "maintenance-doc" ? (
                                                        <><ClockIcon width={16} className="animate-spin" /> กำลังอัปโหลด...</>
                                                    ) : (
                                                        <><CameraIcon width={18} /> ถ่ายรูป / เลือกไฟล์ใบเสร็จ</>
                                                    )}
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedReturn.assets?.asset_id === "71-1557" && (
                                <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
                                    <h4 style={{ margin: "0 0 12px 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <TruckIcon width={20} />
                                        ค่าเที่ยวขับรถ (Trip Fee)
                                    </h4>

                                    <label className={styles.checkboxLabel} style={{ marginBottom: "12px" }}>
                                        <input
                                            type="checkbox"
                                            checked={returnData.overnight_required}
                                            onChange={e => setReturnData({ ...returnData, overnight_required: e.target.checked })}
                                        />
                                        <span className={styles.checkboxText} style={{ fontWeight: 500 }}>มีการค้างคืน (Overnight stay required)</span>
                                    </label>

                                    {returnData.overnight_required && (
                                        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <label style={{ fontSize: "14px", fontWeight: 500 }}>จำนวนคืนที่ค้าง (Nights):</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    style={{ width: "80px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                                    value={returnData.nights_count}
                                                    onChange={e => setReturnData({ ...returnData, nights_count: parseInt(e.target.value) || 1 })}
                                                />
                                            </div>
                                            <div style={{ padding: "12px", backgroundColor: "#eff6ff", color: "#1e3a8a", borderRadius: "6px", fontSize: "14px", fontWeight: 500, marginTop: "8px" }}>
                                                ค่าตอบแทนที่ได้รับ: {(returnData.nights_count * 600).toLocaleString()} บาท ({returnData.nights_count} × 600)
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

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
            {/* Key Return Modal */}
            {showKeyReturnModal && (
                <KeyReturnModal
                    borrowingId={showKeyReturnModal.id}
                    assetName={showKeyReturnModal.assets.name}
                    onClose={() => setShowKeyReturnModal(null)}
                    onSuccess={() => {
                        setShowKeyReturnModal(null);
                        setAlert({ visible: true, message: "บันทึกการคืนรถและกุญแจรถยนต์สำเร็จ", type: "ok" });
                        queryClient.invalidateQueries({ queryKey: ["assets"] });
                    }}
                />
            )}
        </div>
    );
}
