"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

/* ── Types ──────────────────────────────────────────────────── */
type Branch = { id: string; name: string };

type Emp = {
    emp_id: string;
    name: string;
    branch_id: string | null;
    is_active: boolean;
    gender?: string | null;
    hire_date?: string | null;
    birth_date?: string | null;
    phone_number?: string | null;
    department_id?: number | null;
    job_position_id?: number | null;
    base_salary?: number | null;
    supervisor_id?: string | null;
    departments?: { name: string } | null;
    job_positions?: { title: string; is_ot_eligible: boolean } | null;
    supervisor?: { name: string } | null;
    is_on_trial: boolean;
    has_telephone_allowance: boolean;
    position_allowance?: number | null;
};

type EditDraft = {
    emp_id: string;
    name: string;
    branch_id: string;
    gender: string;
    hire_date: string;
    birth_date: string;
    phone_number: string;
    is_active: boolean;
    department_id: number;
    job_position_id: number;
    base_salary: string;
    supervisor_id: string;
    is_on_trial: boolean;
    has_telephone_allowance: boolean;
    position_allowance: string;
};

type Department = { id: number; name: string };
type JobPosition = { id: number; department_id: number; title: string; is_ot_eligible: boolean };

/* ── Component ──────────────────────────────────────────────── */
export default function AdminEmployeesPage() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [positions, setPositions] = useState<JobPosition[]>([]);
    const [list, setList] = useState<Emp[]>([]);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    /* search / filter */
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("all");

    /* create form */
    const [empId, setEmpId] = useState("");
    const [name, setName] = useState("");
    const [branchId, setBranchId] = useState("");
    const [pin, setPin] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [gender, setGender] = useState<"M" | "F" | "O">("M");
    const [hireDate, setHireDate] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [departmentId, setDepartmentId] = useState<number>(0);
    const [positionId, setPositionId] = useState<number>(0);
    const [baseSalary, setBaseSalary] = useState("");
    const [supervisorId, setSupervisorId] = useState("");
    const [isOnTrial, setIsOnTrial] = useState(false);
    const [hasTelephoneAllowance, setHasTelephoneAllowance] = useState(false);
    const [positionAllowance, setPositionAllowance] = useState("");

    /* edit modal */
    const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);

    /* warnings modal */
    const [warningTarget, setWarningTarget] = useState<Emp | null>(null);
    const [empWarnings, setEmpWarnings] = useState<{ id: number; date: string; reason: string }[]>([]);
    const [newWarningDate, setNewWarningDate] = useState(new Date().toISOString().split("T")[0]);
    const [newWarningReason, setNewWarningReason] = useState("");

    /* toast */
    const [toast, setToast] = useState<{ msg: string; type: "ok" | "bad" } | null>(null);

    /* ── helpers ── */
    function showToast(msg: string, type: "ok" | "bad" = "ok") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    const branchName = (id: string | null) => {
        if (!id) return "—";
        return branches.find((b) => b.id === id)?.name ?? id;
    };

    const genderLabel: Record<string, string> = { M: "ชาย", F: "หญิง", O: "อื่นๆ" };

    const activeCnt = list.filter((e) => e.is_active).length;
    const inactiveCnt = list.length - activeCnt;

    /* ── load ── */
    async function load() {
        setMsg(""); setLoading(true);
        try {
            const [b, e, dRes, pRes] = await Promise.all([
                fetch("/api/branches", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
                fetch("/api/admin/employees", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
                fetch("/api/admin/organization/departments", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
                fetch("/api/admin/organization/positions", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}))
            ]);
            setBranches(b.branches || []);
            setDepartments(dRes.list || []);
            setPositions(pRes.list || []);
            if (e?.ok) setList(e.list || []);
            else if (e?.error === "UNAUTHORIZED") setMsg("ยังไม่ได้เข้าสู่ระบบ Admin (โปรด login)");
            else if (e?.error === "FORBIDDEN") setMsg("ไม่มีสิทธิ์ Admin");
            else setMsg(e?.error || "LOAD_FAILED");
        } finally { setLoading(false); }
    }

    useEffect(() => { load(); }, []);

    /* ── create ── */
    async function create() {
        setMsg("");
        if (!empId.trim()) return setMsg("กรุณากรอกรหัสพนักงาน");
        if (!name.trim()) return setMsg("กรุณากรอกชื่อ-สกุล");
        setSaving(true);
        try {
            const r = await fetch("/api/admin/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emp_id: empId.trim(),
                    name: name.trim(),
                    branch_id: branchId || null,
                    pin: pin.trim() || undefined,
                    is_active: isActive,
                    gender,
                    hire_date: hireDate || null,
                    birth_date: birthDate || null,
                    phone_number: phoneNumber.trim() || null,
                    department_id: departmentId || null,
                    job_position_id: positionId || null,
                    base_salary: baseSalary ? Number(baseSalary) : null,
                    supervisor_id: supervisorId || null,
                    is_on_trial: isOnTrial,
                    has_telephone_allowance: hasTelephoneAllowance,
                    position_allowance: positionAllowance ? Number(positionAllowance) : 0,
                }),
            });
            const t = await r.json().catch(() => ({}));
            if (!r.ok) {
                const map: Record<string, string> = {
                    EMP_ID_EXISTS: "รหัสพนักงานนี้มีแล้ว",
                    PIN_TOO_SHORT: "PIN ต้องอย่างน้อย 4 หลัก",
                    HIRE_DATE_INVALID: "รูปแบบวันที่เริ่มงานไม่ถูกต้อง",
                    UNAUTHORIZED: "ยังไม่ได้เข้าสู่ระบบ Admin",
                    FORBIDDEN: "ไม่มีสิทธิ์ Admin",
                };
                return setMsg(map[t?.error] || t?.error || "CREATE_FAILED");
            }
            showToast(`✅ เพิ่ม ${name.trim()} แล้ว`);
            setEmpId(""); setName(""); setBranchId(""); setPin("");
            setIsActive(true); setGender("M"); setHireDate(""); setBirthDate(""); setPhoneNumber("");
            setDepartmentId(0); setPositionId(0); setBaseSalary(""); setSupervisorId("");
            setIsOnTrial(false); setHasTelephoneAllowance(false);
            setPositionAllowance("");
            setCreateModalOpen(false);
            await load();
        } finally { setSaving(false); }
    }

    /* ── update (from modal) ── */
    async function saveEdit() {
        if (!editDraft) return;
        setSaving(true);
        try {
            const r = await fetch("/api/admin/employees", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emp_id: editDraft.emp_id,
                    name: editDraft.name.trim(),
                    branch_id: editDraft.branch_id || null,
                    gender: editDraft.gender,
                    hire_date: editDraft.hire_date || null,
                    birth_date: editDraft.birth_date || null,
                    phone_number: editDraft.phone_number.trim() || null,
                    is_active: editDraft.is_active,
                    department_id: editDraft.department_id || null,
                    job_position_id: editDraft.job_position_id || null,
                    base_salary: editDraft.base_salary ? Number(editDraft.base_salary) : null,
                    supervisor_id: editDraft.supervisor_id || null,
                    is_on_trial: editDraft.is_on_trial,
                    has_telephone_allowance: editDraft.has_telephone_allowance,
                    position_allowance: editDraft.position_allowance ? Number(editDraft.position_allowance) : 0,
                }),
            });
            const t = await r.json().catch(() => ({}));
            if (!r.ok) {
                const map: Record<string, string> = {
                    EMP_NOT_FOUND: "ไม่พบพนักงาน",
                    HIRE_DATE_INVALID: "รูปแบบวันที่เริ่มงานไม่ถูกต้อง",
                    UNAUTHORIZED: "ยังไม่ได้เข้าสู่ระบบ Admin",
                    FORBIDDEN: "ไม่มีสิทธิ์ Admin",
                };
                showToast(map[t?.error] || t?.error || "UPDATE_FAILED", "bad");
                return;
            }
            showToast(`✅ อัปเดต ${editDraft.name} แล้ว`);
            setEditDraft(null);
            await load();
        } finally { setSaving(false); }
    }

    /* ── quick toggle active (inline) ── */
    async function toggleActive(x: Emp) {
        const next = !x.is_active;
        setSaving(true);
        try {
            const r = await fetch("/api/admin/employees", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emp_id: x.emp_id, is_active: next }),
            });
            if (r.ok) {
                showToast(next ? `✅ เปิดใช้งาน ${x.name}` : `⛔ ปิดใช้งาน ${x.name}`);
                setList((prev) => prev.map((e) => e.emp_id === x.emp_id ? { ...e, is_active: next } : e));
            } else showToast("เกิดข้อผิดพลาด", "bad");
        } finally { setSaving(false); }
    }

    /* ── warnings ── */
    async function loadWarnings(emp: Emp) {
        setWarningTarget(emp);
        setEmpWarnings([]);
        try {
            const r = await fetch(`/api/admin/employees/${emp.emp_id}/warnings`);
            const t = await r.json();
            if (t.ok) setEmpWarnings(t.warnings);
        } catch (e) { console.error(e); }
    }

    async function addWarning() {
        if (!warningTarget || !newWarningReason.trim()) return;
        setSaving(true);
        try {
            const r = await fetch(`/api/admin/employees/${warningTarget.emp_id}/warnings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: newWarningDate, reason: newWarningReason.trim() }),
            });
            const t = await r.json();
            if (t.ok) {
                showToast("✅ บันทึกใบเตือนแล้ว");
                setNewWarningReason("");
                await loadWarnings(warningTarget);
            }
        } finally { setSaving(false); }
    }

    async function deleteWarning(id: number) {
        if (!confirm("ต้องการลบใบเตือนนี้ใช่หรือไม่?")) return;
        setSaving(true);
        try {
            const r = await fetch(`/api/admin/employees/${warningTarget?.emp_id}/warnings?id=${id}`, {
                method: "DELETE"
            });
            if (r.ok) {
                showToast("🗑️ ลบใบเตือนแล้ว");
                if (warningTarget) await loadWarnings(warningTarget);
            }
        } finally { setSaving(false); }
    }

    /* ── filtered list ── */
    const filtered = useMemo(() => list.filter((x) => {
        const q = search.trim().toLowerCase();
        const matchQ = !q || x.emp_id.toLowerCase().includes(q) || x.name.toLowerCase().includes(q);
        const matchS =
            statusFilter === "all" ? true :
                statusFilter === "active" ? x.is_active :
                    !x.is_active;
        return matchQ && matchS;
    }), [list, search, statusFilter]);

    /* ─────────────────────────────────────────────────────────
       RENDER
    ───────────────────────────────────────────────────────── */
    return (
        <div className={styles.wrap}>

            {/* ── Header ── */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.h1}>พนักงาน</h1>
                    <div className={styles.sub}>จัดการข้อมูลพนักงานทั้งหมด</div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.btnAdd} onClick={() => setCreateModalOpen(true)}>
                        + เพิ่มพนักงาน
                    </button>
                    <button className={styles.btnGhost} onClick={load} disabled={loading}>
                        {loading ? "กำลังโหลด..." : "↻ รีเฟรช"}
                    </button>
                </div>
            </div>

            {msg && <div className={styles.msg}>{msg}</div>}

            {/* ── Main grid ── */}
            <div className={styles.grid}>

                {/* ────── Employee list card ────── */}
                <div className={styles.card} style={{ padding: 0 }}>

                    {/* ────── Employee list card ────── */}
                    <div className={styles.tableWrap}>

                        {/* Table header bar */}
                        <div className={styles.tableHeader}>
                            <div className={styles.tableHeaderTitle}>
                                👥 รายการพนักงาน
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span className={styles.rowCount}>{activeCnt} Active</span>
                                <span className={styles.rowCount}>{inactiveCnt} Inactive</span>
                            </div>
                        </div>

                        {/* Search + filter bar */}
                        <div style={{
                            display: "flex", gap: 8, padding: "16px 20px",
                            borderBottom: "1px solid var(--line)",
                        }}>
                            <input
                                className={styles.input}
                                placeholder="🔍 ค้นหา รหัส / ชื่อ"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ flex: 1, marginBottom: 0 }}
                            />
                            <select
                                className={styles.input}
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                style={{ width: 140 }}
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="active">Active เท่านั้น</option>
                                <option value="inactive">Inactive เท่านั้น</option>
                            </select>
                            <button className={styles.btnRefresh} onClick={load} disabled={loading}>
                                ↻
                            </button>
                        </div>

                        {/* Table */}
                        <div className={styles.tableScroll}>
                            {loading ? (
                                <div className={styles.loader}>
                                    <div className={styles.spinner} />
                                    กำลังโหลด...
                                </div>
                            ) : (
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>รหัส</th>
                                            <th>ชื่อ-สกุล</th>
                                            <th>สาขา</th>
                                            <th>เพศ</th>
                                            <th>เริ่มงาน</th>
                                            <th>แผนก / ตำแหน่ง</th>
                                            <th>ฐานเงินเดือน</th>
                                            <th>เบอร์มือถือ</th>
                                            <th>สถานะ</th>
                                            <th style={{ textAlign: "right" }}>จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((x) => (
                                            <tr key={x.emp_id} style={{ opacity: x.is_active ? 1 : 0.55 }}>
                                                <td><span className={styles.empId}>{x.emp_id}</span></td>
                                                <td style={{ fontWeight: 600, color: "var(--text)" }}>{x.name}</td>
                                                <td style={{ color: "var(--text-3)", fontSize: 12 }}>{branchName(x.branch_id)}</td>
                                                <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                                                    {x.gender ? (genderLabel[x.gender as keyof typeof genderLabel] ?? x.gender) : "—"}
                                                </td>
                                                <td style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>
                                                    {x.hire_date ? String(x.hire_date).slice(0, 10) : "—"}
                                                </td>
                                                <td style={{ fontSize: 13, color: "var(--text-2)" }}>
                                                    {x.departments?.name ? (
                                                        <span style={{ fontWeight: 600 }}>{x.departments.name}</span>
                                                    ) : "—"}
                                                    {x.job_positions?.title && (
                                                        <> / <span style={{ color: "var(--text-3)" }}>{x.job_positions.title}</span></>
                                                    )}
                                                    {x.job_positions && !x.job_positions.is_ot_eligible && (
                                                        <span style={{ display: "block", fontSize: 10, color: "var(--red)", marginTop: 2 }}>ไม่คิด OT</span>
                                                    )}
                                                    {x.supervisor?.name && (
                                                        <div style={{ display: "block", fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>หัวหน้า: {x.supervisor.name}</div>
                                                    )}
                                                    {x.is_on_trial && (
                                                        <span style={{ display: "inline-block", fontSize: 10, color: "var(--ok)", background: "rgba(16, 185, 129, 0.1)", padding: "2px 6px", borderRadius: 4, marginTop: 4 }}>อยู่ระหว่างทดลองงาน</span>
                                                    )}
                                                </td>
                                                <td style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13 }}>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                        <div>{x.base_salary ? `฿${Number(x.base_salary).toLocaleString()}` : "—"}</div>
                                                        {x.position_allowance && Number(x.position_allowance) > 0 && (
                                                            <div style={{ fontSize: 11, color: "var(--ok)" }}>+ Allowance: ฿{Number(x.position_allowance).toLocaleString()}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                                                    {x.phone_number || "—"}
                                                </td>

                                                {/* ── Status badge ── */}
                                                <td>
                                                    <span className={x.is_active ? styles.badgeActive : styles.badgeInactive}>
                                                        {x.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                                                    </span>
                                                </td>

                                                {/* ── Manage Column ── */}
                                                <td style={{ textAlign: "right" }}>
                                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, alignItems: "center" }}>
                                                        <button
                                                            className={styles.btnEdit}
                                                            title="แก้ไข"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditDraft({
                                                                    emp_id: x.emp_id,
                                                                    name: x.name,
                                                                    branch_id: x.branch_id ?? "",
                                                                    gender: x.gender ?? "M",
                                                                    hire_date: x.hire_date ? String(x.hire_date).slice(0, 10) : "",
                                                                    birth_date: x.birth_date ? String(x.birth_date).slice(0, 10) : "",
                                                                    phone_number: x.phone_number ?? "",
                                                                    is_active: x.is_active,
                                                                    department_id: x.department_id ?? 0,
                                                                    job_position_id: x.job_position_id ?? 0,
                                                                    base_salary: x.base_salary ? String(x.base_salary) : "",
                                                                    supervisor_id: x.supervisor_id ?? "",
                                                                    is_on_trial: x.is_on_trial,
                                                                    has_telephone_allowance: x.has_telephone_allowance,
                                                                    position_allowance: x.position_allowance ? String(x.position_allowance) : "",
                                                                });
                                                            }}
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                        </button>

                                                        <button
                                                            className={styles.btnEdit}
                                                            title="ใบเตือน"
                                                            style={{ color: "var(--red)" }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                loadWarnings(x);
                                                            }}
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                                        </button>

                                                        <label className={styles.toggleSwitch} title={x.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                                                            <input
                                                                type="checkbox"
                                                                checked={x.is_active}
                                                                disabled={saving}
                                                                onChange={() => toggleActive(x)}
                                                            />
                                                            <span className={styles.slider}></span>
                                                        </label>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={7}>
                                                    <div className={styles.empty}>
                                                        <span className={styles.emptyIcon}>👥</span>
                                                        ไม่พบข้อมูลตามเงื่อนไข
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer hint */}
                        <div style={{
                            padding: "10px 16px",
                            borderTop: "1px solid var(--line)",
                            fontSize: 11.5,
                            color: "var(--text-4)",
                            background: "var(--surface-2)",
                        }}>
                            💡 กรณีลาออก แนะนำให้กดปุ่ม <b>Active</b> เพื่อเปลี่ยนเป็น Inactive แทนการลบ เพื่อเก็บประวัติการทำงาน
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                CREATE MODAL
            ══════════════════════════════════════════ */}
            {createModalOpen && (
                <div className={styles.modalOverlay}
                    onClick={(e) => { if (e.target === e.currentTarget) setCreateModalOpen(false); }}>
                    <div className={styles.modal}>

                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>➕ สร้างพนักงานใหม่</span>
                            <button className={styles.modalClose} onClick={() => setCreateModalOpen(false)}>✕</button>
                        </div>

                        <div className={styles.modalScroll}>
                            <label className={styles.lbl}>รหัสพนักงาน</label>
                            <input className={styles.input} placeholder="E0001"
                                value={empId} onChange={(e) => setEmpId(e.target.value)} />

                            <label className={styles.lbl}>ชื่อ-สกุล</label>
                            <input className={styles.input} placeholder="ชื่อพนักงาน"
                                value={name} onChange={(e) => setName(e.target.value)} />

                            <label className={styles.lbl}>สาขา</label>
                            <select className={styles.input} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                                <option value="">— ไม่ระบุ —</option>
                                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>

                            <label className={styles.lbl}>เพศ</label>
                            <select className={styles.input} value={gender} onChange={(e) => setGender(e.target.value as "M" | "F" | "O")}>
                                <option value="M">ชาย (M)</option>
                                <option value="F">หญิง (F)</option>
                                <option value="O">อื่นๆ (O)</option>
                            </select>

                            <label className={styles.lbl}>วันที่เริ่มงาน</label>
                            <input type="date" className={styles.input}
                                value={hireDate} onChange={(e) => setHireDate(e.target.value)} />

                            <label className={styles.lbl}>วันเกิด (Date of Birth)</label>
                            <input type="date" className={styles.input}
                                value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                                <div>
                                    <label className={styles.lbl}>แผนก</label>
                                    <select className={styles.input} value={departmentId} onChange={(e) => {
                                        setDepartmentId(Number(e.target.value));
                                        setPositionId(0);
                                    }}>
                                        <option value={0}>— ไม่ระบุ —</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={styles.lbl}>ตำแหน่ง</label>
                                    <select className={styles.input} value={positionId} onChange={(e) => setPositionId(Number(e.target.value))}>
                                        <option value={0}>— ไม่ระบุ —</option>
                                        {positions.filter(p => !departmentId || p.department_id === departmentId).map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <label className={styles.lbl} style={{ marginTop: 10 }}>หัวหน้างาน (Supervisor)</label>
                            <select className={styles.input} value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
                                <option value="">— ไม่มี / ไม่ระบุ —</option>
                                {list.map((e) => <option key={e.emp_id} value={e.emp_id}>{e.name} ({e.emp_id})</option>)}
                            </select>

                            <label className={styles.lbl} style={{ marginTop: 10 }}>เงินเดือนฐาน (Base Salary) (THB)</label>
                            <input type="number" className={styles.input} placeholder="0.00"
                                value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} />

                            <label className={styles.lbl} style={{ marginTop: 10 }}>เบอร์โทรศัพท์มือถือ</label>
                            <input type="tel" className={styles.input} placeholder="08XXXXXXXX"
                                value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />

                            <label className={styles.lbl} style={{ marginTop: 10 }}>PIN (ไม่บังคับ)</label>
                            <input type="password" className={styles.input} placeholder="อย่างน้อย 4 หลัก"
                                value={pin} onChange={(e) => setPin(e.target.value)} />

                            <div style={{ marginTop: 16 }}>
                                <label className={styles.row}>
                                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                                    <span>ใช้งานอยู่ (Active)</span>
                                </label>

                                <label className={styles.row} style={{ marginTop: 10 }}>
                                    <input type="checkbox" checked={isOnTrial} onChange={(e) => setIsOnTrial(e.target.checked)} />
                                    <span style={{ color: "var(--red)", fontWeight: 700 }}>อยู่ระหว่างทดลองงาน (On Trial Period)</span>
                                </label>

                                <label className={styles.row} style={{ marginTop: 10 }}>
                                    <input type="checkbox" checked={hasTelephoneAllowance} onChange={(e) => setHasTelephoneAllowance(e.target.checked)} />
                                    <span>รับค่าโทรศัพท์ (Receives Telephone Allowance)</span>
                                </label>

                                <label className={styles.lbl} style={{ marginTop: 16 }}>เงินประจำตำแหน่ง (Position Allowance) (THB)</label>
                                <input type="number" className={styles.input} placeholder="0.00"
                                    value={positionAllowance} onChange={(e) => setPositionAllowance(e.target.value)} />
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.btnCancel} onClick={() => setCreateModalOpen(false)}>ยกเลิก</button>
                            <button className={styles.btnSave} onClick={create} disabled={saving}>
                                {saving ? "กำลังบันทึก..." : "➕ ดำเนินการสร้างพนักงาน"}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════
                EDIT MODAL
            ══════════════════════════════════════════ */}
            {editDraft && (
                <div className={styles.modalOverlay}
                    onClick={(e) => { if (e.target === e.currentTarget) setEditDraft(null); }}>
                    <div className={styles.modal}>

                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>✏️ แก้ไขข้อมูลพนักงาน</span>
                            <button className={styles.modalClose} onClick={() => setEditDraft(null)}>✕</button>
                        </div>

                        {/* Employee ID — read only */}
                        <div style={{
                            padding: "8px 12px", borderRadius: 8,
                            background: "var(--surface-3)", border: "1px solid var(--line)",
                            fontSize: 13, color: "var(--text-3)", marginBottom: 4,
                            display: "flex", alignItems: "center", gap: 8,
                        }}>
                            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, color: "var(--red)" }}>
                                {editDraft.emp_id}
                            </span>
                            <span style={{ fontSize: 11 }}>— รหัสพนักงาน (ไม่สามารถเปลี่ยนได้)</span>
                        </div>

                        {/* Name */}
                        <label className={styles.lbl}>ชื่อ-สกุล</label>
                        <input className={styles.input}
                            value={editDraft.name}
                            onChange={(e) => setEditDraft((d) => d && ({ ...d, name: e.target.value }))} />

                        {/* Branch + Gender side by side */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                                <label className={styles.lbl}>สาขา</label>
                                <select className={styles.input} value={editDraft.branch_id}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, branch_id: e.target.value }))}>
                                    <option value="">— ไม่ระบุ —</option>
                                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={styles.lbl}>เพศ</label>
                                <select className={styles.input} value={editDraft.gender}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, gender: e.target.value }))}>
                                    <option value="M">ชาย (M)</option>
                                    <option value="F">หญิง (F)</option>
                                    <option value="O">อื่นๆ (O)</option>
                                </select>
                            </div>
                        </div>

                        {/* Hire date */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                                <label className={styles.lbl}>วันที่เริ่มงาน</label>
                                <input type="date" className={styles.input} value={editDraft.hire_date}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, hire_date: e.target.value }))} />
                            </div>
                            <div>
                                <label className={styles.lbl}>วันเกิด (Date of Birth)</label>
                                <input type="date" className={styles.input} value={editDraft.birth_date}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, birth_date: e.target.value }))} />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                            <div>
                                <label className={styles.lbl}>แผนก</label>
                                <select className={styles.input} value={editDraft.department_id} onChange={(e) => {
                                    const deptVal = Number(e.target.value);
                                    setEditDraft((d) => d && ({ ...d, department_id: deptVal, job_position_id: 0 }));
                                }}>
                                    <option value={0}>— ไม่ระบุ —</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={styles.lbl}>ตำแหน่ง</label>
                                <select className={styles.input} value={editDraft.job_position_id} onChange={(e) => setEditDraft((d) => d && ({ ...d, job_position_id: Number(e.target.value) }))}>
                                    <option value={0}>— ไม่ระบุ —</option>
                                    {positions.filter(p => !editDraft.department_id || p.department_id === editDraft.department_id).map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <label className={styles.lbl} style={{ marginTop: 10 }}>หัวหน้างาน (Supervisor)</label>
                        <select className={styles.input} value={editDraft.supervisor_id} onChange={(e) => setEditDraft((d) => d && ({ ...d, supervisor_id: e.target.value }))}>
                            <option value="">— ไม่มี / ไม่ระบุ —</option>
                            {list.filter(e => e.emp_id !== editDraft.emp_id).map((e) => (
                                <option key={e.emp_id} value={e.emp_id}>{e.name} ({e.emp_id})</option>
                            ))}
                        </select>

                        <label className={styles.lbl} style={{ marginTop: 10 }}>เงินเดือนฐาน (Base Salary) (THB)</label>
                        <input type="number" className={styles.input} placeholder="0.00" value={editDraft.base_salary}
                            onChange={(e) => setEditDraft((d) => d && ({ ...d, base_salary: e.target.value }))} />

                        <div style={{ marginTop: 16 }}>
                            <label className={styles.row} style={{ marginBottom: 10 }}>
                                <input type="checkbox"
                                    checked={editDraft.is_on_trial}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, is_on_trial: e.target.checked }))} />
                                <span style={{ color: "var(--red)", fontWeight: 700 }}>อยู่ระหว่างทดลองงาน (On Trial Period)</span>
                            </label>
                            <label className={styles.row} style={{ marginBottom: 16 }}>
                                <input type="checkbox"
                                    checked={editDraft.has_telephone_allowance}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, has_telephone_allowance: e.target.checked }))} />
                                <span>ได้รับค่าโทรศัพท์ (Receives Telephone Allowance)</span>
                            </label>

                            <label className={styles.lbl} style={{ marginTop: 10 }}>เงินประจำตำแหน่ง (Position Allowance) (THB)</label>
                            <input type="number" className={styles.input} placeholder="0.00" value={editDraft.position_allowance}
                                onChange={(e) => setEditDraft((d) => d && ({ ...d, position_allowance: e.target.value }))} />
                        </div>

                        {/* Phone Number */}
                        <label className={styles.lbl}>เบอร์โทรศัพท์มือถือ</label>
                        <input type="tel" className={styles.input} value={editDraft.phone_number} placeholder="08XXXXXXXX"
                            onChange={(e) => setEditDraft((d) => d && ({ ...d, phone_number: e.target.value }))} />

                        {/* Status block */}
                        <div className={`${styles.statusBlock} ${editDraft.is_active ? styles.active : styles.inactive}`}>
                            <div>
                                <div className={styles.statusBlockLabel}>
                                    {editDraft.is_active ? "● Active — ทำงานอยู่" : "○ Inactive — ลาออกแล้ว"}
                                </div>
                                <div className={styles.statusBlockHint}>
                                    {editDraft.is_active ? "ปิด toggle เพื่อบันทึกการลาออก" : "เปิด toggle เพื่อ reactivate พนักงาน"}
                                </div>
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                <input type="checkbox"
                                    checked={editDraft.is_active}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, is_active: e.target.checked }))}
                                    style={{ accentColor: "var(--ok)", width: 18, height: 18, cursor: "pointer" }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Active</span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className={styles.modalActions}>
                            <button className={styles.btnCancel} onClick={() => setEditDraft(null)}>
                                ยกเลิก
                            </button>
                            <button className={styles.btnSave} onClick={saveEdit} disabled={saving}>
                                {saving
                                    ? <><span className={styles.spinner} style={{ width: 14, height: 14, borderTopColor: "#fff" }} /> กำลังบันทึก...</>
                                    : "✓ บันทึกการเปลี่ยนแปลง"
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════
                WARNINGS MODAL
            ══════════════════════════════════════════ */}
            {warningTarget && (
                <div className={styles.modalOverlay}
                    onClick={(e) => { if (e.target === e.currentTarget) setWarningTarget(null); }}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle} style={{ color: "var(--red)" }}>⚠️ รายการใบเตือน: {warningTarget.name}</span>
                            <button className={styles.modalClose} onClick={() => setWarningTarget(null)}>✕</button>
                        </div>

                        <div style={{ padding: "0 20px 20px" }}>
                            <div style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 8 }}>➕ เพิ่มใบเตือนใหม่</div>
                                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
                                    <input type="date" className={styles.input} value={newWarningDate} onChange={e => setNewWarningDate(e.target.value)} />
                                    <input placeholder="สาเหตุ / รายละเอียด" className={styles.input} value={newWarningReason} onChange={e => setNewWarningReason(e.target.value)} />
                                </div>
                                <button className={styles.btnSave} style={{ background: "var(--red)", border: "none", width: "100%", marginTop: 8 }} onClick={addWarning} disabled={saving}>
                                    {saving ? "กำลังบันทึก..." : "ยืนยันการเพิ่มใบเตือน"}
                                </button>
                            </div>

                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>ประวัติใบเตือน ({empWarnings.length})</div>
                            <div style={{ maxHeight: 300, overflowY: "auto" }}>
                                {empWarnings.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "var(--text-4)", fontSize: 13 }}>ไม่มีประวัติใบเตือน</div>}
                                {empWarnings.map(w => (
                                    <div key={w.id} style={{
                                        padding: 10, borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center"
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700 }}>{new Date(w.date).toLocaleDateString("th-TH")}</div>
                                            <div style={{ fontSize: 13 }}>{w.reason}</div>
                                        </div>
                                        <button onClick={() => deleteWarning(w.id)} style={{ padding: 4, background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}>🗑️</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            {toast && (
                <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.msg}</div>
            )}
        </div>
    );
}