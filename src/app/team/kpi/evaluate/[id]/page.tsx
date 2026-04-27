"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ChevronLeftIcon,
    ChatBubbleLeftRightIcon,
    UserCircleIcon,
    ArrowPathIcon,
    TableCellsIcon,
    CheckBadgeIcon
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
    const [recommendSalary, setRecommendSalary] = useState<boolean | null>(null);
    const [attendance, setAttendance] = useState<any>(null);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/team/kpi/evaluate?id=${id}`)
            .then(r => r.json())
            .then(async data => {
                if (data.ok) {
                    const found = data.evaluation;
                    setEvaluation(found);

                    let attendanceStats: any = null;
                    if (found.category === 'ANNUAL') {
                        const aRes = await fetch(`/api/team/kpi/attendance?emp_id=${found.emp_id}&start=${found.period_start}&end=${found.period_end}`);
                        const aData = await aRes.json();
                        if (aData.ok) {
                            attendanceStats = aData.stats;
                            setAttendance(aData.stats);
                        }
                    }

                    setItems(found.items.map((it: any) => {
                        let autoScore = it.supervisor_score || it.employee_score || 0;
                        let autoRes = it.result_description || "";

                        if (attendanceStats && (it.supervisor_score === 0 || !it.supervisor_score)) {
                            if (it.objective.includes("มาสาย")) {
                                autoScore = attendanceStats.latenessScore;
                                if (!autoRes) autoRes = `${attendanceStats.latenessCount} ครั้ง`;
                            }
                            else if (it.objective.includes("ลาป่วย")) {
                                autoScore = attendanceStats.sickLeaveScore;
                                if (!autoRes) autoRes = `${attendanceStats.sickLeaveCount} วัน`;
                            }
                            else if (it.objective.includes("ลากิจ")) {
                                autoScore = attendanceStats.personalLeaveScore;
                                if (!autoRes) autoRes = `${attendanceStats.personalLeaveCount} วัน`;
                            }
                        }
                        return { ...it, supervisor_score: autoScore, result_description: autoRes };
                    }));
                    setComment(found.supervisor_comment || "");
                    setRecommendSalary(found.recommend_salary ?? null);
                }
            })
            .finally(() => setLoading(false));
    }, [id]);

    const { totalSupervisorScore, grade, s1Supervisor, s23Supervisor, w1Pct, w23Pct } = useMemo(() => {
        const p1Items = items.filter(it => it.section === "KPI");
        const p2Items = items.filter(it => it.section === "CORE_VALUE");
        const p3Items = items.filter(it => it.section === "COMPETENCY");

        const isProbation = evaluation?.category === 'PROBATION';
        const isMonthly = evaluation?.category === 'MONTHLY';
        const hasP3 = p3Items.length > 0;

        let total = 0;
        let s1 = 0;
        let s23 = 0;
        let w1PctVal = 100;
        let w23PctVal = 0;

        if (isProbation || isMonthly) {
            s1 = p1Items.reduce((sum, it) => sum + (Number(it.weight) / 100) * (Number(it.supervisor_score) || 0), 0);
            total = s1;
            w1PctVal = 100;
            w23PctVal = 0;
        } else {
            const w1 = 0.70;
            const w2 = hasP3 ? 0.20 : 0.30;
            const w3 = hasP3 ? 0.10 : 0;

            s1 = p1Items.reduce((sum, it) => sum + (Number(it.weight) / 100) * (Number(it.supervisor_score) || 0), 0);
            const s2 = p2Items.length > 0 ? (p2Items.reduce((sum, it) => sum + (Number(it.supervisor_score) || 0), 0) / p2Items.length) : 0;
            const s3 = p3Items.length > 0 ? (p3Items.reduce((sum, it) => sum + (Number(it.supervisor_score) || 0), 0) / p3Items.length) : 0;

            total = (s1 * w1) + (s2 * w2) + (s3 * w3);
            s23 = (s2 * (w2 / (w2 + w3 || 1))) + (s3 * (w3 / (w2 + w3 || 1)));
            w1PctVal = w1 * 100;
            w23PctVal = (w2 + w3) * 100;
        }

        let g = "E";
        if (total >= 4.5) g = "A";
        else if (total >= 3.5) g = "B";
        else if (total >= 2.5) g = "C";
        else if (total >= 1.5) g = "D";

        return {
            totalSupervisorScore: total,
            grade: g,
            s1Supervisor: s1,
            s23Supervisor: s23,
            w1Pct: w1PctVal,
            w23Pct: w23PctVal
        };
    }, [items, evaluation]);

    useEffect(() => {
        if (evaluation?.category === 'MONTHLY' || evaluation?.category === 'PROBATION') {
            const isPassing = totalSupervisorScore >= 2.5;
            setRecommendSalary(isPassing);
        }
    }, [totalSupervisorScore, evaluation?.category]);

    const { s1Employee, s23Employee, totalEmployeeScore } = useMemo(() => {
        const p1Items = items.filter(it => it.section === "KPI");
        const p2Items = items.filter(it => it.section === "CORE_VALUE");
        const p3Items = items.filter(it => it.section === "COMPETENCY");

        const isProbation = evaluation?.category === 'PROBATION';
        const isMonthly = evaluation?.category === 'MONTHLY';
        const hasP3 = p3Items.length > 0;

        let total = 0;
        let s1 = 0;
        let s23 = 0;

        if (isProbation || isMonthly) {
            s1 = p1Items.reduce((sum, it) => sum + (Number(it.weight) / 100) * (Number(it.employee_score) || 0), 0);
            total = s1;
        } else {
            const w1 = 0.70;
            const w2 = hasP3 ? 0.20 : 0.30;
            const w3 = hasP3 ? 0.10 : 0;

            s1 = p1Items.reduce((sum, it) => sum + (Number(it.weight) / 100) * (Number(it.employee_score) || 0), 0);
            const s2 = p2Items.length > 0 ? (p2Items.reduce((sum, it) => sum + (Number(it.employee_score) || 0), 0) / p2Items.length) : 0;
            const s3 = p3Items.length > 0 ? (p3Items.reduce((sum, it) => sum + (Number(it.employee_score) || 0), 0) / p3Items.length) : 0;

            total = (s1 * w1) + (s2 * w2) + (s3 * w3);
            s23 = (s2 * (w2 / (w2 + w3 || 1))) + (s3 * (w3 / (w2 + w3 || 1)));
        }

        return {
            s1Employee: s1,
            s23Employee: s23,
            totalEmployeeScore: total
        };
    }, [items]);

    const updateItem = (index: number, value: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], supervisor_score: value };
        setItems(newItems);
    };

    const handleSubmit = async () => {
        const incomplete = items.find(it => it.section !== "DEVELOPMENT" && it.supervisor_score === 0);
        if (incomplete) {
            alert("กรุณาให้คะแนนประเมินให้ครบทุกหัวข้อ");
            return;
        }

        if (recommendSalary === null) {
            alert("กรุณาพิจารณาความเห็นเกี่ยวกับการปรับเงินเดือน");
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
                    supervisor_comment: comment,
                    recommend_salary: recommendSalary
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
                    <h1 className={styles.heroH1}>
                        {evaluation?.category === "ANNUAL" ? "ประเมินผล KPI ประจำปี" : (evaluation?.category === "MONTHLY" ? "ประเมินผล KPI ประจำเดือน" : "ประเมินผล KPI ทดลองงาน")}
                    </h1>
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
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#D93025' }}>
                                {evaluation.category === 'ANNUAL' ? (evaluation.session_name === 'Mid-Year' ? 'Mid-Year Assessment' : evaluation.session_name) : 
                                 evaluation.category === 'MONTHLY' ? `KPI เดือน ${evaluation.evaluation_no}/${evaluation.year || ''}` : `ครั้งที่ ${evaluation.evaluation_no}`}
                                {evaluation.category === 'ANNUAL' && <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>({evaluation.year})</span>}
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>วันที่ประเมิน</label>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{evaluation.evaluation_date ? new Date(evaluation.evaluation_date).toLocaleDateString("th-TH") : "-"}</div>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 2: RUBRIC ── */}
                {["KPI", "CORE_VALUE", "COMPETENCY"].map((sec) => {
                    const secItems = items.filter(it => it.section === sec);
                    if (secItems.length === 0) return null;
                    if ((evaluation.category === 'PROBATION' || evaluation.category === 'MONTHLY') && (sec === 'CORE_VALUE' || sec === 'COMPETENCY')) return null;

                    return (
                        <div key={sec}>
                            <div className={styles.sectionLabel} style={{ marginTop: 32, marginBottom: 16 }}>
                                <div className={styles.dot} />
                                <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {sec === "KPI" ? "ส่วนที่ 1 เป้าหมายการปฏิบัติงาน (Performance Objectives)" :
                                        sec === "CORE_VALUE" ? "ส่วนที่ 2 คุณลักษณะส่วนบุคคลตามค่านิยมของบริษัท (Personal Attributes According to Values)" :
                                            "ส่วนที่ 3 คุณลักษณะความเป็นผู้นำ (Leadership Qualities)"}
                                </span>
                            </div>

                            <div className={styles.itemsList}>
                                {items.map((item, index) => {
                                    if (item.section !== sec) return null;
                                    return (
                                        <div key={item.id} className={styles.card}>
                                            <div className={styles.itemHeader}>
                                                <div className={styles.itemTitle}>หัวข้อที่ {index + 1}: {item.objective}</div>
                                                <div className={styles.weightBadge}>{item.weight}%</div>
                                            </div>

                                            <div className={styles.itemContent}>
                                                {/* --- Locked Badge for Attendance --- */}
                                                {(item.objective.includes("มาสาย") || item.objective.includes("ลาป่วย") || item.objective.includes("ลากิจ")) && (
                                                    <div className={styles.lockedBadge}>
                                                        <CheckBadgeIcon width={14} />
                                                        <span>
                                                            คะแนนคำนวณจากระบบอัตโนมัติ (Locked) 
                                                            {attendance && (
                                                                <strong style={{ marginLeft: 8, color: '#1e293b' }}>
                                                                    — สถิติ: {
                                                                        item.objective.includes("มาสาย") ? `${attendance.latenessCount} ครั้ง` :
                                                                        item.objective.includes("ลาป่วย") ? `${attendance.sickLeaveCount} วัน` :
                                                                        item.objective.includes("ลากิจ") ? `${attendance.personalLeaveCount} วัน` : ""
                                                                    }
                                                                </strong>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
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
                                                                onClick={() => {
                                                                    if (!(item.objective.includes("มาสาย") || item.objective.includes("ลาป่วย") || item.objective.includes("ลากิจ"))) {
                                                                        updateItem(index, s);
                                                                    }
                                                                }}
                                                                style={{
                                                                    opacity: (item.objective.includes("มาสาย") || item.objective.includes("ลาป่วย") || item.objective.includes("ลากิจ")) && item.supervisor_score !== s ? 0.4 : 1,
                                                                    cursor: (item.objective.includes("มาสาย") || item.objective.includes("ลาป่วย") || item.objective.includes("ลากิจ")) ? 'not-allowed' : 'pointer'
                                                                }}
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
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {(evaluation.category === 'ANNUAL') && (
                <div key="DEVELOPMENT">
                    <div className={styles.sectionLabel} style={{ marginTop: 32, marginBottom: 16 }}>
                        <div className={styles.dot} />
                        <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            ส่วนที่ 4 เป้าหมายการพัฒนาตนเอง  (Personal Development Goals)
                        </span>
                    </div>

                    {items.filter(it => it.section === "DEVELOPMENT").length === 0 ? (
                        <div className={styles.card} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                            พนักงานไม่ได้ระบุเป้าหมายการพัฒนา
                        </div>
                    ) : (
                        items.filter(it => it.section === "DEVELOPMENT").map((item, index) => (
                            <div key={item.id || index} className={styles.card}>
                                <div className={styles.itemHeader}>
                                    <div className={styles.itemTitle}>หัวข้อการพัฒนาที่ {index + 1}: {item.objective}</div>
                                </div>
                                <div className={styles.indicatorGrid} style={{ marginTop: 12 }}>
                                    <div className={styles.indicatorLabel}>เป้าหมายและวิธีการพัฒนา:</div>
                                    <div className={styles.indicatorVal}>{item.indicator || "-"}</div>
                                </div>
                                <div className={styles.indicatorGrid}>
                                    <div className={styles.indicatorLabel}>ระยะเวลาการพัฒนา:</div>
                                    <div className={styles.indicatorVal}>{item.target_1 || "-"}</div>
                                </div>
                                <div className={styles.indicatorGrid}>
                                    <div className={styles.indicatorLabel}>ผลลัพธ์การพัฒนา:</div>
                                    <div className={styles.indicatorVal} style={{ color: '#059669', fontWeight: 600 }}>{item.result_description || "ยังไม่มีข้อมูล"}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                )}

                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span> ส่วนที่ 5 ผลการประเมินโดยรวม  (Overall Evaluation)</span>
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

                {/* ── SECTION 5: SUMMARY TABLE ── */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span>ส่วนที่ 5 ผลการประเมินโดยรวม (Overall Evaluation)</span>
                    </div>

                    <table className={styles.part5Table}>
                        <thead>
                            <tr>
                                <th className={styles.colTitle}>หัวข้อ (Section)</th>
                                <th>พนักงาน</th>
                                <th>หัวหน้า</th>
                                <th>น้ำหนัก</th>
                                <th>รวมพนักงาน</th>
                                <th>รวมหัวหน้า</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className={styles.colTitle}>ส่วนที่ 1: KPI</td>
                                <td>{s1Employee.toFixed(2)}</td>
                                <td>{s1Supervisor.toFixed(2)}</td>
                                <td>{w1Pct}%</td>
                                <td>{(s1Employee * (w1Pct / 100)).toFixed(2)}</td>
                                <td>{(s1Supervisor * (w1Pct / 100)).toFixed(2)}</td>
                            </tr>
                            {(evaluation.category !== 'PROBATION' && evaluation.category !== 'MONTHLY') && (
                            <tr>
                                <td className={styles.colTitle}>ส่วนที่ 2 & 3: Attributes</td>
                                <td>{s23Employee.toFixed(2)}</td>
                                <td>{s23Supervisor.toFixed(2)}</td>
                                <td>{w23Pct}%</td>
                                <td>{(s23Employee * (w23Pct / 100)).toFixed(2)}</td>
                                <td>{(s23Supervisor * (w23Pct / 100)).toFixed(2)}</td>
                            </tr>
                            )}
                            <tr className={styles.totalRow}>
                                <td className={styles.colTitle}>รวมคะแนนทั้งหมด</td>
                                <td></td>
                                <td></td>
                                <td>100%</td>
                                <td>{totalEmployeeScore.toFixed(2)}</td>
                                <td style={{ color: 'var(--red)', fontSize: 14 }}>{totalSupervisorScore.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className={styles.gradeMapping}>
                        A = 4.50-5.00 | B = 3.50-4.49 | C = 2.50-3.49 | D = 1.50-2.49 | E = &lt;1.50
                        <div style={{ marginTop: 4, color: '#475569', fontSize: 9 }}>(หมายเหตุ: ต้องได้คะแนนไม่ต่ำกว่าเกรด C จึงจะผ่านการประเมิน)</div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                        <div style={{ background: 'var(--red)', color: 'white', padding: '10px 24px', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.8 }}>เกรด (GRADE)</div>
                            <div style={{ fontSize: 24, fontWeight: 900 }}>{grade}</div>
                        </div>
                    </div>

                    <div className={styles.recommendSection}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#475569' }}>ความคิดเห็นของผู้ประเมิน</div>
                        <div className={styles.checkGroup} style={{ opacity: (evaluation?.category === 'MONTHLY' || evaluation?.category === 'PROBATION') ? 0.8 : 1 }}>
                            <div
                                className={`${styles.checkItem} ${recommendSalary === true ? styles.active : ""}`}
                                onClick={() => {
                                    if (evaluation?.category === 'ANNUAL') setRecommendSalary(true);
                                }}
                                style={{ cursor: (evaluation?.category === 'MONTHLY' || evaluation?.category === 'PROBATION') ? 'not-allowed' : 'pointer' }}
                            >
                                <input type="checkbox" checked={recommendSalary === true} readOnly />
                                <span>
                                    {evaluation?.category === 'ANNUAL' ? 'เสนอพิจารณาปรับเงินเดือน' : 'ผ่าน (Pass)'}
                                </span>
                            </div>
                            <div
                                className={`${styles.checkItem} ${recommendSalary === false ? styles.active : ""}`}
                                onClick={() => {
                                    if (evaluation?.category === 'ANNUAL') setRecommendSalary(false);
                                }}
                                style={{ cursor: (evaluation?.category === 'MONTHLY' || evaluation?.category === 'PROBATION') ? 'not-allowed' : 'pointer' }}
                            >
                                <input type="checkbox" checked={recommendSalary === false} readOnly />
                                <span>
                                    {evaluation?.category === 'ANNUAL' ? 'ยังไม่เข้าเกณฑ์พิจารณาปรับเงินเดือน' : 'ไม่ผ่าน (Fail)'}
                                </span>
                            </div>
                        </div>
                        {(evaluation?.category === 'MONTHLY' || evaluation?.category === 'PROBATION') && (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, fontStyle: 'italic' }}>
                                * ระบบล็อคผลการประเมินอัตโนมัติตามเกรด (ต้องได้เกรด C หรือคะแนน 2.50 ขึ้นไปจึงจะผ่าน)
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: 20, padding: '0 10px' }}>
                    <button
                        className={styles.btnSubmit}
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? "กำลังส่งข้อมูล..." : "ยืนยันผลการประเมินและส่งให้ฝ่ายบุคคล"}
                    </button>
                </div>
            </div>
        </div>
    );
}
