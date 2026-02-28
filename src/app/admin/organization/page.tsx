"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

type Department = {
    id: number;
    name: string;
    _count: { job_positions: number; employees: number };
};

type JobPosition = {
    id: number;
    department_id: number;
    title: string;
    is_ot_eligible: boolean;
    departments: Department;
    _count: { employees: number };
};

export default function OrganizationPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [positions, setPositions] = useState<JobPosition[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals state
    const [deptModal, setDeptModal] = useState({ open: false, isEdit: false, id: 0, name: "" });
    const [posModal, setPosModal] = useState({ open: false, isEdit: false, id: 0, department_id: 0, title: "", is_ot_eligible: true });

    async function loadData() {
        setLoading(true);
        try {
            const [deptRes, posRes] = await Promise.all([
                fetch("/api/admin/organization/departments").then(r => r.json()),
                fetch("/api/admin/organization/positions").then(r => r.json())
            ]);
            if (deptRes.ok) setDepartments(deptRes.list);
            if (posRes.ok) setPositions(posRes.list);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, []);

    /* --- DEPARTMENTS --- */
    async function saveDepartment(e: React.FormEvent) {
        e.preventDefault();
        const url = "/api/admin/organization/departments";
        const method = deptModal.isEdit ? "PUT" : "POST";
        const body = JSON.stringify({ id: deptModal.id, name: deptModal.name });

        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body });
        if (res.ok) {
            setDeptModal({ open: false, isEdit: false, id: 0, name: "" });
            loadData();
        } else {
            const err = await res.json();
            alert(err.error || "Error saving department");
        }
    }

    async function deleteDepartment(id: number, name: string) {
        if (!confirm(`ยืนยันการลบแผนก "${name}" ?`)) return;
        const res = await fetch("/api/admin/organization/departments", {
            method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id })
        });
        if (res.ok) loadData();
        else alert("Cannot delete department. It may have linked positions or employees.");
    }

    /* --- POSITIONS --- */
    async function savePosition(e: React.FormEvent) {
        e.preventDefault();
        if (!posModal.department_id) return alert("Please select a department");

        const url = "/api/admin/organization/positions";
        const method = posModal.isEdit ? "PUT" : "POST";
        const body = JSON.stringify({
            id: posModal.id,
            title: posModal.title,
            department_id: posModal.department_id,
            is_ot_eligible: posModal.is_ot_eligible
        });

        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body });
        if (res.ok) {
            setPosModal({ open: false, isEdit: false, id: 0, department_id: 0, title: "", is_ot_eligible: true });
            loadData();
        } else {
            const err = await res.json();
            alert(err.error || "Error saving position");
        }
    }

    async function deletePosition(id: number, title: string) {
        if (!confirm(`ยืนยันการลบตำแหน่ง "${title}" ?`)) return;
        const res = await fetch("/api/admin/organization/positions", {
            method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id })
        });
        if (res.ok) loadData();
        else alert("Cannot delete position. It may have linked employees.");
    }

    if (loading) return <div className={styles.loading}>กำลังโหลดหน้าต่างการจัดการ...</div>;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>โครงสร้างองค์กร (Organization Structure)</h1>
                    <p className={styles.subtitle}>จัดการแผนกและตำแหน่งงาน เพื่อใช้ผูกกับข้อมูลพนักงานและการคำนวณ OT</p>
                </div>
            </div>

            <div className={styles.grid}>
                {/* DEPARTMENTS CARD */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>แผนก (Departments)</h2>
                        <button
                            className={styles.btnAdd}
                            onClick={() => setDeptModal({ open: true, isEdit: false, id: 0, name: "" })}
                        >
                            <PlusIcon className={styles.iconSm} /> เพิ่มแผนก
                        </button>
                    </div>

                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ชื่อแผนก</th>
                                    <th>จำนวนตำแหน่ง</th>
                                    <th className={styles.thRight}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {departments.length === 0 && (
                                    <tr><td colSpan={3} className={styles.empty}>ไม่มีข้อมูลแผนก</td></tr>
                                )}
                                {departments.map(d => (
                                    <tr key={d.id}>
                                        <td className={styles.bold}>{d.name}</td>
                                        <td>{d._count.job_positions} ตำแหน่ง</td>
                                        <td className={styles.tdRight}>
                                            <button
                                                className={styles.btnIcon}
                                                title="แก้ไข"
                                                onClick={() => setDeptModal({ open: true, isEdit: true, id: d.id, name: d.name })}
                                            >
                                                <PencilIcon className={styles.iconSm} />
                                            </button>
                                            <button
                                                className={styles.btnIconDel}
                                                title="ลบ"
                                                onClick={() => deleteDepartment(d.id, d.name)}
                                            >
                                                <TrashIcon className={styles.iconSm} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* POSITIONS CARD */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>ตำแหน่งงาน (Job Positions)</h2>
                        <button
                            className={styles.btnAdd}
                            onClick={() => setPosModal({
                                open: true, isEdit: false, id: 0,
                                department_id: departments[0]?.id || 0,
                                title: "", is_ot_eligible: true
                            })}
                        >
                            <PlusIcon className={styles.iconSm} /> เพิ่มตำแหน่ง
                        </button>
                    </div>

                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ชื่อตำแหน่ง</th>
                                    <th>แผนก</th>
                                    <th>สิทธิ์ OT</th>
                                    <th className={styles.thRight}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.length === 0 && (
                                    <tr><td colSpan={4} className={styles.empty}>ไม่มีข้อมูลตำแหน่งงาน</td></tr>
                                )}
                                {positions.map(p => (
                                    <tr key={p.id}>
                                        <td className={styles.bold}>{p.title}</td>
                                        <td>{p.departments.name}</td>
                                        <td>
                                            {p.is_ot_eligible ? (
                                                <span className={styles.badgeOk}>มีสิทธิ์ OT</span>
                                            ) : (
                                                <span className={styles.badgeErr}>ไม่มีสิทธิ์ OT</span>
                                            )}
                                        </td>
                                        <td className={styles.tdRight}>
                                            <button
                                                className={styles.btnIcon}
                                                title="แก้ไข"
                                                onClick={() => setPosModal({
                                                    open: true, isEdit: true, id: p.id,
                                                    department_id: p.department_id,
                                                    title: p.title,
                                                    is_ot_eligible: p.is_ot_eligible
                                                })}
                                            >
                                                <PencilIcon className={styles.iconSm} />
                                            </button>
                                            <button
                                                className={styles.btnIconDel}
                                                title="ลบ"
                                                onClick={() => deletePosition(p.id, p.title)}
                                            >
                                                <TrashIcon className={styles.iconSm} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {deptModal.open && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>{deptModal.isEdit ? "แก้ไขแผนก" : "เพิ่มแผนกใหม่"}</h3>
                        <form onSubmit={saveDepartment}>
                            <div className={styles.formGroup}>
                                <label>ชื่อแผนก</label>
                                <input
                                    className={styles.input}
                                    autoFocus
                                    required
                                    value={deptModal.name}
                                    onChange={e => setDeptModal({ ...deptModal, name: e.target.value })}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btnCancel} onClick={() => setDeptModal({ ...deptModal, open: false })}>ยกเลิก</button>
                                <button type="submit" className={styles.btnSave}>ตกลง (OK)</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {posModal.open && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>{posModal.isEdit ? "แก้ไขตำแหน่งงาน" : "เพิ่มตำแหน่งงานใหม่"}</h3>
                        <form onSubmit={savePosition}>
                            <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text2)", marginBottom: "8px" }}>แผนก</label>
                                    <select
                                        className={styles.input}
                                        required
                                        value={posModal.department_id}
                                        onChange={e => setPosModal({ ...posModal, department_id: Number(e.target.value) })}
                                    >
                                        <option value={0} disabled>-- เลือกแผนก --</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text2)", marginBottom: "8px" }}>ชื่อตำแหน่ง</label>
                                    <input
                                        className={styles.input}
                                        required
                                        value={posModal.title}
                                        onChange={e => setPosModal({ ...posModal, title: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className={styles.formGroupCheckbox}>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={posModal.is_ot_eligible}
                                        onChange={e => setPosModal({ ...posModal, is_ot_eligible: e.target.checked })}
                                    />
                                    มีสิทธิ์คำนวณ OT และเบิกจ่ายล่วงเวลา
                                </label>
                                <p className={styles.hint}>* หากติ๊กออก พนักงานในตำแหน่งนี้จะไม่มียอดเงิน OT ในสรุปรายงาน</p>
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btnCancel} onClick={() => setPosModal({ ...posModal, open: false })}>ยกเลิก</button>
                                <button type="submit" className={styles.btnSave}>ตกลง (OK)</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
