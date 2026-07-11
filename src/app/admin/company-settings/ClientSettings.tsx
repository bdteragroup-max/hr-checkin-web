"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
    BuildingOfficeIcon, 
    DocumentTextIcon, 
    PencilSquareIcon,
    SparklesIcon,
    BuildingStorefrontIcon,
    MapPinIcon,
    HashtagIcon
} from "@heroicons/react/24/outline";
import styles from "./page.module.css";
import AlertModal, { AlertState } from "@/components/AlertModal";

export default function ClientSettings() {
    const queryClient = useQueryClient();
    const { data: companies = [], isLoading: queryLoading } = useQuery({
        queryKey: ["admin-company-settings"],
        queryFn: async () => {
            const res = await fetch("/api/admin/company-settings");
            const data = await res.json();
            return data.list || [];
        }
    });

    const [deleting, setDeleting] = useState(false);
    const loading = queryLoading || deleting;
    const [search, setSearch] = useState("");
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });

    // Form Modal
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        id: 0,
        tax_id: "",
        name: "",
        address: "",
        branch_no: "",
        isEdit: false
    });

    const [pendingDelete, setPendingDelete] = useState<number | null>(null);

    const filtered = useMemo(() => {
        return companies.filter((c: any) =>
            (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (c.tax_id || "").toLowerCase().includes(search.toLowerCase()) ||
            (c.branch_no || "").toLowerCase().includes(search.toLowerCase())
        );
    }, [companies, search]);

    const handleAdd = () => {
        setForm({
            id: 0,
            tax_id: "",
            name: "",
            address: "",
            branch_no: "",
            isEdit: false
        });
        setShowModal(true);
    };

    const handleEdit = (comp: any) => {
        setForm({
            id: comp.id,
            tax_id: comp.tax_id || "",
            name: comp.name || "",
            address: comp.address || "",
            branch_no: comp.branch_no || "",
            isEdit: true
        });
        setShowModal(true);
    };

    const handleDelete = (id: number, name: string) => {
        setPendingDelete(id);
        setAlert({
            visible: true,
            message: `ยืนยันการลบข้อมูลบริษัท "${name}"?`,
            type: "ok"
        });
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        try {
            const res = await fetch("/api/admin/company-settings", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: pendingDelete })
            });
            const data = await res.json();
            if (data.ok) {
                setAlert({ visible: true, message: "ลบข้อมูลเรียบร้อยแล้ว", type: "ok" });
                queryClient.invalidateQueries({ queryKey: ["admin-company-settings"] });
            } else {
                setAlert({ visible: true, message: data.error || "ลบไม่สำเร็จ", type: "error" });
            }
        } catch (e) {
            setAlert({ visible: true, message: "เกิดข้อผิดพลาดในการลบ", type: "error" });
        } finally {
            setPendingDelete(null);
            setDeleting(false);
        }
    };

    const handleSave = async () => {
        if (!form.name || !form.tax_id) {
            setAlert({ visible: true, message: "กรุณาระบุชื่อบริษัทและเลขผู้เสียภาษี", type: "error" });
            return;
        }

        setSubmitting(true);
        try {
            const payload = { ...form };
            if (!payload.isEdit) {
                (payload as any).id = null; // Trigger create in API
            }
            const res = await fetch("/api/admin/company-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.ok) {
                setShowModal(false);
                setAlert({ visible: true, message: "บันทึกข้อมูลเรียบร้อยแล้ว", type: "ok" });
                queryClient.invalidateQueries({ queryKey: ["admin-company-settings"] });
            } else {
                setAlert({ visible: true, message: data.error || "บันทึกไม่สำเร็จ", type: "error" });
            }
        } catch (e) {
            setAlert({ visible: true, message: "เกิดข้อผิดพลาดในการบันทึก", type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.page}>
            <AlertModal
                alert={alert}
                onClose={() => setAlert(p => ({ ...p, visible: false }))}
                onConfirm={pendingDelete ? confirmDelete : undefined}
                confirmText={pendingDelete ? "ลบข้อมูล" : "ตกลง"}
            />

            <header className={styles.header}>
                <h1 className={styles.title}>ข้อมูลบริษัท (Company Settings)</h1>
                <p className={styles.subtitle}>ตั้งค่าข้อมูลนิติบุคคล สำหรับออกหนังสือรับรองและเอกสารภาษี 50 ทวิ</p>
            </header>

            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        className={styles.searchInput}
                        placeholder="ค้นหาชื่อบริษัท, รหัสสาขา, หรือเลขภาษี..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className={styles.btnAdd} onClick={handleAdd}>
                    <span>+</span> เพิ่มบริษัท
                </button>
            </div>

            <main className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <BuildingOfficeIcon width={20} /> รายชื่อบริษัททั้งหมด
                    </h2>
                    <span className={styles.badgeOk}>{filtered.length} รายการ</span>
                </div>

                <div className={styles.tableWrap}>
                    {loading ? (
                        <div className={styles.loading}>กำลังโหลดข้อมูล...</div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ชื่อบริษัท / นิติบุคคล</th>
                                    <th>เลขประจำตัวผู้เสียภาษี</th>
                                    <th>รหัสสาขา</th>
                                    <th>ที่อยู่</th>
                                    <th style={{ textAlign: "right" }}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} className={styles.empty}>ไม่พบข้อมูลบริษัท</td></tr>
                                ) : filtered.map((c: any) => (
                                    <tr key={c.id}>
                                        <td><span className={styles.bold}>{c.name}</span></td>
                                        <td><span className={styles.mono}>{c.tax_id}</span></td>
                                        <td><span className={styles.mono}>{c.branch_no}</span></td>
                                        <td>{c.address}</td>
                                        <td style={{ textAlign: "right" }}>
                                            <button className={styles.btnIcon} onClick={() => handleEdit(c)} title="แก้ไข">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                            <button className={styles.btnIconDel} onClick={() => handleDelete(c.id, c.name)} title="ลบ">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>

            {showModal && (
                <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className={styles.modal}>
                        <h2 className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {form.isEdit ? (
                                <><PencilSquareIcon width={24} /> แก้ไขบริษัท</>
                            ) : (
                                <><SparklesIcon width={24} /> เพิ่มบริษัทใหม่</>
                            )}
                        </h2>

                        <div className={styles.formGroup}>
                            <label><BuildingStorefrontIcon width={16} style={{ display: "inline", marginBottom: -3 }} /> ชื่อบริษัท / นิติบุคคล</label>
                            <input
                                className={styles.input}
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="เช่น บริษัท เทอรา กรุ๊ป จำกัด"
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label><DocumentTextIcon width={16} style={{ display: "inline", marginBottom: -3 }} /> เลขประจำตัวผู้เสียภาษี</label>
                                <input
                                    className={styles.input}
                                    value={form.tax_id}
                                    onChange={e => setForm({ ...form, tax_id: e.target.value })}
                                    placeholder="13 หลัก"
                                    maxLength={13}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label><HashtagIcon width={16} style={{ display: "inline", marginBottom: -3 }} /> รหัสสาขา</label>
                                <input
                                    className={styles.input}
                                    value={form.branch_no}
                                    onChange={e => setForm({ ...form, branch_no: e.target.value })}
                                    placeholder="เช่น 00000"
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label><MapPinIcon width={16} style={{ display: "inline", marginBottom: -3 }} /> ที่อยู่บริษัท</label>
                            <textarea
                                className={styles.textarea}
                                value={form.address}
                                onChange={e => setForm({ ...form, address: e.target.value })}
                                placeholder="ที่อยู่ตามที่จดทะเบียน..."
                                rows={3}
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.btnCancel} onClick={() => setShowModal(false)}>ยกเลิก</button>
                            <button className={styles.btnSave} onClick={handleSave} disabled={submitting}>
                                {submitting ? "กำลังบันทึก..." : "✓ บันทึกข้อมูล"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
