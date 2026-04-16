"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { PencilSquareIcon, BanknotesIcon, PlusCircleIcon, MinusCircleIcon, AcademicCapIcon, AdjustmentsHorizontalIcon, CheckCircleIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

type PayrollResult = {
    emp_id: string;
    name: string;
    department: string;
    position: string;
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
    base_salary_original: number;
    is_salary_overridden: boolean;
    gross_pay: number;
    net_pay: number;
    bank_name: string;
    bank_account_no: string;
    is_on_trial: boolean;
    is_published?: boolean;
    raw_adjustments?: any;
};

export default function PayrollPage() {
    const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
    const [year, setYear] = useState(new Date().getFullYear());
    const [data, setData] = useState<PayrollResult[]>([]);
    const [cycle, setCycle] = useState<{ start: string; end: string; is_published?: boolean } | null>(null);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);

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
        travel_site_allowance_override: "",
        travel_accommodation_override: "",
        social_security: "",
        student_loan: "",
        insurance: "",
        unpaid_absenteeism: "",
        tax: "",
        commissions: "",
        bonus: "",
        other_deductions: "",
        other_benefits: ""
    });
    const [saving, setSaving] = useState(false);

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
                loadData();
            } else {
                alert("Failed to save adjustments");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving");
        }
        setSaving(false);
    };

    async function loadData() {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/payroll?month=${month}&year=${year}`);
            if (res.status === 401) {
                window.location.href = "/admin/login";
                return;
            }
            if (res.ok) {
                const d = await res.json();
                setData(d.list);
                setCycle(d.cycle);
            } else {
                alert("Failed to load payroll data");
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }


    useEffect(() => {
        loadData();
    }, [month, year]);

    const handlePublish = async (emp_id: string, publishStatus: boolean) => {
        if (!confirm(publishStatus ? `ยืนยันการเผยแพร่สลิปเงินเดือนให้พนักงานคนนี้?` : `ยืนยันการยกเลิกเผยแพร่?`)) return;
        setPublishing(true);
        try {
            const res = await fetch("/api/admin/payroll/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month, year, emp_id, is_published: publishStatus })
            });
            if (res.ok) {
                loadData();
            } else {
                alert("เกิดข้อผิดพลาด");
            }
        } catch (e) {
            alert("Error");
        }
        setPublishing(false);
    };

    const handlePublishBatch = async (companyTitle: string, items: PayrollResult[], targetStatus: boolean) => {
        if (!confirm(`ยืนยันการ${targetStatus ? 'เผยแพร่' : 'ยกเลิกเผยแพร่'}สลิปเงินเดือนทั้งหมดให้กับพนักงานใน ${companyTitle} จำนวน ${items.length} คน?`)) return;
        setPublishing(true);
        try {
            let changesMade = false;
            for (const emp of items) {
                if (Boolean(emp.is_published) === targetStatus) continue;
                changesMade = true;
                await fetch("/api/admin/payroll/publish", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ month, year, emp_id: emp.emp_id, is_published: targetStatus })
                });
            }
            if (changesMade) loadData();
        } catch (e) {
            alert("เกิดข้อผิดพลาดในการตั้งค่า");
        }
        setPublishing(false);
    };

    const formatB = (num: number) => new Intl.NumberFormat("th-TH").format(Math.round(num));

    const groupedData = [
        { title: "บริษัท เทอรา กรุ๊ป จำกัด (TG)", items: data.filter(d => d.emp_id.toUpperCase().startsWith("TG")) },
        { title: "บริษัท เทอรา อิเลคทริค จำกัด (TE)", items: data.filter(d => d.emp_id.toUpperCase().startsWith("TE")) },
        { title: "บริษัท เทอรา พาวเวอร์ จำกัด (TP)", items: data.filter(d => d.emp_id.toUpperCase().startsWith("TP")) },
        { title: "บริษัทอื่นๆ", items: data.filter(d => !["TG", "TE", "TP"].includes(d.emp_id.toUpperCase().substring(0, 2))) }
    ].filter(g => g.items.length > 0);

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
                            <span style={{ color: "var(--text3)", fontSize: 14, fontWeight: 500 }}>({group.items.length} คน)</span>
                            <div style={{ flex: 1 }}></div>
                            <button className={styles.btnSecondary} style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => handlePublishBatch(group.title, group.items, false)} disabled={publishing || loading}>
                                ยกเลิก Publish ทั้งหมด
                            </button>
                            <button className={styles.btnPrimary} style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => handlePublishBatch(group.title, group.items, true)} disabled={publishing || loading}>
                                <PaperAirplaneIcon width={14} /> Publish ทั้งหมด
                            </button>
                        </div>
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>พนักงาน (ID)</th>
                                <th>ตำแหน่ง & แผนก</th>
                                <th className={styles.thRight} title="หากมีการปรับฐานเงินเดือนรอบนี้ จะแสดงเป็นสีส้ม">เงินเดือน (฿)</th>
                                <th className={styles.thRight} style={{ minWidth: 100 }}>เงินประจำตำแหน่ง</th>
                                <th>เงื่อนไข OT</th>
                                <th className={styles.thRight} style={{ minWidth: 120 }}>OT ปกติ 1.5x (ชม)</th>
                                <th className={styles.thRight} style={{ minWidth: 120 }}>ทำวันหยุด 1x (ชม)</th>
                                <th className={styles.thRight} style={{ minWidth: 120 }}>OT วันหยุด 3x (ชม)</th>
                                <th className={styles.thRight} style={{ minWidth: 90 }}>เบี้ยขยัน</th>
                                <th className={styles.thRight} style={{ minWidth: 90 }}>ค่าอาหาร</th>
                                <th className={styles.thRight} style={{ minWidth: 90 }}>ค่าเดินทาง</th>
                                <th className={styles.thRight} style={{ minWidth: 90 }}>ค่าที่พัก</th>
                                <th className={styles.thRight} style={{ minWidth: 100 }}>เบี้ยเลี้ยง Off-Site</th>
                                <th className={styles.thRight} style={{ minWidth: 100 }}>ค่าที่พัก (Claim)</th>
                                <th className={styles.thRight} style={{ minWidth: 90 }}>ค่าโทรศัพท์</th>
                                {month === 12 && (
                                    <th className={styles.thRight} style={{ minWidth: 100 }}>โบนัสอายุงาน</th>
                                )}
                                <th className={styles.thRight} style={{ minWidth: 100 }}>OT+วันหยุด</th>
                                <th className={styles.thRight} style={{ minWidth: 100 }}>คอมมิชชั่น</th>
                                <th className={styles.thRight} style={{ minWidth: 100 }}>โบนัส</th>
                                <th className={styles.thRight} style={{ minWidth: 100 }}>รายได้อื่นๆ</th>
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
                            {group.items.map(p => (
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
                                    <td className={styles.tdRight}>
                                        <div style={{ color: p.is_salary_overridden ? "var(--orange)" : "inherit", fontWeight: p.is_salary_overridden ? 600 : "normal" }} title={p.is_salary_overridden ? `ปรับฐานเงินเดือนสำหรับรอบนี้ (ฐานเดิม: ${formatB(p.base_salary_original)})` : ""}>
                                            {formatB(p.base_salary)}
                                        </div>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.position_allowance > 0 ? "var(--purple)" : "inherit" }}>
                                            {p.position_allowance > 0 ? formatB(p.position_allowance) : "-"}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={p.is_ot_eligible ? styles.badgeOk : styles.badgeErr}>
                                            {p.ot_rule}
                                        </span>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <div style={{ fontWeight: 600, color: p.normal_1_5x_hours > 0 ? "var(--ok)" : "inherit" }}>
                                            {p.normal_1_5x_hours > 0 ? `${p.normal_1_5x_hours} ชม.` : "-"}
                                            {p.normal_ot_pay > 0 && <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 6 }}>({formatB(p.normal_ot_pay)} ฿)</span>}
                                        </div>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <div style={{ fontWeight: 600, color: p.holiday_1x_hours > 0 ? "var(--blue)" : "inherit" }}>
                                            {p.holiday_1x_hours > 0 ? `${p.holiday_1x_hours} ชม.` : "-"}
                                            {p.holiday_1x_pay > 0 && <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 6 }}>({formatB(p.holiday_1x_pay)} ฿)</span>}
                                        </div>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <div style={{ fontWeight: 600, color: p.holiday_3x_hours > 0 ? "var(--red)" : "inherit" }}>
                                            {p.holiday_3x_hours > 0 ? `${p.holiday_3x_hours} ชม.` : "-"}
                                            {p.holiday_3x_pay > 0 && <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 6 }}>({formatB(p.holiday_3x_pay)} ฿)</span>}
                                        </div>
                                    </td>

                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.diligence_allowance > 0 ? "var(--ok)" : "var(--text4)" }}>
                                            {p.diligence_allowance > 0 ? formatB(p.diligence_allowance) : "0"}
                                        </span>
                                        {p.diligence_allowance === 0 && p.diligence_failed_reason && (
                                            <span style={{ fontSize: 10, color: "var(--text4)", marginLeft: 6 }}>({p.diligence_failed_reason})</span>
                                        )}
                                    </td>

                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.meal_allowance > 0 ? "var(--ink)" : "inherit" }}>
                                            {p.meal_allowance > 0 ? formatB(p.meal_allowance) : "-"}
                                        </span>
                                    </td>

                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.travel_allowance > 0 ? "var(--ink)" : "inherit" }}>
                                            {p.travel_allowance > 0 ? formatB(p.travel_allowance) : "-"}
                                        </span>
                                    </td>

                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.accommodation_allowance > 0 ? "var(--ink)" : "inherit" }}>
                                            {p.accommodation_allowance > 0 ? formatB(p.accommodation_allowance) : "-"}
                                        </span>
                                    </td>

                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.travel_site_allowance > 0 ? "var(--blue)" : "inherit" }}>
                                            {p.travel_site_allowance > 0 ? formatB(p.travel_site_allowance) : "-"}
                                        </span>
                                    </td>

                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.travel_accommodation > 0 ? "var(--blue)" : "inherit" }}>
                                            {p.travel_accommodation > 0 ? formatB(p.travel_accommodation) : "-"}
                                        </span>
                                    </td>

                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.telephone_allowance > 0 ? "var(--ink)" : "inherit" }}>
                                            {p.telephone_allowance > 0 ? formatB(p.telephone_allowance) : "-"}
                                        </span>
                                    </td>

                                    {month === 12 && (
                                        <td className={styles.tdRight}>
                                            <span style={{ fontWeight: 600, color: p.long_service_allowance > 0 ? "var(--purple)" : "inherit" }}>
                                                {p.long_service_allowance > 0 ? formatB(p.long_service_allowance) : "-"}
                                            </span>
                                        </td>
                                    )}

                                    <td className={styles.tdRight} style={{ fontWeight: 600, color: (p.ot_amount + (p.holiday_allowance || 0)) > 0 ? "var(--ok)" : "inherit" }}>
                                        {formatB(p.ot_amount + (p.holiday_allowance || 0))}
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.commissions > 0 ? "var(--ok)" : "inherit" }}>
                                            {p.commissions > 0 ? formatB(p.commissions) : "-"}
                                        </span>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.bonus > 0 ? "var(--ok)" : "inherit" }}>
                                            {p.bonus > 0 ? formatB(p.bonus) : "-"}
                                        </span>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.other_benefits > 0 ? "var(--ok)" : "inherit" }}>
                                            {p.other_benefits > 0 ? formatB(p.other_benefits) : "-"}
                                        </span>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <div style={{ fontWeight: 500 }}>{formatB(p.gross_pay)}</div>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.social_security > 0 ? "var(--red)" : "inherit" }}>
                                            {p.social_security > 0 ? "-" + formatB(p.social_security) : "-"}
                                        </span>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.student_loan > 0 ? "var(--red)" : "inherit" }}>
                                            {p.student_loan > 0 ? "-" + formatB(p.student_loan) : "-"}
                                        </span>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.insurance > 0 ? "var(--red)" : "inherit" }}>
                                            {p.insurance > 0 ? "-" + formatB(p.insurance) : "-"}
                                        </span>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.unpaid_absenteeism > 0 ? "var(--red)" : "inherit" }}>
                                            {p.unpaid_absenteeism > 0 ? "-" + formatB(p.unpaid_absenteeism) : "-"}
                                        </span>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.tax > 0 ? "var(--red)" : "inherit" }}>
                                            {p.tax > 0 ? "-" + formatB(p.tax) : "-"}
                                        </span>
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span style={{ fontWeight: 600, color: p.other_deductions > 0 ? "var(--red)" : "inherit" }}>
                                            {p.other_deductions > 0 ? "-" + formatB(p.other_deductions) : "-"}
                                        </span>
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
                                        <BanknotesIcon width={18} /> รายได้หลัก และ OT (ชั่วโมง)
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ฐานเงินเดือนรอบนี้</label>
                                            <input className={styles.inputElement} type="number" value={editForm.override_salary} onChange={e => setEditForm({ ...editForm, override_salary: e.target.value })} placeholder={formatB(editingEmp.base_salary_original)} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>OT ปกติ 1.5x (ชม.)</label>
                                            <input className={styles.inputElement} type="number" value={editForm.normal_1_5x_hours_override} onChange={e => setEditForm({ ...editForm, normal_1_5x_hours_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ทำงานวันหยุด 1x (ชม.)</label>
                                            <input className={styles.inputElement} type="number" value={editForm.holiday_1_x_hours_override} onChange={e => setEditForm({ ...editForm, holiday_1_x_hours_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>OT วันหยุด 3x (ชม.)</label>
                                            <input className={styles.inputElement} type="number" value={editForm.holiday_3_x_hours_override} onChange={e => setEditForm({ ...editForm, holiday_3_x_hours_override: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <hr style={{ border: '0', borderTop: '1px solid var(--line)', marginBottom: 24 }} />

                                {/* Section: Allowances */}
                                <div style={{ marginBottom: 24 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <PlusCircleIcon width={18} /> ค่าตอบแทน และสวัสดิการ
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>เบี้ยขยัน</label>
                                            <input className={styles.inputElement} type="number" value={editForm.diligence_allowance_override} onChange={e => setEditForm({ ...editForm, diligence_allowance_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ค่าอาหาร</label>
                                            <input className={styles.inputElement} type="number" value={editForm.meal_allowance_override} onChange={e => setEditForm({ ...editForm, meal_allowance_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ค่าเดินทาง</label>
                                            <input className={styles.inputElement} type="number" value={editForm.travel_allowance_override} onChange={e => setEditForm({ ...editForm, travel_allowance_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ค่าที่พัก (สวัสดิการ)</label>
                                            <input className={styles.inputElement} type="number" value={editForm.accommodation_allowance_override} onChange={e => setEditForm({ ...editForm, accommodation_allowance_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ค่าโทรศัพท์</label>
                                            <input className={styles.inputElement} type="number" value={editForm.phone_allowance_override} onChange={e => setEditForm({ ...editForm, phone_allowance_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>เงินประจำตำแหน่ง</label>
                                            <input className={styles.inputElement} type="number" value={editForm.position_allowance_override} onChange={e => setEditForm({ ...editForm, position_allowance_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>เบี้ยเลี้ยง Off-Site</label>
                                            <input className={styles.inputElement} type="number" value={editForm.travel_site_allowance_override} onChange={e => setEditForm({ ...editForm, travel_site_allowance_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ค่าที่พัก (Claim)</label>
                                            <input className={styles.inputElement} type="number" value={editForm.travel_accommodation_override} onChange={e => setEditForm({ ...editForm, travel_accommodation_override: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ค่าคอมมิชชั่น</label>
                                            <input className={styles.inputElement} type="number" value={editForm.commissions} onChange={e => setEditForm({ ...editForm, commissions: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>โบนัส</label>
                                            <input className={styles.inputElement} type="number" value={editForm.bonus} onChange={e => setEditForm({ ...editForm, bonus: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>รายได้อื่นๆ</label>
                                            <input className={styles.inputElement} type="number" value={editForm.other_benefits} onChange={e => setEditForm({ ...editForm, other_benefits: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ประกันทำงาน (คืน)</label>
                                            <input className={styles.inputElement} type="number" value={editForm.insurance_income} onChange={e => setEditForm({ ...editForm, insurance_income: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <hr style={{ border: '0', borderTop: '1px solid var(--line)', marginBottom: 24 }} />

                                {/* Section: Deductions */}
                                <div>
                                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <MinusCircleIcon width={18} /> รายการหักเงิน
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ประกันสังคม</label>
                                            <input className={styles.inputElement} type="number" value={editForm.social_security} onChange={e => setEditForm({ ...editForm, social_security: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>กยศ.</label>
                                            <input className={styles.inputElement} type="number" value={editForm.student_loan} onChange={e => setEditForm({ ...editForm, student_loan: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ประกันทำงาน</label>
                                            <input className={styles.inputElement} type="number" value={editForm.insurance} onChange={e => setEditForm({ ...editForm, insurance: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ขาดงาน (หัก)</label>
                                            <input className={styles.inputElement} type="number" value={editForm.unpaid_absenteeism} onChange={e => setEditForm({ ...editForm, unpaid_absenteeism: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>ภาษี (หัก)</label>
                                            <input className={styles.inputElement} type="number" value={editForm.tax} onChange={e => setEditForm({ ...editForm, tax: e.target.value })} />
                                        </div>
                                        <div className={styles.inputField}>
                                            <label className={styles.inputLabel}>หักอื่นๆ</label>
                                            <input className={styles.inputElement} type="number" value={editForm.other_deductions} onChange={e => setEditForm({ ...editForm, other_deductions: e.target.value })} />
                                        </div>
                                    </div>
                                </div></div>

                            <div className={styles.modalFooter}>
                                <button className={styles.btnSecondary} onClick={() => setShowModal(false)} disabled={saving}>
                                    ยกเลิก
                                </button>
                                <button className={styles.btnPrimary} onClick={saveAdjustments} disabled={saving}>
                                    {saving ? "กำลังบันทึก..." : (
                                        <>
                                            <CheckCircleIcon width={18} /> ยืนยันปรับแก้
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
}
