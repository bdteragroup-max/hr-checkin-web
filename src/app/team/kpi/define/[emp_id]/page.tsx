"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
}

export default function KPIDefinePage() {
    const { emp_id } = useParams();
    const router = useRouter();

    const [empInfo, setEmpInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [items, setItems] = useState<KPIItem[]>([
        { objective: "", indicator: "", weight: 0, target_1: "", target_2: "", target_3: "", target_4: "", target_5: "" }
    ]);
    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");

    useEffect(() => {
        // Find employee info from the list
        fetch("/api/team/kpi/employees")
            .then(r => r.json())
            .then(data => {
                if (data.ok) {
                    const found = data.list.find((e: any) => e.emp_id === emp_id);
                    setEmpInfo(found);
                    if (found) {
                        const evalNo = (found.evaluations?.length || 0) + 1;
                        const dates = calculateProbationDates(found.hire_date, evalNo);
                        setPeriodStart(dates.start);
                        setPeriodEnd(dates.end);
                    }
                }
            })
            .finally(() => setLoading(false));
    }, [emp_id]);

    const totalWeight = useMemo(() => {
        return items.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
    }, [items]);

    const addItem = () => {
        setItems([...items, { objective: "", indicator: "", weight: 0, target_1: "", target_2: "", target_3: "", target_4: "", target_5: "" }]);
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
        if (Math.abs(totalWeight - 100) > 0.01) {
            alert("น้ำหนักรวมต้องเท่ากับ 100%");
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
                    period_end: periodEnd
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

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>กำหนดเป้าหมาย KPI</h1>
                    <button onClick={() => router.back()} className={styles.btnBack}>
                        <ChevronLeftIcon width={14} /> ย้อนกลับ
                    </button>
                </div>

                {/* ── SECTION 1: INFO ── */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span> ข้อมูลพนักงาน</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEE2E2', color: '#D93025', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserCircleIcon width={32} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 16 }}>{empInfo?.name}</div>
                            <div style={{ fontSize: 12, color: '#94A3B8' }}>{emp_id} · {empInfo?.position || "Staff"}</div>
                        </div>
                    </div>
                    
                    <div className={styles.divider} />
                    
                    <div className={styles.row}>
                        <div className={styles.inputGroup}>
                            <label>ตั้งแต่วันที่ (เริ่มรอบ)</label>
                            <input 
                                type="date" 
                                value={periodStart} 
                                readOnly 
                                style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>ถึงวันที่ (สิ้นสุดรอบ)</label>
                            <input 
                                type="date" 
                                value={periodEnd} 
                                readOnly
                                style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                            />
                        </div>
                    </div>
                    <div className={styles.probationTip}>
                        <InformationCircleIcon width={14} />
                        KPI รอบพนักงานทดลองงานอ้างอิงตามรอบประเมิน (รอบ 1: ~30 วัน / รอบ 2: ~60 วัน)
                    </div>
                </div>

                {/* ── SECTION 2: ITEMS ── */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span> รายการพิจารณา (KPI Items)</span>
                    </div>
                    
                    <div className={styles.itemsList}>
                        {items.map((item, index) => (
                            <div key={index} className={styles.itemCard}>
                                <div className={styles.itemHeader}>
                                    <span className={styles.itemNo}>หัวข้อที่ {index + 1}</span>
                                    <button onClick={() => removeItem(index)} className={styles.btnRemove}>
                                        <TrashIcon width={16} />
                                    </button>
                                </div>

                                <div className={styles.itemBody}>
                                    <div className={styles.inputGroup}>
                                        <label>เป้าหมายการปฏิบัติงาน (Objective)</label>
                                        <textarea 
                                            rows={2} 
                                            value={item.objective} 
                                            onChange={e => updateItem(index, "objective", e.target.value)}
                                            placeholder="ระบุเป้าหมาย..." 
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>ตัวชี้วัด (Indicator / Criteria)</label>
                                        <textarea 
                                            rows={2} 
                                            value={item.indicator} 
                                            onChange={e => updateItem(index, "indicator", e.target.value)}
                                            placeholder="ระบุเกณฑ์การวัดผล..." 
                                        />
                                    </div>
                                    <div className={styles.weightInput}>
                                        <label>น้ำหนัก (%)</label>
                                        <input 
                                            type="number" 
                                            value={item.weight} 
                                            onChange={e => updateItem(index, "weight", parseInt(e.target.value) || 0)} 
                                        />
                                    </div>

                                    <div className={styles.rubricSection}>
                                        <div className={styles.rubricHeaderRow}>
                                            <div className={styles.rubricLabel}>เกณฑ์การให้คะแนน (Scoring Metrics)</div>
                                            <div className={styles.templateButtons}>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        updateItem(index, "target_1", "<20%");
                                                        updateItem(index, "target_2", "20-29%");
                                                        updateItem(index, "target_3", "30-39%");
                                                        updateItem(index, "target_4", "40-49%");
                                                        updateItem(index, "target_5", "50%up");
                                                    }}
                                                >Ratio %</button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        updateItem(index, "target_1", "<85%");
                                                        updateItem(index, "target_2", "85%");
                                                        updateItem(index, "target_3", "90%");
                                                        updateItem(index, "target_4", "95%");
                                                        updateItem(index, "target_5", "100%");
                                                    }}
                                                >Achievement %</button>
                                            </div>
                                        </div>

                                        <div className={styles.rubricTable}>
                                            <div className={styles.rubricTHead}>
                                                <div>Rating 1</div>
                                                <div>Rating 2</div>
                                                <div>Rating 3</div>
                                                <div>Rating 4</div>
                                                <div>Rating 5</div>
                                            </div>
                                            <div className={styles.rubricTBody}>
                                                <input placeholder="..." value={item.target_1} onChange={e => updateItem(index, "target_1", e.target.value)} />
                                                <input placeholder="..." value={item.target_2} onChange={e => updateItem(index, "target_2", e.target.value)} />
                                                <input placeholder="..." value={item.target_3} onChange={e => updateItem(index, "target_3", e.target.value)} />
                                                <input placeholder="..." value={item.target_4} onChange={e => updateItem(index, "target_4", e.target.value)} />
                                                <input placeholder="..." value={item.target_5} onChange={e => updateItem(index, "target_5", e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button onClick={addItem} className={styles.btnAddFull}>
                        <PlusIcon width={16} /> เพิ่มหัวข้อตัวชี้วัดใหม่
                    </button>
                </div>

                {/* ── STICKY SHELF ── */}
                <div className={styles.summarySticky}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className={`${styles.totalVal} ${totalWeight !== 100 ? styles.textError : ""}`}>
                            {totalWeight}% 
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94A3B8' }}>น้ำหนักรวม</div>
                    </div>
                    
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                        {totalWeight === 100 ? (
                            <CheckCircleIcon width={32} color="#16a34a" />
                        ) : (
                            <ExclamationTriangleIcon width={32} color="#d93025" />
                        )}
                        
                        <button 
                            className={styles.btnSubmit}
                            onClick={handleSubmit}
                            disabled={submitting || totalWeight !== 100}
                        >
                            {submitting ? "..." : "ส่งให้พนักงาน"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
