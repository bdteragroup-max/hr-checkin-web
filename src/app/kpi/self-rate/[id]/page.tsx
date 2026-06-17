"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ChevronLeftIcon,
    CheckBadgeIcon,
    InformationCircleIcon,
    ArrowPathIcon,
    UserCircleIcon,
    TableCellsIcon,
    PlusIcon,
    TrashIcon
} from "@heroicons/react/24/solid";
import styles from "./page.module.css";

export default function KPISelfRatePage() {
    const { id } = useParams();
    const router = useRouter();

    const [evaluation, setEvaluation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [items, setItems] = useState<any[]>([]);
    const [devItems, setDevItems] = useState<any[]>([]);
    const [comment, setComment] = useState("");
    const [attendance, setAttendance] = useState<any>(null);

    useEffect(() => {
        fetch("/api/kpi")
            .then(r => r.json())
            .then(async data => {
                if (data.ok) {
                    const found = data.list.find((e: any) => e.id === Number(id));
                    if (found) {
                        setEvaluation(found);
                        let attendanceStats: any = null;
                        if (found.category === 'ANNUAL') {
                            try {
                                const aRes = await fetch(`/api/team/kpi/attendance?emp_id=${found.emp_id}&start=${found.period_start}&end=${found.period_end}`);
                                if (aRes.ok) {
                                    const aData = await aRes.json();
                                    attendanceStats = aData.stats;
                                    setAttendance(aData.stats);
                                }
                            } catch (err) {
                                console.error("Failed to fetch attendance:", err);
                            }
                        }

                        setItems(found.items.filter((it: any) => it.section !== "DEVELOPMENT").map((it: any) => {
                            let autoResult = it.result_description || "";
                            let autoScore = it.employee_score || 0;

                            if (attendanceStats) {
                                if (it.objective.includes("มาสาย")) {
                                    autoResult = `มาสาย ${attendanceStats.latenessCount} ครั้ง`;
                                    autoScore = attendanceStats.latenessScore;
                                } else if (it.objective.includes("ลาป่วย")) {
                                    autoResult = `ลาป่วย ${attendanceStats.sickLeaveCount} ครั้ง`;
                                    autoScore = attendanceStats.sickLeaveScore;
                                } else if (it.objective.includes("ลากิจ")) {
                                    autoResult = `ลากิจ ${attendanceStats.personalLeaveCount} ครั้ง`;
                                    autoScore = attendanceStats.personalLeaveScore;
                                }
                            }

                            return {
                                ...it,
                                result_description: autoResult,
                                employee_score: autoScore
                            };
                        }));

                        const existingDev = found.items.filter((it: any) => it.section === "DEVELOPMENT");
                        if (existingDev.length > 0) {
                            setDevItems(existingDev);
                        } else if (found.category === "ANNUAL") {
                            setDevItems([{ objective: "", indicator: "", target_1: "", result_description: "", section: "DEVELOPMENT" }]);
                        }

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

    const addDevItem = () => {
        setDevItems([...devItems, { objective: "", indicator: "", target_1: "", result_description: "", section: "DEVELOPMENT" }]);
    };

    const removeDevItem = (index: number) => {
        const next = [...devItems];
        next.splice(index, 1);
        setDevItems(next);
    };

    const updateDevItem = (index: number, field: string, value: any) => {
        const next = [...devItems];
        next[index] = { ...next[index], [field]: value };
        setDevItems(next);
    };

    const handleSubmit = async () => {
        const hasValidText = (val: string) => val && /[a-zA-Z0-9ก-๙]/.test(val);
        // Validation: Competency is only required if employee is a supervisor
        const isLeader = evaluation.employee?._count?.subordinates > 0;
        const incomplete = items.find(it => {
            if (it.section === "COMPETENCY" && !isLeader) return false;
            // Skip validation for locked attendance items
            if (it.objective.includes("มาสาย") || it.objective.includes("ลาป่วย") || it.objective.includes("ลากิจ")) return false;
            return (!hasValidText(it.result_description) || it.employee_score === 0);
        });

        if (incomplete) {
            alert("กรุณาระบุผลงานและคะแนนประเมินตนเองให้ครบทุกหัวข้อ และต้องมีตัวอักษรหรือตัวเลข (ห้ามระบุเฉพาะอักขระพิเศษ)" + (!isLeader ? " (ยกเว้นส่วนที่หัวหน้าประเมิน)" : ""));
            return;
        }

        if (comment && !hasValidText(comment)) {
            alert("ช่องความคิดเห็นต้องมีตัวอักษรหรือตัวเลข (ห้ามระบุเฉพาะอักขระพิเศษ)");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/kpi/self-rate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    evaluation_id: Number(id),
                    items: [...items, ...devItems],
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

    const isLeader = evaluation.employee?._count?.subordinates > 0;

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
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#D93025' }}>
                                {evaluation.category === 'ANNUAL' ? (evaluation.session_name === 'Mid-Year' ? 'Mid-Year Assessment' : evaluation.session_name) : `ครั้งที่ ${evaluation.evaluation_no}`}
                                {evaluation.category === 'ANNUAL' && <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>({evaluation.year})</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.itemsList}>
                    {["KPI", "CORE_VALUE", "COMPETENCY"].map((sec) => {
                        const secItems = items.filter(it => it.section === sec);
                        if (secItems.length === 0) return null;

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

                                {sec === "COMPETENCY" && !isLeader ? (
                                    <div className={styles.guide} style={{ marginBottom: 20, background: '#F8FAFC' }}>
                                        <InformationCircleIcon width={16} />
                                        <span>ในส่วนนี้ หัวหน้างานจะเป็นผู้ประเมินทักษะและความสามารถของคุณโดยตรง (เนื่องจากคุณไม่ได้อยู่ในตำแหน่งระดับบริหาร)</span>
                                    </div>
                                ) : (
                                    items.map((item, index) => {
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
                                                            disabled={item.objective.includes("มาสาย") || item.objective.includes("ลาป่วย") || item.objective.includes("ลากิจ")}
                                                        />
                                                    </div>

                                                    <div className={styles.scoreSection}>
                                                        <label>ประเมินตนเอง (คะแนน 1-5)</label>
                                                        <div className={styles.scoreButtons}>
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <button
                                                                    key={s}
                                                                    className={`${styles.scoreBtn} ${item.employee_score === s ? styles.active : ""}`}
                                                                    onClick={() => {
                                                                        if (!(item.objective.includes("มาสาย") || item.objective.includes("ลาป่วย") || item.objective.includes("ลากิจ"))) {
                                                                            updateItem(index, "employee_score", s);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        opacity: (item.objective.includes("มาสาย") || item.objective.includes("ลาป่วย") || item.objective.includes("ลากิจ")) && item.employee_score !== s ? 0.4 : 1,
                                                                        cursor: (item.objective.includes("มาสาย") || item.objective.includes("ลาป่วย") || item.objective.includes("ลากิจ")) ? 'not-allowed' : 'pointer'
                                                                    }}
                                                                >
                                                                    {s}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        );
                    })}
                </div>

                {evaluation.category === "ANNUAL" && (
                    <div key="DEVELOPMENT">
                        <div className={styles.sectionLabel} style={{ marginTop: 32, marginBottom: 16 }}>
                            <div className={styles.dot} />
                            <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                ส่วนที่ 4 เป้าหมายการพัฒนาตนเอง  (Personal Development Goals)
                            </span>
                        </div>

                        {devItems.map((item, index) => (
                            <div key={index} className={styles.card}>
                                <div className={styles.itemHeader}>
                                    <div className={styles.itemTitle}>หัวข้อการพัฒนาที่ {index + 1}</div>
                                    <button onClick={() => removeDevItem(index)} className={styles.btnRemove}>
                                        <TrashIcon width={16} />
                                    </button>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>สิ่งที่จะพัฒนา</label>
                                    <input
                                        value={item.objective || ""}
                                        onChange={e => updateDevItem(index, "objective", e.target.value)}
                                        placeholder="เช่น พัฒนาการใช้ Excel..."
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>เป้าหมายและวิธีการพัฒนา</label>
                                    <textarea
                                        rows={2}
                                        value={item.indicator || ""}
                                        onChange={e => updateDevItem(index, "indicator", e.target.value)}
                                        placeholder="เช่น เพื่อพัฒนาเทคนิคต่างๆ โดยการเรียนรู้เพิ่มเติม..."
                                    />
                                </div>
                                <div className={styles.row}>
                                    <div className={styles.inputGroup}>
                                        <label>ระยะเวลาการพัฒนา</label>
                                        <input
                                            value={item.target_1 || ""}
                                            onChange={e => updateDevItem(index, "target_1", e.target.value)}
                                            placeholder="เช่น มกราคม - ธันวาคม 2568"
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>ผลการพัฒนา (Progress Report)</label>
                                        <input
                                            value={item.result_description || ""}
                                            onChange={e => updateDevItem(index, "result_description", e.target.value)}
                                            placeholder="ระบุความคืบหน้า..."
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button onClick={addDevItem} className={styles.btnAddFull} style={{ marginBottom: 32 }}>
                            <PlusIcon width={16} /> เพิ่มหัวข้อการพัฒนาตนเอง
                        </button>
                    </div>
                )}

                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span> {evaluation.category === 'ANNUAL' ? "ข้อเสนอแนะเพิ่มเติม (Additional Remarks)" : "PART 4: แผนพัฒนาและข้อเสนอแนะ (Development & Remarks)"}</span>
                    </div>
                    <div className={styles.inputGroup}>
                        <label>{evaluation.category === 'ANNUAL' ? "ระบุข้อเสนอแนะต่อองค์กรและหัวหน้างาน" : "เป้าหมายในอาชีพของคุณ และสิ่งที่คุณต้องการพัฒนา (Career Goals & Development Needs)"}</label>
                        <textarea
                            rows={4}
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="..."
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
