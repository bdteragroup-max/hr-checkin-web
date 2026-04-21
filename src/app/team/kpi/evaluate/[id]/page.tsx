"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
    ChevronLeftIcon,
    ChatBubbleLeftRightIcon,
    UserCircleIcon,
    ArrowPathIcon,
    TableCellsIcon
} from "@heroicons/react/24/solid";
import styles from "./page.module.css";

export default function KPISupervisorEvaluatePage() {
    const { id } = useParams();
    const router = useRouter();

    const [evaluation, setEvaluation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [items, setItems] = useState<any[]>([]);
    const [comment, setComment] = useState("");

    useEffect(() => {
        fetch("/api/admin/kpi")
            .then(r => r.json())
            .then(data => {
                if (data.ok) {
                    const found = data.list.find((e: any) => e.id === Number(id));
                    if (found) {
                        setEvaluation(found);
                        setItems(found.items.map((it: any) => ({
                            ...it,
                            supervisor_score: it.supervisor_score || it.employee_score || 0
                        })));
                        setComment(found.supervisor_comment || "");
                    }
                }
            })
            .finally(() => setLoading(false));
    }, [id]);

    const totalEmployeeScore = useMemo(() => {
        return items.reduce((sum, it) => sum + (Number(it.weight) / 100) * (it.employee_score || 0), 0);
    }, [items]);

    const totalSupervisorScore = useMemo(() => {
        return items.reduce((sum, it) => sum + (Number(it.weight) / 100) * (it.supervisor_score || 0), 0);
    }, [items]);

    const grade = useMemo(() => {
        const score = totalSupervisorScore;
        if (score >= 4.5) return "A";
        if (score >= 3.5) return "B";
        if (score >= 2.5) return "C";
        if (score >= 1.5) return "D";
        return "E";
    }, [totalSupervisorScore]);

    const updateItem = (index: number, value: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], supervisor_score: value };
        setItems(newItems);
    };

    const handleSubmit = async () => {
        const incomplete = items.find(it => it.supervisor_score === 0);
        if (incomplete) {
            alert("กรุณาให้คะแนนประเมินให้ครบทุกหัวข้อ");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/team/kpi/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    evaluation_id: Number(id),
                    items,
                    supervisor_comment: comment
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

    if (!evaluation) return <div className={styles.loading}>ไม่พบข้อมูล</div>;

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>ประเมินผล KPI</h1>
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
                            <div style={{ fontWeight: 800, fontSize: 16 }}>{evaluation.employee?.name}</div>
                            <div style={{ fontSize: 12, color: '#94A3B8' }}>{evaluation.emp_id} · {evaluation.employee?.job_positions?.title}</div>
                        </div>
                    </div>
                    
                    <div className={styles.divider} />
                    
                    <div className={styles.row}>
                        <div className={styles.inputGroup}>
                            <label>รอบการประเมิน (Session)</label>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#D93025' }}>ครั้งที่ {evaluation.evaluation_no}</div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>วันที่ประเมิน</label>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{evaluation.evaluation_date ? new Date(evaluation.evaluation_date).toLocaleDateString("th-TH") : "-"}</div>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 2: RUBRIC ── */}
                <div className={styles.sectionLabel}>
                    <div className={styles.dot} />
                    <span> รายการพิจารณา (KPI Rubric)</span>
                </div>

                <div className={styles.itemsList}>
                    {items.map((item, index) => (
                        <div key={item.id} className={styles.card}>
                            <div className={styles.itemHeader}>
                                <div className={styles.itemTitle}>หัวข้อที่ {index + 1}: {item.objective}</div>
                                <div className={styles.weightBadge}>{item.weight}%</div>
                            </div>
                            
                            <div className={styles.itemContent}>
                                <div className={styles.indicatorGrid}>
                                    <div className={styles.indicatorLabel}>ตัวชี้วัด / เกณฑ์การพิจารณา:</div>
                                    <div className={styles.indicatorVal}>{item.indicator}</div>
                                </div>

                                {/* --- Rubric Table --- */}
                                <div className={styles.rubricTable}>
                                    <div className={styles.rubricTHead}>
                                        <div>Rating 1</div>
                                        <div>Rating 2</div>
                                        <div>Rating 3</div>
                                        <div>Rating 4</div>
                                        <div>Rating 5</div>
                                    </div>
                                    <div className={styles.rubricTBody}>
                                        <div>{item.target_1 || "-"}</div>
                                        <div>{item.target_2 || "-"}</div>
                                        <div>{item.target_3 || "-"}</div>
                                        <div>{item.target_4 || "-"}</div>
                                        <div>{item.target_5 || "-"}</div>
                                    </div>
                                </div>
                                
                                <div className={styles.employeeResult}>
                                    <div className={styles.resHeader}>
                                        <ChatBubbleLeftRightIcon width={14} />
                                        <span>ผลการดำเนินงานที่พนักงานระบุ (Self-Report)</span>
                                    </div>
                                    <div className={styles.resVal}>{item.result_description || "ไม่มีข้อมูล"}</div>
                                    <div className={styles.selfScoreRow}>
                                        <span>พนักงานให้คะแนนตนเอง:</span>
                                        <strong>{item.employee_score} / 5</strong>
                                    </div>
                                    <div className={styles.weightedRow}>
                                        <span>คะแนนถ่วงน้ำหนัก (พนักงาน):</span>
                                        <strong>{((Number(item.weight) / 100) * (item.employee_score || 0)).toFixed(2)}</strong>
                                    </div>
                                </div>

                                <div className={styles.scoreSection}>
                                    <label>คะแนนจากหัวหน้างาน (1 - 5)</label>
                                    <div className={styles.scoreButtons}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <button 
                                                key={s}
                                                className={`${styles.scoreBtn} ${item.supervisor_score === s ? styles.active : ""}`}
                                                onClick={() => updateItem(index, s)}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                    <div className={styles.weightedRow} style={{ marginTop: 12, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>คะแนนถ่วงน้ำหนัก (หัวหน้า):</span>
                                        <strong style={{ fontSize: 14, color: '#D93025' }}>{((Number(item.weight) / 100) * (item.supervisor_score || 0)).toFixed(2)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span> ความคิดเห็น/คำแนะนำ (Remarks)</span>
                    </div>
                    <div className={styles.inputGroup}>
                        <textarea 
                            rows={4} 
                            value={comment} 
                            onChange={e => setComment(e.target.value)} 
                            placeholder="ระบุความคิดเห็นเพื่อกระตุ้นผลงานและคำแนะนำเพิ่มเติม..."
                        />
                    </div>
                </div>

                {/* --- STICKY SUMMARY SHELF --- */}
                <div className={styles.summarySticky}>
                    <div className={styles.dualScoreBox}>
                        <div className={styles.scoreLine}>
                            <span className={styles.scoreLabel}>Employee:</span>
                            <span className={styles.scoreValSmall}>{totalEmployeeScore.toFixed(2)}</span>
                        </div>
                        <div className={styles.scoreLineLarge}>
                            <span className={styles.scoreLabelLarge}>Supervisor:</span>
                            <span className={styles.scoreValLarge}>{totalSupervisorScore.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div className={styles.gradeBox}>
                        <div className={styles.gradeVal}>{grade}</div>
                        <div style={{ fontSize: 9, fontWeight: 800, textAlign: 'center', color: '#94A3B8' }}>GRADE</div>
                    </div>
                    
                    <button 
                        className={styles.btnSubmit}
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? "..." : "บันทึกผล"}
                    </button>
                </div>
            </div>
        </div>
    );
}
