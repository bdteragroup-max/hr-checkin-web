"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";
import {
    PencilSquareIcon,
    BanknotesIcon,
    AcademicCapIcon,
    PaperAirplaneIcon,
    MagnifyingGlassIcon,
    ArrowDownTrayIcon,
    BuildingOffice2Icon,
    UserGroupIcon,
    ClockIcon,
    GiftIcon,
    ExclamationTriangleIcon,
    XMarkIcon,
    ReceiptPercentIcon,
    CreditCardIcon,
    EyeSlashIcon,
    ArrowPathIcon
} from "@heroicons/react/24/outline";
import AlertModal, { AlertState } from "@/components/AlertModal";

type PayrollResult = {
    emp_id: string;
    name: string;
    nickname?: string;
    company_id: number;
    company_code: string;
    company_name: string;
    branch_id?: string;
    department_id?: number | null;
    department: string;
    division: string;
    position: string;
    salary_type: "monthly" | "daily";
    base_salary_daily?: number | null;
    is_active: boolean;
    resignation_date?: string | null;
    service_duration?: string;
    base_salary: number;
    hourly_wage: number;
    is_ot_eligible: boolean;
    ot_rule: string;

    normal_1_5x_hours: number;
    normal_ot_pay: number;

    holiday_1x_hours: number;
    holiday_1x_pay: number;

    holiday_3x_hours: number;
    holiday_3x_pay: number;

    holiday_working_days: number;
    holiday_allowance: number;

    diligence_allowance: number;
    diligence_failed_reason: string;
    meal_allowance: number;
    travel_allowance: number;
    accommodation_allowance: number;
    long_service_allowance: number;
    telephone_allowance: number;
    position_allowance: number;
    general_allowance: number;
    travel_site_allowance: number;
    travel_accommodation: number;

    total_ot_hours: number;
    ot_amount: number;
    social_security: number;
    student_loan: number;
    insurance: number;
    unpaid_absenteeism: number;
    tax: number;
    commissions: number;
    bonus: number;
    other_deductions: number;
    other_benefits: number;
    calculated_lump_sum?: number;
    welfare_amount: number;
    base_salary_original: number;
    is_salary_overridden: boolean;
    gross_pay: number;
    net_pay: number;
    truck_trip_fee?: number;
    truck_hotel_allowance_max?: number;
    provident_fund: number;
    taxable_income: number;
    housing_benefit: number;
    car_benefit: number;
    bank_name: string;
    bank_account_no: string;
    is_on_trial: boolean;
    is_published?: boolean;
    raw_adjustments?: any;
};

