"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";
import { 
    PlusIcon, 
    PencilSquareIcon,
    ClipboardDocumentListIcon,
    ChartBarIcon,
    ArchiveBoxIcon,
    MagnifyingGlassIcon,
    CheckCircleIcon,
    XMarkIcon,
    UserIcon,
    ClockIcon,
    CheckIcon,
    ArrowDownTrayIcon
} from "@heroicons/react/24/outline";
import AlertModal, { AlertState } from "@/components/AlertModal";

type Tab = "requests" | "inventory" | "reports";

export default function AdminClothingPage() {
    return (
        <Suspense fallback={<div className={styles.loading}>กำลังโหลด...</div>}>
            <AdminClothingPageInner />
        </Suspense>
    );
}

function AdminClothingPageInner() {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<Tab>("requests");
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });

    const { data, isLoading: loading } = useQuery({
        queryKey: ['admin-clothing'],
        queryFn: async () => {
            const [reqRes, itemRes, repRes] = await Promise.all([
                fetch("/api/admin/clothing/requests").then(r => r.json()),
                fetch("/api/admin/clothing/items").then(r => r.json()),
                fetch("/api/admin/clothing/reports").then(r => r.json())
            ]);
            return {
                requests: Array.isArray(reqRes) ? reqRes : [],
                items: Array.isArray(itemRes) ? itemRes : [],
                reports: repRes && !repRes.error ? repRes : null
            };
        }
    });

    const requests = data?.requests || [];
    const items = data?.items || [];
    const reports = data?.reports || null;

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // Modals
    const [editingItem, setEditingItem] = useState<any>(null);
    const [showItemModal, setShowItemModal] = useState(false);
    
    const [actionRequest, setActionRequest] = useState<any>(null);
    const [adminNote, setAdminNote] = useState("");
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionType, setActionType] = useState<"approved" | "rejected" | "fulfilled" | null>(null);
    const [actionSaving, setActionSaving] = useState(false);



    // Inventory Handlers
    function handleEditItem(item: any) {
        setEditingItem(JSON.parse(JSON.stringify(item))); // Deep copy
        setShowItemModal(true);
    }

    function handleAddItem() {
        setEditingItem({
            name: "",
            description: "",
            image_url: "",
            is_active: true,
            variants: [{ size: "M", stock_quantity: 0 }]
        });
        setShowItemModal(true);
    }

    async function saveItem() {
        try {
            const method = editingItem.id ? "PUT" : "POST";
            const res = await fetch("/api/admin/clothing/items", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingItem)
            });
            if (res.ok) {
                setAlert({ visible: true, message: "บันทึกข้อมูลสินค้าเรียบร้อย", type: "ok" });
                setShowItemModal(false);
                queryClient.invalidateQueries({ queryKey: ['admin-clothing'] });
            } else {
                setAlert({ visible: true, message: "บันทึกไม่สำเร็จ", type: "error" });
            }
        } catch (e: any) {
            setAlert({ visible: true, message: e.message, type: "error" });
        }
    }

    // Request Handlers
    function openActionModal(req: any, type: "approved" | "rejected" | "fulfilled") {
        setActionRequest(req);
        setActionType(type);
        setAdminNote("");
        setShowActionModal(true);
    }

    async function submitAction() {
        setActionSaving(true);
        try {
            const res = await fetch(`/api/admin/clothing/requests/${actionRequest.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: actionType,
                    admin_note: adminNote,
                    approved_by: "Admin" 
                })
            });
            const data = await res.json();
            if (res.ok) {
                setAlert({ visible: true, message: "ดำเนินการเรียบร้อยแล้ว", type: "ok" });
                setShowActionModal(false);
                queryClient.invalidateQueries({ queryKey: ['admin-clothing'] });
            } else {
                setAlert({ visible: true, message: data.error || "ดำเนินการไม่สำเร็จ", type: "error" });
            }
        } catch (e: any) {
            setAlert({ visible: true, message: e.message, type: "error" });
        } finally {
            setActionSaving(false);
        }
    }

    function renderReports() {
        if (!reports) return <div className={styles.loading}>กำลังโหลดข้อมูล...</div>;
        
        return (
            <div className={styles.reportContainer}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                    <button 
                        className={styles.addBtn} 
                        style={{ background: "#10b981" }}
                        onClick={() => window.location.href = "/api/admin/clothing/reports/export"}
                    >
                        <ArrowDownTrayIcon width={18} /> ส่งออกเป็น Excel (Excel Export)
                    </button>
                </div>
                <div className={styles.grid2Col}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                                <ChartBarIcon width={18} style={{ display: "inline", marginRight: 8 }} />
                                สถิติคำขอ
                            </div>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.miniTable}>
                                <thead>
                                    <tr>
                                        <th>สถานะ</th>
                                        <th style={{ textAlign: "right" }}>จำนวน (รายการ)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><span className={`${styles.badge} ${styles.pending}`}>รอดำเนินการ</span></td>
                                        <td style={{ textAlign: "right", fontWeight: 700 }}>{reports.statusCounts?.find((c:any) => c.status === 'pending')?._count.id || 0}</td>
                                    </tr>
                                    <tr>
                                        <td><span className={`${styles.badge} ${styles.approved}`}>อนุมัติแล้ว</span></td>
                                        <td style={{ textAlign: "right", fontWeight: 700 }}>{reports.statusCounts?.find((c:any) => c.status === 'approved')?._count.id || 0}</td>
                                    </tr>
                                    <tr>
                                        <td><span className={`${styles.badge} ${styles.fulfilled}`}>ส่งมอบแล้ว</span></td>
                                        <td style={{ textAlign: "right", fontWeight: 700 }}>{reports.statusCounts?.find((c:any) => c.status === 'fulfilled')?._count.id || 0}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                                <ChartBarIcon width={18} style={{ display: "inline", marginRight: 8 }} />
                                สินค้าที่เบิกบ่อยที่สุด
                            </div>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.miniTable}>
                                <thead>
                                    <tr>
                                        <th>ชื่อสินค้า</th>
                                        <th style={{ textAlign: "right" }}>จำนวน (ตัว)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(reports.itemDistribution || {}).sort((a: any, b: any) => b[1] - a[1]).map(([name, count]: any, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{name}</td>
                                            <td style={{ textAlign: "right", fontWeight: 700 }}>{count}</td>
                                        </tr>
                                    ))}
                                    {Object.keys(reports.itemDistribution || {}).length === 0 && (
                                        <tr><td colSpan={2} style={{ textAlign: "center" }}>ไม่มีข้อมูล</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}>
                            <ArchiveBoxIcon width={18} style={{ display: "inline", marginRight: 8 }} />
                            สินค้าระดับสต๊อกต่ำ (ใกล้หมด)
                        </div>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.miniTable}>
                            <thead>
                                <tr>
                                    <th>สินค้า</th>
                                    <th>ไซส์</th>
                                    <th>สต๊อกคงเหลือ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.lowStock?.filter((v:any) => v.stock_quantity <= 10).map((v:any) => (
                                    <tr key={v.id}>
                                        <td style={{ fontWeight: 600 }}>{v.item?.name}</td>
                                        <td>{v.size}</td>
                                        <td>
                                            <span style={{ color: v.stock_quantity === 0 ? "var(--bad)" : "var(--late)", fontWeight: 700 }}>
                                                {v.stock_quantity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {reports.lowStock?.filter((v:any) => v.stock_quantity <= 10).length === 0 && (
                                    <tr><td colSpan={3} style={{ textAlign: "center" }}>ไม่มีสินค้าใกล้หมด</td></tr>
                                )}
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
                onClose={() => setAlert({ ...alert, visible: false })} 
            />

            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>ระบบจัดการชุดยูนิฟอร์ม</h1>
                    <p className={styles.subtitle}>จัดการคำขอเบิก สต๊อกสินค้า และรายงาน (สำหรับ Admin / HR)</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {(viewMode === "requests" || viewMode === "inventory") && (
                        <div className={styles.searchWrapper} style={{ minWidth: 300 }}>
                            <MagnifyingGlassIcon width={18} className={styles.searchIcon} />
                            <input 
                                type="text" 
                                className={styles.searchInput}
                                placeholder="ค้นหาชื่อพนักงาน หรือชื่อสินค้า..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    )}
                    {viewMode === "inventory" && (
                        <button className={styles.addBtn} onClick={() => handleAddItem()}>
                            <PlusIcon width={20} /> เพิ่มสินค้าใหม่
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.viewToggle}>
                <button 
                    className={`${styles.toggleBtn} ${viewMode === "requests" ? styles.active : ""}`}
                    onClick={() => setViewMode("requests")}
                >
                    <ClipboardDocumentListIcon width={18} style={{ display: "inline", marginRight: 6, verticalAlign: "text-bottom" }} />
                    คำขอเบิก {requests.filter(r => r.status === 'pending').length > 0 && `(${requests.filter(r => r.status === 'pending').length})`}
                </button>
                <button 
                    className={`${styles.toggleBtn} ${viewMode === "inventory" ? styles.active : ""}`}
                    onClick={() => setViewMode("inventory")}
                >
                    <ArchiveBoxIcon width={18} style={{ display: "inline", marginRight: 6, verticalAlign: "text-bottom" }} />
                    สต๊อกสินค้า
                </button>
                <button 
                    className={`${styles.toggleBtn} ${viewMode === "reports" ? styles.active : ""}`}
                    onClick={() => setViewMode("reports")}
                >
                    <ChartBarIcon width={18} style={{ display: "inline", marginRight: 6, verticalAlign: "text-bottom" }} />
                    Dashboard & รายงาน
                </button>
            </div>

            {viewMode === "requests" && (
                <>
                    <div className={styles.statsBar}>
                        <div className={`${styles.statCard} ${filterStatus === "all" ? styles.active : ""}`} onClick={() => setFilterStatus("all")}>
                            <span className={styles.statLabel}>คำขอทั้งหมด</span>
                            <span className={styles.statVal}>{requests.length}</span>
                        </div>
                        <div className={`${styles.statCard} ${filterStatus === "pending" ? styles.active : ""}`} onClick={() => setFilterStatus("pending")}>
                            <span className={styles.statLabel}>รอดำเนินการ</span>
                            <span className={styles.statVal} style={{ color: "#b45309" }}>{requests.filter(r => r.status === "pending").length}</span>
                        </div>
                        <div className={`${styles.statCard} ${filterStatus === "approved" ? styles.active : ""}`} onClick={() => setFilterStatus("approved")}>
                            <span className={styles.statLabel}>รอส่งมอบ</span>
                            <span className={styles.statVal} style={{ color: "#4338ca" }}>{requests.filter(r => r.status === "approved").length}</span>
                        </div>
                    </div>

                    <div className={styles.tableCard}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>วันที่</th>
                                    <th>พนักงาน</th>
                                    <th>รายการ / ไซส์</th>
                                    <th>จำนวน</th>
                                    <th>สถานะ</th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className={styles.loading}>กำลังโหลด...</td></tr>
                                ) : (() => {
                                    const filtered = requests.filter(r => {
                                        const matchesSearch = 
                                            r.employee?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            r.variant?.item?.name?.toLowerCase().includes(searchQuery.toLowerCase());
                                        const matchesStatus = filterStatus === "all" || r.status === filterStatus;
                                        return matchesSearch && matchesStatus;
                                    });

                                    if (filtered.length === 0) return <tr><td colSpan={6} className={styles.loading}>ไม่พบข้อมูลคำขอ</td></tr>;

                                    return filtered.map(r => (
                                        <tr key={r.id}>
                                            <td style={{ fontSize: 13, color: "var(--text4)" }}>
                                                {new Date(r.requested_at).toLocaleDateString("th-TH")}
                                            </td>
                                            <td>
                                                <div className={styles.assetName}>{r.employee?.name}</div>
                                                <div className={styles.assetId}>{r.employee?.departments?.name || "ไม่ระบุแผนก"}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{r.variant?.item?.name}</div>
                                                <div style={{ fontSize: 13, color: "var(--text4)" }}>ไซส์: {r.variant?.size}</div>
                                            </td>
                                            <td style={{ fontWeight: 700 }}>{r.quantity}</td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${styles[r.status]}`}>
                                                    {r.status === 'approved' ? 'อนุมัติ' :
                                                     r.status === 'fulfilled' ? 'ส่งมอบแล้ว' :
                                                     r.status === 'rejected' ? 'ไม่อนุมัติ' : 'รอตรวจสอบ'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={styles.actions}>
                                                    {r.status === "pending" && (
                                                        <>
                                                            <button className={styles.successBtn} onClick={() => openActionModal(r, "approved")}>อนุมัติ</button>
                                                            <button className={styles.dangerBtn} onClick={() => openActionModal(r, "rejected")}>ปฏิเสธ</button>
                                                        </>
                                                    )}
                                                    {r.status === "approved" && (
                                                        <button className={styles.infoBtn} onClick={() => openActionModal(r, "fulfilled")}>ส่งมอบของแล้ว</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {viewMode === "inventory" && (
                <div className={styles.tableCard}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>รหัส</th>
                                <th>ชื่อสินค้า</th>
                                <th>รายละเอียดสต๊อก (ไซส์)</th>
                                <th>รวมสต๊อก</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className={styles.loading}>กำลังโหลด...</td></tr>
                            ) : (() => {
                                const filtered = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
                                if (filtered.length === 0) return <tr><td colSpan={5} className={styles.loading}>ไม่พบสินค้า</td></tr>;
                                
                                return filtered.map(item => {
                                    const totalStock = item.variants.reduce((sum: number, v: any) => sum + v.stock_quantity, 0);
                                    return (
                                        <tr key={item.id}>
                                            <td style={{ color: "var(--text4)" }}>{item.id}</td>
                                            <td style={{ fontWeight: 700 }}>{item.name}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {item.variants.map((v: any) => (
                                                        <span key={v.id} style={{ 
                                                            padding: '2px 8px', 
                                                            background: v.stock_quantity > 0 ? '#f1f5f9' : '#fee2e2', 
                                                            color: v.stock_quantity > 0 ? '#1e293b' : '#b91c1c',
                                                            borderRadius: 4, 
                                                            fontSize: 12,
                                                            fontWeight: 600
                                                        }}>
                                                            {v.size}: {v.stock_quantity}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 700, color: totalStock > 0 ? "#16a34a" : "#dc2626" }}>
                                                    {totalStock}
                                                </span>
                                            </td>
                                            <td>
                                                <button className={styles.editBtn} onClick={() => handleEditItem(item)}>
                                                    <PencilSquareIcon width={18} /> แก้ไข
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            )}

            {viewMode === "reports" && renderReports()}

            {/* Modals */}
            
            {showActionModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>
                                {actionType === "approved" ? "ยืนยันการอนุมัติ" :
                                 actionType === "rejected" ? "ยืนยันการปฏิเสธคำขอ" : "ยืนยันการส่งมอบชุด"}
                            </h2>
                            <p>กรุณาตรวจสอบข้อมูลก่อนดำเนินการ</p>
                        </div>
                        <div style={{ marginBottom: 16, padding: "12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                            <div>พนักงาน: <b>{actionRequest?.employee?.name}</b></div>
                            <div>รายการ: {actionRequest?.variant?.item?.name} (ไซส์ {actionRequest?.variant?.size})</div>
                            <div>จำนวน: {actionRequest?.quantity} ตัว</div>
                        </div>
                        
                        {actionType === "approved" && (
                            <div style={{ padding: "12px", background: "#fef3c7", color: "#b45309", borderRadius: "var(--radius-sm)", marginBottom: 16, fontSize: 13, display: "flex", gap: 6 }}>
                                <CheckIcon width={16} /> <b>การอนุมัติ จะทำการตัดสต๊อกสินค้าทันที!</b>
                            </div>
                        )}

                        <div className={styles.inputGroup}>
                            <label>หมายเหตุ (Optional)</label>
                            <input 
                                value={adminNote} 
                                onChange={e => setAdminNote(e.target.value)} 
                                placeholder="พิมพ์ข้อความเพิ่มเติมถึงพนักงาน..."
                            />
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowActionModal(false)}>ยกเลิก</button>
                            <button className={styles.confirmBtn} onClick={submitAction} disabled={actionSaving}>
                                {actionSaving ? "กำลังบันทึก..." : "ยืนยัน"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showItemModal && editingItem && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal} style={{ width: 500 }}>
                        <div className={styles.modalHeader}>
                            <h2>{editingItem.id ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าใหม่"}</h2>
                            <p>จัดการข้อมูลสินค้าและจำนวนสต๊อกแยกตามไซส์</p>
                        </div>
                        <div className={styles.modalScroll} style={{ maxHeight: "60vh" }}>
                            <div className={styles.inputGroup}>
                                <label>ชื่อสินค้า</label>
                                <input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>คำอธิบาย</label>
                                <textarea rows={2} value={editingItem.description || ""} onChange={e => setEditingItem({...editingItem, description: e.target.value})} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>จัดการไซส์และสต๊อก</label>
                                {editingItem.variants.map((v: any, i: number) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                        <input style={{ flex: 1 }} placeholder="ไซส์ (เช่น M, L)" value={v.size} onChange={e => {
                                            const newV = [...editingItem.variants];
                                            newV[i].size = e.target.value;
                                            setEditingItem({...editingItem, variants: newV});
                                        }}/>
                                        <input type="number" style={{ width: 100 }} placeholder="จำนวน" value={v.stock_quantity} onChange={e => {
                                            const newV = [...editingItem.variants];
                                            newV[i].stock_quantity = Number(e.target.value);
                                            setEditingItem({...editingItem, variants: newV});
                                        }}/>
                                        <button 
                                            className={styles.dangerBtn} 
                                            style={{ padding: "0 12px" }}
                                            onClick={() => {
                                                const newV = editingItem.variants.filter((_: any, idx: number) => idx !== i);
                                                setEditingItem({...editingItem, variants: newV});
                                            }}
                                        >
                                            <XMarkIcon width={16} />
                                        </button>
                                    </div>
                                ))}
                                <button className={styles.borrowActionBtn} style={{ marginTop: 8 }} onClick={() => {
                                    setEditingItem({...editingItem, variants: [...editingItem.variants, { size: "", stock_quantity: 0 }]});
                                }}>
                                    <PlusIcon width={14} /> เพิ่มไซส์
                                </button>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowItemModal(false)}>ยกเลิก</button>
                            <button className={styles.confirmBtn} onClick={saveItem}>บันทึกข้อมูล</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
