"use client";

import { useState, useEffect } from "react";
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
    XMarkIcon
} from "@heroicons/react/24/outline";
import AlertModal, { AlertState } from "@/components/AlertModal";

type Asset = {
    id: number;
    asset_id: string;
    name: string;
    category: string | null;
    status: "available" | "borrowed" | "maintenance" | "damaged";
    asset_borrowings: Array<{
        id: number;
        emp_id: string;
        employee: { name: string };
        borrow_date: string;
        expected_return_date: string;
        status: string;
    }>;
};

export default function AdminAssetsPage() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
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
        status: "available"
    });
    const [assetSaving, setAssetSaving] = useState(false);

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [assetHistory, setAssetHistory] = useState<any[]>([]);

    async function loadAssets() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/assets?category_exclude=Car");
            if (res.ok) {
                const data = await res.json();
                setAssets(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAssets();
    }, []);

    function openAddModal() {
        setIsEditing(false);
        setAssetForm({ id: undefined, asset_id: "", name: "", avg_category: "", category: "", description: "", status: "available" });
        setShowAssetModal(true);
    }

    function openEditModal(asset: Asset) {
        setIsEditing(true);
        setAssetForm({ 
            id: asset.id, 
            asset_id: asset.asset_id, 
            name: asset.name, 
            category: asset.category || "", 
            avg_category: "",
            description: "", // todo: add to fetch if needed
            status: asset.status 
        });
        setShowAssetModal(true);
    }

    async function handleAssetSubmit(e: React.FormEvent) {
        e.preventDefault();
        setAssetSaving(true);
        try {
            const url = isEditing ? `/api/admin/assets/${assetForm.id}` : "/api/admin/assets";
            const method = isEditing ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(assetForm)
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: `บันทึกข้อมูล ${assetForm.name} เรียบร้อยแล้ว`, type: "ok" });
                setShowAssetModal(false);
                loadAssets();
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
                loadAssets();
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

            const res = await fetch("/api/admin/assets/return", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyPayload)
            });

            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "รับคืนอุปกรณ์เรียบร้อยแล้ว", type: "ok" });
                setShowReturnModal(false);
                loadAssets();
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
        } catch (e) {}
        return [photoUrl];
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
                    <h1 className={styles.title}>จัดการอุปกรณ์ (Assets)</h1>
                    <p className={styles.subtitle}>จัดการอุปกรณ์บริษัท การยืม-คืน และประวัติการใช้งาน</p>
                </div>
                <button className={styles.addBtn} onClick={openAddModal}>
                    <PlusIcon width={20} /> เพิ่มอุปกรณ์
                </button>
            </div>

            <div className={styles.statsBar}>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>ทั้งหมด</span>
                    <span className={styles.statVal}>{assets.length}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>กำลังถูกยืม</span>
                    <span className={styles.statVal}>{assets.filter(a => a.status === "borrowed").length}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>พร้อมใช้งาน</span>
                    <span className={styles.statVal}>{assets.filter(a => a.status === "available").length}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>ชำรุด</span>
                    <span className={styles.statVal} style={{ color: "#dc2626" }}>{assets.filter(a => a.status === "damaged").length}</span>
                </div>
            </div>

            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>อุปกรณ์</th>
                            <th>สถานะ</th>
                            <th>ผู้ยืมปัจจุบัน</th>
                            <th>กำหนดคืน</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className={styles.loading}>กำลังโหลด...</td></tr>
                        ) : assets.length === 0 ? (
                            <tr><td colSpan={5} className={styles.loading}>ไม่มีข้อมูลอุปกรณ์</td></tr>
                        ) : (
                            assets.map(asset => {
                                const currentBorrow = asset.asset_borrowings.find(b => b.status === "borrowed");
                                return (
                                    <tr key={asset.id}>
                                        <td>
                                            <div className={styles.assetName}>{asset.name}</div>
                                            <div className={styles.assetId}>{asset.asset_id} • {asset.category}</div>
                                        </td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[asset.status]}`}>
                                                {asset.status === "available" ? "พร้อมใช้งาน" : 
                                                 asset.status === "borrowed" ? "ถูกยืม" : 
                                                 asset.status === "damaged" ? "ชำรุด" : "ซ่อมบำรุง"}
                                            </span>
                                        </td>
                                        <td>
                                            {currentBorrow ? (
                                                <div className={styles.borrowerInfo}>
                                                    <UserIcon width={14} />
                                                    {currentBorrow.employee.name}
                                                </div>
                                            ) : "—"}
                                        </td>
                                        <td>
                                            {currentBorrow ? (
                                                <div className={styles.dateInfo}>
                                                    <ClockIcon width={14} />
                                                    {new Date(currentBorrow.expected_return_date).toLocaleDateString("th-TH")}
                                                </div>
                                            ) : "—"}
                                        </td>
                                        <td>
                                            <div className={styles.actions}>
                                                {asset.status === "borrowed" && (
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
                                                {asset.status !== "borrowed" && (
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
                            <h2>{isEditing ? "แก้ไขข้อมูลอุปกรณ์" : "เพิ่มอุปกรณ์ใหม่"}</h2>
                            <p>{isEditing ? "ปรับปรุงรายละเอียดของอุปกรณ์ในระบบ" : "ลงทะเบียนอุปกรณ์ใหม่เข้าสู่ระบบ"}</p>
                        </div>
                        <form onSubmit={handleAssetSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.inputGroup}>
                                    <label>Asset ID (รหัสอุปกรณ์)</label>
                                    <input 
                                        type="text" 
                                        placeholder="เช่น NB-001, PRJ-05"
                                        value={assetForm.asset_id}
                                        onChange={e => setAssetForm({...assetForm, asset_id: e.target.value})}
                                        required
                                        disabled={isEditing}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>ชื่ออุปกรณ์</label>
                                    <input 
                                        type="text" 
                                        placeholder="เช่น Laptop Dell Vostro"
                                        value={assetForm.name}
                                        onChange={e => setAssetForm({...assetForm, name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>หมวดหมู่</label>
                                    <select 
                                        value={assetForm.category}
                                        onChange={e => setAssetForm({...assetForm, category: e.target.value})}
                                    >
                                        <option value="">เลือกหมวดหมู่...</option>
                                        <option value="Notebook">Notebook</option>
                                        <option value="PC">PC / Monitor</option>
                                        <option value="Peripheral">Peripheral (Mouse/Keyboard)</option>
                                        <option value="Camera">Camera</option>
                                        <option value="Tool">Tool (เครื่องมือช่าง)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                {isEditing && (
                                    <div className={styles.inputGroup}>
                                        <label>สถานะ</label>
                                        <select 
                                            value={assetForm.status}
                                            onChange={e => setAssetForm({...assetForm, status: e.target.value as any})}
                                        >
                                            <option value="available">พร้อมใช้งาน</option>
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
                            <h2>รับคืนอุปกรณ์</h2>
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
                                <label>สภาพอุปกรณ์เมื่อคืน</label>
                                <textarea 
                                    placeholder="ระบุความเสียหาย หรือ สภาพหลังการใช้งาน..."
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
                                    อุปกรณ์ชำรุด / เสียหาย
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
                                <p>รหัสคุณครุภัณฑ์: {selectedAsset.asset_id}</p>
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
                                                <div className={styles.historyField}>
                                                    <span className={styles.historyLabel}>สถานะ:</span> {item.status === 'borrowed' ? 'อยู่ระหว่างการยืม' : 'คืนแล้ว'}
                                                </div>
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
        </div>
    );
}
