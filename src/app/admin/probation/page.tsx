"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "./page.module.css";
import { 
    DocumentArrowDownIcon, 
    PaperAirplaneIcon,
    CheckCircleIcon,
    MagnifyingGlassIcon,
    DocumentCheckIcon,
    ArrowPathIcon,
    UserIcon,
    XMarkIcon,
    ChatBubbleLeftEllipsisIcon,
    ExclamationTriangleIcon,
    EyeIcon
} from "@heroicons/react/24/outline";
import { 
    calculateTotalScore, 
    calculateGrade, 
    calculateAttendanceScore 
} from "@/utils/probationCalculations";

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

export default function AdminProbationPage() {
    const [list, setList] = useState<any[]>([]);
    const [pendingList, setPendingList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sendingId, setSendingId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'trial' | 'regular'>('trial');

    // -- REVIEW UI STATE --
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editData, setEditData] = useState<any>(null);
    const [realtimeStats, setRealtimeStats] = useState<any>(null);
    const [showBreakdown, setShowBreakdown] = useState<string | null>(null); 
    const [saving, setSaving] = useState(false);

    const refresh = () => {
        setLoading(true);
        fetch("/api/admin/probation/evaluations")
            .then(r => r.json())
            .then(data => {
                if (data.ok) {
                    setList(data.list || []);
                    setPendingList(data.pending || []);
                }
            })
            .catch(err => console.error("Refresh Error:", err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refresh();
    }, []);

    const filtered = (list || []).filter(item => {
        const matchesSearch = (item.employee?.name || "").toLowerCase().includes(search.toLowerCase()) ||
                              (item.employee?.emp_id || "").toLowerCase().includes(search.toLowerCase());
        
        if (activeTab === 'trial') return matchesSearch && item.employee?.is_on_trial;
        return matchesSearch && !item.employee?.is_on_trial;
    });

    const filteredPending = (pendingList || []).filter(item => 
        (item.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.emp_id || "").toLowerCase().includes(search.toLowerCase())
    );

    const getDaysInfo = (endDate: string) => {
        if (!endDate) return null;
        const diff = new Date(endDate).getTime() - new Date().getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        let color = "#16a34a"; // Green
        if (days < 7) color = "#dc2626"; // Red
        else if (days < 30) color = "#d97706"; // Orange
        return { days, color };
    };

    const getRoundHistory = (empId: string, hireDate: string) => {
        if (!hireDate) return [];
        const empEvals = list.filter(it => it.emp_id === empId).sort((a, b) => a.evaluation_no - b.evaluation_no);
        
        return [1, 2, 3].map(round => {
            const evaluation = empEvals.find(it => it.evaluation_no === round);
            if (!evaluation) return { round, status: 'pending' };

            const hire = new Date(hireDate);
            const target = new Date(hire);
            target.setDate(hire.getDate() + (round * 30));
            
            const actual = new Date(evaluation.evaluation_date);
            const diff = actual.getTime() - target.getTime();
            const delayDays = Math.floor(diff / (1000 * 60 * 60 * 24));

            return {
                round,
                status: delayDays > 0 ? 'delayed' : 'normal',
                delayDays: delayDays > 0 ? delayDays : 0,
                date: actual
            };
        });
    };

    // -- REVIEW LOGIC --
    const openReview = async (id: number) => {
        const evalItem = list.find(it => it.id === id);
        if (!evalItem) return;

        setSelectedId(id);
        setEditData({
            scores: {
                work_quality: evalItem.score_work_quality,
                work_quantity: evalItem.score_work_quantity,
                dedication: evalItem.score_dedication,
                knowledge: evalItem.score_knowledge,
                learning: evalItem.score_learning,
                obedience: evalItem.score_obedience,
                responsibility: evalItem.score_responsibility,
                creativity: evalItem.score_creativity,
                teamwork: evalItem.score_teamwork,
                discipline: evalItem.score_discipline,
                tool_maintenance: evalItem.score_tool_maintenance,
                participation: evalItem.score_participation
            },
            attendance_counts: {
                late: evalItem.count_late,
                sick: evalItem.count_sick_leave,
                personal: evalItem.count_personal_leave
            },
            decision: evalItem.decision,
            hr_remark: evalItem.hr_remark || "",
            salary_adjust_from: evalItem.salary_adjust_from || "",
            salary_adjust_to: evalItem.salary_adjust_to || ""
        });

        // Fetch realtime stats
        fetch(`/api/admin/probation/evaluations/${id}/stats`)
            .then(r => r.json())
            .then(data => {
                if (data.ok) setRealtimeStats(data);
            });
    };

    const handleSaveReview = async () => {
        if (!selectedId || saving) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/probation/evaluations/${selectedId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editData)
            });
            if (res.ok) {
                setSelectedId(null);
                refresh();
            } else {
                alert("เกิดข้อผิดพลาดในการบันทึก");
            }
        } catch (e) {
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setSaving(false);
        }
    };

    const currentTotal = useMemo(() => {
        if (!editData) return 0;
        const input: any = { ...editData.scores };
        input.late = calculateAttendanceScore("late", editData.attendance_counts.late);
        input.sick_leave = calculateAttendanceScore("sick", editData.attendance_counts.sick);
        input.personal_leave = calculateAttendanceScore("personal", editData.attendance_counts.personal);
        return calculateTotalScore(input);
    }, [editData]);

    const currentGrade = useMemo(() => calculateGrade(currentTotal), [currentTotal]);

    async function sendToManagement(id: number) {
        if (!confirm("ต้องการส่งสรุปผลการประเมินนี้ไปยัง LINE ฝ่ายบริหารใช่หรือไม่?")) return;
        setSendingId(id);
        try {
            const res = await fetch(`/api/admin/probation/evaluations/${id}/send-summary`, { method: "POST" });
            if (res.ok) {
                alert("ส่งเรียบร้อยแล้ว");
                refresh();
            } else {
                alert("เกิดข้อผิดพลาดในการส่ง");
            }
        } catch (e) {
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setSendingId(null);
        }
    }

    const decisionMap: any = {
        pass: { label: "ผ่าน", color: "#16a34a" },
        fail: { label: "ไม่ผ่าน", color: "#dc2626" },
        extend: { label: "ขยายเวลา", color: "#d97706" },
        salary_adjust: { label: "ปรับเงินเดือน", color: "#2563eb" }
    };

    return (
        <div className={styles.wrap}>
            {/* --- HEADER --- */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>ประเมินผลพนักงานทดลองงาน</h1>
                    <div className={styles.subtitle}>รายการประเมินทั้งหมดที่หัวหน้างานส่งเข้ามาเพื่อขออนุมัติ</div>
                    <div className={styles.legend}>
                        <b>เกณฑ์คะแนน:</b> A (280-300), B (260-279), C (240-259), D (220-239), E (&lt;220) 
                        <span style={{ color: '#dc2626', marginLeft: 12, fontWeight: 800 }}>* ต้องได้เกรด C ขึ้นไปเพื่อผ่านการประเมิน</span>
                    </div>
                </div>
            </div>

            <div className={styles.tabs}>
                <div 
                    className={`${styles.tab} ${activeTab === 'trial' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('trial')}
                >
                    พนักงานทดลองงาน (Probation)
                </div>
                <div 
                    className={`${styles.tab} ${activeTab === 'regular' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('regular')}
                >
                    พนักงานประจำ (Regular Staff)
                </div>
            </div>

            {/* --- CONTENT CARD --- */}
            <div className={styles.card}>
                <div className={styles.cardTopAccent} />
                
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        <DocumentCheckIcon width={20} /> {activeTab === 'trial' ? 'รายการส่งประเมินทดลองงาน' : 'รายการส่งประเมินประจำเดือน'}
                    </div>
                    <div>
                        <span className={styles.rowCount}>{(list || []).length} ทั้งหมด</span>
                    </div>
                </div>

                <div className={styles.filterBar}>
                    <div className={styles.searchWrap}>
                        <MagnifyingGlassIcon width={18} className={styles.searchIcon} />
                        <input 
                            className={styles.searchInput}
                            placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* --- PENDING EVALUATIONS SECTION --- */}
                {activeTab === 'trial' && filteredPending.length > 0 && (
                    <div className={styles.sectionPending}>
                        <div className={styles.sectionTitlePending}>
                            <UserIcon width={20} /> พนักงานที่ต้องเข้ารับการประเมิน ({filteredPending.length})
                        </div>
                        <div className={styles.pendingGrid}>
                            {filteredPending.map(emp => {
                                const info = getDaysInfo(emp.probation_end_date);
                                return (
                                    <div key={emp.emp_id} className={styles.pendingCard}>
                                        <div className={styles.pendingEmp}>
                                            <div className={styles.pendingName}>{emp.name}</div>
                                            <div className={styles.pendingId}>{emp.emp_id} • {emp.job_title}</div>
                                        </div>
                                        <div className={styles.pendingRound}>
                                            <span className={styles.roundLabel}>ครั้งที่</span>
                                            <span className={styles.roundNum}>{emp.next_round}</span>
                                        </div>
                                        <div className={styles.pendingMeta}>
                                            <div className={styles.metaRow}>
                                                <span>วันสิ้นสุดทดลองงาน:</span>
                                                <b>{emp.probation_end_date ? new Date(emp.probation_end_date).toLocaleDateString("th-TH") : "-"}</b>
                                            </div>
                                            {info && (
                                                <div className={styles.countdownRow} style={{ color: info.color }}>
                                                    <ExclamationTriangleIcon width={14} /> เหลืออีก {info.days} วัน
                                                </div>
                                            )}

                                            <div className={styles.historyRounds}>
                                                {getRoundHistory(emp.emp_id, emp.hire_date).map(h => {
                                                    if (h.status === 'pending') return null;
                                                    return (
                                                        <div key={h.round} className={styles.historyItem}>
                                                            <span className={styles.historyRoundLabel}>ครั้งที่ {h.round}</span>
                                                            <span className={h.status === 'delayed' ? styles.statusDelayed : styles.statusNormal}>
                                                                {h.status === 'delayed' ? `ล่าช้า ${h.delayDays} วัน` : 'ปกติ'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>พนักงาน</th>
                                <th>ผู้ประเมิน</th>
                                <th>ครั้งที่</th>
                                <th>ช่วงวันที่ประเมิน</th>
                                <th>คะแนน / เกรด</th>
                                <th>ผลสรุป</th>
                                <th>สถานะ HR</th>
                                <th style={{ textAlign: "right" }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className={styles.tdLoading}>กำลังโหลดข้อมูล...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className={styles.tdEmpty}>ไม่พบรายการที่ตรงกับเงื่อนไข</td></tr>
                            ) : filtered.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <UserIcon width={18} />
                                            </div>
                                            <div className={styles.empInfo}>
                                                <div className={styles.empName}>{item.employee?.name}</div>
                                                <div className={styles.empId}>{item.employee?.emp_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{item.supervisor?.name}</td>
                                    <td><span className={styles.evalNo}>{item.evaluation_no}</span></td>
                                    <td>
                                        <div className={styles.period}>
                                            {new Date(item.period_start).toLocaleDateString("th-TH")} — {new Date(item.period_end).toLocaleDateString("th-TH")}
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.scoreRow}>
                                            <span className={styles.scoreVal}>{item.total_score}</span>
                                            <span className={styles.gradeVal}>{item.grade}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={styles.badge} style={{ background: (decisionMap[item.decision]?.color || "#94a3b8") + "15", color: decisionMap[item.decision]?.color || "#94a3b8" }}>
                                            {decisionMap[item.decision]?.label || item.decision}
                                        </span>
                                    </td>
                                    <td>
                                        {item.status === "reviewed" ? (
                                            <span className={styles.sentStatus} style={{ background: '#e0f2fe', color: '#0369a1' }}>ตรวจสอบแล้ว</span>
                                        ) : (
                                            <span className={styles.pendingStatus}>รอการตรวจสอบ</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        <div className={styles.actions}>
                                            <button className={styles.btnAction} style={{ color: '#0ea5e9' }} onClick={() => openReview(item.id)}><MagnifyingGlassIcon width={18} /></button>
                                            <a href={`/api/admin/probation/evaluations/${item.id}/pdf`} className={styles.btnAction} style={{ color: '#0369a1' }} target="_blank"><DocumentArrowDownIcon width={18} /></a>
                                            <button className={styles.btnAction} style={{ color: '#D93025' }} onClick={() => sendToManagement(item.id)} disabled={sendingId === item.id}>
                                                {sendingId === item.id ? <div className={styles.spinner} style={{ width: 14, height: 14 }} /> : <PaperAirplaneIcon width={18} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODAL: REVIEW --- */}
            {selectedId && editData && (
                <div className={styles.modalOverlay} onClick={() => setSelectedId(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2><DocumentCheckIcon width={24} color="#D93025" /> ตรวจสอบและแก้ไขผลการประเมิน</h2>
                            <button onClick={() => setSelectedId(null)} className={styles.btnAction}><XMarkIcon width={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            {/* --- EMPLOYEE INFO CARD --- */}
                            <div className={styles.reviewCard} style={{ marginBottom: 24 }}>
                                <div className={styles.reviewGrid}>
                                    <div className={styles.reviewInfoItem}>
                                        <div className={styles.reviewLabel}>พนักงาน</div>
                                        <div className={styles.reviewValue}>
                                            <UserIcon width={16} />
                                            {list.find(it => it.id === selectedId)?.employee?.name}
                                        </div>
                                    </div>
                                    <div className={styles.reviewInfoItem}>
                                        <div className={styles.reviewLabel}>ผู้ประเมิน</div>
                                        <div className={styles.reviewValue}>
                                            <DocumentCheckIcon width={16} />
                                            {list.find(it => it.id === selectedId)?.supervisor?.name}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* --- ATTENDANCE SECTION --- */}
                            <div className={styles.reviewSectionTitle}>
                                <ArrowPathIcon width={18} /> สถิติการมาทำงาน (Attendance Statistics)
                            </div>
                            <div className={styles.attendanceGrid} style={{ marginBottom: 32 }}>
                                {[
                                    { label: "มาสาย (ครั้ง)", key: "late", icon: <ArrowPathIcon width={14} />, statsKey: "late" },
                                    { label: "ลาป่วย (วัน)", key: "sick", icon: <ArrowPathIcon width={14} />, statsKey: "sickLeaveCount" },
                                    { label: "ลากิจ / ไม่รับค่าจ้าง (วัน)", key: "personal", icon: <ArrowPathIcon width={14} />, statsKey: "personalLeaveCount" }
                                ].map(att => (
                                    <div key={att.key} className={styles.attendanceCard}>
                                        <div className={styles.attIcon}>{att.icon}</div>
                                        <div className={styles.attInfo}>
                                            <div className={styles.attLabel}>{att.label}</div>
                                            <div className={styles.attStats}>
                                                จากระบบ: <b>{realtimeStats ? (realtimeStats.stats as any)[att.statsKey] || 0 : '...'}</b>
                                            </div>
                                        </div>
                                        <input 
                                            type="number" 
                                            className={styles.attInput} 
                                            value={editData.attendance_counts[att.key]} 
                                            onChange={e => setEditData({...editData, attendance_counts: {...editData.attendance_counts, [att.key]: Number(e.target.value)}})} 
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* --- SCORING SECTION --- */}
                            <div className={styles.reviewSectionTitle}>
                                <CheckCircleIcon width={18} /> คะแนนการปฏิบัติงาน (1 - 5)
                            </div>
                            <div className={styles.scoreGrid}>
                                {CATEGORIES.map(cat => (
                                    <div key={cat.key} className={styles.scoreCard}>
                                        <div className={styles.scoreInfo}>
                                            <div className={styles.scoreCatLabel}>{cat.label}</div>
                                            <div className={styles.scoreWeight}>น้ำหนัก: {cat.weight}</div>
                                        </div>
                                        <div className={styles.scoreInputWrap}>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max="5" 
                                                className={styles.scoreInput} 
                                                value={editData.scores[cat.key]} 
                                                onChange={e => setEditData({...editData, scores: {...editData.scores, [cat.key]: Number(e.target.value)}})} 
                                            />
                                            <span className={styles.scoreMax}>/ 5</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* --- REMARK SECTION --- */}
                            <div className={styles.reviewSectionTitle} style={{ marginTop: 32 }}>
                                <ChatBubbleLeftEllipsisIcon width={18} /> ความเห็นเพิ่มเติมของ HR (Remark)
                            </div>
                            <textarea 
                                className={styles.remarkArea}
                                placeholder="ระบุความเห็นหรือหมายเหตุสำหรับการพิจารณา..."
                                value={editData.hr_remark}
                                onChange={e => setEditData({...editData, hr_remark: e.target.value})}
                            />
                        </div>

                        <div className={styles.modalFooter}>
                             <div style={{ marginRight: 'auto' }}>
                                <span style={{ fontWeight:900, fontSize:24 }}>{currentTotal} / 300 ({currentGrade})</span>
                             </div>
                             <button className={styles.btnCancel} onClick={() => setSelectedId(null)}>ยกเลิก</button>
                             <button className={styles.btnSave} onClick={handleSaveReview} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกผล"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
