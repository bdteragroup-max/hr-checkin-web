"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";
import {
    UsersIcon,
    MagnifyingGlassIcon,
    LightBulbIcon,
    PlusIcon,
    PencilSquareIcon,
    ExclamationTriangleIcon,
    TrashIcon,
    CheckCircleIcon,
    NoSymbolIcon,
    XCircleIcon,
    ArrowDownTrayIcon,
    InformationCircleIcon
} from "@heroicons/react/24/outline";
import SearchableSelect from "@/components/SearchableSelect";
import { formatDateThai } from "@/utils/time";

/* ── Types ──────────────────────────────────────────────────── */
type Branch = { id: string; name: string };

type Emp = {
    emp_id: string;
    name: string;
    nickname?: string | null;
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
    secondary_supervisor_id?: string | null;
    departments?: { name: string } | null;
    job_positions?: { title: string; is_ot_eligible: boolean } | null;
    supervisor?: { name: string } | null;
    secondary_supervisor?: { name: string } | null;
    is_on_trial: boolean;
    has_telephone_allowance: boolean;
    probation_accommodation_allowance: boolean;
    probation_meal_allowance: boolean;
    probation_travel_allowance: boolean;
    fixed_accommodation_allowance?: number | null;
    fixed_meal_allowance?: number | null;
    fixed_travel_allowance?: number | null;
    fixed_tax_deduction?: number | null;
    position_allowance?: number | null;
    general_allowance?: number | null;
    national_id_card?: string | null;
    address?: string | null;
    bank_account_no?: string | null;
    bank_name?: string | null;
    resignation_date?: string | null;
    salary_type?: string | null;
    line_user_id?: string | null;
    is_checkin_exempt: boolean;
    probation_end_date?: string | null;
    email?: string | null;
    company_car: boolean;
    company_accommodation: boolean;
};

type EditDraft = {
    emp_id: string;
    name: string;
    nickname: string;
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
    probation_accommodation_allowance: boolean;
    probation_meal_allowance: boolean;
    probation_travel_allowance: boolean;
    fixed_accommodation_allowance: string;
    fixed_meal_allowance: string;
    fixed_travel_allowance: string;
    fixed_tax_deduction: string;
    position_allowance: string;
    general_allowance: string;
    national_id_card: string;
    address: string;
    bank_account_no: string;
    bank_name: string;
    salary_type: string;
    line_user_id: string;
    is_checkin_exempt: boolean;
    probation_end_date: string;
    resignation_date: string;
    secondary_supervisor_id: string;
    email: string;
    company_car: boolean;
    company_accommodation: boolean;
};

type Department = { id: number; name: string };
type JobPosition = { id: number; department_id: number; title: string; is_ot_eligible: boolean };

