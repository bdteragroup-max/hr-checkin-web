"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

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
    net_pay: number;
    bank_name: string;
    bank_account_no: string;
    is_on_trial: boolean;
};

export default function PayrollPage() {
    const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
    const [year, setYear] = useState(new Date().getFullYear());
    const [data, setData] = useState<PayrollResult[]>([]);
    const [cycle, setCycle] = useState<{ start: string; end: string } | null>(null);
    const [loading, setLoading] = useState(true);

    async function loadData() {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/payroll?month=${month}&year=${year}`);
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

    const formatB = (num: number) => new Intl.NumberFormat("th-TH").format(Math.round(num));

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

            <div className={styles.card}>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>พนักงาน (ID)</th>
                                <th>ตำแหน่ง & แผนก</th>
                                <th className={styles.thRight}>เงินเดือน (฿)</th>
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
                                <th className={styles.thRight}>รวมสุทธิ (฿)</th>
                                <th>บัญชีรับเงิน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={9} className={styles.empty}>ไม่มีข้อมูลพนักงาน หรือข้อมูลการทำงานในรอบนี้</td>
                                </tr>
                            )}
                            {data.map(p => (
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
                                    <td className={styles.tdRight}>{formatB(p.base_salary)}</td>
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
                                        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{formatB(p.net_pay)}</span>
                                    </td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.bank_name}</span> <span style={{ fontSize: 12, color: "var(--text3)" }}>{p.bank_account_no}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
