"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
    ChevronLeftIcon,
    CheckBadgeIcon,
    InformationCircleIcon,
    ArrowPathIcon,
    UserCircleIcon,
    TableCellsIcon
} from "@heroicons/react/24/solid";
import styles from "./page.module.css";

export default function KPISelfRatePage() {
    const { id } = useParams();
    const router = useRouter();

    const [evaluation, setEvaluation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [items, setItems] = useState<any[]>([]);
    const [comment, setComment] = useState("");

    useEffect(() => {
        fetch("/api/kpi")
            .then(r => r.json())
            .then(data => {
                if (data.ok) {
                    const found = data.list.find((e: any) => e.id === Number(id));
                    if (found) {
                        setEvaluation(found);
                        setItems(found.items.map((it: any) => ({
                            ...it,
                            result_description: it.result_description || "",
                            employee_score: it.employee_score || 0
                        })));
                        setComment(found.employee_comment || "");
                    }
                }
            })
            .finally(() => setLoading(false));
    }, [id]);

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = async () => {
        const incomplete = items.find(it => !it.result_description || it.employee_score === 0);
        if (incomplete) {
            alert("กรุณาระบุผลงานและคะแนนประเมินตนเองให้ครบทุกหัวข้อ");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/kpi/self-rate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    evaluation_id: Number(id),
                    items,
                    employee_comment: comment
                })
            });

            if (res.ok) {
                router.push("/kpi?success=true");
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
                    <h1 className={styles.heroH1}>ประเมินตนเอง (Self-Rating)</h1>
                    <button onClick={() => router.back()} className={styles.btnBack}>
                        <ChevronLeftIcon width={14} /> ย้อนกลับ
                    </button>
                </div>

                <div className={styles.guide}>
                    <InformationCircleIcon width={20} />
                    <span>กรุณากรอกผลงานและประเมินคะแนน (1-5) ตามเกณฑ์ที่กำหนด</span>
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
                    </div>
                </div>

                <div className={styles.itemsList}>
                    {items.map((item, index) => (
                        <div key={item.id} className={styles.card}>
                            <div className={styles.itemHeader}>
                                <div className={styles.itemTitle}>หัวข้อที่ {index + 1}: {item.objective}</div>
                                <div className={styles.weightBadge}>{item.weight}%</div>
                            </div>
                            
                            <div className={styles.itemContent}>
                                <div className={styles.indicatorBox}>
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
                                
                                <div className={styles.inputGroup} style={{ marginTop: 20 }}>
                                    <label>ระบุผลลัพธ์ที่ทำได้จริง (Performance Result)</label>
                                    <textarea 
                                        rows={3} 
                                        value={item.result_description} 
                                        onChange={e => updateItem(index, "result_description", e.target.value)}
                                        placeholder="อธิบายว่าคุณทำอะไรสำเร็จบ้างตามเป้าหมายนี้..."
                                    />
                                </div>

                                <div className={styles.scoreSection}>
                                    <label>ประเมินตนเอง (คะแนน 1-5)</label>
                                    <div className={styles.scoreButtons}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <button 
                                                key={s}
                                                className={`${styles.scoreBtn} ${item.employee_score === s ? styles.active : ""}`}
                                                onClick={() => updateItem(index, "employee_score", s)}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span> ข้อความถึงผู้บังคับบัญชา (Remarks)</span>
                    </div>
                    <div className={styles.inputGroup}>
                        <textarea 
                            rows={3} 
                            value={comment} 
                            onChange={e => setComment(e.target.value)} 
                            placeholder="ระบุความคิดเห็นเพิ่มเติมของคุณ..."
                        />
                    </div>
                </div>

                <button 
                    className={styles.btnSubmit}
                    onClick={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? "กำลังส่งข้อมูล..." : "ส่งผลการประเมินให้หัวหน้า"}
                </button>
            </div>
        </div>
    );
}
