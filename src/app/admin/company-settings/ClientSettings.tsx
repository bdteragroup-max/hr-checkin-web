"use client";

import React, { useState, useEffect } from "react";
import { 
    BuildingOfficeIcon, 
    DocumentTextIcon, 
    MapPinIcon, 
    HashtagIcon,
    BuildingStorefrontIcon
} from "@heroicons/react/24/outline";
import styles from "./page.module.css";

export default function ClientSettings() {
    const [data, setData] = useState({
        tax_id: "",
        name: "",
        address: "",
        branch_no: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/admin/company-settings")
            .then(res => res.json())
            .then(d => {
                if (d) {
                    setData({
                        tax_id: d.tax_id || "",
                        name: d.name || "",
                        address: d.address || "",
                        branch_no: d.branch_no || ""
                    });
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/company-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                alert("บันทึกข้อมูลเรียบร้อยแล้ว");
            } else {
                alert("เกิดข้อผิดพลาดในการบันทึก");
            }
        } catch (e) {
            alert("เกิดข้อผิดพลาด");
        }
        setSaving(false);
    };

    if (loading) return <div className={styles.loading}>กำลังโหลด...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <BuildingOfficeIcon width={28} className={styles.titleIcon} />
                    <h1 className={styles.title}>ข้อมูลบริษัท (Company Settings)</h1>
                </div>
                <p className={styles.subtitle}>
                    ตั้งค่าข้อมูลนิติบุคคล สำหรับออกหนังสือรับรองและเอกสารภาษี 50 ทวิ
                </p>
            </div>

            <div className={styles.card}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>
                        <BuildingStorefrontIcon width={16} /> ชื่อบริษัท / นิติบุคคล
                    </label>
                    <input 
                        className={styles.input}
                        value={data.name}
                        onChange={(e) => setData({ ...data, name: e.target.value })}
                        placeholder="เช่น บริษัท เทอรา กรุ๊ป จำกัด"
                    />
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            <DocumentTextIcon width={16} /> เลขประจำตัวผู้เสียภาษี
                        </label>
                        <input 
                            className={styles.input}
                            value={data.tax_id}
                            onChange={(e) => setData({ ...data, tax_id: e.target.value })}
                            placeholder="13 หลัก"
                            maxLength={13}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            <HashtagIcon width={16} /> รหัสสาขา
                        </label>
                        <input 
                            className={styles.input}
                            value={data.branch_no}
                            onChange={(e) => setData({ ...data, branch_no: e.target.value })}
                            placeholder="เช่น 00000 (สำนักงานใหญ่)"
                        />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>
                        <MapPinIcon width={16} /> ที่อยู่บริษัท
                    </label>
                    <textarea 
                        className={styles.textarea}
                        value={data.address}
                        onChange={(e) => setData({ ...data, address: e.target.value })}
                        placeholder="ที่อยู่ตามที่จดทะเบียน..."
                        rows={3}
                    />
                </div>
            </div>

            <div className={styles.actions}>
                <button 
                    className={styles.saveBtn}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                </button>
            </div>
        </div>
    );
}
