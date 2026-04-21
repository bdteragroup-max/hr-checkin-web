"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
    calculateTotalScore, 
    calculateGrade,
    calculateProbationDates
} from "@/utils/probationCalculations";
import { 
    ChevronLeftIcon, 
    ArrowPathIcon,
    ClipboardDocumentCheckIcon,
    ExclamationCircleIcon,
    ChatBubbleLeftRightIcon,
    CheckBadgeIcon,
    CalendarDaysIcon,
    UserCircleIcon,
    LockClosedIcon,
    ExclamationTriangleIcon,
    XMarkIcon,
    EyeIcon,
    InformationCircleIcon
} from "@heroicons/react/24/solid";
import styles from "./page.module.css";
import Link from "next/link";

const CATEGORIES = [
    { key: "work_quality", label: "1. คุณภาพงาน", weight: 4 },
    { key: "work_quantity", label: "2. ปริมาณงาน", weight: 3 },
    { key: "dedication", label: "3. ความตั้งใจ / ความขยัน / ความทุ่มเท", weight: 8 },
    { key: "knowledge", label: "4. ความรอบรู้ / ความเข้าใจในงาน", weight: 5 },
    { key: "learning", label: "5. การเรียนรู้ / การพัฒนาตนเอง / การปรับตัว", weight: 5 },
    { key: "obedience", label: "6. การเชื่อฟังคำแนะนำ / คำสั่งของผู้บังคับบัญชา", weight: 4 },
    { key: "responsibility", label: "7. ความรับผิดชอบในงาน / ความเชื่อถือ", weight: 8 },
    { key: "creativity", label: "8. ความคิดริเริ่มสร้างสรรค์", weight: 6 },
    { key: "teamwork", label: "9. สัมพันธภาพในการทำงาน / มนุษยสัมพันธ์", weight: 3 },
    { key: "discipline", label: "10. การรักษาระเบียบวินัย / ข้อบังคับของบริษัท", weight: 3 },
    { key: "tool_maintenance", label: "11. การใช้ / การดูแล / การบำรุงรักษาอุปกรณ์", weight: 3 },
    { key: "participation", label: "12. เข้าร่วมกิจกรรมของบริษัท", weight: 5 },
];