export default function PayrollPage() {
    const queryClient = useQueryClient();
    const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
    const [year, setYear] = useState(new Date().getFullYear());

    // Company segmentation & Filter States
    const [selectedCompanyTab, setSelectedCompanyTab] = useState<"ALL" | number>("ALL");
    const [deptFilter, setDeptFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<"all" | "monthly" | "daily">("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "resigned">("all");
    const [searchTerm, setSearchTerm] = useState("");

    const { data: payrollData, isLoading } = useQuery({
        queryKey: ['admin-payroll', month, year],
        queryFn: async () => {
            const res = await fetch(`/api/admin/payroll?month=${month}&year=${year}`);
            if (res.status === 401) {
                window.location.href = "/admin/login";
                throw new Error("Unauthorized");
            }
            if (!res.ok) throw new Error("Failed to load payroll data");
            return res.json();
        }
    });

    const data: PayrollResult[] = payrollData?.list || [];
    const cycle = payrollData?.cycle || null;
    const loading = isLoading;
    const [publishing, setPublishing] = useState(false);

    // Companies list from API or standard default
    const companies = useMemo(() => {
        if (payrollData?.companies && payrollData.companies.length > 0) {
            return payrollData.companies;
        }
        return [
            { id: 2, code: "TG", name: "บริษัท เทอรา กรุ้ป จำกัด" },
            { id: 3, code: "TE", name: "บริษัท เทอรา อิเล็กทริค จำกัด" },
            { id: 4, code: "TP", name: "บริษัท เทอรา พาวเวอร์ จำกัด" }
        ];
    }, [payrollData]);

    const handleIssue50Twi = async (empId: string, issueYear: number) => {
        try {
            const res = await fetch('/api/admin/payroll/50twi/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId: empId, year: issueYear })
            });
            const d = await res.json();
            if (!res.ok) {
                alert(`Error: ${d.error || 'Failed to issue'}`);
            } else {
                alert(`ออกหนังสือรับรอง 50 ทวิ เรียบร้อยแล้ว! เลขที่เอกสาร: ${d.document?.document_number}`);
            }
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการออกเอกสาร 50 ทวิ');
        }
    };

    // Edit Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingEmp, setEditingEmp] = useState<PayrollResult | null>(null);
    const [editForm, setEditForm] = useState({
        override_salary: "",
        normal_1_5x_hours_override: "",
        holiday_1_x_hours_override: "",
        holiday_3_x_hours_override: "",
        diligence_allowance_override: "",
        meal_allowance_override: "",
        travel_allowance_override: "",
        accommodation_allowance_override: "",
        phone_allowance_override: "",
        position_allowance_override: "",
        general_allowance_override: "",
        travel_site_allowance_override: "",
        travel_accommodation_override: "",
        social_security: "",
        student_loan: "",
        insurance: "",
        insurance_income: "",
        unpaid_absenteeism: "",
        tax: "",
        commissions: "",
        bonus: "",
        other_deductions: "",
        other_benefits: ""
    });
    const [saving, setSaving] = useState(false);

    // Quick Edit State
    const [activeCell, setActiveCell] = useState<{ empId: string, field: string } | null>(null);
    const [tempValue, setTempValue] = useState("");
    const [quickSaving, setQuickSaving] = useState<string | null>(null);

    const [alertConfig, setAlertConfig] = useState<{ alert: AlertState, onConfirm?: () => void }>({ alert: { visible: false, message: "", type: "ok" } });
    const closeAlert = () => setAlertConfig(prev => ({ ...prev, alert: { ...prev.alert, visible: false } }));

    const openEditModal = (emp: PayrollResult) => {
        setEditingEmp(emp);
        const raw = emp.raw_adjustments || {};
        const v = (val: any) => (val !== null && val !== undefined) ? String(val) : "";

        setEditForm({
            override_salary: v(raw.override_salary),
            normal_1_5x_hours_override: v(raw.normal_1_5x_hours_override),
            holiday_1_x_hours_override: v(raw.holiday_1_x_hours_override),
            holiday_3_x_hours_override: v(raw.holiday_3_x_hours_override),
            diligence_allowance_override: v(raw.diligence_allowance_override),
            meal_allowance_override: v(raw.meal_allowance_override),
            travel_allowance_override: v(raw.travel_allowance_override),
            accommodation_allowance_override: v(raw.accommodation_allowance_override),
            phone_allowance_override: v(raw.phone_allowance_override),
            position_allowance_override: v(raw.position_allowance_override),
            general_allowance_override: v(raw.general_allowance_override),
            travel_site_allowance_override: v(raw.travel_site_allowance_override),
            travel_accommodation_override: v(raw.travel_accommodation_override),
            social_security: raw.social_security !== null && raw.social_security !== undefined && Number(raw.social_security) !== 0 ? String(raw.social_security) : "",
            student_loan: raw.student_loan !== null && raw.student_loan !== undefined && Number(raw.student_loan) !== 0 ? String(raw.student_loan) : "",
            insurance: raw.insurance !== null && raw.insurance !== undefined && Number(raw.insurance) !== 0 ? String(raw.insurance) : "",
            insurance_income: raw.insurance_income !== null && raw.insurance_income !== undefined && Number(raw.insurance_income) !== 0 ? String(raw.insurance_income) : "",
            unpaid_absenteeism: raw.unpaid_absenteeism !== null && raw.unpaid_absenteeism !== undefined && Number(raw.unpaid_absenteeism) !== 0 ? String(raw.unpaid_absenteeism) : "",
            tax: raw.tax !== null && raw.tax !== undefined && Number(raw.tax) !== 0 ? String(raw.tax) : "",
            commissions: raw.commissions !== null && raw.commissions !== undefined && Number(raw.commissions) !== 0 ? String(raw.commissions) : "",
            bonus: raw.bonus !== null && raw.bonus !== undefined && Number(raw.bonus) !== 0 ? String(raw.bonus) : "",
            other_deductions: raw.other_deductions !== null && raw.other_deductions !== undefined && Number(raw.other_deductions) !== 0 ? String(raw.other_deductions) : "",
            other_benefits: raw.other_benefits !== null && raw.other_benefits !== undefined && Number(raw.other_benefits) !== 0 ? String(raw.other_benefits) : ""
        });
        setActiveCell(null);
        setShowModal(true);
    };

    const saveAdjustments = async () => {
        if (!editingEmp) return;
        setSaving(true);
        try {
            const payload = {
                emp_id: editingEmp.emp_id,
                cycle_month: month,
                cycle_year: year,
                override_salary: editForm.override_salary,
                normal_1_5x_hours_override: editForm.normal_1_5x_hours_override,
                holiday_1_x_hours_override: editForm.holiday_1_x_hours_override,
                holiday_3_x_hours_override: editForm.holiday_3_x_hours_override,
                diligence_allowance_override: editForm.diligence_allowance_override,
                meal_allowance_override: editForm.meal_allowance_override,
                travel_allowance_override: editForm.travel_allowance_override,
                accommodation_allowance_override: editForm.accommodation_allowance_override,
                phone_allowance_override: editForm.phone_allowance_override,
                position_allowance_override: editForm.position_allowance_override,
                general_allowance_override: editForm.general_allowance_override,
                travel_site_allowance_override: editForm.travel_site_allowance_override,
                travel_accommodation_override: editForm.travel_accommodation_override,
                social_security: editForm.social_security,
                student_loan: editForm.student_loan,
                insurance: editForm.insurance,
                insurance_income: editForm.insurance_income,
                unpaid_absenteeism: editForm.unpaid_absenteeism,
                tax: editForm.tax,
                commissions: editForm.commissions,
                bonus: editForm.bonus,
                other_deductions: editForm.other_deductions,
                other_benefits: editForm.other_benefits
            };
            const res = await fetch("/api/admin/payroll/adjustments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowModal(false);
                queryClient.invalidateQueries({ queryKey: ['admin-payroll', month, year] });
            } else {
                alert("Failed to save adjustments");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving");
        }
        setSaving(false);
    };

    const handleQuickSave = async (emp: PayrollResult, field: string, value: string) => {
        const key = `${emp.emp_id}-${field}`;
        setQuickSaving(key);
        setActiveCell(null);

        try {
            const raw = emp.raw_adjustments || {};
            const payload: any = {
                emp_id: emp.emp_id,
                cycle_month: month,
                cycle_year: year,
                override_salary: raw.override_salary,
                normal_1_5x_hours_override: raw.normal_1_5x_hours_override,
                holiday_1_x_hours_override: raw.holiday_1_x_hours_override,
                holiday_3_x_hours_override: raw.holiday_3_x_hours_override,
                diligence_allowance_override: raw.diligence_allowance_override,
                meal_allowance_override: raw.meal_allowance_override,
                travel_allowance_override: raw.travel_allowance_override,
                accommodation_allowance_override: raw.accommodation_allowance_override,
                phone_allowance_override: raw.phone_allowance_override,
                position_allowance_override: raw.position_allowance_override,
                general_allowance_override: raw.general_allowance_override,
                travel_site_allowance_override: raw.travel_site_allowance_override,
                travel_accommodation_override: raw.travel_accommodation_override,
                social_security: raw.social_security,
                student_loan: raw.student_loan,
                insurance: raw.insurance,
                insurance_income: raw.insurance_income,
                unpaid_absenteeism: raw.unpaid_absenteeism,
                tax: raw.tax,
                commissions: raw.commissions,
                bonus: raw.bonus,
                other_deductions: raw.other_deductions,
                other_benefits: raw.other_benefits
            };

            payload[field] = value === "" ? null : value;

            const res = await fetch("/api/admin/payroll/adjustments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ['admin-payroll', month, year] });
            } else {
                alert("Failed to save");
            }
        } catch (e) {
            console.error(e);
        }
        setQuickSaving(null);
    };

    const handlePublish = (emp_id: string, publishStatus: boolean) => {
        setAlertConfig({
            alert: {
                visible: true,
                message: publishStatus ? `ยืนยันการเผยแพร่สลิปเงินเดือนให้พนักงานคนนี้?` : `ยืนยันการยกเลิกเผยแพร่?`,
                type: "ok"
            },
            onConfirm: async () => {
                closeAlert();
                setPublishing(true);
                try {
                    const emp = data.find(d => d.emp_id === emp_id);
                    const res = await fetch("/api/admin/payroll/publish", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            month, year, emp_id,
                            is_published: publishStatus,
                            tax: emp?.tax,
                            social_security: emp?.social_security,
                            provident_fund: emp?.provident_fund,
                            taxable_income: emp?.taxable_income,
                            housing_benefit: emp?.housing_benefit,
                            car_benefit: emp?.car_benefit
                        })
                    });
                    if (res.ok) {
                        queryClient.invalidateQueries({ queryKey: ['admin-payroll', month, year] });
                    } else {
                        setAlertConfig({ alert: { visible: true, message: "เกิดข้อผิดพลาด", type: "error" } });
                    }
                } catch (e) {
                    setAlertConfig({ alert: { visible: true, message: "Error", type: "error" } });
                }
                setPublishing(false);
            }
        });
    };

    const handlePublishBatch = (companyTitle: string, items: PayrollResult[], targetStatus: boolean) => {
        const incompleteInBatch = payrollData?.incomplete_employees?.filter((inc: any) =>
            items.some(i => i.emp_id === inc.emp_id)
        ) || [];

        const warnMessage = targetStatus && incompleteInBatch.length > 0
            ? `\n\nคำเตือน: มีพนักงาน ${incompleteInBatch.length} คน ข้อมูลยังไม่สมบูรณ์ (เช่น ${incompleteInBatch[0].name})\nพนักงานเหล่านี้จะไม่ถูกคำนวณเงินเดือนอย่างถูกต้อง ยืนยันที่จะดำเนินการต่อหรือไม่?`
            : "";

        setAlertConfig({
            alert: {
                visible: true,
                message: `ยืนยันการ${targetStatus ? 'เผยแพร่' : 'ยกเลิกเผยแพร่'}สลิปเงินเดือนทั้งหมดให้กับพนักงานใน ${companyTitle} จำนวน ${items.length} คน?${warnMessage}`,
                type: "ok"
            },
            onConfirm: async () => {
                closeAlert();
                setPublishing(true);
                try {
                    let changesMade = false;
                    for (const emp of items) {
                        if (Boolean(emp.is_published) === targetStatus) continue;
                        changesMade = true;
                        await fetch("/api/admin/payroll/publish", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                month, year, emp_id: emp.emp_id,
                                is_published: targetStatus,
                                tax: emp.tax,
                                social_security: emp.social_security,
                                provident_fund: emp.provident_fund,
                                taxable_income: emp.taxable_income,
                                housing_benefit: emp.housing_benefit,
                                car_benefit: emp.car_benefit
                            })
                        });
                    }
                    if (changesMade) queryClient.invalidateQueries({ queryKey: ['admin-payroll', month, year] });
                } catch (e) {
                    setAlertConfig({ alert: { visible: true, message: "เกิดข้อผิดพลาดในการตั้งค่า", type: "error" } });
                }
                setPublishing(false);
            }
        });
    };

    const handleExportExcel = async (companyTitle: string, items: PayrollResult[]) => {
        try {
            const res = await fetch("/api/admin/payroll/export-excel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ companyTitle, month, year, data: items })
            });
            if (!res.ok) throw new Error("Export failed");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const safeTitle = companyTitle.replace(/[^a-zA-Z0-9ก-๙\s]/g, "").trim().replace(/\s+/g, "_");
            a.download = `Payroll_${safeTitle}_${month}_${year}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            console.error(e);
            alert("เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ Excel");
        }
    };

    const formatB = (num: number) => new Intl.NumberFormat("th-TH").format(Math.round(num || 0));

    // Unique Departments List
    const departmentsList = useMemo(() => {
        const set = new Set<string>();
        data.forEach(d => {
            if (d.department && d.department !== "N/A") set.add(d.department);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
    }, [data]);

    // Status Counts (Active vs Employment Ended)
    const statusCounts = useMemo(() => {
        const targetData = selectedCompanyTab === "ALL"
            ? data
            : data.filter(d => d.company_id === selectedCompanyTab);

        let active = 0;
        let resigned = 0;
        targetData.forEach(d => {
            if (!d.is_active || Boolean(d.resignation_date)) {
                resigned++;
            } else {
                active++;
            }
        });
        return { active, resigned, total: targetData.length };
    }, [data, selectedCompanyTab]);

    // Filtered Data
    const filteredData = useMemo(() => {
        return data.filter(d => {
            // Search (Name, Nickname, Emp ID)
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase();
                const matchName = d.name.toLowerCase().includes(s);
                const matchId = d.emp_id.toLowerCase().includes(s);
                const matchNickname = d.nickname ? d.nickname.toLowerCase().includes(s) : false;
                if (!matchName && !matchId && !matchNickname) return false;
            }

            // Department
            if (deptFilter !== "all") {
                if (d.department !== deptFilter && String(d.department_id) !== deptFilter) return false;
            }

            // Salary Type
            if (typeFilter !== "all") {
                if (d.salary_type !== typeFilter) return false;
            }

            // Employment Status Filter
            const isEmploymentEnded = !d.is_active || Boolean(d.resignation_date);
            if (statusFilter === "active" && isEmploymentEnded) return false;
            if (statusFilter === "resigned" && !isEmploymentEnded) return false;

            // Company Tab Filter
            if (selectedCompanyTab !== "ALL") {
                if (d.company_id !== selectedCompanyTab) return false;
            }

            return true;
        });
    }, [data, searchTerm, deptFilter, typeFilter, statusFilter, selectedCompanyTab]);

    // Financial KPI Summary
    const financialStats = useMemo(() => {
        const calc = (items: PayrollResult[]) => ({
            count: items.length,
            monthlyCount: items.filter(i => i.salary_type !== "daily").length,
            dailyCount: items.filter(i => i.salary_type === "daily").length,
            baseSalary: items.reduce((acc, curr) => acc + (Number(curr.base_salary) || 0), 0),
            otPay: items.reduce((acc, curr) => acc + (Number(curr.ot_amount) || 0), 0),
            allowances: items.reduce((acc, curr) => acc + (
                (Number(curr.diligence_allowance) || 0) +
                (Number(curr.meal_allowance) || 0) +
                (Number(curr.travel_allowance) || 0) +
                (Number(curr.accommodation_allowance) || 0) +
                (Number(curr.long_service_allowance) || 0) +
                (Number(curr.telephone_allowance) || 0) +
                (Number(curr.position_allowance) || 0) +
                (Number(curr.general_allowance) || 0) +
                (Number(curr.travel_site_allowance) || 0) +
                (Number(curr.welfare_amount) || 0) +
                (Number(curr.commissions) || 0) +
                (Number(curr.bonus) || 0) +
                (Number(curr.other_benefits) || 0) +
                (Number(curr.truck_trip_fee) || 0)
            ), 0),
            deductions: items.reduce((acc, curr) => acc + (
                (Number(curr.social_security) || 0) +
                (Number(curr.student_loan) || 0) +
                (Number(curr.insurance) || 0) +
                (Number(curr.unpaid_absenteeism) || 0) +
                (Number(curr.tax) || 0) +
                (Number(curr.other_deductions) || 0)
            ), 0),
            netPay: items.reduce((acc, curr) => acc + (Number(curr.net_pay) || 0), 0)
        });

        const overall = calc(data);
        const perCompany: { [compId: number]: ReturnType<typeof calc> } = {};
        companies.forEach((c: any) => {
            perCompany[c.id] = calc(data.filter(d => d.company_id === c.id));
        });

        const currentView = calc(filteredData);
        return { overall, perCompany, currentView };
    }, [data, companies, filteredData]);

    // Grouping by Company -> Division
    const groupedData = useMemo(() => {
        const targetCompanies = selectedCompanyTab === "ALL"
            ? companies
            : companies.filter((c: any) => c.id === selectedCompanyTab);

        return targetCompanies.map((comp: any) => {
            const compItems = filteredData.filter(d => d.company_id === comp.id);

            const divGroups: { [key: string]: PayrollResult[] } = {};
            compItems.forEach(item => {
                const divName = item.division || "ไม่ระบุฝ่าย";
                if (!divGroups[divName]) divGroups[divName] = [];
                divGroups[divName].push(item);
            });

            const divisions = Object.entries(divGroups).map(([name, items]) => ({
                name,
                items: items.sort((a, b) => a.emp_id.localeCompare(b.emp_id))
            })).sort((a, b) => a.name.localeCompare(b.name, "th"));

            return {
                id: comp.id,
                code: comp.code,
                title: comp.name,
                divisions,
                totalCount: compItems.length
            };
        }).filter((g: any) => g.totalCount > 0);
    }, [companies, selectedCompanyTab, filteredData]);

    const hasActiveFilters = searchTerm.trim() !== "" || deptFilter !== "all" || typeFilter !== "all" || statusFilter !== "all";

    const handleResetFilters = () => {
        setSearchTerm("");
        setDeptFilter("all");
        setTypeFilter("all");
        setStatusFilter("all");
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    กำลังประมวลผลข้อมูลเงินเดือนและโอที...
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* ── 1. Header ── */}
            <div className={styles.header}>
                <div className={styles.titleArea}>
                    <div className={styles.titleRow}>
                        <div className={styles.titleIcon}>
                            <BanknotesIcon width={20} height={20} />
                        </div>
                        <h1 className={styles.title}>คำนวณและสรุปเงินเดือนพนักงาน</h1>
                    </div>
                    <p className={styles.subtitle}>
                        ระบบประมวลผลเงินเดือน ค่าล่วงเวลา สวัสดิการ และการเผยแพร่สลิป
                        {cycle && (
                            <span className={styles.cycleBadge}>
                                รอบ: {new Date(cycle.start).toLocaleDateString("th-TH")} - {new Date(cycle.end).toLocaleDateString("th-TH")}
                            </span>
                        )}
                    </p>
                </div>

                <div className={styles.headerControls}>
                    <select
                        className={styles.periodSelect}
                        value={month}
                        onChange={e => setMonth(Number(e.target.value))}
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>
                        ))}
                    </select>

                    <select
                        className={styles.periodSelect}
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                    >
                        {Array.from({ length: 5 }, (_, i) => (
                            <option key={i} value={new Date().getFullYear() - 2 + i}>
                                ปี {new Date().getFullYear() - 2 + i}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── 2. Company Segmented Tabs ── */}
            <div className={styles.companyTabsWrap}>
                <button
                    className={`${styles.companyTab} ${selectedCompanyTab === "ALL" ? styles.companyTabActive : ""}`}
                    onClick={() => setSelectedCompanyTab("ALL")}
                >
                    <BuildingOffice2Icon width={16} height={16} />
                    <span>ทุกบริษัท (All)</span>
                    <span className={styles.tabCountBadge}>{financialStats.overall.count} คน</span>
                </button>

                {companies.map((c: any) => {
                    const compStat = financialStats.perCompany[c.id];
                    const isSelected = selectedCompanyTab === c.id;
                    return (
                        <button
                            key={c.id}
                            className={`${styles.companyTab} ${isSelected ? styles.companyTabActive : ""}`}
                            onClick={() => setSelectedCompanyTab(c.id)}
                        >
                            <span className={styles.tabCodeBadge}>{c.code}</span>
                            <span>{c.name.replace(/^บริษัท\s*/, "").replace(/\s*จำกัด.*$/, "")}</span>
                            <span className={styles.tabCountBadge}>{compStat?.count || 0} คน</span>
                        </button>
                    );
                })}
            </div>

            {/* ── 3. Financial KPI Summary Cards ── */}
            <div className={styles.financialGrid}>
                <div className={styles.financialCard}>
                    <div className={styles.financialLabel}>
                        <UserGroupIcon width={14} height={14} />
                        <span>พนักงานในรอบนี้</span>
                    </div>
                    <div className={styles.financialValue}>
                        {financialStats.currentView.count} <span style={{ fontSize: 13, fontWeight: 500 }}>คน</span>
                    </div>
                    <div className={styles.financialSub}>
                        รายเดือน {financialStats.currentView.monthlyCount} • รายวัน {financialStats.currentView.dailyCount}
                    </div>
                </div>

                <div className={styles.financialCard}>
                    <div className={styles.financialLabel}>
                        <BanknotesIcon width={14} height={14} />
                        <span>เงินเดือนฐานรวม</span>
                    </div>
                    <div className={styles.financialValue}>
                        ฿{formatB(financialStats.currentView.baseSalary)}
                    </div>
                    <div className={styles.financialSub}>ตามสัญญาจ้างและการปรับปรุง</div>
                </div>

                <div className={styles.financialCard}>
                    <div className={styles.financialLabel}>
                        <ClockIcon width={14} height={14} />
                        <span>ค่าล่วงเวลา & วันหยุด (OT)</span>
                    </div>
                    <div className={styles.financialValue} style={{ color: "#0284c7" }}>
                        ฿{formatB(financialStats.currentView.otPay)}
                    </div>
                    <div className={styles.financialSub}>คำนวณตามชั่วโมงที่ได้รับอนุมัติ</div>
                </div>

                <div className={styles.financialCard}>
                    <div className={styles.financialLabel}>
                        <GiftIcon width={14} height={14} />
                        <span>สวัสดิการและเบี้ยเลี้ยง</span>
                    </div>
                    <div className={styles.financialValue} style={{ color: "var(--purple)" }}>
                        ฿{formatB(financialStats.currentView.allowances)}
                    </div>
                    <div className={styles.financialSub}>ค่าตำแหน่ง อาหาร ที่พัก เดินทาง เหมาจ่าย</div>
                </div>

                <div className={styles.financialCard}>
                    <div className={styles.financialLabel}>
                        <ReceiptPercentIcon width={14} height={14} />
                        <span>หักภาษี & ประกันสังคม</span>
                    </div>
                    <div className={styles.financialValue} style={{ color: "var(--bad)" }}>
                        -฿{formatB(financialStats.currentView.deductions)}
                    </div>
                    <div className={styles.financialSub}>ประกันสังคม กยศ. ขาดงาน ภาษี</div>
                </div>

                <div className={`${styles.financialCard} ${styles.financialCardTotal}`}>
                    <div className={styles.financialLabel}>
                        <CreditCardIcon width={14} height={14} />
                        <span>ยอดรวมจ่ายสุทธิ (Net Pay)</span>
                    </div>
                    <div className={styles.financialValue}>
                        ฿{formatB(financialStats.currentView.netPay)}
                    </div>
                    <div className={styles.financialSub} style={{ color: "#94a3b8" }}>
                        ยอดรวมโอนจริงสำหรับงวดนี้
                    </div>
                </div>
            </div>

            {/* ── 4. Responsive Search & Filter Bar ── */}
            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <MagnifyingGlassIcon className={styles.searchIcon} width={16} height={16} />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="ค้นหาชื่อ, ชื่อเล่น, หรือรหัสพนักงาน..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <select
                    className={styles.filterSelect}
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                >
                    <option value="all">ทุกแผนก (ทั้งหมด)</option>
                    {departmentsList.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                    ))}
                </select>

                <select
                    className={styles.filterSelect}
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as any)}
                >
                    <option value="all">ประเภทการจ้าง (ทั้งหมด)</option>
                    <option value="monthly">พนักงานรายเดือน</option>
                    <option value="daily">พนักงานรายวัน</option>
                </select>

                <select
                    className={styles.filterSelect}
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                >
                    <option value="all">สถานะการทำงาน (ทั้งหมด)</option>
                    <option value="active">กำลังปฏิบัติงาน ({statusCounts.active})</option>
                    <option value="resigned">สิ้นสุดการจ้าง / พ้นสภาพ ({statusCounts.resigned})</option>
                </select>

                {hasActiveFilters && (
                    <button className={styles.btnResetFilter} onClick={handleResetFilters}>
                        <ArrowPathIcon width={14} height={14} />
                        <span>ล้างตัวกรอง</span>
                    </button>
                )}
            </div>

            {/* Incomplete Employees Warning Banner */}
            {payrollData?.incomplete_employees?.length > 0 && (
                <div className={styles.incompleteBanner}>
                    <div className={styles.incompleteHeader}>
                        <ExclamationTriangleIcon width={18} height={18} style={{ color: "#d97706", flexShrink: 0 }} />
                        <span>มีพนักงานที่ยังกรอกข้อมูลตั้งต้นไม่สมบูรณ์ ({payrollData.incomplete_employees.length} คน)</span>
                    </div>
                    <div>
                        พนักงานกลุ่มนี้ถูกแยกไว้ชั่วคราวและยังไม่ถูกนำมาคำนวณเงินเดือนในตารางหลัก กรุณาตรวจสอบและบันทึกข้อมูลพนักงานให้ครบถ้วน:
                        <div className={styles.incompleteList}>
                            {payrollData.incomplete_employees.map((inc: any) => (
                                <span key={inc.emp_id} style={{ display: "inline-block", marginRight: 12 }}>
                                    • {inc.emp_id} {inc.name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── 5. Company Payroll Tables ── */}
            {groupedData.length === 0 ? (
                <div className={styles.emptyState}>
                    ไม่พบข้อมูลเงินเดือนพนักงานตามเงื่อนไขตัวกรองที่กำหนด
                </div>
            ) : (
                groupedData.map((group: any) => (
                    <div key={group.id} className={styles.companySection}>
                        {/* Company Section Header */}
                        <div className={styles.companySectionHeader}>
                            <div className={styles.companyHeaderLeft}>
                                <span className={styles.companyTagCode}>{group.code}</span>
                                <h2 className={styles.companyTitle}>{group.title}</h2>
                                <span className={styles.companyStaffCount}>({group.totalCount} คน)</span>
                            </div>

                            <div className={styles.companyHeaderActions}>
                                <button
                                    className={styles.btnExcel}
                                    onClick={() => {
                                        const allItems = group.divisions.flatMap((d: any) => d.items);
                                        handleExportExcel(group.title, allItems);
                                    }}
                                >
                                    <ArrowDownTrayIcon width={14} height={14} />
                                    <span>ส่งออก Excel ({group.code})</span>
                                </button>

                                <button
                                    className={styles.btnUnpublishBatch}
                                    onClick={() => {
                                        const allItems = group.divisions.flatMap((d: any) => d.items);
                                        handlePublishBatch(group.title, allItems, false);
                                    }}
                                    disabled={publishing || loading}
                                >
                                    <EyeSlashIcon width={14} height={14} />
                                    <span>ยกเลิก Publish</span>
                                </button>

                                <button
                                    className={styles.btnPublishBatch}
                                    onClick={() => {
                                        const allItems = group.divisions.flatMap((d: any) => d.items);
                                        handlePublishBatch(group.title, allItems, true);
                                    }}
                                    disabled={publishing || loading}
                                >
                                    <PaperAirplaneIcon width={14} height={14} />
                                    <span>Publish สลิปทั้งหมด</span>
                                </button>
                            </div>
                        </div>

                        {/* Divisions and Tables */}
                        {group.divisions.map((div: any, dIdx: number) => (
                            <div key={dIdx} className={styles.divisionBlock}>
                                <div className={styles.divisionHeader}>
                                    <AcademicCapIcon width={16} height={16} style={{ color: "var(--red)" }} />
                                    <h3 className={styles.divisionTitle}>ฝ่าย: {div.name}</h3>
                                    <span className={styles.divisionCount}>({div.items.length} คน)</span>
                                </div>

                                <div className={styles.tableWrap}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th className={styles.stickyColEmp}>พนักงาน (ID)</th>
                                                <th>ตำแหน่ง & แผนก</th>
                                                <th className={styles.thRight} title="คลิกเพื่อแก้ไขยอดเงินเดือนเฉพาะรอบนี้">เงินเดือน (฿)</th>
                                                <th className={styles.thRight}>เงินประจำตำแหน่ง</th>
                                                <th className={styles.thRight}>เบี้ยเลี้ยง/สวัสดิการ</th>
                                                <th>เงื่อนไข OT</th>
                                                <th className={styles.thRight}>OT 1.5x (ชม)</th>
                                                <th className={styles.thRight}>วันหยุด 1x (ชม)</th>
                                                <th className={styles.thRight}>OT วันหยุด 3x (ชม)</th>
                                                <th className={styles.thRight}>เบี้ยขยัน</th>
                                                <th className={styles.thRight}>ค่าอาหาร</th>
                                                <th className={styles.thRight}>ค่าเดินทาง</th>
                                                <th className={styles.thRight}>ค่าที่พัก</th>
                                                <th className={styles.thRight}>Off-Site</th>
                                                <th className={styles.thRight}>ค่าโทรศัพท์</th>
                                                {month === 12 && (
                                                    <th className={styles.thRight}>โบนัสอายุงาน</th>
                                                )}
                                                <th className={styles.thRight}>OT+วันหยุด</th>
                                                <th className={styles.thRight}>คอมมิชชั่น</th>
                                                <th className={styles.thRight}>โบนัส</th>
                                                <th className={styles.thRight}>สวัสดิการอื่นๆ (เหมาจ่าย)</th>
                                                <th className={styles.thRight}>ค่าเที่ยวรถ</th>
                                                <th className={styles.thRight}>เบิกสวัสดิการ</th>
                                                <th className={styles.thRight}>รวมรายได้สุทธิ</th>
                                                <th className={styles.thRight}>ประกันสังคม</th>
                                                <th className={styles.thRight}>กยศ.</th>
                                                <th className={styles.thRight}>ประกันงาน</th>
                                                <th className={styles.thRight}>ขาดงาน</th>
                                                <th className={styles.thRight}>ภาษี</th>
                                                <th className={styles.thRight}>หักอื่นๆ</th>
                                                <th className={styles.thRight} style={{ fontWeight: 800 }}>รวมรับจริง (฿)</th>
                                                <th>บัญชีรับเงิน</th>
                                                <th style={{ textAlign: "center" }}>จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {div.items.map((p: PayrollResult) => (
                                                <tr key={p.emp_id}>
                                                    {/* Sticky Employee Column */}
                                                    <td className={styles.stickyColEmp}>
                                                        <div className={styles.empCellWrap}>
                                                            <div className={styles.empNameRow}>
                                                                <span>{p.name}</span>
                                                                {p.nickname && (
                                                                    <span className={styles.empNickname}>({p.nickname})</span>
                                                                )}
                                                            </div>
                                                            <div className={styles.empSubRow}>
                                                                <span className={styles.empIdBadge}>{p.emp_id}</span>
                                                                {!p.is_active && (
                                                                    <span className={styles.badgeResigned}>
                                                                        พ้นสภาพ {p.resignation_date ? `(${p.resignation_date})` : ""}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Department & Position */}
                                                    <td>
                                                        <div className={styles.deptCell}>
                                                            <span className={styles.posText}>{p.position}</span>
                                                            <div className={styles.deptSubText}>
                                                                <span>{p.department}</span>
                                                                {p.is_on_trial ? (
                                                                    <span className={styles.badgeTrial}>ทดลองงาน</span>
                                                                ) : (
                                                                    <span className={styles.badgeRegular}>ประจำ</span>
                                                                )}
                                                                {p.salary_type === "daily" && (
                                                                    <span className={styles.dailyRateTag}>
                                                                        รายวัน (฿{formatB(p.base_salary_daily || p.base_salary)}/วัน)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Base Salary (Quick edit) */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-override_salary` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "override_salary" });
                                                            setTempValue(p.is_salary_overridden ? String(p.base_salary) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "override_salary" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "override_salary", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "override_salary", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <span className={p.is_salary_overridden ? styles.cellOverridden : undefined}>
                                                                {formatB(p.base_salary)}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Position Allowance */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-position_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "position_allowance_override" });
                                                            setTempValue(p.position_allowance > 0 ? String(p.position_allowance) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "position_allowance_override" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "position_allowance_override", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "position_allowance_override", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <span style={{ color: p.position_allowance > 0 ? "var(--purple)" : "inherit", fontWeight: p.position_allowance > 0 ? 700 : 400 }}>
                                                                {p.position_allowance > 0 ? formatB(p.position_allowance) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* General Allowance */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-general_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "general_allowance_override" });
                                                            setTempValue(p.general_allowance > 0 ? String(p.general_allowance) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "general_allowance_override" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "general_allowance_override", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "general_allowance_override", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <span style={{ color: p.general_allowance > 0 ? "var(--purple)" : "inherit" }}>
                                                                {p.general_allowance > 0 ? formatB(p.general_allowance) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* OT Rule */}
                                                    <td>
                                                        <span className={p.is_ot_eligible ? styles.badgeOk : styles.badgeErr}>
                                                            {p.ot_rule}
                                                        </span>
                                                    </td>

                                                    {/* OT 1.5x */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-normal_1_5x_hours_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "normal_1_5x_hours_override" });
                                                            setTempValue(p.normal_1_5x_hours > 0 ? String(p.normal_1_5x_hours) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "normal_1_5x_hours_override" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "normal_1_5x_hours_override", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "normal_1_5x_hours_override", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <div style={{ color: p.normal_1_5x_hours > 0 ? "var(--ok)" : "inherit" }}>
                                                                {p.normal_1_5x_hours > 0 ? `${p.normal_1_5x_hours} ชม.` : "-"}
                                                                {p.normal_ot_pay > 0 && <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 4 }}>({formatB(p.normal_ot_pay)})</span>}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* OT 1x */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-holiday_1_x_hours_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "holiday_1_x_hours_override" });
                                                            setTempValue(p.holiday_1x_hours > 0 ? String(p.holiday_1x_hours) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "holiday_1_x_hours_override" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "holiday_1_x_hours_override", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "holiday_1_x_hours_override", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <div style={{ color: p.holiday_1x_hours > 0 ? "var(--blue)" : "inherit" }}>
                                                                {p.holiday_1x_hours > 0 ? `${p.holiday_1x_hours} ชม.` : "-"}
                                                                {p.holiday_1x_pay > 0 && <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 4 }}>({formatB(p.holiday_1x_pay)})</span>}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* OT 3x */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-holiday_3_x_hours_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "holiday_3_x_hours_override" });
                                                            setTempValue(p.holiday_3x_hours > 0 ? String(p.holiday_3x_hours) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "holiday_3_x_hours_override" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "holiday_3_x_hours_override", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "holiday_3_x_hours_override", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <div style={{ color: p.holiday_3x_hours > 0 ? "var(--red)" : "inherit" }}>
                                                                {p.holiday_3x_hours > 0 ? `${p.holiday_3x_hours} ชม.` : "-"}
                                                                {p.holiday_3x_pay > 0 && <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 4 }}>({formatB(p.holiday_3x_pay)})</span>}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Diligence */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-diligence_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "diligence_allowance_override" });
                                                            setTempValue(p.diligence_allowance > 0 ? String(p.diligence_allowance) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "diligence_allowance_override" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "diligence_allowance_override", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "diligence_allowance_override", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <>
                                                                <span style={{ color: p.diligence_allowance > 0 ? "var(--ok)" : "var(--text-4)", fontWeight: p.diligence_allowance > 0 ? 700 : 400 }}>
                                                                    {p.diligence_allowance > 0 ? formatB(p.diligence_allowance) : "0"}
                                                                </span>
                                                                {p.diligence_allowance === 0 && p.diligence_failed_reason && (
                                                                    <span style={{ fontSize: 10, color: "var(--text-4)", marginLeft: 4 }}>
                                                                        ({p.diligence_failed_reason})
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>

                                                    {/* Meal */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-meal_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "meal_allowance_override" });
                                                            setTempValue(p.meal_allowance > 0 ? String(p.meal_allowance) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "meal_allowance_override" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "meal_allowance_override", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "meal_allowance_override", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <span>{p.meal_allowance > 0 ? formatB(p.meal_allowance) : "-"}</span>
                                                        )}
                                                    </td>

                                                    {/* Travel */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-travel_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "travel_allowance_override" });
                                                            setTempValue(p.travel_allowance > 0 ? String(p.travel_allowance) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "travel_allowance_override" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "travel_allowance_override", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "travel_allowance_override", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <span>{p.travel_allowance > 0 ? formatB(p.travel_allowance) : "-"}</span>
                                                        )}
                                                    </td>

                                                    {/* Accommodation */}
                                                    <td
                                                        className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-accommodation_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => {
                                                            setActiveCell({ empId: p.emp_id, field: "accommodation_allowance_override" });
                                                            setTempValue(p.accommodation_allowance > 0 ? String(p.accommodation_allowance) : "");
                                                        }}
                                                    >
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "accommodation_allowance_override" ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.cellInput}
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={e => setTempValue(e.target.value)}
                                                                onBlur={() => handleQuickSave(p, "accommodation_allowance_override", tempValue)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleQuickSave(p, "accommodation_allowance_override", tempValue);
                                                                    if (e.key === "Escape") setActiveCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <span>{p.accommodation_allowance > 0 ? formatB(p.accommodation_allowance) : "-"}</span>
                                                        )}
                                                    </td>

                                                    {/* Off-site */}
                                                    <td className={styles.tdRight}>
                                                        {p.travel_site_allowance > 0 ? formatB(p.travel_site_allowance) : "-"}
                                                    </td>

                                                    {/* Phone */}
                                                    <td className={styles.tdRight}>
                                                        {p.telephone_allowance > 0 ? formatB(p.telephone_allowance) : "-"}
                                                    </td>

                                                    {month === 12 && (
                                                        <td className={styles.tdRight}>
                                                            {p.long_service_allowance > 0 ? formatB(p.long_service_allowance) : "-"}
                                                        </td>
                                                    )}

                                                    {/* Total OT */}
                                                    <td className={styles.tdRight} style={{ color: p.ot_amount > 0 ? "var(--ok)" : "inherit", fontWeight: 700 }}>
                                                        {formatB(p.ot_amount)}
                                                    </td>

                                                    {/* Commissions */}
                                                    <td className={styles.tdRight}>
                                                        {p.commissions > 0 ? formatB(p.commissions) : "-"}
                                                    </td>

                                                    {/* Bonus */}
                                                    <td className={styles.tdRight}>
                                                        {p.bonus > 0 ? formatB(p.bonus) : "-"}
                                                    </td>

                                                    {/* Other Benefits */}
                                                    <td className={styles.tdRight}>
                                                        {p.other_benefits > 0 ? formatB(p.other_benefits) : "-"}
                                                    </td>

                                                    {/* Truck Trip */}
                                                    <td className={styles.tdRight}>
                                                        {p.truck_trip_fee && p.truck_trip_fee > 0 ? formatB(p.truck_trip_fee) : "-"}
                                                    </td>

                                                    {/* Welfare */}
                                                    <td className={styles.tdRight}>
                                                        {p.welfare_amount > 0 ? formatB(p.welfare_amount) : "-"}
                                                    </td>

                                                    {/* Gross Pay */}
                                                    <td className={styles.tdRight} style={{ fontWeight: 700 }}>
                                                        {formatB(p.gross_pay)}
                                                    </td>

                                                    {/* Social Security */}
                                                    <td className={styles.tdRight} style={{ color: "var(--bad)" }}>
                                                        {p.social_security > 0 ? `-${formatB(p.social_security)}` : "-"}
                                                    </td>

                                                    {/* Student Loan */}
                                                    <td className={styles.tdRight}>
                                                        {p.student_loan > 0 ? `-${formatB(p.student_loan)}` : "-"}
                                                    </td>

                                                    {/* Insurance */}
                                                    <td className={styles.tdRight}>
                                                        {p.insurance > 0 ? `-${formatB(p.insurance)}` : "-"}
                                                    </td>

                                                    {/* Unpaid Leave */}
                                                    <td className={styles.tdRight}>
                                                        {p.unpaid_absenteeism > 0 ? `-${formatB(p.unpaid_absenteeism)}` : "-"}
                                                    </td>

                                                    {/* Tax */}
                                                    <td className={styles.tdRight} style={{ color: "var(--bad)" }}>
                                                        {p.tax > 0 ? `-${formatB(p.tax)}` : "-"}
                                                    </td>

                                                    {/* Other Deductions */}
                                                    <td className={styles.tdRight}>
                                                        {p.other_deductions > 0 ? `-${formatB(p.other_deductions)}` : "-"}
                                                    </td>

                                                    {/* Net Pay */}
                                                    <td className={styles.tdRight} style={{ fontWeight: 800, fontSize: 13.5, color: "var(--red)" }}>
                                                        {formatB(p.net_pay)}
                                                    </td>

                                                    {/* Bank Account */}
                                                    <td style={{ fontSize: 11.5 }}>
                                                        <div>{p.bank_name}</div>
                                                        <span style={{ fontFamily: "IBM Plex Mono", color: "var(--text-3)" }}>{p.bank_account_no}</span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td>
                                                        <div className={styles.actionBtnRow}>
                                                            <button
                                                                className={styles.btnActionIcon}
                                                                onClick={() => openEditModal(p)}
                                                                title="แก้ไขยอดรายบุคคล"
                                                            >
                                                                <PencilSquareIcon width={14} height={14} />
                                                            </button>

                                                            <button
                                                                className={styles.btnActionIcon}
                                                                style={{ color: p.is_published ? "var(--ok)" : "var(--text-4)" }}
                                                                onClick={() => handlePublish(p.emp_id, !p.is_published)}
                                                                title={p.is_published ? "เผยแพร่แล้ว (คลิกเพื่อยกเลิก)" : "ยังไม่เผยแพร่ (คลิกเพื่อเผยแพร่)"}
                                                                disabled={publishing}
                                                            >
                                                                <PaperAirplaneIcon width={14} height={14} />
                                                            </button>

                                                            <button
                                                                className={styles.btnActionIcon}
                                                                onClick={() => handleIssue50Twi(p.emp_id, year)}
                                                                title="ออกหนังสือรับรอง 50 ทวิ"
                                                            >
                                                                <ArrowDownTrayIcon width={14} height={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                ))
            )}

            {/* ── 6. Edit Adjustments Modal ── */}
            {showModal && editingEmp && (
                <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalHeaderTitle}>
                                ปรับปรุงยอดเงินเดือน: {editingEmp.name} ({editingEmp.emp_id})
                            </h2>
                            <button className={styles.modalCloseBtn} onClick={() => setShowModal(false)} aria-label="ปิด">
                                <XMarkIcon width={18} height={18} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.inputField}>
                                <label className={styles.inputLabel}>เงินเดือนฐานรอบนี้ (Override Salary)</label>
                                <input
                                    type="number"
                                    className={styles.inputElement}
                                    placeholder={String(editingEmp.base_salary)}
                                    value={editForm.override_salary}
                                    onChange={e => setEditForm({ ...editForm, override_salary: e.target.value })}
                                />
                            </div>

                            <div className={styles.modalFieldGrid}>
                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>OT ปกติ 1.5x (ชม.)</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.normal_1_5x_hours_override}
                                        onChange={e => setEditForm({ ...editForm, normal_1_5x_hours_override: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>OT วันหยุด 3x (ชม.)</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.holiday_3_x_hours_override}
                                        onChange={e => setEditForm({ ...editForm, holiday_3_x_hours_override: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>เงินประจำตำแหน่ง</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.position_allowance_override}
                                        onChange={e => setEditForm({ ...editForm, position_allowance_override: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>เบี้ยขยัน</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.diligence_allowance_override}
                                        onChange={e => setEditForm({ ...editForm, diligence_allowance_override: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>ค่าอาหาร</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.meal_allowance_override}
                                        onChange={e => setEditForm({ ...editForm, meal_allowance_override: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>ค่าเดินทาง</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.travel_allowance_override}
                                        onChange={e => setEditForm({ ...editForm, travel_allowance_override: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>ค่าที่พัก</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.accommodation_allowance_override}
                                        onChange={e => setEditForm({ ...editForm, accommodation_allowance_override: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>หักประกันสังคม</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.social_security}
                                        onChange={e => setEditForm({ ...editForm, social_security: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>ภาษีหัก ณ ที่จ่าย</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.tax}
                                        onChange={e => setEditForm({ ...editForm, tax: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>คอมมิชชั่น</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.commissions}
                                        onChange={e => setEditForm({ ...editForm, commissions: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>โบนัส</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.bonus}
                                        onChange={e => setEditForm({ ...editForm, bonus: e.target.value })}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>สวัสดิการอื่นๆ (เหมาจ่าย)</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.other_benefits}
                                        onChange={e => setEditForm({ ...editForm, other_benefits: e.target.value })}
                                        placeholder={String(editingEmp?.calculated_lump_sum ?? editingEmp?.other_benefits ?? 0)}
                                    />
                                </div>

                                <div className={styles.inputField}>
                                    <label className={styles.inputLabel}>รายการหักอื่นๆ</label>
                                    <input
                                        type="number"
                                        className={styles.inputElement}
                                        value={editForm.other_deductions}
                                        onChange={e => setEditForm({ ...editForm, other_deductions: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.btnModalCancel} onClick={() => setShowModal(false)}>
                                ยกเลิก
                            </button>
                            <button className={styles.btnModalSave} onClick={saveAdjustments} disabled={saving}>
                                {saving ? "กำลังบันทึก..." : "บันทึกการปรับปรุง"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AlertModal
                alert={alertConfig.alert}
                onClose={closeAlert}
                onConfirm={alertConfig.onConfirm}
            />
        </div>
    );
}
