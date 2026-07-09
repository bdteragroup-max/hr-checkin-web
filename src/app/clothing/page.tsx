"use client";

import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import { 
    CheckCircleIcon, 
    ArrowPathIcon,
    XCircleIcon,
    ChevronDownIcon,
    ChevronUpIcon
} from "@heroicons/react/24/outline";

type Variant = {
    id: number;
    size: string;
    stock_quantity: number;
};

type Item = {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    variants: Variant[];
};

type RequestHistory = {
    id: number;
    status: string;
    quantity: number;
    requested_at: string;
    reason: string | null;
    variant: {
        id: number;
        size: string;
        item: { 
            name: string;
            variants?: { id: number; size: string; stock_quantity: number; }[];
        };
    };
    admin_note: string | null;
};

export default function ClothingPage() {
    const [me, setMe] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<Item[]>([]);
    const [history, setHistory] = useState<RequestHistory[]>([]);
    
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState("");

    const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
    const [editVariantId, setEditVariantId] = useState<number | null>(null);
    const [editQuantity, setEditQuantity] = useState(1);
    const [editReason, setEditReason] = useState("");
    
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState<{ text: string, type: 'ok' | 'bad' } | null>(null);

    async function loadData() {
        try {
            setLoading(true);
            const [meRes, itemsRes] = await Promise.all([
                fetch("/api/me").then(r => r.json()),
                fetch("/api/clothing/items").then(r => r.json())
            ]);
            
            setMe(meRes);
            setItems(itemsRes || []);
            
            if (meRes?.emp_id) {
                const histRes = await fetch(`/api/clothing/requests?emp_id=${meRes.emp_id}`).then(r => r.json());
                setHistory(histRes || []);
            }
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadData(); }, []);

    async function submitRequest() {
        if (!me?.emp_id) return setMsg({ text: "ไม่พบข้อมูลพนักงาน", type: 'bad' });
        if (!selectedVariantId) return setMsg({ text: "กรุณาเลือกไซส์", type: 'bad' });
        if (quantity < 1) return setMsg({ text: "จำนวนต้องมากกว่า 0", type: 'bad' });

        setSubmitting(true);
        setMsg(null);
        try {
            const r = await fetch("/api/clothing/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emp_id: me.emp_id,
                    variant_id: selectedVariantId,
                    quantity,
                    reason
                })
            });
            const data = await r.json();
            
            if (!r.ok) {
                throw new Error(data.error || "เกิดข้อผิดพลาดในการส่งคำขอ");
            }
            
            setMsg({ text: "ส่งคำขอเบิกสำเร็จ!", type: 'ok' });
            setSelectedItem(null);
            setSelectedVariantId(null);
            setQuantity(1);
            setReason("");
            loadData(); // refresh stock and history
            
            setTimeout(() => setMsg(null), 5000);
        } catch (error: any) {
            setMsg({ text: error.message, type: 'bad' });
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteRequest(id: number) {
        if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำขอนี้?")) return;
        setSubmitting(true);
        try {
            const r = await fetch(`/api/clothing/requests/${id}`, { method: "DELETE" });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการยกเลิก");
            setMsg({ text: "ยกเลิกคำขอเรียบร้อยแล้ว", type: 'ok' });
            loadData();
        } catch (e: any) {
            setMsg({ text: e.message, type: 'bad' });
        } finally {
            setSubmitting(false);
        }
    }

    async function updateRequest(id: number) {
        setSubmitting(true);
        try {
            const r = await fetch(`/api/clothing/requests/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ variant_id: editVariantId, quantity: editQuantity, reason: editReason })
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการแก้ไข");
            setMsg({ text: "แก้ไขคำขอเรียบร้อยแล้ว", type: 'ok' });
            setEditingRequestId(null);
            loadData();
        } catch (e: any) {
            setMsg({ text: e.message, type: 'bad' });
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}><ArrowPathIcon className="animate-spin inline mr-2" width={24} /> กำลังโหลดข้อมูล...</div>;

    const selectedVariantStock = selectedItem?.variants.find(v => v.id === selectedVariantId)?.stock_quantity || 0;

    return (
        <div className={styles.wrapper}>
            {/* HERO */}
            <div className={styles.hero}>
                <h1 className={styles.heroH1}>เบิกชุดยูนิฟอร์ม</h1>
                <div className={styles.heroMeta}>
                    <div className={styles.heroMetaItem}>
                        <div className={styles.heroMetaDot} />
                        ทำรายการเบิกชุดยูนิฟอร์ม เสื้อช็อป อุปกรณ์
                    </div>
                </div>
            </div>

            <div className={styles.wrap}>
                {msg && (
                    <div className={`${styles.alert} ${msg.type === 'ok' ? styles.alertOk : styles.alertBad}`}>
                        {msg.type === 'ok' ? <CheckCircleIcon width={20} /> : <XCircleIcon width={20} />}
                        {msg.text}
                    </div>
                )}

                {/* CATALOG TABLE */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span>เลือกสินค้าที่ต้องการ</span>
                    </div>

                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>รายการสินค้า</th>
                                    <th style={{ width: 120 }}>สถานะสต๊อก</th>
                                    <th style={{ width: 40 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: "center", color: "var(--text4)", padding: 30 }}>
                                            ไม่มีรายการสินค้า
                                        </td>
                                    </tr>
                                ) : (
                                    items.map(item => {
                                        const totalStock = item.variants.reduce((sum, v) => sum + v.stock_quantity, 0);
                                        const isOut = totalStock === 0;
                                        const isActive = selectedItem?.id === item.id;
                                        
                                        return (
                                            <React.Fragment key={item.id}>
                                                <tr 
                                                    className={`${styles.tableRow} ${isActive ? styles.tableRowActive : ""}`}
                                                    onClick={() => {
                                                        if (isActive) {
                                                            setSelectedItem(null);
                                                        } else {
                                                            setSelectedItem(item);
                                                            setSelectedVariantId(null);
                                                            setQuantity(1);
                                                            setMsg(null);
                                                        }
                                                    }}
                                                >
                                                    <td>
                                                        <div className={styles.itemName}>{item.name}</div>
                                                        <div className={styles.itemDesc}>{item.description || "ไม่มีรายละเอียดเพิ่มเติม"}</div>
                                                    </td>
                                                    <td>
                                                        <span className={`${styles.historyTag} ${isOut ? styles.tagGray : styles.tagOk}`}>
                                                            {isOut ? "สินค้าหมด" : "พร้อมเบิกจ่าย"}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: "center", color: isActive ? "var(--red)" : "var(--gray-400)" }}>
                                                        {isActive ? <ChevronUpIcon width={20} /> : <ChevronDownIcon width={20} />}
                                                    </td>
                                                </tr>
                                                
                                                {/* EXPANDABLE ROW CONTENT */}
                                                {isActive && (
                                                    <tr className={styles.expandedRow}>
                                                        <td colSpan={3} style={{ padding: "20px", background: "var(--red-dim)" }}>
                                                            <div style={{ background: "var(--white)", padding: "20px", borderRadius: "12px", border: "1px solid var(--red)" }}>
                                                                <label className={styles.label}>เลือกไซส์ (Size)</label>
                                                                <div className={styles.sizeGrid}>
                                                                    {item.variants.map(v => (
                                                                        <button
                                                                            key={v.id}
                                                                            className={`
                                                                                ${styles.sizeBtn} 
                                                                                ${selectedVariantId === v.id ? styles.sizeBtnActive : ""} 
                                                                                ${v.stock_quantity === 0 ? styles.sizeBtnDisabled : ""}
                                                                            `}
                                                                            disabled={v.stock_quantity === 0}
                                                                            onClick={() => setSelectedVariantId(v.id)}
                                                                        >
                                                                            {v.size} {v.stock_quantity === 0 ? "(หมด)" : ""}
                                                                        </button>
                                                                    ))}
                                                                </div>

                                                                {selectedVariantId && (
                                                                    <div style={{ marginTop: 16 }}>
                                                                        <div className={styles.formGrid}>
                                                                            <div>
                                                                                <label className={styles.label}>จำนวน (Max: {selectedVariantStock})</label>
                                                                                <input 
                                                                                    type="number" 
                                                                                    min={1}
                                                                                    max={selectedVariantStock}
                                                                                    className={styles.input}
                                                                                    value={quantity}
                                                                                    onChange={e => setQuantity(Number(e.target.value))}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className={styles.label}>เหตุผล (Optional)</label>
                                                                                <input 
                                                                                    type="text" 
                                                                                    className={styles.input}
                                                                                    placeholder="เหตุผลการเบิก..."
                                                                                    value={reason}
                                                                                    onChange={e => setReason(e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        <button 
                                                                            className={styles.btnPrimary}
                                                                            onClick={submitRequest}
                                                                            disabled={submitting || quantity < 1 || quantity > selectedVariantStock}
                                                                        >
                                                                            {submitting ? <><ArrowPathIcon width={18} className="animate-spin" /> กำลังบันทึก...</> : "ส่งคำขอเบิก"}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* HISTORY CARD */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span>ประวัติการเบิกของคุณ</span>
                    </div>

                    {history.length === 0 ? (
                        <div className={styles.empty}>ยังไม่มีประวัติการทำรายการ</div>
                    ) : (
                        <div className={styles.historyList}>
                            {history.map(h => {
                                const date = new Date(h.requested_at).toLocaleDateString("th-TH", {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                });
                                let tagClass = styles.tagWarn;
                                let tagText = "รอตรวจสอบ";
                                if (h.status === 'approved') { tagClass = styles.tagOk; tagText = "อนุมัติ"; }
                                if (h.status === 'fulfilled') { tagClass = styles.tagBlue; tagText = "รับของแล้ว"; }
                                if (h.status === 'rejected') { tagClass = styles.tagBad; tagText = "ไม่อนุมัติ"; }

                                const isEditing = editingRequestId === h.id;

                                return (
                                    <div key={h.id} className={styles.historyItem} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div className={styles.historyInfo}>
                                                <div className={styles.historyType}>{h.variant.item.name} (ไซส์ {h.variant.size})</div>
                                                <div className={styles.historyMeta}>
                                                    จำนวน: {h.quantity} ตัว · เบิกเมื่อ {date}
                                                    {h.reason && <div>เหตุผล: {h.reason}</div>}
                                                    {h.admin_note && <div>หมายเหตุ: {h.admin_note}</div>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                                <div className={`${styles.historyTag} ${tagClass}`}>
                                                    {tagText}
                                                </div>
                                                {h.status === 'pending' && !isEditing && (
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button 
                                                            style={{ fontSize: 12, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                                            onClick={() => {
                                                                setEditingRequestId(h.id);
                                                                setEditVariantId(h.variant.id);
                                                                setEditQuantity(h.quantity);
                                                                setEditReason(h.reason || "");
                                                            }}
                                                        >
                                                            แก้ไข
                                                        </button>
                                                        <button 
                                                            style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                                            onClick={() => deleteRequest(h.id)}
                                                            disabled={submitting}
                                                        >
                                                            ยกเลิก
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {isEditing && (
                                            <div style={{ marginTop: 12, padding: 12, background: 'var(--surface2)', borderRadius: 8 }}>
                                                {h.variant.item.variants && h.variant.item.variants.length > 0 && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <label className={styles.label}>เปลี่ยนไซส์</label>
                                                        <div className={styles.sizeGrid} style={{ marginBottom: 0 }}>
                                                            {h.variant.item.variants.map(v => (
                                                                <button
                                                                    key={v.id}
                                                                    className={`
                                                                        ${styles.sizeBtn} 
                                                                        ${editVariantId === v.id ? styles.sizeBtnActive : ""} 
                                                                        ${v.stock_quantity === 0 && h.variant.id !== v.id ? styles.sizeBtnDisabled : ""}
                                                                    `}
                                                                    disabled={v.stock_quantity === 0 && h.variant.id !== v.id}
                                                                    onClick={() => setEditVariantId(v.id)}
                                                                >
                                                                    {v.size} {v.stock_quantity === 0 && h.variant.id !== v.id ? "(หมด)" : ""}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label className={styles.label}>จำนวน</label>
                                                        <input 
                                                            type="number" 
                                                            min={1} 
                                                            className={styles.input} 
                                                            value={editQuantity} 
                                                            onChange={e => setEditQuantity(Number(e.target.value))} 
                                                        />
                                                    </div>
                                                    <div style={{ flex: 2 }}>
                                                        <label className={styles.label}>เหตุผล</label>
                                                        <input 
                                                            type="text" 
                                                            className={styles.input} 
                                                            value={editReason} 
                                                            onChange={e => setEditReason(e.target.value)} 
                                                        />
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                    <button 
                                                        className={styles.btnSecondary}
                                                        onClick={() => setEditingRequestId(null)}
                                                        disabled={submitting}
                                                    >
                                                        ยกเลิก
                                                    </button>
                                                    <button 
                                                        className={styles.btnPrimary}
                                                        onClick={() => updateRequest(h.id)}
                                                        disabled={submitting || editQuantity < 1 || !editVariantId}
                                                    >
                                                        {submitting ? "กำลังบันทึก..." : "บันทึก"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
