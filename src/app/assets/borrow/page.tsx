"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
    ArrowLeftIcon
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
    company_name?: string | null;
};

export default function AssetBorrowPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>กำลังโหลด...</div>}>
            <AssetBorrowPageInner />
        </Suspense>
    );
}

function AssetBorrowPageInner() {
    const searchParams = useSearchParams();
    const type = searchParams.get("type") || "item";
    const isEquipment = type === "equipment";

    const [activeTab, setActiveTab] = useState<"borrow" | "my">("borrow");
    const [assets, setAssets] = useState<Asset[]>([]);
    const [myBorrowings, setMyBorrowings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [submitting, setSubmitting] = useState(false);
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
        remark: ""
    });

    useEffect(() => {
        loadData();
    }, [activeTab, type]);

    async function loadData() {
        setLoading(true);
        try {
            if (activeTab === "borrow") {
                const url = isEquipment 
                    ? "/api/assets/available?category_exclude=Car"
                    : "/api/products/available";
                const res = await fetch(url);
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "Failed to fetch");
                }
                const data = await res.json();
                console.log(`[AssetBorrowPage] Loaded ${isEquipment ? 'Equipment' : 'Items'}:`, data);
                
                // Map product fields to asset fields for UI consistency if needed
                const normalized = Array.isArray(data) ? data.map((item: any) => ({
                    id: item.id,
                    asset_id: item.product_code || item.asset_id,
                    name: item.product_name || item.name,
                    description: item.description,
                    image_url: item.image_url,
                    status: item.status,
                    company_name: item.company_name || item.company_owner
                })) : [];
                
                setAssets(normalized);
            } else {
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
                
                setMyBorrowings(normalized);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

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
                photo_url_borrow: borrowPhoto
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
                    remark: ""
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
                                {filteredAssets.map(asset => (
                                    <div key={asset.id} className={styles.card}>
                                        <div className={styles.myHeader}>
                                            <span className={styles.assetId}>{asset.asset_id}</span>
                                            {asset.company_name && (
                                                <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--surface2)", fontWeight: 700, color: "var(--text3)" }}>
                                                    {asset.company_name}
                                                </div>
                                            )}
                                        </div>
                                        <h3 className={styles.assetName}>{asset.name}</h3>
                                        <p className={styles.assetDesc}>{asset.description || "—"}</p>

                                        {asset.image_url && (
                                            <div className={styles.assetImageWrap}>
                                                <div className={styles.museumFrame}>
                                                    <img src={asset.image_url} alt={asset.name} className={styles.assetImage} />
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            className={`${styles.btn} ${styles.btnPrimary}`}
                                            onClick={() => setSelectedAsset(asset)}
                                        >
                                            ดำเนินการยืม{isEquipment ? "อุปกรณ์" : "สินค้า"}
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
