"use client";

import React, { useState, useEffect } from "react";
import styles from "../app/page.module.css";
import { XMarkIcon, CalendarIcon, MapPinIcon, DocumentTextIcon, UserIcon } from "@heroicons/react/24/outline";
import SearchableSelect from "./SearchableSelect";

interface AdminBorrowModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: {
        id: number;
        asset_id: string;
        name: string;
        category: string | null;
    } | null;
    onSuccess: () => void;
    type?: "equipment" | "item";
}

export default function AdminBorrowModal({ isOpen, onClose, asset, onSuccess, type = "equipment" }: AdminBorrowModalProps) {
    const isEquipment = type === "equipment";
    const [employees, setEmployees] = useState<any[]>([]);
    const [borrowerId, setBorrowerId] = useState("");
    const [borrowDate, setBorrowDate] = useState("");
    const [returnDate, setReturnDate] = useState("");
    const [location, setLocation] = useState("");
    const [remark, setRemark] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetch("/api/admin/employees")
                .then(r => r.json())
                .then(json => {
                    if (json.ok) {
                        setEmployees(json.list.map((e: any) => ({
                            value: e.emp_id,
                            label: e.nickname ? `${e.name} (${e.nickname})` : e.name
                        })));
                    }
                });
            
            // Default dates
            const now = new Date();
            const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
            setBorrowDate(today);
            
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            setReturnDate(tomorrow.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }));
        }
    }, [isOpen]);

    if (!isOpen || !asset) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!borrowerId) { setError("กรุณาเลือกผู้ยืม"); return; }
        
        setLoading(true);
        setError("");
        
        try {
            const url = isEquipment ? "/api/assets/borrow" : "/api/products/borrow";
            const bodyPayload: any = {
                borrower_emp_id: borrowerId,
                borrow_date: borrowDate,
                expected_return_date: returnDate,
                location,
                remark,
                quantity: Number(quantity)
            };
            
            if (isEquipment) {
                bodyPayload.asset_id = asset?.id;
                bodyPayload.borrow_vehicle_status = "good";
                bodyPayload.borrow_is_clean = true;
                bodyPayload.borrow_is_lights_ok = true;
                bodyPayload.borrow_is_tires_ok = true;
                bodyPayload.borrow_is_body_ok = true;
                bodyPayload.borrow_is_insurance_ok = true;
            } else {
                bodyPayload.product_id = asset?.id;
            }

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyPayload)
            });
            
            const json = await res.json();
            if (json.ok) {
                onSuccess();
                onClose();
            } else {
                setError(json.message || json.error || "เกิดข้อผิดพลาด");
            }
        } catch (err) {
            setError("Network Error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
            <div className={styles.modal} style={{ maxWidth: 500 }}>
                <div className={styles.modalHeader}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>ทำเรื่องยืม{isEquipment ? 'อุปกรณ์' : 'สินค้า'} (Admin)</h2>
                            <p style={{ fontSize: 13, color: "var(--text4)", marginTop: 4 }}>บันทึกการยืมในนามพนักงาน</p>
                        </div>
                        <button onClick={onClose} className={styles.closeBtn}>
                            <XMarkIcon width={24} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.modalBody} style={{ padding: "24px 32px" }}>
                        <div style={{ 
                            background: "var(--surface2)", 
                            padding: 16, 
                            borderRadius: 12, 
                            marginBottom: 20,
                            border: "1px solid var(--line)"
                        }}>
                            <div style={{ fontSize: 12, color: "var(--text4)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>{isEquipment ? 'อุปกรณ์' : 'สินค้า'}ที่เลือก</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--red)" }}>{asset.name}</div>
                            <div style={{ fontSize: 12, color: "var(--text3)" }}>{asset.asset_id} {asset.category ? `• ${asset.category}` : ''}</div>
                        </div>

                        {error && (
                            <div style={{ 
                                padding: "10px 16px", 
                                background: "#fef2f2", 
                                color: "#dc2626", 
                                borderRadius: 8, 
                                fontSize: 13, 
                                marginBottom: 16,
                                border: "1px solid #fecaca"
                            }}>
                                {error}
                            </div>
                        )}

                        <div className={styles.inputGroup} style={{ marginBottom: 16 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                                <UserIcon width={16} /> ผู้ยืม{isEquipment ? 'อุปกรณ์' : 'สินค้า'} *
                            </label>
                            <SearchableSelect 
                                options={employees}
                                value={borrowerId}
                                onChange={setBorrowerId}
                                placeholder="ค้นหาชื่อพนักงาน..."
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                            <div className={styles.inputGroup}>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                                    <CalendarIcon width={16} /> วันที่เริ่มยืม
                                </label>
                                <input 
                                    type="date" 
                                    className={styles.input}
                                    value={borrowDate}
                                    onChange={e => setBorrowDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                                    <CalendarIcon width={16} /> วันที่คาดว่าคืน
                                </label>
                                <input 
                                    type="date" 
                                    className={styles.input}
                                    value={returnDate}
                                    onChange={e => setReturnDate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup} style={{ marginBottom: 16 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                                <MapPinIcon width={16} /> สถานที่ใช้งาน / โครงการ
                            </label>
                            <input 
                                type="text" 
                                className={styles.input}
                                placeholder="เช่น Site งาน A, สำนักงานใหญ่"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                                <DocumentTextIcon width={16} /> หมายเหตุเพิ่มเติม
                            </label>
                            <textarea 
                                className={styles.input}
                                style={{ minHeight: 80, paddingTop: 10 }}
                                placeholder="สภาพเบื้องต้น หรือจุดประสงค์การยืม..."
                                value={remark}
                                onChange={e => setRemark(e.target.value)}
                            />
                        </div>
 
                        <div className={styles.inputGroup} style={{ marginTop: 16 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                                <DocumentTextIcon width={16} /> จำนวนที่ยืม (ชิ้น) *
                            </label>
                            <input 
                                type="number" 
                                className={styles.input}
                                value={quantity}
                                onChange={e => setQuantity(Number(e.target.value))}
                                min={1}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.modalFooter} style={{ padding: "0 32px 32px", display: "flex", gap: 12 }}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} style={{ flex: 1 }}>ยกเลิก</button>
                        <button type="submit" className={styles.saveBtn} disabled={loading} style={{ flex: 2 }}>
                            {loading ? "กำลังบันทึก..." : "ยืนยันการยืม"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