/* ── Component ──────────────────────────────────────────────── */
export default function AdminEmployeesPage() {
    const queryClient = useQueryClient();

    const { data: loadData, isLoading: loading, error: queryError, refetch: reload } = useQuery({
        queryKey: ["admin-employees-page"],
        queryFn: async () => {
            const [b, e, dRes, pRes] = await Promise.all([
                fetch("/api/branches", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
                fetch("/api/admin/employees", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
                fetch("/api/admin/organization/departments", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
                fetch("/api/admin/organization/positions", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}))
            ]);

            if (e?.error === "UNAUTHORIZED") throw new Error("ยังไม่ได้เข้าสู่ระบบ Admin (โปรด login)");
            if (e?.error === "FORBIDDEN") throw new Error("ไม่มีสิทธิ์ Admin");
            if (!e?.ok) throw new Error(e?.error || "LOAD_FAILED");

            return {
                branches: (b.branches || []) as Branch[],
                departments: (dRes.list || []) as Department[],
                positions: (pRes.list || []) as JobPosition[],
                list: (e.list || []) as Emp[]
            };
        }
    });

    const branches = loadData?.branches || [];
    const departments = loadData?.departments || [];
    const positions = loadData?.positions || [];
    const list = loadData?.list || [];
    const msg = queryError ? queryError.message : "";
    const [saving, setSaving] = useState(false);
    const [visibleSalaries, setVisibleSalaries] = useState<Set<string>>(new Set());

    const toggleSalaryVisibility = (empId: string) => {
        setVisibleSalaries((prev) => {
            const next = new Set(prev);
            if (next.has(empId)) next.delete(empId);
            else next.add(empId);
            return next;
        });
    };

    const [newEmpId, setNewEmpId] = useState<string | null>(null);

    /* search / filter */
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("all");
    const [typeFilter, setTypeFilter] = useState<"all" | "monthly" | "daily">("all");
    const [deptFilter, setDeptFilter] = useState<number | "all">("all");
    const [branchFilter, setBranchFilter] = useState<string | "all">("all");

    /* create form */
    const [empId, setEmpId] = useState("");
    const [name, setName] = useState("");
    const [nickname, setNickname] = useState("");
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
    const [secondarySupervisorId, setSecondarySupervisorId] = useState("");
    const [isOnTrial, setIsOnTrial] = useState(false);
    const [hasTelephoneAllowance, setHasTelephoneAllowance] = useState(false);
    const [probationAccommodationAllowance, setProbationAccommodationAllowance] = useState(false);
    const [probationMealAllowance, setProbationMealAllowance] = useState(false);
    const [probationTravelAllowance, setProbationTravelAllowance] = useState(false);
    const [fixedAccommodationAllowance, setFixedAccommodationAllowance] = useState("");
    const [fixedMealAllowance, setFixedMealAllowance] = useState("");
    const [fixedTravelAllowance, setFixedTravelAllowance] = useState("");
    const [fixedTaxDeduction, setFixedTaxDeduction] = useState("");
    const [positionAllowance, setPositionAllowance] = useState("");
    const [generalAllowance, setGeneralAllowance] = useState("");
    const [nationalIdCard, setNationalIdCard] = useState("");
    const [address, setAddress] = useState("");
    const [bankAccountNo, setBankAccountNo] = useState("");
    const [bankName, setBankName] = useState("");
    const [salaryType, setSalaryType] = useState<"monthly" | "daily">("monthly");
    const [lineUserId, setLineUserId] = useState("");
    const [email, setEmail] = useState("");
    const [isCheckinExempt, setIsCheckinExempt] = useState(false);
    const [probationEndDate, setProbationEndDate] = useState("");
    const [companyCar, setCompanyCar] = useState(false);
    const [companyAccommodation, setCompanyAccommodation] = useState(false);

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

    const handleExport = () => {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (typeFilter !== "all") params.append("salary_type", typeFilter);
        if (branchFilter !== "all") params.append("branch", branchFilter);
        if (deptFilter !== "all") params.append("dept", String(deptFilter));

        window.location.href = `/api/admin/employees/export?${params.toString()}`;
    };

    const branchName = (id: string | null) => {
        if (!id) return "—";
        return branches.find((b) => b.id === id)?.name ?? id;
    };

    const genderLabel: Record<string, string> = { M: "ชาย", F: "หญิง", O: "อื่นๆ" };

    const activeCnt = list.filter((e) => e.is_active).length;
    const inactiveCnt = list.length - activeCnt;

    /* ── load ── */
    // Handled by useQuery

    /* ── create ── */
    async function create() {
        if (!empId.trim()) {
            showToast("กรุณากรอกรหัสพนักงาน", "bad");
            return;
        }
        if (!name.trim()) {
            showToast("กรุณากรอกชื่อ-สกุล", "bad");
            return;
        }
        setSaving(true);
        try {
            const r = await fetch("/api/admin/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emp_id: empId.trim(),
                    name: name.trim(),
                    nickname: nickname.trim() || undefined,
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
                    secondary_supervisor_id: secondarySupervisorId || null,
                    is_on_trial: isOnTrial,
                    has_telephone_allowance: hasTelephoneAllowance,
                    probation_accommodation_allowance: probationAccommodationAllowance,
                    probation_meal_allowance: probationMealAllowance,
                    probation_travel_allowance: probationTravelAllowance,
                    fixed_accommodation_allowance: fixedAccommodationAllowance ? Number(fixedAccommodationAllowance) : 0,
                    fixed_meal_allowance: fixedMealAllowance ? Number(fixedMealAllowance) : 0,
                    fixed_travel_allowance: fixedTravelAllowance ? Number(fixedTravelAllowance) : 0,
                    fixed_tax_deduction: fixedTaxDeduction ? Number(fixedTaxDeduction) : 0,
                    position_allowance: positionAllowance ? Number(positionAllowance) : 0,
                    general_allowance: generalAllowance ? Number(generalAllowance) : 0,
                    national_id_card: nationalIdCard.trim() || null,
                    address: address.trim() || null,
                    bank_account_no: bankAccountNo.trim() || null,
                    bank_name: bankName.trim() || null,
                    salary_type: salaryType,
                    line_user_id: lineUserId.trim() || null,
                    email: email.trim() || null,
                    is_checkin_exempt: isCheckinExempt,
                    probation_end_date: isOnTrial && probationEndDate ? probationEndDate : null,
                    company_car: companyCar,
                    company_accommodation: companyAccommodation,
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
                return showToast(map[t?.error] || t?.error || "CREATE_FAILED", "bad");
            }
            showToast(`เพิ่ม ${name.trim()} แล้ว`);
            setNewEmpId(empId.trim());
            setTimeout(() => setNewEmpId(null), 3000);

            setEmpId(""); setName(""); setNickname(""); setBranchId(""); setPin("");
            setIsActive(true); setGender("M"); setHireDate(""); setBirthDate(""); setPhoneNumber("");
            setDepartmentId(0); setPositionId(0); setBaseSalary(""); setSupervisorId("");
            setSecondarySupervisorId("");
            setIsOnTrial(false); setHasTelephoneAllowance(false);
            setPositionAllowance(""); setGeneralAllowance("");
            setNationalIdCard(""); setAddress(""); setBankAccountNo(""); setBankName("");
            setSalaryType("monthly");
            setLineUserId("");
            setEmail("");
            setIsCheckinExempt(false);
            setProbationEndDate("");
            setCompanyCar(false);
            setCompanyAccommodation(false);
            setCreateModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["admin-employees-page"] });
        } finally { setSaving(false); }
    }

    /* ── update (from modal) ── */
    async function saveEdit() {
        if (!editDraft) return;

        // Validation for resignation date
        if (!editDraft.is_active && !editDraft.resignation_date) {
            showToast("กรุณาระบุวันที่ลาออก", "bad");
            return;
        }

        setSaving(true);
        try {
            const r = await fetch("/api/admin/employees", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emp_id: editDraft.emp_id,
                    name: editDraft.name.trim(),
                    nickname: editDraft.nickname.trim() || undefined,
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
                    secondary_supervisor_id: editDraft.secondary_supervisor_id || null,
                    is_on_trial: editDraft.is_on_trial,
                    has_telephone_allowance: editDraft.has_telephone_allowance,
                    probation_accommodation_allowance: editDraft.probation_accommodation_allowance,
                    probation_meal_allowance: editDraft.probation_meal_allowance,
                    probation_travel_allowance: editDraft.probation_travel_allowance,
                    fixed_accommodation_allowance: editDraft.fixed_accommodation_allowance ? Number(editDraft.fixed_accommodation_allowance) : 0,
                    fixed_meal_allowance: editDraft.fixed_meal_allowance ? Number(editDraft.fixed_meal_allowance) : 0,
                    fixed_travel_allowance: editDraft.fixed_travel_allowance ? Number(editDraft.fixed_travel_allowance) : 0,
                    fixed_tax_deduction: editDraft.fixed_tax_deduction ? Number(editDraft.fixed_tax_deduction) : 0,
                    position_allowance: editDraft.position_allowance ? Number(editDraft.position_allowance) : 0,
                    general_allowance: editDraft.general_allowance ? Number(editDraft.general_allowance) : 0,
                    national_id_card: editDraft.national_id_card.trim() || null,
                    address: editDraft.address.trim() || null,
                    bank_account_no: editDraft.bank_account_no.trim() || null,
                    bank_name: editDraft.bank_name.trim() || null,
                    salary_type: editDraft.salary_type,
                    line_user_id: editDraft.line_user_id.trim() || null,
                    email: editDraft.email.trim() || null,
                    is_checkin_exempt: editDraft.is_checkin_exempt,
                    probation_end_date: editDraft.is_on_trial && editDraft.probation_end_date ? editDraft.probation_end_date : null,
                    resignation_date: !editDraft.is_active ? editDraft.resignation_date : null,
                    company_car: editDraft.company_car,
                    company_accommodation: editDraft.company_accommodation,
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
            showToast(`อัปเดต ${editDraft.name} แล้ว`);
            setEditDraft(null);
            queryClient.invalidateQueries({ queryKey: ["admin-employees-page"] });
        } finally { setSaving(false); }
    }

    /* ── quick toggle active (inline) ── */
    async function toggleActive(x: Emp) {
        const next = !x.is_active;

        // If deactivating, open edit modal instead to force resignation date
        if (!next) {
            setEditDraft({
                emp_id: x.emp_id,
                name: x.name,
                nickname: x.nickname ?? "",
                branch_id: x.branch_id ?? "",
                gender: x.gender ?? "M",
                hire_date: x.hire_date ? String(x.hire_date).slice(0, 10) : "",
                birth_date: x.birth_date ? String(x.birth_date).slice(0, 10) : "",
                phone_number: x.phone_number ?? "",
                is_active: false,
                department_id: x.department_id ?? 0,
                job_position_id: x.job_position_id ?? 0,
                base_salary: x.base_salary ? String(x.base_salary) : "",
                supervisor_id: x.supervisor_id ?? "",
                is_on_trial: x.is_on_trial,
                has_telephone_allowance: x.has_telephone_allowance,
                probation_accommodation_allowance: x.probation_accommodation_allowance,
                probation_meal_allowance: x.probation_meal_allowance,
                probation_travel_allowance: x.probation_travel_allowance,
                fixed_accommodation_allowance: x.fixed_accommodation_allowance ? String(x.fixed_accommodation_allowance) : "",
                fixed_meal_allowance: x.fixed_meal_allowance ? String(x.fixed_meal_allowance) : "",
                fixed_travel_allowance: x.fixed_travel_allowance ? String(x.fixed_travel_allowance) : "",
                fixed_tax_deduction: x.fixed_tax_deduction ? String(x.fixed_tax_deduction) : "",
                position_allowance: x.position_allowance ? String(x.position_allowance) : "",
                general_allowance: x.general_allowance ? String(x.general_allowance) : "",
                national_id_card: x.national_id_card || "",
                address: x.address || "",
                bank_account_no: x.bank_account_no || "",
                bank_name: x.bank_name || "",
                salary_type: x.salary_type || "monthly",
                line_user_id: x.line_user_id || "",
                is_checkin_exempt: x.is_checkin_exempt || false,
                probation_end_date: x.probation_end_date ? String(x.probation_end_date).slice(0, 10) : "",
                resignation_date: new Date().toISOString().split("T")[0], // Default to today
                secondary_supervisor_id: x.secondary_supervisor_id ?? "",
                email: x.email || "",
                company_car: x.company_car ?? false,
                company_accommodation: x.company_accommodation ?? false,
            });
            return;
        }

        setSaving(true);
        try {
            const r = await fetch("/api/admin/employees", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emp_id: x.emp_id, is_active: next }),
            });
            if (r.ok) {
                showToast(next ? `เปิดใช้งาน ${x.name}` : `ปิดใช้งาน ${x.name}`, next ? "ok" : "bad");
                queryClient.invalidateQueries({ queryKey: ["admin-employees-page"] });
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
                showToast("บันทึกใบเตือนแล้ว");
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
                showToast("ลบใบเตือนแล้ว");
                if (warningTarget) await loadWarnings(warningTarget);
            }
        } finally { setSaving(false); }
    }

    /* ── filtered list ── */
    const filtered = useMemo(() => list.filter((x) => {
        const q = search.trim().toLowerCase();
        const matchQ = !q || x.emp_id.toLowerCase().includes(q) || x.name.toLowerCase().includes(q) || x.nickname?.toLowerCase().includes(q);
        const matchS =
            statusFilter === "all" ? true :
                statusFilter === "active" ? x.is_active :
                    !x.is_active;
        const matchT =
            typeFilter === "all" ? true :
                x.salary_type === typeFilter;
        const matchD =
            deptFilter === "all" ? true :
                x.department_id === deptFilter;
        const matchB =
            branchFilter === "all" ? true :
                x.branch_id === branchFilter;

        return matchQ && matchS && matchT && matchD && matchB;
    }), [list, search, statusFilter, typeFilter, deptFilter, branchFilter]);

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
                    <button className={styles.btnGhost} onClick={() => reload()} disabled={loading}>
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
                            <div className={styles.tableHeaderTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <UsersIcon width={20} />  รายการพนักงาน
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
                                placeholder="ค้นหา รหัส / ชื่อ"
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
                            <select
                                className={styles.input}
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value as any)}
                                style={{ width: 140 }}
                            >
                                <option value="all">ทุกประเภท</option>
                                <option value="monthly">รายเดือน</option>
                                <option value="daily">รายวัน (Intern)</option>
                            </select>
                            <select
                                className={styles.input}
                                value={branchFilter}
                                onChange={(e) => setBranchFilter(e.target.value)}
                                style={{ width: 140 }}
                            >
                                <option value="all">ทุกสาขา</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <select
                                className={styles.input}
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                                style={{ width: 160 }}
                            >
                                <option value="all">ทุกแผนก</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                            <button className={styles.btnRefresh} onClick={() => reload()} disabled={loading} title="รีเฟรช">
                                ↻
                            </button>
                            <button
                                className={styles.btnGhost}
                                onClick={handleExport}
                                disabled={loading}
                                style={{ height: 38 }}
                                title="ส่งออกไฟล์ CSV"
                            >
                                <ArrowDownTrayIcon width={18} />
                                Export
                            </button>
                        </div>

                        {/* Export Guide */}
                        <div style={{
                            margin: "0 20px 16px",
                            padding: "16px",
                            background: "linear-gradient(135deg, #f8f9fb 0%, #f1f3f6 100%)",
                            borderRadius: "12px",
                            border: "1px solid var(--line)",
                            display: "flex",
                            gap: "14px",
                            alignItems: "flex-start"
                        }}>
                            <div style={{
                                background: "var(--surface)",
                                padding: "8px",
                                borderRadius: "10px",
                                boxShadow: "var(--shadow-xs)",
                                color: "var(--red)"
                            }}>
                                <InformationCircleIcon width={24} />
                            </div>
                            <div>
                                <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>คู่มือการส่งออกข้อมูล (Data Export Guide)</h4>
                                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-3)", lineHeight: 1.5 }}>
                                    ท่านสามารถกรองข้อมูลพนักงานตาม <b>สาขา, แผนก, ประเภทเงินเดือน</b> หรือ <b>สถานะ</b> โดยใช้ตัวเลือกด้านบน
                                    ระบบจะแสดงรายการที่ตรงตามเงื่อนไขโดยอัตโนมัติ และท่านสามารถกดปุ่ม <b>Export</b> เพื่อดาวน์โหลดไฟล์ CSV
                                    สำหรับนำไปใช้งานต่อใน Excel ได้ทันที
                                </p>
                            </div>
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
                                            <th>ติดต่อ</th>
                                            <th>สถานะ</th>
                                            <th style={{ textAlign: "right" }}>จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((x) => (
                                            <tr key={x.emp_id} className={x.emp_id === newEmpId ? styles.highlightRed : undefined} style={{ opacity: x.is_active ? 1 : 0.55 }}>
                                                <td><span className={styles.empId}>{x.emp_id}</span></td>
                                                <td style={{ fontWeight: 600, color: "var(--text)" }}>
                                                    {x.name} {x.nickname && <span style={{ color: "var(--text-3)", fontSize: 13, fontWeight: 500 }}>({x.nickname})</span>}
                                                    {!x.line_user_id && x.is_active && (
                                                        <span style={{
                                                            marginLeft: 8,
                                                            fontSize: 10,
                                                            color: "var(--red)",
                                                            background: "rgba(239, 68, 68, 0.1)",
                                                            padding: "2px 6px",
                                                            borderRadius: 4,
                                                            fontWeight: 600,
                                                            border: "1px solid rgba(239, 68, 68, 0.2)"
                                                        }}>
                                                            ⚠️ ยังไม่เชื่อม LINE
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ color: "var(--text-3)", fontSize: 12 }}>{branchName(x.branch_id)}</td>
                                                <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                                                    {x.gender ? (genderLabel[x.gender as keyof typeof genderLabel] ?? x.gender) : "—"}
                                                </td>
                                                <td style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>
                                                    {x.hire_date ? formatDateThai(x.hire_date) : "—"}
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
                                                    {x.secondary_supervisor?.name && (
                                                        <div style={{ display: "block", fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>ผู้ประเมินร่วม: {x.secondary_supervisor.name}</div>
                                                    )}
                                                    {x.is_on_trial && (
                                                        <div style={{ marginTop: 4 }}>
                                                            <span style={{ display: "inline-block", fontSize: 10, color: "var(--ok)", background: "rgba(16, 185, 129, 0.1)", padding: "2px 6px", borderRadius: 4 }}>
                                                                อยู่ระหว่างทดลองงาน
                                                            </span>
                                                            {x.probation_end_date && (
                                                                <span style={{ display: "inline-block", fontSize: 10, color: "var(--red)", background: "rgba(239, 68, 68, 0.1)", padding: "2px 6px", borderRadius: 4, marginLeft: 4 }}>
                                                                    ครบกำหนด: {formatDateThai(x.probation_end_date)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {x.is_checkin_exempt && (
                                                        <span style={{ display: "inline-block", fontSize: 10, color: "var(--red)", background: "rgba(239, 68, 68, 0.1)", padding: "2px 6px", borderRadius: 4, marginTop: 4, marginLeft: 4 }}>ยกเว้นการลงเวลา</span>
                                                    )}
                                                </td>
                                                <td style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13 }}>
                                                    <div
                                                        style={{ display: "flex", flexDirection: "column", gap: 2, cursor: "pointer" }}
                                                        onClick={(e) => { e.stopPropagation(); toggleSalaryVisibility(x.emp_id); }}
                                                        title="คลิกเพื่อดู/ซ่อน เงินเดือน"
                                                    >
                                                        <div style={{ fontWeight: 700, color: x.salary_type === "daily" ? "var(--purple)" : "inherit" }}>
                                                            {x.base_salary ? (visibleSalaries.has(x.emp_id) ? `฿${Number(x.base_salary).toLocaleString()}` : "******") : "—"}
                                                            {x.salary_type === "daily" && <span style={{ fontSize: 10, fontWeight: "normal", marginLeft: 4 }}>/ วัน</span>}
                                                        </div>
                                                        {x.position_allowance && Number(x.position_allowance) > 0 && (
                                                            <div style={{ fontSize: 11, color: "var(--ok)" }}>+ Pos. Allow.: {visibleSalaries.has(x.emp_id) ? `฿${Number(x.position_allowance).toLocaleString()}` : "******"}</div>
                                                        )}
                                                        {x.general_allowance && Number(x.general_allowance) > 0 && (
                                                            <div style={{ fontSize: 11, color: "var(--ok)" }}>+ Allowance: {visibleSalaries.has(x.emp_id) ? `฿${Number(x.general_allowance).toLocaleString()}` : "******"}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                                                    <div>{x.phone_number || "—"}</div>
                                                    {x.email && <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>{x.email}</div>}
                                                </td>

                                                {/* ── Status badge ── */}
                                                <td>
                                                    <span className={x.is_active ? styles.badgeActive : styles.badgeInactive}>
                                                        {x.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                                                    </span>
                                                    {!x.is_active && x.resignation_date && (
                                                        <div style={{ fontSize: 10, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>
                                                            ออกเมื่อ: {formatDateThai(x.resignation_date)}
                                                        </div>
                                                    )}
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
                                                                    nickname: x.nickname ?? "",
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
                                                                    probation_accommodation_allowance: x.probation_accommodation_allowance,
                                                                    probation_meal_allowance: x.probation_meal_allowance,
                                                                    probation_travel_allowance: x.probation_travel_allowance,
                                                                    fixed_accommodation_allowance: x.fixed_accommodation_allowance ? String(x.fixed_accommodation_allowance) : "",
                                                                    fixed_meal_allowance: x.fixed_meal_allowance ? String(x.fixed_meal_allowance) : "",
                                                                    fixed_travel_allowance: x.fixed_travel_allowance ? String(x.fixed_travel_allowance) : "",
                                                                    fixed_tax_deduction: x.fixed_tax_deduction ? String(x.fixed_tax_deduction) : "",
                                                                    position_allowance: x.position_allowance ? String(x.position_allowance) : "",
                                                                    general_allowance: x.general_allowance ? String(x.general_allowance) : "",
                                                                    national_id_card: x.national_id_card || "",
                                                                    address: x.address || "",
                                                                    bank_account_no: x.bank_account_no || "",
                                                                    bank_name: x.bank_name || "",
                                                                    salary_type: x.salary_type || "monthly",
                                                                    line_user_id: x.line_user_id || "",
                                                                    is_checkin_exempt: x.is_checkin_exempt || false,
                                                                    probation_end_date: x.probation_end_date ? String(x.probation_end_date).slice(0, 10) : "",
                                                                    resignation_date: x.resignation_date ? String(x.resignation_date).slice(0, 10) : "",
                                                                    secondary_supervisor_id: x.secondary_supervisor_id ?? "",
                                                                    email: x.email || "",
                                                                    company_car: x.company_car ?? false,
                                                                    company_accommodation: x.company_accommodation ?? false,
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
                                                        <span className={styles.emptyIcon}><UsersIcon width={32} /></span>
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
                            <LightBulbIcon width={14} style={{ display: "inline-block", verticalAlign: "text-bottom" }} /> กรณีลาออก แนะนำให้กดปุ่ม <b>Active</b> เพื่อเปลี่ยนเป็น Inactive แทนการลบ เพื่อเก็บประวัติการทำงาน
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
                    <div className={styles.modal} style={{ maxWidth: 700 }}>

                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}><PlusIcon width={20} /> สร้างพนักงานใหม่</span>
                            <button className={styles.modalClose} onClick={() => setCreateModalOpen(false)}>✕</button>
                        </div>

                        <div className={styles.modalScroll}>
                            <label className={styles.lbl}>รหัสพนักงาน</label>
                            <input className={styles.input} placeholder="E0001"
                                value={empId} onChange={(e) => setEmpId(e.target.value)} />

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div>
                                    <label className={styles.lbl}>ชื่อ-สกุล</label>
                                    <input className={styles.input} placeholder="ชื่อพนักงาน"
                                        value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                                <div>
                                    <label className={styles.lbl}>ชื่อเล่น</label>
                                    <input className={styles.input} placeholder="ชื่อเล่น"
                                        value={nickname} onChange={(e) => setNickname(e.target.value)} />
                                </div>
                            </div>

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

                            <label className={styles.lbl}>เลขบัตรประจำตัวประชาชน</label>
                            <input className={styles.input} placeholder="1-xxxx-xxxxx-xx-x"
                                value={nationalIdCard} onChange={(e) => setNationalIdCard(e.target.value)} />

                            <label className={styles.lbl}>ที่อยู่</label>
                            <textarea className={styles.input} placeholder="ที่อยู่ปัจจุบัน"
                                value={address} onChange={(e) => setAddress(e.target.value)} style={{ minHeight: 60 }} />

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div>
                                    <label className={styles.lbl}>ธนาคาร</label>
                                    <input className={styles.input} placeholder="เช่น กสิกรไทย"
                                        value={bankName} onChange={(e) => setBankName(e.target.value)} />
                                </div>
                                <div>
                                    <label className={styles.lbl}>เลขบัญชีธนาคาร</label>
                                    <input className={styles.input} placeholder="000-0-00000-0"
                                        value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} />
                                </div>
                            </div>

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
                            <SearchableSelect
                                className={styles.input}
                                value={supervisorId}
                                onChange={(val) => setSupervisorId(val)}
                                options={list.map((e) => ({ value: e.emp_id, label: `${e.name} (${e.emp_id})` }))}
                                placeholder="— ไม่มี / ไม่ระบุ —"
                            />

                            <label className={styles.lbl} style={{ marginTop: 10 }}>ผู้ประเมินร่วม (Co-Evaluator)</label>
                            <SearchableSelect
                                className={styles.input}
                                value={secondarySupervisorId}
                                onChange={(val) => setSecondarySupervisorId(val)}
                                options={list.map((e) => ({ value: e.emp_id, label: `${e.name} (${e.emp_id})` }))}
                                placeholder="— ไม่มี / ไม่ระบุ —"
                            />

                            <label className={styles.lbl} style={{ marginTop: 10 }}>ประเภทเงินเดือน (Salary Type)</label>
                            <select className={styles.input} value={salaryType} onChange={(e) => {
                                const val = e.target.value as "monthly" | "daily";
                                setSalaryType(val);
                                if (val === "daily" && (!baseSalary || baseSalary === "0")) {
                                    setBaseSalary("300");
                                }
                            }}>
                                <option value="monthly">รายเดือน (Monthly)</option>
                                <option value="daily">รายวัน / Intern (Daily Rate)</option>
                            </select>

                            <label className={styles.lbl} style={{ marginTop: 10 }}>{salaryType === "daily" ? "ค่าแรงรายวัน (Daily Rate) (THB)" : "เงินเดือนฐาน (Base Salary) (THB)"}</label>
                            <input type="number" className={styles.input} placeholder="0.00"
                                value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} />

                            <div style={{ border: "1px solid var(--border)", padding: 12, borderRadius: 6, marginBottom: 16 }}>
                                <div className={styles.lbl} style={{ marginBottom: 10, fontWeight: 700 }}>สวัสดิการตายตัวรายเดือน (Fixed Monthly Allowances)</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "10px", alignItems: "end" }}>
                                    <div style={{ flex: 1 }}>
                                        <label className={styles.lbl}>ค่าที่พัก (Accommodation)</label>
                                        <input type="number" className={styles.input} placeholder="0.00" value={fixedAccommodationAllowance} onChange={(e) => setFixedAccommodationAllowance(e.target.value)} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className={styles.lbl}>ค่าอาหาร (Meal)</label>
                                        <input type="number" className={styles.input} placeholder="0.00" value={fixedMealAllowance} onChange={(e) => setFixedMealAllowance(e.target.value)} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className={styles.lbl}>ค่าเดินทาง (Travel)</label>
                                        <input type="number" className={styles.input} placeholder="0.00" value={fixedTravelAllowance} onChange={(e) => setFixedTravelAllowance(e.target.value)} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className={styles.lbl}>หักภาษีรายเดือน (คงที่)</label>
                                        <input type="number" className={styles.input} placeholder="0.00" value={fixedTaxDeduction} onChange={(e) => setFixedTaxDeduction(e.target.value)} />
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-light)" }}>*หากระบุค่าเหล่านี้ จะใช้แทนการคำนวณอัตโนมัติตามวัน/อายุงาน</div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                                <div>
                                    <label className={styles.lbl}>เงินประจำตำแหน่ง (Position Allowance) (THB)</label>
                                    <input type="number" className={styles.input} placeholder="0.00"
                                        value={positionAllowance} onChange={(e) => setPositionAllowance(e.target.value)} />
                                </div>
                                <div>
                                    <label className={styles.lbl}>เงินเบี้ยเลี้ยงอื่นๆ (General Allowance) (THB)</label>
                                    <input type="number" className={styles.input} placeholder="0.00"
                                        value={generalAllowance} onChange={(e) => setGeneralAllowance(e.target.value)} />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                                <div>
                                    <label className={styles.lbl}>เบอร์โทรศัพท์มือถือ</label>
                                    <input type="tel" className={styles.input} placeholder="08XXXXXXXX"
                                        value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                                </div>
                                <div>
                                    <label className={styles.lbl}>อีเมล (Email)</label>
                                    <input type="email" className={styles.input} placeholder="email@example.com"
                                        value={email} onChange={(e) => setEmail(e.target.value)} />
                                </div>
                            </div>

                            <label className={styles.lbl} style={{ marginTop: 10 }}>PIN (ไม่บังคับ)</label>
                            <input type="password" className={styles.input} placeholder="อย่างน้อย 4 หลัก"
                                value={pin} onChange={(e) => setPin(e.target.value)} />

                            <div style={{ marginTop: 16 }}>
                                <label className={styles.row}>
                                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                                    <span>ใช้งานอยู่ (Active)</span>
                                </label>

                                <label className={styles.row} style={{ marginTop: 10 }}>
                                    <input type="checkbox" checked={isOnTrial} onChange={(e) => {
                                        setIsOnTrial(e.target.checked);
                                        if (!e.target.checked) setProbationEndDate("");
                                    }} />
                                    <span style={{ color: "var(--red)", fontWeight: 700 }}>อยู่ระหว่างทดลองงาน (On Trial Period)</span>
                                </label>

                                {isOnTrial && (
                                    <div style={{ marginLeft: 24, marginTop: 8 }}>
                                        <label className={styles.lbl} style={{ color: "var(--text-3)", fontSize: 12 }}>วันสิ้นสุดทดลองงาน (ถ้ามี)</label>
                                        <input type="date" className={styles.input}
                                            value={probationEndDate} onChange={(e) => setProbationEndDate(e.target.value)} />
                                    </div>
                                )}

                                <label className={styles.row} style={{ marginTop: 10 }}>
                                    <input type="checkbox" checked={hasTelephoneAllowance} onChange={(e) => setHasTelephoneAllowance(e.target.checked)} />
                                    <span>รับค่าโทรศัพท์ (Receives Telephone Allowance)</span>
                                </label>

                                <div style={{ border: "1px solid var(--border)", padding: 12, borderRadius: 6, marginTop: 16 }}>
                                    <div className={styles.lbl} style={{ marginBottom: 10, fontWeight: 700 }}>สวัสดิการช่วงทดลองงาน (Probation Allowances)</div>
                                    <label className={styles.row} style={{ marginBottom: 8 }}>
                                        <input type="checkbox" checked={probationAccommodationAllowance} onChange={(e) => setProbationAccommodationAllowance(e.target.checked)} />
                                        <span>รับค่าที่พัก (Accommodation Allowance)</span>
                                    </label>
                                    <label className={styles.row} style={{ marginBottom: 8 }}>
                                        <input type="checkbox" checked={probationMealAllowance} onChange={(e) => setProbationMealAllowance(e.target.checked)} />
                                        <span>รับค่าอาหาร (Meal Allowance)</span>
                                    </label>
                                    <label className={styles.row}>
                                        <input type="checkbox" checked={probationTravelAllowance} onChange={(e) => setProbationTravelAllowance(e.target.checked)} />
                                        <span>รับค่าเดินทาง (Travel Allowance)</span>
                                    </label>
                                </div>

                                <div style={{ border: "1px solid var(--border)", padding: 12, borderRadius: 6, marginTop: 16 }}>
                                    <div className={styles.lbl} style={{ marginBottom: 10, fontWeight: 700 }}>สวัสดิการที่บริษัทจัดหาให้ (Company-provided benefits)</div>
                                    <label className={styles.row} style={{ marginBottom: 8 }}>
                                        <input type="checkbox" checked={companyCar} onChange={(e) => setCompanyCar(e.target.checked)} />
                                        <span>บริษัทจัดหารถยนต์ให้ (Company provides a car)</span>
                                    </label>
                                    <label className={styles.row}>
                                        <input type="checkbox" checked={companyAccommodation} onChange={(e) => setCompanyAccommodation(e.target.checked)} />
                                        <span>บริษัทจัดหาที่พักให้ (Company provides accommodation)</span>
                                    </label>
                                </div>

                                <label className={styles.row} style={{ marginTop: 10 }}>
                                    <input type="checkbox" checked={isCheckinExempt} onChange={(e) => setIsCheckinExempt(e.target.checked)} />
                                    <span style={{ color: "var(--red)", fontWeight: 500 }}>ยกเว้นการลงเวลา (Check-in Exempt)</span>
                                </label>

                                <label className={styles.lbl} style={{ marginTop: 16 }}>LINE User ID (สำหรับการแจ้งเตือน)</label>
                                <input className={styles.input} placeholder="U123456789..."
                                    value={lineUserId} onChange={(e) => setLineUserId(e.target.value)} />
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.btnCancel} onClick={() => setCreateModalOpen(false)}>ยกเลิก</button>
                            <button className={styles.btnSave} onClick={create} disabled={saving}>
                                {saving ? "กำลังบันทึก..." : <><PlusIcon width={16} style={{ display: "inline-block", verticalAlign: "text-bottom" }} /> ดำเนินการสร้างพนักงาน</>}
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
                    <div className={styles.modal} style={{ maxWidth: 700 }}>

                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}><PencilSquareIcon width={20} /> แก้ไขข้อมูลพนักงาน</span>
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                                <label className={styles.lbl}>ชื่อ-สกุล</label>
                                <input className={styles.input}
                                    value={editDraft.name}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, name: e.target.value }))} />
                            </div>
                            <div>
                                <label className={styles.lbl}>ชื่อเล่น</label>
                                <input className={styles.input}
                                    value={editDraft.nickname}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, nickname: e.target.value }))} />
                            </div>
                        </div>

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


                        <label className={styles.lbl}>เลขบัตรประจำตัวประชาชน</label>
                        <input className={styles.input} placeholder="1-xxxx-xxxxx-xx-x"
                            value={editDraft.national_id_card} onChange={(e) => setEditDraft((d) => d && ({ ...d, national_id_card: e.target.value }))} />

                        <label className={styles.lbl}>ที่อยู่</label>
                        <textarea className={styles.input} placeholder="ที่อยู่ปัจจุบัน" style={{ minHeight: 60 }}
                            value={editDraft.address} onChange={(e) => setEditDraft((d) => d && ({ ...d, address: e.target.value }))} />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                                <label className={styles.lbl}>ธนาคาร</label>
                                <input className={styles.input} placeholder="เช่น กสิกรไทย"
                                    value={editDraft.bank_name} onChange={(e) => setEditDraft((d) => d && ({ ...d, bank_name: e.target.value }))} />
                            </div>
                            <div>
                                <label className={styles.lbl}>เลขบัญชีธนาคาร</label>
                                <input className={styles.input} placeholder="000-0-00000-0"
                                    value={editDraft.bank_account_no} onChange={(e) => setEditDraft((d) => d && ({ ...d, bank_account_no: e.target.value }))} />
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

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                            <div>
                                <label className={styles.lbl}>ประเภทเงินเดือน</label>
                                <select className={styles.input} value={editDraft.salary_type}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, salary_type: e.target.value }))}>
                                    <option value="monthly">รายเดือน</option>
                                    <option value="daily">รายวัน (Intern)</option>
                                </select>
                            </div>
                            <div>
                                <label className={styles.lbl}>{editDraft.salary_type === "daily" ? "ค่าแรงรายวัน (THB)" : "เงินเดือน (THB)"}</label>
                                <input type="number" className={styles.input}
                                    value={editDraft.base_salary}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, base_salary: e.target.value }))} />
                            </div>
                        </div>

                        <div style={{ border: "1px solid var(--border)", padding: 12, borderRadius: 6, marginBottom: 16, marginTop: 16 }}>
                            <div className={styles.lbl} style={{ marginBottom: 10, fontWeight: 700 }}>สวัสดิการตายตัวรายเดือน (Fixed Monthly Allowances)</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "10px", alignItems: "end" }}>
                                <div style={{ flex: 1 }}>
                                    <label className={styles.lbl}>ค่าที่พัก (Accommodation)</label>
                                    <input type="number" className={styles.input} placeholder="0.00" value={editDraft.fixed_accommodation_allowance} onChange={(e) => setEditDraft((d) => d && ({ ...d, fixed_accommodation_allowance: e.target.value }))} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className={styles.lbl}>ค่าอาหาร (Meal)</label>
                                    <input type="number" className={styles.input} placeholder="0.00" value={editDraft.fixed_meal_allowance} onChange={(e) => setEditDraft((d) => d && ({ ...d, fixed_meal_allowance: e.target.value }))} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className={styles.lbl}>ค่าเดินทาง (Travel)</label>
                                    <input type="number" className={styles.input} placeholder="0.00" value={editDraft.fixed_travel_allowance} onChange={(e) => setEditDraft((d) => d && ({ ...d, fixed_travel_allowance: e.target.value }))} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className={styles.lbl}>หักภาษีรายเดือน (คงที่)</label>
                                    <input type="number" className={styles.input} placeholder="0.00" value={editDraft.fixed_tax_deduction} onChange={(e) => setEditDraft((d) => d && ({ ...d, fixed_tax_deduction: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-light)" }}>*หากระบุค่าเหล่านี้ จะใช้แทนการคำนวณอัตโนมัติตามวัน/อายุงาน</div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                            <div>
                                <label className={styles.lbl}>เงินประจำตำแหน่ง (Position Allowance) (THB)</label>
                                <input type="number" className={styles.input} placeholder="0.00" value={editDraft.position_allowance}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, position_allowance: e.target.value }))} />
                            </div>
                            <div>
                                <label className={styles.lbl}>เงินเบี้ยเลี้ยงอื่นๆ (General Allowance) (THB)</label>
                                <input type="number" className={styles.input} placeholder="0.00" value={editDraft.general_allowance}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, general_allowance: e.target.value }))} />
                            </div>
                        </div>

                        <label className={styles.lbl} style={{ marginTop: 10 }}>หัวหน้างาน (Supervisor)</label>
                        <SearchableSelect
                            className={styles.input}
                            value={editDraft.supervisor_id}
                            onChange={(val) => setEditDraft((d) => d && ({ ...d, supervisor_id: val }))}
                            options={list.filter(e => e.emp_id !== editDraft.emp_id).map((e) => ({ value: e.emp_id, label: `${e.name} (${e.emp_id})` }))}
                            placeholder="— ไม่มี / ไม่ระบุ —"
                        />

                        <label className={styles.lbl} style={{ marginTop: 10 }}>ผู้ประเมินร่วม (Co-Evaluator)</label>
                        <SearchableSelect
                            className={styles.input}
                            value={editDraft.secondary_supervisor_id}
                            onChange={(val) => setEditDraft((d) => d && ({ ...d, secondary_supervisor_id: val }))}
                            options={list.filter(e => e.emp_id !== editDraft.emp_id).map((e) => ({ value: e.emp_id, label: `${e.name} (${e.emp_id})` }))}
                            placeholder="— ไม่มี / ไม่ระบุ —"
                        />

                        <label className={styles.lbl} style={{ marginTop: 10 }}>เงินเดือนฐาน (Base Salary) (THB)</label>
                        <input type="number" className={styles.input} placeholder="0.00" value={editDraft.base_salary}
                            onChange={(e) => setEditDraft((d) => d && ({ ...d, base_salary: e.target.value }))} />

                        <div style={{ marginTop: 16 }}>
                            <label className={styles.row} style={{ marginBottom: 10 }}>
                                <input type="checkbox"
                                    checked={editDraft.is_on_trial}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setEditDraft((d) => d && ({
                                            ...d,
                                            is_on_trial: checked,
                                            probation_end_date: checked ? d.probation_end_date : ""
                                        }));
                                    }} />
                                <span style={{ color: "var(--red)", fontWeight: 700 }}>อยู่ระหว่างทดลองงาน (On Trial Period)</span>
                            </label>

                            {editDraft.is_on_trial && (
                                <div style={{ marginLeft: 24, marginBottom: 16 }}>
                                    <label className={styles.lbl} style={{ color: "var(--text-3)", fontSize: 12 }}>วันสิ้นสุดทดลองงาน (ถ้ามี)</label>
                                    <input type="date" className={styles.input}
                                        value={editDraft.probation_end_date}
                                        onChange={(e) => setEditDraft((d) => d && ({ ...d, probation_end_date: e.target.value }))} />
                                </div>
                            )}
                            <label className={styles.row} style={{ marginBottom: 16 }}>
                                <input type="checkbox"
                                    checked={editDraft.has_telephone_allowance}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, has_telephone_allowance: e.target.checked }))} />
                                <span>ได้รับค่าโทรศัพท์ (Receives Telephone Allowance)</span>
                            </label>
                            <div style={{ border: "1px solid var(--border)", padding: 12, borderRadius: 6, marginTop: 16 }}>
                                <div className={styles.lbl} style={{ marginBottom: 10, fontWeight: 700 }}>สวัสดิการช่วงทดลองงาน (Probation Allowances)</div>
                                <label className={styles.row} style={{ marginBottom: 8 }}>
                                    <input type="checkbox" checked={editDraft.probation_accommodation_allowance} onChange={(e) => setEditDraft((d) => d && ({ ...d, probation_accommodation_allowance: e.target.checked }))} />
                                    <span>รับค่าที่พัก (Accommodation Allowance)</span>
                                </label>
                                <label className={styles.row} style={{ marginBottom: 8 }}>
                                    <input type="checkbox" checked={editDraft.probation_meal_allowance} onChange={(e) => setEditDraft((d) => d && ({ ...d, probation_meal_allowance: e.target.checked }))} />
                                    <span>รับค่าอาหาร (Meal Allowance)</span>
                                </label>
                                <label className={styles.row}>
                                    <input type="checkbox" checked={editDraft.probation_travel_allowance} onChange={(e) => setEditDraft((d) => d && ({ ...d, probation_travel_allowance: e.target.checked }))} />
                                    <span>รับค่าเดินทาง (Travel Allowance)</span>
                                </label>
                            </div>
                            
                            <div style={{ border: "1px solid var(--border)", padding: 12, borderRadius: 6, marginTop: 16 }}>
                                <div className={styles.lbl} style={{ marginBottom: 10, fontWeight: 700 }}>สวัสดิการที่บริษัทจัดหาให้ (Company-provided benefits)</div>
                                <label className={styles.row} style={{ marginBottom: 8 }}>
                                    <input type="checkbox" checked={editDraft.company_car} onChange={(e) => setEditDraft((d) => d && ({ ...d, company_car: e.target.checked }))} />
                                    <span>บริษัทจัดหารถยนต์ให้ (Company provides a car)</span>
                                </label>
                                <label className={styles.row}>
                                    <input type="checkbox" checked={editDraft.company_accommodation} onChange={(e) => setEditDraft((d) => d && ({ ...d, company_accommodation: e.target.checked }))} />
                                    <span>บริษัทจัดหาที่พักให้ (Company provides accommodation)</span>
                                </label>
                            </div>

                            <label className={styles.row} style={{ marginBottom: 10 }}>
                                <input type="checkbox"
                                    checked={editDraft.is_checkin_exempt}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, is_checkin_exempt: e.target.checked }))} />
                                <span style={{ color: "var(--red)", fontWeight: 500 }}>ยกเว้นการลงเวลา (Check-in Exempt)</span>
                            </label>



                            <label className={styles.lbl} style={{ marginTop: 16 }}>LINE User ID (สำหรับการแจ้งเตือน)</label>
                            <input className={styles.input} placeholder="U123456789..." value={editDraft.line_user_id}
                                onChange={(e) => setEditDraft((d) => d && ({ ...d, line_user_id: e.target.value }))} />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                            <div>
                                <label className={styles.lbl}>เบอร์โทรศัพท์มือถือ</label>
                                <input type="tel" className={styles.input} value={editDraft.phone_number} placeholder="08XXXXXXXX"
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, phone_number: e.target.value }))} />
                            </div>
                            <div>
                                <label className={styles.lbl}>อีเมล (Email)</label>
                                <input type="email" className={styles.input} value={editDraft.email} placeholder="email@example.com"
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, email: e.target.value }))} />
                            </div>
                        </div>

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
                                    onChange={(e) => {
                                        const active = e.target.checked;
                                        setEditDraft((d) => d && ({
                                            ...d,
                                            is_active: active,
                                            resignation_date: active ? "" : (d.resignation_date || new Date().toISOString().split("T")[0])
                                        }));
                                    }}
                                    style={{ accentColor: "var(--ok)", width: 18, height: 18, cursor: "pointer" }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Active</span>
                            </label>
                        </div>

                        {!editDraft.is_active && (
                            <div style={{
                                marginTop: -12, marginBottom: 20, padding: 16,
                                background: "rgba(239, 68, 68, 0.05)",
                                border: "1px solid rgba(239, 68, 68, 0.1)",
                                borderRadius: "0 0 12px 12px",
                                borderTop: "none"
                            }}>
                                <label className={styles.lbl} style={{ color: "var(--red)", fontWeight: 700 }}>
                                    <ExclamationTriangleIcon width={14} style={{ display: "inline-block", verticalAlign: "text-bottom", marginRight: 4 }} />
                                    ระบุวันที่ลาออก (วันที่ออกจริง) <span style={{ color: "var(--red)" }}>* บังคับ</span>
                                </label>
                                <input
                                    type="date"
                                    className={styles.input}
                                    style={{ border: "1px solid var(--red)", background: "#fff" }}
                                    value={editDraft.resignation_date}
                                    onChange={(e) => setEditDraft((d) => d && ({ ...d, resignation_date: e.target.value }))}
                                />
                                <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 6 }}>
                                    * เมื่อบันทึกแล้ว ข้อมูลจะไม่สามารถลงเวลาได้ และจะแสดงวันที่ออกในรายงาน
                                </div>
                            </div>
                        )}

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
                    <div className={styles.modal} style={{ maxWidth: 700 }}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle} style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}><ExclamationTriangleIcon width={20} /> รายการใบเตือน: {warningTarget.name}</span>
                            <button className={styles.modalClose} onClick={() => setWarningTarget(null)}>✕</button>
                        </div>

                        <div style={{ padding: "0 20px 20px" }}>
                            <div style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><PlusIcon width={14} /> เพิ่มใบเตือนใหม่</div>
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
                                        <button onClick={() => deleteWarning(w.id)} style={{ padding: 4, background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}><TrashIcon width={16} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            {toast && (
                <div className={`${styles.toast} ${styles[toast.type]}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {toast.type === "ok" ? <CheckCircleIcon width={18} /> : <NoSymbolIcon width={18} />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
