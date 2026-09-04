"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
import EmployeeWizard from "../../components/wizard/EmployeeWizard";
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
    nationality?: string | null;
    id_document_type?: string | null;
    company_id?: number | null;
    title_prefix?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    allowance_mode?: string | null;
    co_evaluators?: { evaluator_id: string; order_no: number; name: string; nickname?: string | null }[] | null;
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
    nationality?: string | null;
    id_document_type?: string | null;
    company_id?: number | null;
    title_prefix?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    allowance_mode?: string | null;
};

type Department = { id: number; name: string };
type JobPosition = { id: number; department_id: number; title: string; is_ot_eligible: boolean };

/* ── Component ──────────────────────────────────────────────── */
export default function AdminEmployeesPage() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    /* search / filter */
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all" | "trial">("active");
    const [typeFilter, setTypeFilter] = useState<"all" | "monthly" | "daily">("all");
    const [deptFilter, setDeptFilter] = useState<number | "all">("all");
    const [branchFilter, setBranchFilter] = useState<string | "all">("all");
    const [pageIndex, setPageIndex] = useState(0);
    const [showExportGuide, setShowExportGuide] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset page to 0 when filters change
    useEffect(() => {
        setPageIndex(0);
    }, [debouncedSearch, statusFilter, typeFilter, deptFilter, branchFilter]);

    const { data: orgData } = useQuery({
        queryKey: ["admin-org-data"],
        queryFn: async () => {
            const [b, dRes, pRes, eRes] = await Promise.all([
                fetch("/api/branches", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
                fetch("/api/admin/organization/departments", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
                fetch("/api/admin/organization/positions", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
                fetch("/api/admin/employees?minimal=1", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}))
            ]);
            return {
                branches: (b.branches || []) as Branch[],
                departments: (dRes.list || []) as Department[],
                positions: (pRes.list || []) as JobPosition[],
                allEmployees: (eRes.list || []) as Emp[]
            };
        }
    });

    const { data: empData, isLoading: loading, error: queryError, refetch: reload } = useQuery({
        queryKey: ["admin-employees-list", debouncedSearch, statusFilter, typeFilter, deptFilter, branchFilter, pageIndex],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (debouncedSearch) params.append("q", debouncedSearch);
            params.append("status", statusFilter);
            params.append("type", typeFilter);
            params.append("dept", String(deptFilter));
            params.append("branch", branchFilter);
            params.append("page", String(pageIndex));

            const res = await fetch(`/api/admin/employees?${params.toString()}`, { cache: "no-store" });
            const e = await res.json();

            if (e?.error === "UNAUTHORIZED") throw new Error("ยังไม่ได้เข้าสู่ระบบ Admin (โปรด login)");
            if (e?.error === "FORBIDDEN") throw new Error("ไม่มีสิทธิ์ Admin");
            if (!e?.ok) throw new Error(e?.error || "LOAD_FAILED");

            return {
                list: (e.list || []) as Emp[],
                total: e.total || 0,
                activeCount: e.activeCount || 0,
                inactiveCount: e.inactiveCount || 0,
                trialCount: e.trialCount || 0,
                pageSize: e.pageSize || 50
            };
        },
        placeholderData: keepPreviousData
    });

    const branches = orgData?.branches || [];
    const departments = orgData?.departments || [];
    const positions = orgData?.positions || [];
    const allEmployees = orgData?.allEmployees || [];
    const list = empData?.list || [];
    const msg = queryError ? queryError.message : "";
    const [saving, setSaving] = useState(false);
    const [visibleSalaries, setVisibleSalaries] = useState<Set<string>>(new Set());

    const activeCnt = empData?.activeCount ?? 0;
    const inactiveCnt = empData?.inactiveCount ?? 0;
    const trialCnt = empData?.trialCount ?? 0;
    const totalCnt = activeCnt + inactiveCnt;

    const hasActiveFilters = Boolean(
        search.trim() ||
        branchFilter !== "all" ||
        deptFilter !== "all" ||
        typeFilter !== "all" ||
        statusFilter !== "active"
    );

    const handleResetFilters = () => {
        setSearch("");
        setDebouncedSearch("");
        setBranchFilter("all");
        setDeptFilter("all");
        setTypeFilter("all");
        setStatusFilter("active");
        setPageIndex(0);
    };

    const toggleSalaryVisibility = (empId: string) => {
        setVisibleSalaries((prev) => {
            const next = new Set(prev);
            if (next.has(empId)) next.delete(empId);
            else next.add(empId);
            return next;
        });
    };

    const [newEmpId, setNewEmpId] = useState<string | null>(null);

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

    useEffect(() => {
        if (searchParams.get("add") === "true") {
            setCreateModalOpen(true);
            router.replace("/admin/employees/list");
        }
    }, [searchParams, router]);

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
            queryClient.invalidateQueries({ queryKey: ["admin-employees-list"] });
            queryClient.invalidateQueries({ queryKey: ["admin-org-data"] });
            queryClient.invalidateQueries({ queryKey: ["admin-employees-stats"] });
            reload();
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
                queryClient.invalidateQueries({ queryKey: ["admin-employees-list"] });
                queryClient.invalidateQueries({ queryKey: ["admin-org-data"] });
                queryClient.invalidateQueries({ queryKey: ["admin-employees-stats"] });
                reload();
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
    const filtered = list;

    /* ─────────────────────────────────────────────────────────
       RENDER
    ───────────────────────────────────────────────────────── */
    return (
        <div className={styles.wrap}>

            {/* ── Header ── */}
            <div className={styles.header}>
                <div className={styles.headerTitleArea}>
                    <h1 className={styles.h1}>จัดการข้อมูลพนักงาน</h1>
                    <div className={styles.sub}>รายชื่อพนักงานทั้งหมด ข้อมูลตำแหน่ง สวัสดิการ และการตั้งค่าระบบ</div>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={styles.btnExport}
                        onClick={handleExport}
                        disabled={loading}
                        title="ส่งออกรายชื่อพนักงานเป็นไฟล์ CSV"
                    >
                        <ArrowDownTrayIcon width={17} height={17} />
                        <span>ส่งออก CSV</span>
                    </button>
                    <button
                        className={styles.btnGhost}
                        onClick={() => setShowExportGuide(!showExportGuide)}
                        title="คำแนะนำการส่งออกข้อมูล"
                    >
                        <InformationCircleIcon width={17} height={17} />
                        <span>คำแนะนำ</span>
                    </button>
                    <button
                        className={styles.btnGhost}
                        onClick={() => reload()}
                        disabled={loading}
                        title="รีเฟรชข้อมูล"
                    >
                        ↻ รีเฟรช
                    </button>
                    <button
                        className={styles.btnAdd}
                        onClick={() => setCreateModalOpen(true)}
                    >
                        <PlusIcon width={18} height={18} />
                        <span>เพิ่มพนักงาน</span>
                    </button>
                </div>
            </div>

            {msg && <div className={styles.msg}>{msg}</div>}

            {/* ── Main Container Card ── */}
            <div className={styles.mainCard}>

                {/* Quick Status Tabs */}
                <div className={styles.tabsRow}>
                    <button
                        className={`${styles.tabBtn} ${statusFilter === "all" ? styles.tabBtnActive : ""}`}
                        onClick={() => setStatusFilter("all")}
                    >
                        <span>พนักงานทั้งหมด</span>
                        <span className={styles.tabCount}>{totalCnt}</span>
                    </button>

                    <button
                        className={`${styles.tabBtn} ${statusFilter === "active" ? styles.tabBtnActive : ""}`}
                        onClick={() => setStatusFilter("active")}
                    >
                        <span>กำลังปฏิบัติงาน</span>
                        <span className={styles.tabCount}>{activeCnt}</span>
                    </button>

                    <button
                        className={`${styles.tabBtn} ${statusFilter === "trial" ? styles.tabBtnActive : ""}`}
                        onClick={() => setStatusFilter("trial")}
                    >
                        <span>อยู่ระหว่างทดลองงาน</span>
                        <span className={styles.tabCount}>{trialCnt}</span>
                    </button>

                    <button
                        className={`${styles.tabBtn} ${statusFilter === "inactive" ? styles.tabBtnActive : ""}`}
                        onClick={() => setStatusFilter("inactive")}
                    >
                        <span>พ้นสภาพ / ลาออก</span>
                        <span className={styles.tabCount}>{inactiveCnt}</span>
                    </button>
                </div>

                {/* Collapsible Export Guide */}
                {showExportGuide && (
                    <div className={styles.exportGuideBar}>
                        <div className={styles.guideIconWrap}>
                            <InformationCircleIcon width={22} height={22} />
                        </div>
                        <div className={styles.guideContent}>
                            <div className={styles.guideTitle}>คำแนะนำการส่งออกข้อมูล (Export CSV Guide)</div>
                            <div>
                                ท่านสามารถกรองข้อมูลพนักงานตาม <b>สาขา, แผนก, ประเภทการจ้าง</b> หรือ <b>สถานะ</b> ระบบจะแสดงรายการที่ตรงตามเงื่อนไขโดยอัตโนมัติ และท่านสามารถกดปุ่ม <b>ส่งออก CSV</b> เพื่อดาวน์โหลดไฟล์สำหรับนำไปใช้งานต่อใน Excel ได้ทันที
                            </div>
                        </div>
                        <button
                            className={styles.guideCloseBtn}
                            onClick={() => setShowExportGuide(false)}
                            title="ปิด"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Search & Filter Bar */}
                <div className={styles.filterBar}>
                    <div className={styles.searchWrap}>
                        <MagnifyingGlassIcon className={styles.searchIcon} />
                        <input
                            className={styles.searchInput}
                            placeholder="ค้นหาด้วย รหัสพนักงาน, ชื่อ-นามสกุล, หรือชื่อเล่น..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className={styles.filterGroup}>
                        <select
                            className={styles.filterSelect}
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                        >
                            <option value="all">ทุกสาขา</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>

                        <select
                            className={styles.filterSelect}
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                        >
                            <option value="all">ทุกแผนก</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>

                        <select
                            className={styles.filterSelect}
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                        >
                            <option value="all">ทุกประเภทการจ้าง</option>
                            <option value="monthly">รายเดือน</option>
                            <option value="daily">รายวัน</option>
                        </select>

                        {hasActiveFilters && (
                            <button
                                className={styles.btnResetFilter}
                                onClick={handleResetFilters}
                                title="ล้างตัวกรองทั้งหมด"
                            >
                                ล้างตัวกรอง
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className={styles.tableScroll}>
                    {loading ? (
                        <div className={styles.loader}>
                            <div className={styles.spinner} />
                            <span>กำลังโหลดข้อมูลพนักงาน...</span>
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>พนักงาน</th>
                                    <th>ตำแหน่ง & แผนก</th>
                                    <th>สายบังคับบัญชา</th>
                                    <th>การจ้างงาน & ทดลองงาน</th>
                                    <th>ฐานเงินเดือน</th>
                                    <th>ข้อมูลติดต่อ</th>
                                    <th>สถานะ</th>
                                    <th style={{ textAlign: "right" }}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((x) => (
                                    <tr
                                        key={x.emp_id}
                                        className={x.emp_id === newEmpId ? styles.highlightRed : undefined}
                                        style={{ opacity: x.is_active ? 1 : 0.6 }}
                                    >
                                        {/* 1. พนักงาน */}
                                        <td>
                                            <div className={styles.empMeta}>
                                                <div className={styles.empName}>
                                                    <span>{x.name}</span>
                                                    {x.nickname && <span className={styles.empNickname}>({x.nickname})</span>}
                                                </div>
                                                <div className={styles.empSub}>
                                                    <span className={styles.empIdBadge}>{x.emp_id}</span>
                                                    {!x.line_user_id && x.is_active && (
                                                        <span className={styles.badgeLineWarn}>⚠️ ยังไม่เชื่อม LINE</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* 2. ตำแหน่ง & แผนก */}
                                        <td>
                                            <div className={styles.colDept}>
                                                <div className={styles.deptTitle}>
                                                    {x.departments?.name || "ไม่ระบุแผนก"}
                                                </div>
                                                <div className={styles.posTitle}>
                                                    {x.job_positions?.title || "ไม่ระบุตำแหน่ง"}
                                                    {x.branch_id && <span className={styles.branchTag}> • {branchName(x.branch_id)}</span>}
                                                </div>
                                                {x.job_positions && !x.job_positions.is_ot_eligible && (
                                                    <span className={styles.tagOtExempt}>ไม่คิด OT</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 3. สายบังคับบัญชา */}
                                        <td>
                                            <div className={styles.colSupervision}>
                                                <div className={styles.superRow}>
                                                    <span className={styles.superLabel}>หัวหน้า:</span>
                                                    <span>{x.supervisor?.name || "—"}</span>
                                                </div>
                                                {(x.secondary_supervisor?.name || (x.co_evaluators && x.co_evaluators.length > 0)) && (
                                                    <div className={styles.superRow} style={{ color: "var(--text-3)" }}>
                                                        <span className={styles.superLabel}>ผู้ประเมินร่วม:</span>
                                                        <span>
                                                            {x.secondary_supervisor?.name || (x.co_evaluators && x.co_evaluators[0]?.name)}
                                                            {x.co_evaluators && x.co_evaluators.length > 1 && ` (+${x.co_evaluators.length - 1})`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* 4. การจ้างงาน & ทดลองงาน */}
                                        <td>
                                            <div className={styles.colEmployment}>
                                                <div className={styles.hireDateText}>
                                                    เริ่มงาน: {x.hire_date ? formatDateThai(x.hire_date) : "—"}
                                                </div>
                                                {x.is_on_trial && (
                                                    <>
                                                        <span className={styles.tagTrial}>ทดลองงาน</span>
                                                        {x.probation_end_date && (
                                                            <span className={styles.tagTrialDue}>
                                                                ครบกำหนด: {formatDateThai(x.probation_end_date)}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                                {x.is_checkin_exempt && (
                                                    <span className={styles.tagCheckinExempt}>ยกเว้นลงเวลา</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 5. ฐานเงินเดือน */}
                                        <td>
                                            <div
                                                className={styles.salaryWrap}
                                                onClick={(e) => { e.stopPropagation(); toggleSalaryVisibility(x.emp_id); }}
                                                title="คลิกเพื่อ ดู/ซ่อน เงินเดือน"
                                            >
                                                <div className={`${styles.salaryAmount} ${x.salary_type === "daily" ? styles.salaryTypeDaily : ""}`}>
                                                    {x.base_salary ? (visibleSalaries.has(x.emp_id) ? `฿${Number(x.base_salary).toLocaleString()}` : "******") : "—"}
                                                    {x.salary_type === "daily" && <span style={{ fontSize: 11, fontWeight: "normal", color: "var(--text-3)" }}>/ วัน</span>}
                                                </div>
                                                {x.salary_type === "daily" && (
                                                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                                                        <span style={{ fontSize: 10, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>ไม่มีสวัสดิการ</span>
                                                        <span style={{ fontSize: 10, background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>ขอ OT / ลาได้</span>
                                                    </div>
                                                )}
                                                {x.salary_type !== "daily" && x.position_allowance && Number(x.position_allowance) > 0 && (
                                                    <div className={styles.posAllowText}>
                                                        + ค่าตำแหน่ง {visibleSalaries.has(x.emp_id) ? `฿${Number(x.position_allowance).toLocaleString()}` : "******"}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* 6. ข้อมูลติดต่อ */}
                                        <td>
                                            <div className={styles.contactCol}>
                                                <div>{x.phone_number || "—"}</div>
                                                {x.email && <div className={styles.emailText}>{x.email}</div>}
                                            </div>
                                        </td>

                                        {/* 7. สถานะ */}
                                        <td>
                                            <div>
                                                <span className={x.is_active ? styles.badgeActive : styles.badgeInactive}>
                                                    {x.is_active ? "ปฏิบัติงาน" : "พ้นสภาพ"}
                                                </span>
                                                {!x.is_active && x.resignation_date && (
                                                    <div className={styles.resignationText}>
                                                        ออกเมื่อ: {formatDateThai(x.resignation_date)}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* 8. จัดการ */}
                                        <td style={{ textAlign: "right" }}>
                                            <div className={styles.actionWrap}>
                                                <button
                                                    className={styles.actionBtn}
                                                    title="แก้ไขข้อมูลพนักงาน"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditDraft({
                                                            ...x,
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
                                                            nationality: x.nationality || "THA",
                                                            id_document_type: x.id_document_type || "national_id",
                                                            company_id: x.company_id ?? 2,
                                                            title_prefix: x.title_prefix || "",
                                                            first_name: x.first_name || "",
                                                            last_name: x.last_name || "",
                                                            allowance_mode: x.allowance_mode || "itemized",
                                                        });
                                                    }}
                                                >
                                                    <PencilSquareIcon width={16} height={16} />
                                                </button>

                                                <button
                                                    className={`${styles.actionBtn} ${styles.actionBtnWarn}`}
                                                    title="บันทึกใบเตือน"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        loadWarnings(x);
                                                    }}
                                                >
                                                    <ExclamationTriangleIcon width={16} height={16} />
                                                </button>

                                                <label className={styles.toggleSwitch} title={x.is_active ? "คลิกเพื่อปิดใช้งาน (พ้นสภาพ)" : "คลิกเพื่อเปิดใช้งาน (ปฏิบัติงาน)"}>
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
                                        <td colSpan={8}>
                                            <div className={styles.empty}>
                                                <UsersIcon className={styles.emptyIcon} />
                                                <div className={styles.emptyTitle}>
                                                    {search ? "ไม่พบข้อมูลพนักงานที่ตรงกับการค้นหา" : "ไม่พบข้อมูลตามเงื่อนไขตัวกรอง"}
                                                </div>
                                                <div className={styles.emptyDesc}>
                                                    ลองปรับเปลี่ยนคำค้นหา หรือกดปุ่มด้านล่างเพื่อล้างตัวกรอง
                                                </div>
                                                {hasActiveFilters && (
                                                    <button
                                                        className={styles.btnExport}
                                                        onClick={handleResetFilters}
                                                        style={{ marginTop: 8 }}
                                                    >
                                                        ล้างตัวกรองทั้งหมด
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {(empData?.total || 0) > 0 && (
                    <div className={styles.paginationBar}>
                        <div className={styles.pageInfo}>
                            แสดงหน้า <b>{pageIndex + 1}</b> จากทั้งหมด <b>{Math.max(1, Math.ceil((empData?.total || 0) / (empData?.pageSize || 50)))}</b> หน้า (จำนวนพนักงานที่พบ <b>{empData?.total || 0}</b> คน)
                        </div>
                        <div className={styles.pageControls}>
                            <button
                                className={styles.pageBtn}
                                disabled={pageIndex === 0}
                                onClick={() => setPageIndex(p => p - 1)}
                            >
                                ← ก่อนหน้า
                            </button>
                            <button
                                className={styles.pageBtn}
                                disabled={(pageIndex + 1) * (empData?.pageSize || 50) >= (empData?.total || 0)}
                                onClick={() => setPageIndex(p => p + 1)}
                            >
                                ถัดไป →
                            </button>
                        </div>
                    </div>
                )}

                {/* Bottom hint */}
                <div className={styles.bottomHint}>
                    <LightBulbIcon width={16} height={16} style={{ color: "var(--red)", flexShrink: 0 }} />
                    <span>กรณีพนักงานลาออก แนะนำให้ปิดใช้งาน (พ้นสภาพ) แทนการลบข้อมูล เพื่อเก็บประวัติการทำงานและสถิติเงินเดือนไว้ในระบบ</span>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                CREATE MODAL (NEW WIZARD)
            ══════════════════════════════════════════ */}
            {createModalOpen && (
                <EmployeeWizard
                    onClose={() => setCreateModalOpen(false)}
                    onSuccess={(createdId) => {
                        setCreateModalOpen(false);
                        if (createdId) {
                            setNewEmpId(createdId);
                            setTimeout(() => setNewEmpId(null), 4000);
                        }
                        queryClient.invalidateQueries({ queryKey: ["admin-employees-list"] });
                        queryClient.invalidateQueries({ queryKey: ["admin-org-data"] });
                        queryClient.invalidateQueries({ queryKey: ["admin-employees-stats"] });
                        reload();
                        showToast(createdId ? `เพิ่มพนักงาน ${createdId} เรียบร้อยแล้ว` : "เพิ่มพนักงานเรียบร้อยแล้ว", "ok");
                    }}
                    branches={branches}
                    departments={departments}
                    positions={positions}
                    employees={allEmployees}
                />
            )}

            {/* ══════════════════════════════════════════
                EDIT MODAL (Unified 3-Step Wizard)
            ══════════════════════════════════════════ */}
            {editDraft && (
                <EmployeeWizard
                    mode="edit"
                    initialEmployee={editDraft}
                    onClose={() => setEditDraft(null)}
                    onSuccess={() => {
                        setEditDraft(null);
                        queryClient.invalidateQueries({ queryKey: ["admin-employees-list"] });
                        queryClient.invalidateQueries({ queryKey: ["admin-org-data"] });
                        queryClient.invalidateQueries({ queryKey: ["admin-employees-stats"] });
                        reload();
                        showToast("บันทึกการแก้ไขข้อมูลพนักงานเรียบร้อย", "ok");
                    }}
                    branches={branches}
                    departments={departments}
                    positions={positions}
                    employees={allEmployees}
                />
            )}

            {/* ══════════════════════════════════════════
                WARNINGS MODAL (Modern Red-White-Gray)
            ══════════════════════════════════════════ */}
            {warningTarget && (
                <div
                    className={styles.modalOverlay}
                    onClick={(e) => { if (e.target === e.currentTarget) setWarningTarget(null); }}
                >
                    <div className={styles.warningModal}>
                        {/* Header */}
                        <div className={styles.warnModalHeader}>
                            <div className={styles.warnHeaderLeft}>
                                <div className={styles.warnIconWrap}>
                                    <ExclamationTriangleIcon width={22} height={22} />
                                </div>
                                <div>
                                    <h3 className={styles.warnModalTitle}>จัดการใบเตือนพนักงาน</h3>
                                    <div className={styles.warnEmployeeMeta}>
                                        <span className={styles.warnEmpName}>{warningTarget.name}</span>
                                        {warningTarget.nickname && (
                                            <span className={styles.warnEmpNickname}>({warningTarget.nickname})</span>
                                        )}
                                        <span className={styles.empIdBadge}>{warningTarget.emp_id}</span>
                                        {(warningTarget.departments?.name || warningTarget.job_positions?.title) && (
                                            <span className={styles.warnDeptText}>
                                                • {warningTarget.departments?.name || ""} {warningTarget.job_positions?.title ? `(${warningTarget.job_positions.title})` : ""}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                className={styles.btnCloseModal}
                                onClick={() => setWarningTarget(null)}
                                title="ปิดหน้าต่าง"
                            >
                                ✕
                            </button>
                        </div>

                        <div className={styles.warnModalBody}>
                            {/* Create New Warning Box */}
                            <div className={styles.newWarnCard}>
                                <div className={styles.newWarnHeader}>
                                    <PlusIcon width={16} height={16} />
                                    <span>ออกใบเตือนใหม่</span>
                                </div>

                                <div className={styles.newWarnGrid}>
                                    <div className={styles.warnField}>
                                        <label className={styles.warnFieldLabel}>วันที่ออกใบเตือน</label>
                                        <input
                                            type="date"
                                            className={styles.warnDateInput}
                                            value={newWarningDate}
                                            onChange={(e) => setNewWarningDate(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.warnField} style={{ flex: 1 }}>
                                        <label className={styles.warnFieldLabel}>สาเหตุ / รายละเอียดการกระทำผิด</label>
                                        <input
                                            placeholder="ระบุสาเหตุ เช่น ขาดงานโดยไม่แจ้ง, ปฏิบัติงานผิดระเบียบ..."
                                            className={styles.warnTextInput}
                                            value={newWarningReason}
                                            onChange={(e) => setNewWarningReason(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && newWarningReason.trim() && !saving) {
                                                    addWarning();
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <button
                                    className={styles.btnSaveWarn}
                                    onClick={addWarning}
                                    disabled={saving || !newWarningReason.trim()}
                                >
                                    {saving ? "กำลังบันทึก..." : "+ ยืนยันการออกใบเตือน"}
                                </button>
                            </div>

                            {/* Warning History Section */}
                            <div className={styles.warnHistorySection}>
                                <div className={styles.warnHistoryHeader}>
                                    <div className={styles.warnHistoryTitle}>
                                        <span>ประวัติใบเตือนทั้งหมด</span>
                                        <span className={styles.warnCountBadge}>{empWarnings.length} รายการ</span>
                                    </div>
                                </div>

                                <div className={styles.warnListWrap}>
                                    {empWarnings.length === 0 ? (
                                        <div className={styles.warnEmptyState}>
                                            <CheckCircleIcon width={36} height={36} className={styles.warnEmptyIcon} />
                                            <div className={styles.warnEmptyTitle}>ไม่มีประวัติใบเตือน</div>
                                            <div className={styles.warnEmptyDesc}>
                                                พนักงานท่านนี้มีประวัติการทำงานที่ดี ยังไม่เคยได้รับใบเตือน
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={styles.warnList}>
                                            {empWarnings.map((w, idx) => (
                                                <div key={w.id} className={styles.warnItemCard}>
                                                    <div className={styles.warnItemContent}>
                                                        <div className={styles.warnItemMeta}>
                                                            <span className={styles.warnIndexBadge}>ใบเตือนครั้งที่ {empWarnings.length - idx}</span>
                                                            <span className={styles.warnDateBadge}>
                                                                {formatDateThai(w.date)}
                                                            </span>
                                                        </div>
                                                        <div className={styles.warnItemReason}>{w.reason}</div>
                                                    </div>
                                                    <button
                                                        className={styles.btnDeleteWarn}
                                                        onClick={() => deleteWarning(w.id)}
                                                        title="ลบใบเตือนนี้"
                                                        disabled={saving}
                                                    >
                                                        <TrashIcon width={14} height={14} />
                                                        <span>ลบ</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