export default function EvaluatePage() {
    const { emp_id } = useParams();
    const router = useRouter();

    const [empInfo, setEmpInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");
    
    const [scores, setScores] = useState<Record<string, number>>({});
    const [attendanceCounts, setAttendanceCounts] = useState({ late: 0, sick: 0, personal: 0 });
    const [attendanceLoading, setAttendanceLoading] = useState(false);

    const [decision, setDecision] = useState("pass");
    const [salaryFrom, setSalaryFrom] = useState("");
    const [salaryTo, setSalaryTo] = useState("");
    
    const [commentSupervisor, setCommentSupervisor] = useState("");
    const [commentImprovement, setCommentImprovement] = useState("");
    const [commentPraise, setCommentPraise] = useState("");

    // --- CORRECTIONS & DETAILS ---
    const [attDetails, setAttDetails] = useState<any>(null);
    const [activeDetailType, setActiveDetailType] = useState<"late" | "sick" | "personal" | null>(null);
    const [extraLateMin, setExtraLateMin] = useState(0);

    const [corrections, setCorrections] = useState<Record<string, string>>({
        late: "",
        sick: "",
        personal: ""
    });
    const [correctionRemark, setCorrectionRemark] = useState("");

    const displayedStats = useMemo(() => {
        return {
            late: corrections.late !== "" ? Number(corrections.late) : attendanceCounts.late,
            sick: corrections.sick !== "" ? Number(corrections.sick) : attendanceCounts.sick,
            personal: corrections.personal !== "" ? Number(corrections.personal) : attendanceCounts.personal,
        };
    }, [attendanceCounts, corrections]);


    useEffect(() => {
        fetch("/api/team/probation/employees")
            .then(r => r.json())
            .then(data => {
                if (data.ok) {
                    const found = data.list.find((e: any) => e.emp_id === emp_id);
                    setEmpInfo(found);
                    if (found) {
                        const evalNo = found.last_evaluation_no + 1;
                        const dates = calculateProbationDates(found.hire_date, evalNo);
                        setPeriodStart(dates.start);
                        setPeriodEnd(dates.end);
                    }
                }
            })
            .finally(() => setLoading(false));
    }, [emp_id]);

    useEffect(() => {
        if (!emp_id || !periodStart || !periodEnd) return;
        setAttendanceLoading(true);
        fetch(`/api/team/probation/stats/${emp_id}?start=${periodStart}&end=${periodEnd}`)
            .then(r => r.json())
            .then(data => {
                if (data.stats) {
                    setAttendanceCounts(data.stats);
                    setExtraLateMin(data.stats.late_min || 0);
                }
                if (data.details) setAttDetails(data.details);
            })
            .catch(() => {})
            .finally(() => setAttendanceLoading(false));
    }, [emp_id, periodStart, periodEnd]);

    const totalScore = useMemo(() => {
        const input: Record<string, number> = { ...scores };
        const calcAtt = (type: "late" | "sick" | "personal", count: number) => {
            if (type === "late") {
                if (count === 0) return 5;
                if (count <= 2) return 4;
                if (count <= 5) return 3;
                if (count <= 10) return 2;
                return 1;
            }
            if (count === 0) return 5;
            if (count === 1) return 4;
            if (count === 2) return 3;
            if (count <= 4) return 2;
            return 1;
        };
        input.late = calcAtt("late", displayedStats.late);
        input.sick_leave = calcAtt("sick", displayedStats.sick);
        input.personal_leave = calcAtt("personal", displayedStats.personal);
        return calculateTotalScore(input);
    }, [scores, displayedStats]);

    const grade = useMemo(() => calculateGrade(totalScore), [totalScore]);

    // --- POLICY ENFORCEMENT: Reset decision if grade is D or E ---
    useEffect(() => {
        if ((grade === "D" || grade === "E") && (decision === "pass" || decision === "salary_adjust")) {
            setDecision("extend"); // Default to extend if grade is too low
        }
    }, [grade, decision]);

    async function handleSubmit() {
        if (submitting) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/team/probation/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emp_id,
                    evaluation_no: (empInfo?.last_evaluation_no || 0) + 1,
                    period_start: periodStart,
                    period_end: periodEnd,
                    scores,
                    attendance_counts: displayedStats,
                    system_attendance_counts: attendanceCounts, // For audit
                    correction_remark: correctionRemark,
                    comment_supervisor: commentSupervisor,
                    comment_improvement: commentImprovement,
                    comment_praise: commentPraise,
                    decision,
                    salary_adjust_from: salaryFrom,
                    salary_adjust_to: salaryTo
                })
            });
            if (res.ok) router.push("/team/probation?success=true");
            else {
                const data = await res.json();
                alert("เกิดข้อผิดพลาด: " + (data.error || "Unknown"));
                setSubmitting(false);
            }
        } catch (e) {
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
            setSubmitting(false);
        }
    }

    if (loading) return <div className={styles.loading}>
        <ArrowPathIcon width={40} className="animate-spin mx-auto mb-4 opacity-10" />
        <div style={{ fontWeight: 700 }}>กำลังโหลด...</div>
    </div>;

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>แบบประเมินผลการทำงาน</h1>
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
                            <div style={{ fontWeight: 800, fontSize: 16 }}>{empInfo.name}</div>
                            <div style={{ fontSize: 12, color: '#94A3B8' }}>{emp_id} · {empInfo.job_positions?.title || "Staff"}</div>
                        </div>
                    </div>
                    
                    <div className={styles.divider} style={{ margin: '20px 0', borderTop: '1px dashed #E2E8F0' }} />
                    
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
                    <div style={{ fontSize: 11, color: '#94a3b8', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <LockClosedIcon width={14} />
                        ระบบล็อคช่วงเวลาประเมินอัตโนมัติ (รอบละ 30 วัน นับจากวันเริ่มงาน)
                    </div>
                </div>

                {/* ── SECTION 2: ATTENDANCE ── */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span> สรุปสถิติการมาทำงาน</span>
                    </div>
                    {attendanceLoading ? (
                        <div style={{ textAlign: 'center', padding: 10, fontSize: 13, color: '#94A3B8' }}>
                            <ArrowPathIcon width={14} className="animate-spin inline mr-2" /> กำลังประมวลผล...
                        </div>
                    ) : (
                        <div className={styles.attGrid}>
                            <div className={styles.attItem}>
                                <div className={styles.attVal}>{attendanceCounts.late}</div>
                                <div className={styles.attLabel}>มาสาย</div>
                                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{extraLateMin} นาที</div>
                                <button className={styles.attDetailBtn} onClick={() => setActiveDetailType("late")}><EyeIcon width={10} style={{display:'inline',marginRight:2}}/> รายละเอียด</button>
                            </div>
                            <div className={styles.attItem}>
                                <div className={styles.attVal}>{attendanceCounts.sick}</div>
                                <div className={styles.attLabel}>ลาป่วย</div>
                                <button className={styles.attDetailBtn} onClick={() => setActiveDetailType("sick")}><EyeIcon width={10} style={{display:'inline',marginRight:2}}/> รายละเอียด</button>
                            </div>
                            <div className={styles.attItem}>
                                <div className={styles.attVal}>{attendanceCounts.personal}</div>
                                <div className={styles.attLabel}>ลากิจ</div>
                                <button className={styles.attDetailBtn} onClick={() => setActiveDetailType("personal")}><EyeIcon width={10} style={{display:'inline',marginRight:2}}/> รายละเอียด</button>
                            </div>
                        </div>
                    )}

                    <div className={styles.correctionWrap}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <ExclamationTriangleIcon width={16} color="#d93025" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>แก้ไข/ปรับปรุงสถิติ (ถ้ามี)</span>
                        </div>
                        <div className={styles.correctionGrid}>
                            <div className={styles.correctionInputGroup}>
                                <label>มาสาย (ครั้ง)</label>
                                <input 
                                    type="number" 
                                    placeholder={String(attendanceCounts.late)}
                                    value={corrections.late}
                                    onChange={e => setCorrections(p => ({ ...p, late: e.target.value }))}
                                />
                            </div>
                            <div className={styles.correctionInputGroup}>
                                <label>ลาป่วย (วัน)</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    placeholder={String(attendanceCounts.sick)}
                                    value={corrections.sick}
                                    onChange={e => setCorrections(p => ({ ...p, sick: e.target.value }))}
                                />
                            </div>
                            <div className={styles.correctionInputGroup}>
                                <label>ลากิจ (วัน)</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    placeholder={String(attendanceCounts.personal)}
                                    value={corrections.personal}
                                    onChange={e => setCorrections(p => ({ ...p, personal: e.target.value }))}
                                />
                            </div>
                        </div>

                        {(corrections.late !== "" || corrections.sick !== "" || corrections.personal !== "") && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>ระบุเหตุผลการปรับปรุงสถิติ</div>
                                <textarea 
                                    style={{ width: '100%', fontSize: 13, padding: 8, border: '1.5px solid #fecaca', borderRadius: 8, background: '#fff' }}
                                    rows={2}
                                    value={correctionRemark}
                                    onChange={e => setCorrectionRemark(e.target.value)}
                                    placeholder="เช่น แก้ไขเนื่องจากพนักงานลืมลงเวลาแต่มาจริง..."
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* ── SECTION 3: CORE RUBRIC ── */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span> เกณฑ์คะแนนและผลการประเมิน</span>
                    </div>
                    <div className={styles.scoreHeader}>
                        <div>หัวข้อพิจารณา</div>
                        <div>เกณฑ์คะแนน (5-1)</div>
                    </div>

                    {CATEGORIES.map(cat => (
                        <div key={cat.key} className={styles.scoreRow}>
                            <div className={styles.catInfo}>
                                <div className={styles.catName}>{cat.label}</div>
                                <div className={styles.catWeight}>ความสำคัญ: {cat.weight}</div>
                            </div>
                            <div className={styles.scoreButtons}>
                                {[5, 4, 3, 2, 1].map(s => (
                                    <button 
                                        key={s}
                                        className={`${styles.scoreBtn} ${scores[cat.key] === s ? styles.active : ""}`}
                                        onClick={() => setScores(p => ({ ...p, [cat.key]: s }))}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── SECTION 4: REMARKS ── */}
                <div className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span> สรุปผลและข้อเสนอแนะ</span>
                    </div>
                    
                    <div className={styles.inputGroup}>
                        <label>ความคิดเห็นเพิ่มเติม (Comments)</label>
                        <textarea rows={3} value={commentSupervisor} onChange={e => setCommentSupervisor(e.target.value)} />
                    </div>
                    
                    <div className={styles.inputGroup}>
                        <label>คำแนะนำการพัฒนา (Recommendations)</label>
                        <textarea rows={3} value={commentImprovement} onChange={e => setCommentImprovement(e.target.value)} />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>คำชื่นชม / จุดเด่น (Commendations)</label>
                        <textarea rows={3} value={commentPraise} onChange={e => setCommentPraise(e.target.value)} placeholder="ระบุจุดเด่นหรือพฤติกรรมที่น่าชื่นชม..." />
                    </div>

                    <div className={styles.divider} style={{ margin: '20px 0', borderTop: '1px dashed #E2E8F0' }} />

                    <div className={styles.decisionGrid}>
                        <button 
                            className={`${styles.choice} ${decision === "pass" ? styles.choiceActive : ""} ${(grade === "D" || grade === "E") ? styles.choiceDisabled : ""}`} 
                            onClick={() => (grade !== "D" && grade !== "E") && setDecision("pass")}
                            disabled={grade === "D" || grade === "E"}
                        >
                            ผ่านทดลองงาน
                        </button>
                        <button className={`${styles.choice} ${decision === "fail" ? styles.choiceActive : ""}`} onClick={() => setDecision("fail")}>ไม่ผ่านทดลองงาน</button>
                        <button className={`${styles.choice} ${decision === "extend" ? styles.choiceActive : ""}`} onClick={() => setDecision("extend")}>ขยายเวลา</button>
                        <button 
                            className={`${styles.choice} ${decision === "salary_adjust" ? styles.choiceActive : ""} ${(grade === "D" || grade === "E") ? styles.choiceDisabled : ""}`} 
                            onClick={() => (grade !== "D" && grade !== "E") && setDecision("salary_adjust")}
                            disabled={grade === "D" || grade === "E"}
                        >
                            ปรับเงินเดือน
                        </button>
                    </div>

                    {(grade === "D" || grade === "E") && (
                        <div style={{ marginTop: 16, padding: 12, background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ExclamationTriangleIcon width={20} color="#dc2626" />
                            <div style={{ fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
                                นโยบาย: เกรด {grade} ไม่สามารถเลือกผ่านทดลองงานได้ (ต้องได้เกรด C ขึ้นไป)
                            </div>
                        </div>
                    )}

                    {decision === "salary_adjust" && (
                        <div className={styles.row} style={{ marginTop: 20 }}>
                            <div className={styles.inputGroup}>
                                <label>จากเดิม</label>
                                <input type="number" value={salaryFrom} onChange={e => setSalaryFrom(e.target.value)} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>เป็น (บาท)</label>
                                <input type="number" value={salaryTo} onChange={e => setSalaryTo(e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>

                {/* ── STICKY SHELF ── */}
                <div className={styles.summarySticky}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className={styles.totalVal}>{totalScore} <span style={{ fontSize: 13, color: '#94a3b8' }}>/300</span></div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94A3B8' }}>คะแนนรวม</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div className={styles.gradeVal} style={{ color: (grade === "D" || grade === "E") ? "#dc2626" : "#16a34a" }}>{grade}</div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', marginTop: -4 }}>GRADE</div>
                    </div>
                    <button 
                        className={styles.btnSubmit}
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? "..." : "ส่งผลประเมิน"}
                    </button>
                </div>

                {/* ── MODAL: ATTENDANCE DETAILS ── */}
                {activeDetailType && attDetails && (
                    <div className={styles.modalOverlay} onClick={() => setActiveDetailType(null)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>รายละเอียด: {activeDetailType === "late" ? "มาสาย" : activeDetailType === "sick" ? "ลาป่วย" : "ลากิจ"}</h3>
                                <button 
                                    onClick={() => setActiveDetailType(null)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                >
                                    <XMarkIcon width={24} color="#94a3b8" />
                                </button>
                            </div>
                            <div className={styles.modalBody}>
                                {activeDetailType === "late" && (
                                    <>
                                        {attDetails.lates.length === 0 ? <div style={{textAlign:'center',color:'#94a3b8'}}>ไม่พบรายการสาย</div> : 
                                            attDetails.lates.map((item: any, idx: number) => (
                                                <div key={idx} className={styles.detailRow}>
                                                    <div className={styles.detailDate}>{new Date(item.date).toLocaleDateString("th-TH", { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                                    <div className={styles.detailSub}>สาย {item.minutes} นาที ({item.status})</div>
                                                </div>
                                            ))
                                        }
                                    </>
                                )}
                                {(activeDetailType === "sick" || activeDetailType === "personal") && (
                                    <>
                                        {(attDetails[activeDetailType] || []).length === 0 ? <div style={{textAlign:'center',color:'#94a3b8'}}>ไม่พบรายการลา</div> : 
                                            attDetails[activeDetailType].map((item: any, idx: number) => (
                                                <div key={idx} className={styles.detailRow}>
                                                    <div className={styles.detailDate}>
                                                        {new Date(item.start).toLocaleDateString("th-TH")} — {new Date(item.end).toLocaleDateString("th-TH")}
                                                    </div>
                                                    <div className={styles.detailSub}>{item.days} วัน · {item.reason || "ไม่ระบุเหตุผล"}</div>
                                                </div>
                                            ))
                                        }
                                    </>
                                )}
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.btnCloseModal} onClick={() => setActiveDetailType(null)}>ปิดหน้าต่าง</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
