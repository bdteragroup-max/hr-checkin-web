"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "./page.module.css";
import AlertModal, { AlertState } from "@/components/AlertModal";

interface Branch {
    id: string;
    name: string;
    center_lat: number;
    center_lon: number;
    radius_m: number;
    _count?: { employees: number };
}

export default function AdminBranchesPage() {
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [search, setSearch] = useState("");
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });

    // Form Modal
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        id: "",
        name: "",
        center_lat: 13.7563,
        center_lon: 100.5018,
        radius_m: 200,
        isEdit: false
    });

    // Delete Confirmation
    const [pendingDelete, setPendingDelete] = useState<string | null>(null);

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const r = await fetch("/api/admin/branches");
            const data = await r.json();
            if (data.ok) setBranches(data.list || []);
        } catch (e) {
            console.error("Fetch branches failed", e);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        return branches.filter(b =>
            b.id.toLowerCase().includes(search.toLowerCase()) ||
            b.name.toLowerCase().includes(search.toLowerCase())
        );
    }, [branches, search]);

    const handleAdd = () => {
        setForm({
            id: "",
            name: "",
            center_lat: 13.7563,
            center_lon: 100.5018,
            radius_m: 200,
            isEdit: false
        });
        setShowModal(true);
    };

    const handleEdit = (b: Branch) => {
        setForm({
            id: b.id,
            name: b.name,
            center_lat: Number(b.center_lat),
            center_lon: Number(b.center_lon),
            radius_m: b.radius_m,
            isEdit: true
        });
        setShowModal(true);
    };

    const handleDelete = (id: string, name: string) => {
        setPendingDelete(id);
        setAlert({
            visible: true,
            message: `ยืนยันการลบสาขา "${name}" (${id})?`,
            type: "ok"
        });
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setLoading(true);
        try {
            const r = await fetch("/api/admin/branches", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: pendingDelete })
            });
            const data = await r.json();
            if (data.ok) {
                setAlert({ visible: true, message: "ลบข้อมูลเรียบร้อยแล้ว", type: "ok" });
                fetchBranches();
            } else {
                setAlert({ visible: true, message: data.error || "ลบไม่สำเร็จ", type: "error" });
            }
        } catch (e) {
            setAlert({ visible: true, message: "เกิดข้อผิดพลาดในการลบ", type: "error" });
        } finally {
            setPendingDelete(null);
            setLoading(false);
        }
    };

    const saveBranch = async () => {
        if (!form.id || !form.name) {
            setAlert({ visible: true, message: "กรุณาระบุรหัสและชื่อสาขา", type: "error" });
            return;
        }

        setSubmitting(true);
        try {
            const method = form.isEdit ? "PUT" : "POST";
            const r = await fetch("/api/admin/branches", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form)
            });
            const data = await r.json();
            if (data.ok) {
                setShowModal(false);
                setAlert({ visible: true, message: "บันทึกข้อมูลเรียบร้อยแล้ว", type: "ok" });
                fetchBranches();
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
                <h1 className={styles.title}>จัดการสาขา (Branches)</h1>
                <p className={styles.subtitle}>เพิ่ม แก้ไข หรือลบข้อมูลสาขาในระบบ</p>
            </header>

            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        className={styles.searchInput}
                        placeholder="ค้นหารหัสหรือชื่อสาขา..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className={styles.btnAdd} onClick={handleAdd}>
                    <span>+</span> เพิ่มสาขาใหม่
                </button>
            </div>

            <main className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>📜 รายชื่อสาขาทั้งหมด</h2>
                    <span className={styles.badgeOk}>{filtered.length} รายการ</span>
                </div>

                <div className={styles.tableWrap}>
                    {loading ? (
                        <div className={styles.loading}>กำลังโหลดข้อมูล...</div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>รหัสสาขา</th>
                                    <th>ชื่อสาขา</th>
                                    <th>พิกัด (Lat, Lon)</th>
                                    <th>รัศมี (เมตร)</th>
                                    <th>พนักงาน</th>
                                    <th style={{ textAlign: "right" }}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={6} className={styles.empty}>ไม่พบข้อมูลสาขา</td></tr>
                                ) : filtered.map(b => (
                                    <tr key={b.id}>
                                        <td><span className={styles.mono}>{b.id}</span></td>
                                        <td><span className={styles.bold}>{b.name}</span></td>
                                        <td>
                                            <div style={{ fontSize: 12 }}>{Number(b.center_lat).toFixed(6)}, {Number(b.center_lon).toFixed(6)}</div>
                                        </td>
                                        <td>{b.radius_m} ม.</td>
                                        <td>{b._count?.employees || 0} คน</td>
                                        <td style={{ textAlign: "right" }}>
                                            <button className={styles.btnIcon} onClick={() => handleEdit(b)} title="แก้ไข">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                            <button className={styles.btnIconDel} onClick={() => handleDelete(b.id, b.name)} title="ลบ">
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
                        <h2 className={styles.modalTitle}>{form.isEdit ? "✏️ แก้ไขสาขา" : "✨ เพิ่มสาขาใหม่"}</h2>

                        <div className={styles.formGroup}>
                            <label>รหัสสาขา (ID)</label>
                            <input
                                className={styles.input}
                                value={form.id}
                                onChange={e => setForm({ ...form, id: e.target.value.toUpperCase() })}
                                placeholder="เช่น BKK01"
                                disabled={form.isEdit}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>ชื่อสาขา</label>
                            <input
                                className={styles.input}
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="เช่น สำนักงานใหญ่"
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>ละติจูด (Lat)</label>
                                <input
                                    type="number" step="any"
                                    className={styles.input}
                                    value={form.center_lat}
                                    onChange={e => setForm({ ...form, center_lat: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>ลองจิจูด (Lon)</label>
                                <input
                                    type="number" step="any"
                                    className={styles.input}
                                    value={form.center_lon}
                                    onChange={e => setForm({ ...form, center_lon: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>รัศมีเช็คอิน (เมตร)</label>
                            <input
                                type="number"
                                className={styles.input}
                                value={form.radius_m}
                                onChange={e => setForm({ ...form, radius_m: parseInt(e.target.value) })}
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.btnCancel} onClick={() => setShowModal(false)}>ยกเลิก</button>
                            <button className={styles.btnSave} onClick={saveBranch} disabled={submitting}>
                                {submitting ? "กำลังบันทึก..." : "✓ บันทึกข้อมูล"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
