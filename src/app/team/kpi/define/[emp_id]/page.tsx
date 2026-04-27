"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    calculateProbationDates
} from "@/utils/probationCalculations";
import {
    ArrowPathIcon,
    ChevronLeftIcon,
    UserCircleIcon,
    InformationCircleIcon,
    PlusIcon,
    TrashIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon
} from "@heroicons/react/24/solid";
import styles from "./page.module.css";

interface KPIItem {
    id?: number;
    objective: string;
    indicator: string;
    weight: number;
    target_1: string;
    target_2: string;
    target_3: string;
    target_4: string;
    target_5: string;
    section: string;
}

export default function KPIDefinePage() {
    const { emp_id } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const category = searchParams.get("category") || "PROBATION";

    const [empInfo, setEmpInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [items, setItems] = useState<KPIItem[]>([
        { objective: "", indicator: "", weight: 0, target_1: "", target_2: "", target_3: "", target_4: "", target_5: "", section: "KPI" }
    ]);
    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");
    const [sessionName, setSessionName] = useState(category === "ANNUAL" ? "Mid-Year Assessment" : "");
    const [year, setYear] = useState(new Date().getUTCFullYear());
    const [currentRound, setCurrentRound] = useState<number>(1);

    useEffect(() => {
        if (category === "ANNUAL") {
            if (sessionName === "Mid-Year Assessment") {
                setPeriodStart(`${year}-01-01`);
                setPeriodEnd(`${year}-06-30`);
            } else {
                setPeriodStart(`${year}-07-01`);
                setPeriodEnd(`${year}-12-31`);
            }
        } else if (category === "MONTHLY") {
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            setPeriodStart(`${y}-${m.toString().padStart(2, '0')}-01`);
            const lastDay = new Date(y, m, 0).getDate();
            setPeriodEnd(`${y}-${m.toString().padStart(2, '0')}-${lastDay}`);
        }
    }, [category, sessionName, year]);

    useEffect(() => {
        fetch(`/api/team/kpi/employee/${emp_id}`)
            .then(r => r.json())
            .then(data => {
                if (data.ok && data.employee) {
                    setEmpInfo(data.employee);
                    const isLeader = (data.employee._count?.subordinates || 0) > 0;

                    const existing = data.employee.kpi_evaluations?.find((ev: any) =>
                        ev.category === category && (ev.status === 'draft' || ev.status === 'pending_employee' || ev.status === 'pending_supervisor')
                    );

                    if (existing) {
                        setItems(existing.items || []);
                        if (category !== "ANNUAL") {
                            setPeriodStart(existing.period_start ? existing.period_start.split('T')[0] : "");
                            setPeriodEnd(existing.period_end ? existing.period_end.split('T')[0] : "");
                        }
                        setSessionName(existing.session_name || (category === 'ANNUAL' ? 'Mid-Year Assessment' : ''));
                        setYear(existing.year || new Date().getUTCFullYear());
                        if (category === "PROBATION" || category === "MONTHLY") {
                            setCurrentRound(existing.evaluation_no || (category === "MONTHLY" ? new Date().getMonth() + 1 : 1));
                        }
                    } else {
                        const commonItems: KPIItem[] = [
                            { objective: "ผลงานตามเป้าหมายหลัก (Main KPIs)", indicator: "วัดผลตามความสำเร็จของเป้าหมายที่กำหนด", weight: 100, target_1: "", target_2: "", target_3: "", target_4: "", target_5: "", section: "KPI" },
                            { objective: "1. คุณภาพงาน (Quality)", indicator: "ปฏิบัติงานมีประสิทธิภาพและประสิทธิผล มองเห็นได้ชัดเจน", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "2. ปริมาณงาน (Quantity)", indicator: "ควบคุมและเพิ่มเติมปริมาณงาน ดูแลงานที่มือให้เพียงพอ", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "3. ความตั้งใจ / ความขยัน / ความทุ่มเท", indicator: "มีความทุ่มเทให้คุณหน้าที่รับผิดชอบให้เกิดประโยชน์สูงสุด", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "4. ความรอบรู้ / ความเข้าใจในงาน", indicator: "สามารถแก้ไขปัญหาและเข้าใจในหน้าที่งานของตนเอง", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "5. การเรียนรู้ / การพัฒนาตนเอง / การปรับตัว", indicator: "สามารถเรียนรู้สิ่งใหม่ๆ และพร้อมพัฒนาตนเอง", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "6. การเชื่อฟังคำแนะนำ / คำสั่ง", indicator: "สามารถปฏิบัติตามคำสั่งและยอมรับเหตุผลในการโต้แย้ง", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "7. ความรับผิดชอบ / ความเชื่อถือ / ความไว้วางใจได้", indicator: "ปฏิบัติงานแบบมืออาชีพแสดงให้เห็นถึงความน่าเชื่อถือ", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "8. ความคิดเริ่มสร้างสรรค์ / ข้อคิดเห็นที่เป็นประโยชน์", indicator: "เสนอความคิดเห็นต่างๆ ที่เป็นประโยชน์ต่อบริษัท", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "9. สัมพันธภาพในการทำงาน / มนุษยสัมพันธ์", indicator: "มนุษยสัมพันธ์ที่ดีกับเพื่อนร่วมงาน", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "10. การรักษาระเบียบวินัย / ข้อบังคับของบริษัท", indicator: "ปฏิบัติตัวภายใต้กฎระเบียบของบริษัท", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "11. การใช้ / การดูแล / การบำรุงรักษา เครื่องมือ/ทรัพย์สิน", indicator: "ดูแลทรัพย์สินบริษัทเป็นอย่างดี ไม่ทำลายทรัพย์สิน", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "12. เข้าร่วมกิจกรรมของบริษัท", indicator: "ให้ความร่วมมือเข้าร่วมกิจกรรมต่างๆ", weight: 0, target_1: "Poor", target_2: "Fair", target_3: "Good", target_4: "V.Good", target_5: "Excellent", section: "CORE_VALUE" },
                            { objective: "13. มาสาย (Lateness)", indicator: "มาทำงานตรงเวลาตามที่บริษัทกำหนด", weight: 0, target_1: ">11 ครั้ง", target_2: "6-10 ครั้ง", target_3: "3-5 ครั้ง", target_4: "1-2 ครั้ง", target_5: "0 ครั้ง", section: "CORE_VALUE" },
                            { objective: "14. ลาป่วย (Sick Leave)", indicator: "สถิติการลาป่วย", weight: 0, target_1: ">5 ครั้ง", target_2: "3-4 ครั้ง", target_3: "2 ครั้ง", target_4: "1 ครั้ง", target_5: "0 ครั้ง", section: "CORE_VALUE" },
                            { objective: "15. ลากิจ (Personal Leave)", indicator: "สถิติการลากิจ", weight: 0, target_1: ">5 ครั้ง", target_2: "3-4 ครั้ง", target_3: "2 ครั้ง", target_4: "1-2 ครั้ง", target_5: "0 ครั้ง", section: "CORE_VALUE" }
                        ];

                        if (isLeader) {
                            commonItems.push(
                                { objective: "1. การบริหารการเปลี่ยนแปลง (Change Management)", indicator: "สนับสนุนวิธีการใหม่ๆ และสร้างโอกาสในการปรับปรุงและพัฒนา", weight: 0, target_1: "L1", target_2: "L2", target_3: "L3", target_4: "L4", target_5: "L5", section: "COMPETENCY" },
                                { objective: "2. การสร้างและบริหารทีม (Building a Successful Team)", indicator: "กำหนดทิศทาง เป้าหมาย และโครงสร้างบทบาทความรับผิดชอบที่ชัดเจน", weight: 0, target_1: "L1", target_2: "L2", target_3: "L3", target_4: "L4", target_5: "L5", section: "COMPETENCY" },
                                { objective: "3. การพัฒนาผู้อื่น (Developing Others)", indicator: "วางแผนและสนับสนุนการพัฒนารายบุคคล และให้ข้อมูลป้อนกลับ", weight: 0, target_1: "L1", target_2: "L2", target_3: "L3", target_4: "L4", target_5: "L5", section: "COMPETENCY" },
                                { objective: "4. การแก้ไขปัญหาและการตัดสินใจ (Problem Solving & Decision Making)", indicator: "ระบุประเด็นปัญหา เปรียบเทียบข้อมูล และเลือกวิธีการแก้ไขที่เหมาะสม", weight: 0, target_1: "L1", target_2: "L2", target_3: "L3", target_4: "L4", target_5: "L5", section: "COMPETENCY" },
                                { objective: "5. การบริหารผลการปฏิบัติงาน (Managing Performances)", indicator: "กำหนดเป้าหมาย ติดตามผล และประเมินผลการปฏิบัติงานร่วมกับทีม", weight: 0, target_1: "L1", target_2: "L2", target_3: "L3", target_4: "L4", target_5: "L5", section: "COMPETENCY" }
                            );
                        }

                        if (category === "PROBATION") {
                            const completedRounds = data.employee.kpi_evaluations?.filter((ev: any) => ev.category === "PROBATION" && ev.status === 'completed').length || 0;
                            const roundNo = completedRounds + 1;
                            setCurrentRound(roundNo);
                            const dates = calculateProbationDates(data.employee.hire_date, roundNo);
                            setPeriodStart(dates.start);
                            setPeriodEnd(dates.end);
                            setItems([{ objective: "ผลงานตามเป้าหมายหลัก (Main KPIs)", indicator: "วัดผลตามความสำเร็จของเป้าหมายที่กำหนด", weight: 100, target_1: "", target_2: "", target_3: "", target_4: "", target_5: "", section: "KPI" }]);
                        } else if (category === "MONTHLY") {
                            const monthNo = new Date().getMonth() + 1;
                            setCurrentRound(monthNo);
                            setItems([{ objective: "ผลงานตามเป้าหมายหลัก (Main KPIs)", indicator: "วัดผลตามความสำเร็จของเป้าหมายที่กำหนด", weight: 100, target_1: "", target_2: "", target_3: "", target_4: "", target_5: "", section: "KPI" }]);
                        } else if (category === "ANNUAL") {
                            // Logic to auto-detect if we should start Year-End
                            const midYear = data.employee.kpi_evaluations?.find((ev: any) => 
                                ev.category === 'ANNUAL' && 
                                (ev.session_name?.includes('Mid-Year')) && 
                                ev.year === year
                            );
                            
                            if (midYear && midYear.status === 'completed') {
                                setSessionName("Year-End Assessment");
                            } else {
                                setSessionName("Mid-Year Assessment");
                            }

                            setItems(commonItems);
                        }
                    }
                }
            })
            .finally(() => setLoading(false));
    }, [emp_id, category]);

    const p1Weight = useMemo(() => {
        return items.filter(it => it.section === "KPI").reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
    }, [items]);

    const addItem = (section: string = "KPI") => {
        setItems([...items, { objective: "", indicator: "", weight: 0, target_1: "", target_2: "", target_3: "", target_4: "", target_5: "", section }]);
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const updateItem = (index: number, field: keyof KPIItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = async () => {
        if (Math.abs(p1Weight - 100) > 0.05) {
            alert("น้ำหนักรวมในส่วนที่ 1 (KPI) ต้องเท่ากับ 100% (ปัจจุบัน: " + p1Weight.toFixed(2) + "%)");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/team/kpi/define", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emp_id,
                    items,
                    period_start: periodStart,
                    period_end: periodEnd,
                    category,
                    year,
                    session_name: category === "PROBATION" ? `Round ${currentRound}` : (category === "MONTHLY" ? `KPI เดือน ${currentRound}/${year}` : sessionName)
                })
            });

            if (res.ok) {
                router.push("/team/kpi?success=true");
            } else {
                const data = await res.json();
                alert(data.error || "เกิดข้อผิดพลาด");
            }
        } catch (e) {
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className={styles.loading}>
        <ArrowPathIcon width={40} className="animate-spin mx-auto mb-4 opacity-10" />
        <div style={{ fontWeight: 700 }}>กำลังโหลด...</div>
    </div>;

    if (!empInfo) return <div className={styles.loading}>ไม่พบข้อมูลพนักงาน</div>;

    const isLeader = (empInfo?._count?.subordinates || 0) > 0;

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>
                        {category === "ANNUAL" ? "นิยาม KPI ประจำปี" : (category === "MONTHLY" ? "นิยาม KPI ประจำเดือน" : "นิยาม KPI ทดลองงาน")}
                    </h1>
                    <button onClick={() => router.back()} className={styles.btnBack}>
                        <ChevronLeftIcon width={14} /> ย้อนกลับ
                    </button>
                </div>

                {/* ── SECTION 1: INFO ── */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span>ข้อมูลพนักงาน</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserCircleIcon width={32} color="var(--red)" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 16 }}>{empInfo.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{empInfo.emp_id} · {empInfo.job_positions?.title}</div>
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>รอบการประเมิน / ปี</label>
                        {category === "ANNUAL" ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <select value={sessionName} onChange={e => setSessionName(e.target.value)} style={{ flex: 1 }}>
                                    <option value="Mid-Year Assessment">Mid-Year Assessment (ครึ่งปีแรก)</option>
                                    <option value="Year-End Assessment">Year-End Assessment (ปลายปี)</option>
                                </select>
                                <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 100 }} />
                            </div>
                        ) : category === "MONTHLY" ? (
                            <input disabled value={`KPI เดือน ${currentRound}/${year}`} />
                        ) : (
                            <input disabled value={`Probation Round ${currentRound}`} />
                        )}
                    </div>

                    <div className={styles.inputGroup}>
                        <label>ช่วงเวลาประเมิน (Period)</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="date"
                                value={periodStart}
                                onChange={e => setPeriodStart(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <span>-</span>
                            <input
                                type="date"
                                value={periodEnd}
                                onChange={e => setPeriodEnd(e.target.value)}
                                style={{ flex: 1 }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── SECTION 2: ITEMS ── */}
                {["KPI", "CORE_VALUE", "COMPETENCY", "DEVELOPMENT"].map((sec) => {
                    const secItems = items.filter(it => it.section === sec);
                    if ((category === "PROBATION" || category === "MONTHLY") && sec !== "KPI") return null;
                    if (sec === "COMPETENCY" && !isLeader) return null;
                    if (sec === "DEVELOPMENT" && category !== "ANNUAL") return null;

                    return (
                        <div key={sec}>
                            <div className={styles.sectionLabel} style={{ marginTop: 24, marginBottom: 16 }}>
                                <div className={styles.dot} />
                                <span>
                                    {sec === "KPI" ? (category === "PROBATION" ? "ส่วนที่ 1 เป้าหมายการปฏิบัติงาน" : "ส่วนที่ 1 เป้าหมายการปฏิบัติงาน (Performance KPIs - 70%)") :
                                        sec === "CORE_VALUE" ? `ส่วนที่ 2 คุณลักษณะส่วนบุคคลตามค่านิยมของบริษัท (${isLeader ? '20%' : '30%'})` :
                                            sec === "COMPETENCY" ? "ส่วนที่ 3 คุณลักษณะความเป็นผู้นำ (Leadership Qualities - 10%)" :
                                                "ส่วนที่ 4 เป้าหมายการพัฒนาตนเอง (Personal Development Goals)"}
                                </span>
                            </div>

                            {items.map((item, index) => {
                                if (item.section !== sec) return null;
                                return (
                                    <div key={index} className={styles.card}>
                                        <div className={styles.itemHeader}>
                                            <div className={styles.itemTitle}>หัวข้อที่ {index + 1} {item.section !== 'KPI' && item.section !== 'DEVELOPMENT' ? "(Standard Criteria)" : ""}</div>
                                            {(item.section === 'KPI') && (
                                                <button onClick={() => removeItem(index)} className={styles.btnRemove}>
                                                    <TrashIcon width={18} />
                                                </button>
                                            )}
                                        </div>

                                        <div className={styles.grid3}>
                                            <div className={styles.inputGroup}>
                                                <label>{sec === "DEVELOPMENT" ? "สิ่งที่จะพัฒนา" : "หัวข้อการประเมิน"}</label>
                                                <input
                                                    value={item.objective}
                                                    onChange={e => updateItem(index, "objective", e.target.value)}
                                                    placeholder={sec === "DEVELOPMENT" ? "เช่น พัฒนาทักษะ..." : "เป้าหมาย..."}
                                                    disabled={item.section === 'DEVELOPMENT' || item.section !== 'KPI'}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>{sec === "DEVELOPMENT" ? "เป้าหมายและวิธีการพัฒนา" : "ตัวชี้วัด"}</label>
                                                <input
                                                    value={item.indicator}
                                                    onChange={e => updateItem(index, "indicator", e.target.value)}
                                                    placeholder={sec === "DEVELOPMENT" ? "เช่น เรียนรู้เพิ่มเติม..." : "เกณฑ์วัดผล..."}
                                                    disabled={item.section === 'DEVELOPMENT' || item.section !== 'KPI'}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>{sec === "DEVELOPMENT" ? "ระยะเวลาการพัฒนา" : "น้ำหนัก (%)"}</label>
                                                {sec === "DEVELOPMENT" ? (
                                                    <input
                                                        value={item.target_1}
                                                        onChange={e => updateItem(index, "target_1", e.target.value)}
                                                        placeholder="เช่น มกราคม - ธันวาคม..."
                                                    />
                                                ) : (
                                                    <input
                                                        type="number"
                                                        value={item.weight}
                                                        onChange={e => updateItem(index, "weight", Number(e.target.value))}
                                                        disabled={item.section !== 'KPI'}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {sec !== "DEVELOPMENT" && (
                                            <div className={styles.rubricGrid}>
                                                {[1, 2, 3, 4, 5].map(lv => (
                                                    <div key={lv} className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                                        <label>Rating {lv}</label>
                                                        <input
                                                            value={(item as any)[`target_${lv}`]}
                                                            onChange={e => updateItem(index, `target_${lv}` as any, e.target.value)}
                                                            placeholder="..."
                                                            style={{ fontSize: 11, padding: '8px' }}
                                                            disabled={item.section !== 'KPI'}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                             {sec === 'KPI' && (
                                <button onClick={() => addItem(sec)} className={styles.btnAddFull}>
                                    <PlusIcon width={16} /> เพิ่มหัวข้อใหม่
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* ── SUMMARY ── */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span>สถานะน้ำหนัก (Weight Status)</span>
                    </div>
                    <div className={styles.weightSummary}>
                        <div className={styles.weightRow}>
                            <span>น้ำหนักรวมส่วนที่ 1:</span>
                            <span style={{ color: Math.abs(p1Weight - 100) < 0.1 ? 'var(--ok)' : 'var(--red)', fontWeight: 800 }}>{p1Weight.toFixed(2)}%</span>
                        </div>
                        {Math.abs(p1Weight - 100) > 0.1 && (
                            <div className={styles.weightWarning}>
                                <ExclamationTriangleIcon width={16} />
                                <span>ต้องรวมให้ได้ 100%</span>
                            </div>
                        )}
                    </div>
                    <button
                        className={styles.btnSubmit}
                        onClick={handleSubmit}
                        disabled={submitting || Math.abs(p1Weight - 100) > 0.1}
                    >
                        {submitting ? "กำลังบันทึก..." : "ยืนยันการตั้งค่า"}
                    </button>
                </div>
            </div>
        </div>
    );
}
