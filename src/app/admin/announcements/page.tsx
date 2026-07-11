"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";

type Announcement = {
    id: number;
    title: string;
    content: string | null;
    is_active: boolean;
    created_at: string;
};

export default function AnnouncementsAdminPage() {
    const queryClient = useQueryClient();
    
    const { data: announcements = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: ["admin-announcements"],
        queryFn: async () => {
            const res = await fetch("/api/admin/announcements");
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Failed to fetch announcements");
            return (data.announcements || []) as Announcement[];
        }
    });

    const error = queryError ? queryError.message : "";

    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ id: 0, title: "", content: "", is_active: true });

    function handleEdit(a: Announcement) {
        setFormData({
            id: a.id,
            title: a.title,
            content: a.content || "",
            is_active: a.is_active
        });
        setShowForm(true);
    }

    function handleAddNew() {
        setFormData({ id: 0, title: "", content: "", is_active: true });
        setShowForm(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const url = formData.id 
                ? `/api/admin/announcements/${formData.id}` 
                : "/api/admin/announcements";
            
            const method = formData.id ? "PUT" : "POST";
            
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            
            if (res.ok) {
                setShowForm(false);
                queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
            } else {
                const data = await res.json();
                alert(data.error || "Error saving announcement");
            }
        } catch (e: any) {
            alert(e.message);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm("Are you sure you want to delete this announcement?")) return;
        try {
            const res = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
            } else {
                const data = await res.json();
                alert(data.error || "Error deleting announcement");
            }
        } catch (e: any) {
            alert(e.message);
        }
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>ประกาศข่าวสาร</h1>
                    <p>Announcements Management</p>
                </div>
                <button className={styles.addBtn} onClick={handleAddNew}>
                    + เพิ่มประกาศ
                </button>
            </header>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.tableCard}>
                {loading ? (
                    <div className={styles.emptyState}>กำลังโหลด...</div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>หัวข้อ</th>
                                    <th>สถานะ</th>
                                    <th>วันที่สร้าง</th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {announcements.length === 0 ? (
                                    <tr><td colSpan={4} className={styles.emptyCell} style={{ textAlign: "center" }}>ยังไม่มีประกาศ</td></tr>
                                ) : (
                                    announcements.map(a => (
                                        <tr key={a.id}>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{a.title}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{a.content?.substring(0, 50)}{a.content && a.content.length > 50 ? '...' : ''}</div>
                                            </td>
                                            <td>
                                                <span style={{ 
                                                    padding: '4px 8px', 
                                                    borderRadius: '999px', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 500,
                                                    background: a.is_active ? '#dcfce7' : '#f1f5f9',
                                                    color: a.is_active ? '#166534' : '#475569'
                                                }}>
                                                    {a.is_active ? "แสดงอยู่" : "ซ่อน"}
                                                </span>
                                            </td>
                                            <td>{new Date(a.created_at).toLocaleDateString("th-TH")}</td>
                                            <td>
                                                <button onClick={() => handleEdit(a)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '1rem' }}>แก้ไข</button>
                                                <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>ลบ</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Modal ── */}
            {showForm && (
                <div className={styles.modalOverlay} onClick={() => setShowForm(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h2>{formData.id ? "แก้ไขประกาศ" : "เพิ่มประกาศใหม่"}</h2>
                        <div className={styles.formGroup}>
                            <label>หัวข้อ (Title)</label>
                            <input 
                                value={formData.title} 
                                onChange={e => setFormData({...formData, title: e.target.value})} 
                                required 
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>รายละเอียด (Content)</label>
                            <textarea 
                                value={formData.content} 
                                onChange={e => setFormData({...formData, content: e.target.value})} 
                                rows={4}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: '1rem', marginTop: '4px' }}
                            />
                        </div>
                        <label className={styles.checkLabel}>
                            <input 
                                type="checkbox" 
                                checked={formData.is_active} 
                                onChange={e => setFormData({...formData, is_active: e.target.checked})} 
                            />
                            แสดงผล (Active)
                        </label>
                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>ยกเลิก</button>
                            <button className={styles.submitBtn} onClick={handleSubmit}>บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
