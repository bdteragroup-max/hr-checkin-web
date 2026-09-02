"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";
import { PencilSquareIcon, BanknotesIcon, PlusCircleIcon, MinusCircleIcon, AcademicCapIcon, AdjustmentsHorizontalIcon, CheckCircleIcon, PaperAirplaneIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import AlertModal, { AlertState } from "@/components/AlertModal";

type PayrollResult = {
    emp_id: string;
    name: string;
    department: string;
    division: string;
    position: string;
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

    const { data: payrollData, isLoading, isFetching } = useQuery({
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
    const [searchTerm, setSearchTerm] = useState("");

    const handleIssue50Twi = async (empId: string, year: number) => {
        try {
            const res = await fetch('/api/admin/payroll/50twi/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId: empId, year })
            });
            const data = await res.json();
            if (!res.ok) {
                alert(`Error: ${data.error || 'Failed to issue'}`);
            } else {
                alert(`Issued 50 Tawi successfully! Document No: ${data.document?.document_number}`);
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred while issuing the document.');
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
        setActiveCell(null); // Close any active quick edit
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
            // Get all existing fields to maintain other overrides
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

            // Update the specific field
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
            ? `\n\n⚠️ คำเตือน: มีพนักงาน ${incompleteInBatch.length} คน ข้อมูลยังไม่สมบูรณ์ (เช่น ${incompleteInBatch[0].name})\nพนักงานเหล่านี้จะไม่ถูกคำนวณเงินเดือนอย่างถูกต้อง ยืนยันที่จะดำเนินการต่อหรือไม่?`
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

    const formatB = (num: number) => new Intl.NumberFormat("th-TH").format(Math.round(num));

    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return data;
        const s = searchTerm.toLowerCase();
        return data.filter(d =>
            d.name.toLowerCase().includes(s) ||
            d.emp_id.toLowerCase().includes(s)
        );
    }, [data, searchTerm]);

    const groupedData = useMemo(() => {
        const companies = [
            { key: "TG", title: "บริษัท เทอรา กรุ้ป จำกัด (TG)" },
            { key: "TE", title: "บริษัท เทอรา อิเล็กทริค จำกัด (TE)" },
            { key: "TP", title: "บริษัท เทอรา พาวเวอร์ จำกัด (TP)" },
            { key: "OTHER", title: "บริษัทอื่นๆ" }
        ];

        return companies.map(comp => {
            let filtered = [];
            if (comp.key === "OTHER") {
                filtered = filteredData.filter(d => !["TG", "TE", "TP"].includes(d.emp_id.toUpperCase().substring(0, 2)));
            } else {
                filtered = filteredData.filter(d => d.emp_id.toUpperCase().startsWith(comp.key));
            }

            // Sub-group by Division
            const divGroups: { [key: string]: PayrollResult[] } = {};
            filtered.forEach(item => {
                const divName = item.division || "ไม่ระบุฝ่าย (Unassigned)";
                if (!divGroups[divName]) divGroups[divName] = [];
                divGroups[divName].push(item);
            });

            const divisions = Object.entries(divGroups).map(([name, items]) => ({
                name,
                items: items.sort((a, b) => a.emp_id.localeCompare(b.emp_id))
            })).sort((a, b) => a.name.localeCompare(b.name));

            return { key: comp.key, title: comp.title, divisions, totalCount: filtered.length };
        }).filter(g => g.totalCount > 0);
    }, [filteredData]);


    const offSiteSummary = useMemo(() => {
        const summary: { [division: string]: { [role: string]: { count: number, amount: number } } } = {};

        filteredData.forEach(p => {
            if (p.travel_site_allowance <= 0) return;

            const div = p.division || "ไม่ระบุฝ่าย (Unassigned)";
            const pos = p.position.toLowerCase();
            let role = "Staff";
            if (pos.includes("manager") || pos.includes("ผู้จัดการ")) role = "Manager";
            else if (pos.includes("engineer") || pos.includes("วิศวกร")) role = "Engineer";
            else if (pos.includes("foreman") || pos.includes("หัวหน้าช่าง")) role = "Foreman";
            else if (pos.includes("driver") || pos.includes("ขับรถ")) role = "Driver";

            if (!summary[div]) summary[div] = {};
            if (!summary[div][role]) summary[div][role] = { count: 0, amount: 0 };

            summary[div][role].count += 1;
            summary[div][role].amount += p.travel_site_allowance;
        });

        return summary;
    }, [filteredData]);


    if (loading) return <div className={styles.loading}>กำลังโหลดข้อมูลเงินเดือน...</div>;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>ระบบเงินเดือน และ OT (Payroll & Overtime)</h1>
                    <p className={styles.subtitle}>
                        รอบคำนวณ: {cycle ? `${new Date(cycle.start).toLocaleDateString("th-TH")} ถึง ${new Date(cycle.end).toLocaleDateString("th-TH")}` : ""}
                    </p>
                </div>
                <div className={styles.filters}>
                    <div className={styles.searchBox}>
                        <MagnifyingGlassIcon className={styles.searchIcon} width={18} />
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="ค้นหาชื่อ หรือรหัสพนักงาน..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select className={styles.input} value={month} onChange={e => setMonth(Number(e.target.value))}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>
                        ))}
                    </select>
                    <select className={styles.input} value={year} onChange={e => setYear(Number(e.target.value))}>
                        {Array.from({ length: 5 }, (_, i) => (
                            <option key={i} value={new Date().getFullYear() - 2 + i}>ปี {new Date().getFullYear() - 2 + i}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Incomplete Employees Warning Banner */}
            {payrollData?.incomplete_employees?.length > 0 && (
                <div style={{
                    background: "var(--bad-bg)",
                    border: "1px solid var(--bad-border)",
                    color: "var(--bad)",
                    padding: "16px 20px",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: 24,
                    fontSize: 14,
                    lineHeight: 1.5
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>⚠️</span> 
                        <span>พนักงานที่มีข้อมูลยังไม่สมบูรณ์ ({payrollData.incomplete_employees.length} คน)</span>
                    </div>
                    <div>
                        พนักงานเหล่านี้อาจไม่ได้รับการคำนวณเงินเดือนที่ถูกต้อง เนื่องจากข้อมูลเบื้องต้น/อัตราเงินเดือนยังไม่ครบถ้วน กรุณาอัปเดตข้อมูลพนักงานให้สมบูรณ์ก่อน Publish:
                        <div style={{ marginTop: 8, maxHeight: 100, overflowY: "auto", background: "rgba(255,255,255,0.5)", padding: 8, borderRadius: 4 }}>
                            {payrollData.incomplete_employees.map((inc: any) => (
                                <div key={inc.emp_id}>• {inc.emp_id} - {inc.name}</div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Off-Site Allowance Summary Section */}
            {Object.keys(offSiteSummary).length > 0 && (
                <div className={styles.summarySection}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 4, height: 24, background: 'var(--red)', borderRadius: 2 }}></div>
                        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>สรุปเบี้ยเลี้ยงปฏิบัติงานนอกสถานที่ (Off-Site Allowance Summary)</h2>
                    </div>
                    <div className={styles.summaryGrid}>
                        {Object.entries(offSiteSummary).map(([div, roles]) => (
                            <div key={div} className={styles.summaryCard}>
                                <div className={styles.summaryHeader}>
                                    <AcademicCapIcon width={18} style={{ color: 'var(--blue)' }} />
                                    <h2>ฝ่าย: {div}</h2>
                                </div>
                                <table className={styles.summaryTable}>
                                    <thead>
                                        <tr>
                                            <th>ระดับ/ตำแหน่ง</th>
                                            <th style={{ textAlign: 'center' }}>จำนวน (คน)</th>
                                            <th style={{ textAlign: 'right' }}>ยอดรวม (฿)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(roles).map(([role, stats]) => (
                                            <tr key={role}>
                                                <td>
                                                    <span className={`${styles.roleBadge} ${styles[`role${role}`]}`}>
                                                        {role === "Manager" ? "ผู้จัดการ" :
                                                            role === "Engineer" ? "วิศวกร" :
                                                                role === "Foreman" ? "หัวหน้าช่าง" :
                                                                    role === "Driver" ? "คนขับรถ" : "พนักงานทั่วไป"}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{stats.count}</td>
                                                <td style={{ textAlign: 'right' }} className={styles.amountText}>{formatB(stats.amount)}</td>
                                            </tr>
                                        ))}
                                        <tr className={styles.totalRow}>
                                            <td style={{ fontWeight: 800 }}>รวมทั้งสิ้น</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {Object.values(roles).reduce((acc, curr) => acc + curr.count, 0)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {formatB(Object.values(roles).reduce((acc, curr) => acc + curr.amount, 0))}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {groupedData.length === 0 ? (
                <div className={styles.card} style={{ padding: "40px", textAlign: "center", color: "var(--text3)", background: "white", borderRadius: "12px", border: "1px solid var(--line)" }}>
                    ไม่มีข้อมูลพนักงาน หรือข้อมูลการทำงานในรอบนี้
                </div>
            ) : (
                groupedData.map((group, gIdx) => (
                    <div key={gIdx} className={styles.card} style={{ marginBottom: 24, overflow: "hidden" }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "var(--gray-50)", display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--red)" }}></div>
                            <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-display)" }}>{group.title}</h2>
                            <span style={{ color: "var(--text3)", fontSize: 14, fontWeight: 500 }}>({group.totalCount} คน)</span>
                            <div style={{ flex: 1 }}></div>
                            <button className={styles.btnSecondary} style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4, background: "#10b981", color: "white", borderColor: "#10b981" }} onClick={() => {
                                const allItems = group.divisions.flatMap(d => d.items);
                                handleExportExcel(group.title, allItems);
                            }}>
                                ดาวน์โหลด Excel
                            </button>
                            <button className={styles.btnSecondary} style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => {
                                const allItems = group.divisions.flatMap(d => d.items);
                                handlePublishBatch(group.title, allItems, false);
                            }} disabled={publishing || loading}>
                                ยกเลิก Publish ทั้งหมด
                            </button>
                            <button className={styles.btnPrimary} style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => {
                                const allItems = group.divisions.flatMap(d => d.items);
                                handlePublishBatch(group.title, allItems, true);
                            }} disabled={publishing || loading}>
                                <PaperAirplaneIcon width={14} /> Publish ทั้งหมด
                            </button>
                        </div>
                        {group.divisions.map((div, dIdx) => (
                            <div key={dIdx} style={{ padding: "0 20px 20px 20px" }}>
                                <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                                    <AcademicCapIcon width={16} style={{ color: "var(--blue)" }} />
                                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text2)" }}>ฝ่าย: {div.name}</h3>
                                    <span style={{ fontSize: 12, color: "var(--text4)" }}>({div.items.length} คน)</span>
                                </div>
                                <div className={styles.tableWrap}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>พนักงาน (ID)</th>
                                                <th>ตำแหน่ง & แผนก</th>
                                                <th className={styles.thRight} title="หากมีการปรับฐานเงินเดือนรอบนี้ จะแสดงเป็นสีส้ม">เงินเดือน (฿)</th>
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>เงินประจำตำแหน่ง</th>
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>เบี้ยเลี้ยง/สวัสดิการ</th>
                                                <th>เงื่อนไข OT</th>
                                                <th className={styles.thRight} style={{ minWidth: 120 }}>OT ปกติ 1.5x (ชม)</th>
                                                <th className={styles.thRight} style={{ minWidth: 120 }}>ทำวันหยุด 1x (ชม)</th>
                                                <th className={styles.thRight} style={{ minWidth: 120 }}>OT วันหยุด 3x (ชม)</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>เบี้ยขยัน</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>ค่าอาหาร</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>ค่าเดินทาง</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>ค่าที่พัก</th>
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>เบี้ยเลี้ยง Off-Site</th>

                                                <th className={styles.thRight} style={{ minWidth: 90 }}>ค่าโทรศัพท์</th>
                                                {month === 12 && (
                                                    <th className={styles.thRight} style={{ minWidth: 100 }}>โบนัสอายุงาน</th>
                                                )}
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>OT+วันหยุด</th>
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>คอมมิชชั่น</th>
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>โบนัส</th>
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>รายได้อื่นๆ</th>
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>ค่าเที่ยวขับรถ</th>
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>สวัสดิการอื่นๆ</th>
                                                <th className={styles.thRight} style={{ minWidth: 100 }}>รวมรายได้สุทธิ</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>หักประกันสังคม</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>หัก กยศ.</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>ประกันทำงาน</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>ขาดงาน</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>ภาษี</th>
                                                <th className={styles.thRight} style={{ minWidth: 90 }}>หักอื่นๆ</th>
                                                <th className={styles.thRight}>รวมรับจริง (฿)</th>
                                                <th>บัญชีรับเงิน</th>
                                                <th>จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {div.items.map(p => (
                                                <tr key={p.emp_id}>
                                                    <td style={{ whiteSpace: "nowrap" }}>
                                                        <span className={styles.bold}>{p.name}</span> <span style={{ fontSize: 12, color: "var(--text3)" }}>({p.emp_id})</span>
                                                    </td>
                                                    <td style={{ whiteSpace: "nowrap" }}>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                            <span>{p.position}</span>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                                <span style={{ fontSize: 12, color: "var(--text3)" }}>{p.department}</span>
                                                                {p.is_on_trial ? (
                                                                    <span style={{ fontSize: 10, color: "var(--red)", background: "rgba(239, 68, 68, 0.1)", padding: "1px 4px", borderRadius: 4 }}>ทดลองงาน</span>
                                                                ) : (
                                                                    <span style={{ fontSize: 10, color: "var(--ok)", background: "rgba(16, 185, 129, 0.1)", padding: "1px 4px", borderRadius: 4 }}>พนักงานประจำ</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Salary */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-override_salary` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "override_salary" }); setTempValue(p.is_salary_overridden ? String(p.base_salary) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "override_salary" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "override_salary", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "override_salary", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <div style={{ color: p.is_salary_overridden ? "var(--orange)" : "inherit", fontWeight: p.is_salary_overridden ? 600 : "normal" }} title={p.is_salary_overridden ? `ปรับฐานเงินเดือนสำหรับรอบนี้ (ฐานเดิม: ${formatB(p.base_salary_original)})` : ""}>
                                                                {formatB(p.base_salary)}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Position Allowance */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-position_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "position_allowance_override" }); setTempValue(p.position_allowance > 0 ? String(p.position_allowance) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "position_allowance_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "position_allowance_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "position_allowance_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.position_allowance > 0 ? "var(--purple)" : "inherit" }}>
                                                                {p.position_allowance > 0 ? formatB(p.position_allowance) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* General Allowance */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-general_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "general_allowance_override" }); setTempValue(p.general_allowance > 0 ? String(p.general_allowance) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "general_allowance_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "general_allowance_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "general_allowance_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.general_allowance > 0 ? "var(--purple)" : "inherit" }}>
                                                                {p.general_allowance > 0 ? formatB(p.general_allowance) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td>
                                                        <span className={p.is_ot_eligible ? styles.badgeOk : styles.badgeErr}>
                                                            {p.ot_rule}
                                                        </span>
                                                    </td>

                                                    {/* OT 1.5x */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-normal_1_5x_hours_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "normal_1_5x_hours_override" }); setTempValue(p.normal_1_5x_hours > 0 ? String(p.normal_1_5x_hours) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "normal_1_5x_hours_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "normal_1_5x_hours_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "normal_1_5x_hours_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <div style={{ fontWeight: 600, color: p.normal_1_5x_hours > 0 ? "var(--ok)" : "inherit" }}>
                                                                {p.normal_1_5x_hours > 0 ? `${p.normal_1_5x_hours} ชม.` : "-"}
                                                                {p.normal_ot_pay > 0 && <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 6 }}>({formatB(p.normal_ot_pay)} ฿)</span>}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* OT 1x */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-holiday_1_x_hours_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "holiday_1_x_hours_override" }); setTempValue(p.holiday_1x_hours > 0 ? String(p.holiday_1x_hours) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "holiday_1_x_hours_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "holiday_1_x_hours_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "holiday_1_x_hours_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <div style={{ fontWeight: 600, color: p.holiday_1x_hours > 0 ? "var(--blue)" : "inherit" }}>
                                                                {p.holiday_1x_hours > 0 ? `${p.holiday_1x_hours} ชม.` : "-"}
                                                                {p.holiday_1x_pay > 0 && <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 6 }}>({formatB(p.holiday_1x_pay)} ฿)</span>}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* OT 3x */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-holiday_3_x_hours_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "holiday_3_x_hours_override" }); setTempValue(p.holiday_3x_hours > 0 ? String(p.holiday_3x_hours) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "holiday_3_x_hours_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "holiday_3_x_hours_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "holiday_3_x_hours_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <div style={{ fontWeight: 600, color: p.holiday_3x_hours > 0 ? "var(--red)" : "inherit" }}>
                                                                {p.holiday_3x_hours > 0 ? `${p.holiday_3x_hours} ชม.` : "-"}
                                                                {p.holiday_3x_pay > 0 && <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 6 }}>({formatB(p.holiday_3x_pay)} ฿)</span>}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Diligence */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-diligence_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "diligence_allowance_override" }); setTempValue(p.diligence_allowance > 0 ? String(p.diligence_allowance) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "diligence_allowance_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "diligence_allowance_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "diligence_allowance_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <>
                                                                <span style={{ fontWeight: 600, color: p.diligence_allowance > 0 ? "var(--ok)" : "var(--text4)" }}>
                                                                    {p.diligence_allowance > 0 ? formatB(p.diligence_allowance) : "0"}
                                                                </span>
                                                                {p.diligence_allowance === 0 && p.diligence_failed_reason && (
                                                                    <span style={{ fontSize: 10, color: "var(--text4)", marginLeft: 6 }}>({p.diligence_failed_reason})</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>

                                                    {/* Meal */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-meal_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "meal_allowance_override" }); setTempValue(p.meal_allowance > 0 ? String(p.meal_allowance) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "meal_allowance_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "meal_allowance_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "meal_allowance_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.meal_allowance > 0 ? "var(--ink)" : "inherit" }}>
                                                                {p.meal_allowance > 0 ? formatB(p.meal_allowance) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Travel */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-travel_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "travel_allowance_override" }); setTempValue(p.travel_allowance > 0 ? String(p.travel_allowance) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "travel_allowance_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "travel_allowance_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "travel_allowance_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.travel_allowance > 0 ? "var(--ink)" : "inherit" }}>
                                                                {p.travel_allowance > 0 ? formatB(p.travel_allowance) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Accommodation */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-accommodation_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "accommodation_allowance_override" }); setTempValue(p.accommodation_allowance > 0 ? String(p.accommodation_allowance) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "accommodation_allowance_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "accommodation_allowance_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "accommodation_allowance_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.accommodation_allowance > 0 ? "var(--ink)" : "inherit" }}>
                                                                {p.accommodation_allowance > 0 ? formatB(p.accommodation_allowance) : "-"}
                                                                {p.truck_hotel_allowance_max && p.truck_hotel_allowance_max > 0 ? (
                                                                    <div style={{ fontSize: "10px", color: "var(--teal)", marginTop: "2px" }}>(Max {formatB(p.truck_hotel_allowance_max)})</div>
                                                                ) : null}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Travel Site */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-travel_site_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "travel_site_allowance_override" }); setTempValue(p.travel_site_allowance > 0 ? String(p.travel_site_allowance) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "travel_site_allowance_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "travel_site_allowance_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "travel_site_allowance_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.travel_site_allowance > 0 ? "var(--blue)" : "inherit" }}>
                                                                {p.travel_site_allowance > 0 ? formatB(p.travel_site_allowance) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Phone */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-phone_allowance_override` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "phone_allowance_override" }); setTempValue(p.telephone_allowance > 0 ? String(p.telephone_allowance) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "phone_allowance_override" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "phone_allowance_override", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "phone_allowance_override", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.telephone_allowance > 0 ? "var(--ink)" : "inherit" }}>
                                                                {p.telephone_allowance > 0 ? formatB(p.telephone_allowance) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {month === 12 && (
                                                        <td className={styles.thRight}>
                                                            <span style={{ fontWeight: 600, color: p.long_service_allowance > 0 ? "var(--purple)" : "inherit" }}>
                                                                {p.long_service_allowance > 0 ? formatB(p.long_service_allowance) : "-"}
                                                            </span>
                                                        </td>
                                                    )}

                                                    <td className={styles.tdRight} style={{ fontWeight: 600, color: (p.ot_amount + (p.holiday_allowance || 0)) > 0 ? "var(--ok)" : "inherit" }}>
                                                        {formatB(p.ot_amount + (p.holiday_allowance || 0))}
                                                    </td>

                                                    {/* Commissions */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-commissions` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "commissions" }); setTempValue(p.commissions > 0 ? String(p.commissions) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "commissions" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "commissions", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "commissions", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.commissions > 0 ? "var(--ok)" : "inherit" }}>
                                                                {p.commissions > 0 ? formatB(p.commissions) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Bonus */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-bonus` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "bonus" }); setTempValue(p.bonus > 0 ? String(p.bonus) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "bonus" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "bonus", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "bonus", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.bonus > 0 ? "var(--ok)" : "inherit" }}>
                                                                {p.bonus > 0 ? formatB(p.bonus) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Other Benefits (Adjustments) */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-other_benefits` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "other_benefits" }); setTempValue(p.other_benefits > 0 ? String(p.other_benefits) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "other_benefits" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "other_benefits", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "other_benefits", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.other_benefits > 0 ? "var(--ok)" : "inherit" }}>
                                                                {p.other_benefits > 0 ? formatB(p.other_benefits) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Truck Trip Fee */}
                                                    <td className={styles.tdRight}>
                                                        <span style={{ fontWeight: 600, color: p.truck_trip_fee && p.truck_trip_fee > 0 ? "var(--ok)" : "inherit" }}>
                                                            {p.truck_trip_fee && p.truck_trip_fee > 0 ? formatB(p.truck_trip_fee) : "-"}
                                                        </span>
                                                    </td>

                                                    {/* General Welfare (Automated) */}
                                                    <td className={styles.tdRight}>
                                                        <span style={{ fontWeight: 600, color: p.welfare_amount > 0 ? "var(--purple)" : "inherit" }}>
                                                            {p.welfare_amount > 0 ? formatB(p.welfare_amount) : "-"}
                                                        </span>
                                                    </td>

                                                    <td className={styles.tdRight}>
                                                        <div style={{ fontWeight: 500 }}>{formatB(p.gross_pay)}</div>
                                                    </td>

                                                    {/* Social Security */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-social_security` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "social_security" }); setTempValue(p.social_security > 0 ? String(p.social_security) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "social_security" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "social_security", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "social_security", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.social_security > 0 ? "var(--red)" : "inherit" }}>
                                                                {p.social_security > 0 ? "-" + formatB(p.social_security) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Student Loan */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-student_loan` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "student_loan" }); setTempValue(p.student_loan > 0 ? String(p.student_loan) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "student_loan" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "student_loan", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "student_loan", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.student_loan > 0 ? "var(--red)" : "inherit" }}>
                                                                {p.student_loan > 0 ? "-" + formatB(p.student_loan) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Insurance */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-insurance` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "insurance" }); setTempValue(p.insurance > 0 ? String(p.insurance) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "insurance" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "insurance", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "insurance", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.insurance > 0 ? "var(--red)" : "inherit" }}>
                                                                {p.insurance > 0 ? "-" + formatB(p.insurance) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Absenteeism */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-unpaid_absenteeism` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "unpaid_absenteeism" }); setTempValue(p.unpaid_absenteeism > 0 ? String(p.unpaid_absenteeism) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "unpaid_absenteeism" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "unpaid_absenteeism", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "unpaid_absenteeism", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.unpaid_absenteeism > 0 ? "var(--red)" : "inherit" }}>
                                                                {p.unpaid_absenteeism > 0 ? "-" + formatB(p.unpaid_absenteeism) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Tax */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-tax` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "tax" }); setTempValue(p.tax > 0 ? String(p.tax) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "tax" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "tax", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "tax", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.tax > 0 ? "var(--red)" : "inherit" }}>
                                                                {p.tax > 0 ? "-" + formatB(p.tax) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Other Deductions */}
                                                    <td className={`${styles.tdRight} ${styles.editableCell} ${quickSaving === `${p.emp_id}-other_deductions` ? styles.cellSaving : ""}`}
                                                        onClick={() => { setActiveCell({ empId: p.emp_id, field: "other_deductions" }); setTempValue(p.other_deductions > 0 ? String(p.other_deductions) : ""); }}>
                                                        {activeCell?.empId === p.emp_id && activeCell?.field === "other_deductions" ? (
                                                            <input autoFocus className={styles.cellInput} type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={() => handleQuickSave(p, "other_deductions", tempValue)} onKeyDown={e => { if (e.key === "Enter") handleQuickSave(p, "other_deductions", tempValue); if (e.key === "Escape") setActiveCell(null); }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 600, color: p.other_deductions > 0 ? "var(--red)" : "inherit" }}>
                                                                {p.other_deductions > 0 ? "-" + formatB(p.other_deductions) : "-"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className={styles.tdRight}>
                                                        <div style={{ fontWeight: 600, color: "var(--purple)", fontSize: 16 }}>
                                                            {formatB(p.net_pay)}
                                                        </div>
                                                    </td>
                                                    <td style={{ whiteSpace: "nowrap" }}>
                                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.bank_name}</div>
                                                        <div style={{ fontSize: 12, color: "var(--text3)" }}>{p.bank_account_no}</div>
                                                    </td>
                                                    <td style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                                        <button className={styles.btnSecondary} style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => window.open(`/api/payroll/50twi?year=${year}&emp_id=${p.emp_id}&mode=draft`, "_blank")}>
                                                            <ArrowDownTrayIcon width={14} /> ร่าง 50 ทวิ
                                                        </button>
                                                        <button className={styles.btnSecondary} style={{ padding: "4px 8px", fontSize: 12, color: 'var(--blue)' }} onClick={() => handleIssue50Twi(p.emp_id, year)}>
                                                            ออก 50 ทวิ
                                                        </button>
                                                        <button className={styles.btnSecondary} style={{ padding: "4px 8px", fontSize: 12, color: 'var(--green)' }} onClick={() => window.open(`/api/payroll/50twi?year=${year}&emp_id=${p.emp_id}&mode=issued`, "_blank")}>
                                                            <ArrowDownTrayIcon width={14} /> โหลดตัวจริง
                                                        </button>
                                                        <button className={styles.btnSecondary} style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => openEditModal(p)}>
                                                            <PencilSquareIcon width={14} /> จัดการ
                                                        </button>
                                                        <button
                                                            className={p.is_published ? styles.btnSecondary : styles.btnPrimary}
                                                            style={{ padding: "4px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: "4px" }}
                                                            onClick={() => handlePublish(p.emp_id, !p.is_published)}
                                                            disabled={publishing || loading}
                                                        >
                                                            {p.is_published ? "ยกเลิก Publish" : <><PaperAirplaneIcon width={12} /> Publish</>}
                                                        </button>
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

            {showModal && editingEmp && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: "800px", width: "95%" }}>
                        <div className={styles.modalHeader}>
                            <h2>ปรับแก้ข้อมูลเงินเดือน (รอบเดือน {month}/{year})</h2>
                            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text4)" }}>
                                พนักงาน: <span style={{ color: "var(--text1)", fontWeight: 700 }}>{editingEmp.name}</span>
                            </p>
                        </div>

                        <div className={styles.modalBody} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {/* Section: Salary & OT */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <BanknotesIcon width={18} style={{ color: 'var(--blue)' }} /> ฐานเงินเดือน และการทำงานล่วงเวลา
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                                    <div className={styles.formGroup}>
                                        <label>เงินเดือน (Override)</label>
                                        <input className={styles.input} type="number" value={editForm.override_salary} onChange={e => setEditForm({ ...editForm, override_salary: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.base_salary)}`} />
                                    </div>

                                    <div>
                                        <label className={styles.lbl}>เงินเบี้ยเลี้ยง/สวัสดิการ (ทั่วไป)</label>
                                        <input className={styles.input} type="number" value={editForm.general_allowance_override} onChange={e => setEditForm({ ...editForm, general_allowance_override: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.general_allowance)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>OT ปกติ 1.5x (ชม.)</label>
                                        <input className={styles.input} type="number" value={editForm.normal_1_5x_hours_override} onChange={e => setEditForm({ ...editForm, normal_1_5x_hours_override: e.target.value })} placeholder={`ปัจจุบัน: ${editingEmp.normal_1_5x_hours}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>ทำวันหยุด 1x (ชม.)</label>
                                        <input className={styles.input} type="number" value={editForm.holiday_1_x_hours_override} onChange={e => setEditForm({ ...editForm, holiday_1_x_hours_override: e.target.value })} placeholder={`ปัจจุบัน: ${editingEmp.holiday_1x_hours}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>OT วันหยุด 3x (ชม.)</label>
                                        <input className={styles.input} type="number" value={editForm.holiday_3_x_hours_override} onChange={e => setEditForm({ ...editForm, holiday_3_x_hours_override: e.target.value })} placeholder={`ปัจจุบัน: ${editingEmp.holiday_3x_hours}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Allowances */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <PlusCircleIcon width={18} style={{ color: 'var(--ok)' }} /> เงินบวกเพิ่ม / สวัสดิการ
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                                    <div className={styles.formGroup}>
                                        <label>เงินประจำตำแหน่ง</label>
                                        <input className={styles.input} type="number" value={editForm.position_allowance_override} onChange={e => setEditForm({ ...editForm, position_allowance_override: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.position_allowance)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>เบี้ยขยัน</label>
                                        <input className={styles.input} type="number" value={editForm.diligence_allowance_override} onChange={e => setEditForm({ ...editForm, diligence_allowance_override: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.diligence_allowance)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>ค่าอาหาร</label>
                                        <input className={styles.input} type="number" value={editForm.meal_allowance_override} onChange={e => setEditForm({ ...editForm, meal_allowance_override: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.meal_allowance)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>ค่าเดินทาง</label>
                                        <input className={styles.input} type="number" value={editForm.travel_allowance_override} onChange={e => setEditForm({ ...editForm, travel_allowance_override: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.travel_allowance)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>ค่าที่พัก</label>
                                        <input className={styles.input} type="number" value={editForm.accommodation_allowance_override} onChange={e => setEditForm({ ...editForm, accommodation_allowance_override: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.accommodation_allowance)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>เบี้ยเลี้ยง Off-Site</label>
                                        <input className={styles.input} type="number" value={editForm.travel_site_allowance_override} onChange={e => setEditForm({ ...editForm, travel_site_allowance_override: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.travel_site_allowance)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>ค่าที่พัก (Claim)</label>
                                        <input className={styles.input} type="number" value={editForm.travel_accommodation_override} onChange={e => setEditForm({ ...editForm, travel_accommodation_override: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.travel_accommodation)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>ค่าโทรศัพท์</label>
                                        <input className={styles.input} type="number" value={editForm.phone_allowance_override} onChange={e => setEditForm({ ...editForm, phone_allowance_override: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.telephone_allowance)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>คอมมิชชั่น</label>
                                        <input className={styles.input} type="number" value={editForm.commissions} onChange={e => setEditForm({ ...editForm, commissions: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.commissions)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>โบนัส</label>
                                        <input className={styles.input} type="number" value={editForm.bonus} onChange={e => setEditForm({ ...editForm, bonus: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.bonus)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>รายได้อื่นๆ</label>
                                        <input className={styles.input} type="number" value={editForm.other_benefits} onChange={e => setEditForm({ ...editForm, other_benefits: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.other_benefits)}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Deductions */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <MinusCircleIcon width={18} style={{ color: 'var(--red)' }} /> รายการหัก
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                                    <div className={styles.formGroup}>
                                        <label>หักประกันสังคม</label>
                                        <input className={styles.input} type="number" value={editForm.social_security} onChange={e => setEditForm({ ...editForm, social_security: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.social_security)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>หัก กยศ.</label>
                                        <input className={styles.input} type="number" value={editForm.student_loan} onChange={e => setEditForm({ ...editForm, student_loan: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.student_loan)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>ประกันทำงาน</label>
                                        <input className={styles.input} type="number" value={editForm.insurance} onChange={e => setEditForm({ ...editForm, insurance: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.insurance)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>หักขาดงาน</label>
                                        <input className={styles.input} type="number" value={editForm.unpaid_absenteeism} onChange={e => setEditForm({ ...editForm, unpaid_absenteeism: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.unpaid_absenteeism)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>ภาษี</label>
                                        <input className={styles.input} type="number" value={editForm.tax} onChange={e => setEditForm({ ...editForm, tax: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.tax)}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>หักอื่นๆ</label>
                                        <input className={styles.input} type="number" value={editForm.other_deductions} onChange={e => setEditForm({ ...editForm, other_deductions: e.target.value })} placeholder={`ปัจจุบัน: ${formatB(editingEmp.other_deductions)}`} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>ยกเลิก</button>
                            <button className={styles.btnPrimary} onClick={saveAdjustments} disabled={saving}>
                                {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
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
