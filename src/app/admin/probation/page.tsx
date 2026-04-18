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
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sendingId, setSendingId] = useState<number | null>(null);

    // -- REVIEW UI STATE --
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editData, setEditData] = useState<any>(null);
    const [realtimeStats, setRealtimeStats] = useState<any>(null);
    const [showBreakdown, setShowBreakdown] = useState<string | null>(null); // 'late', 'sick', 'personal'
    const [saving, setSaving] = useState(false);

    const refresh = () => {
        setLoading(true);
        fetch("/api/admin/probation/evaluations")
            .then(r => r.json())
            .then(data => {
                if (data.ok) setList(data.list);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refresh();
    }, []);

    const filtered = list.filter(item => 
        item.employee.name.toLowerCase().includes(search.toLowerCase()) ||
        item.employee.emp_id.toLowerCase().includes(search.toLowerCase())
    );

    // -- REVIEW LOGIC --
    const openReview = async (id: number) => {
        setSelectedId(id);
        const evalItem = list.find(it => it.id === id);
        if (!evalItem) return;

        // Prepare editable state
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

        // Fetch realtime stats breakdown
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
        pass: { label: "ผ่านทดลองงาน", color: "#16a34a" },
        fail: { label: "ไม่ผ่านทดลองงาน", color: "#dc2626" },
        extend: { label: "ขยายเวลา", color: "#d97706" },
        salary_adjust: { label: "ปรับเงินเดือน", color: "#2563eb" }
    };

    return (
        <div className={styles.wrap}>
            {/* ── HEADER ── */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>ประเมินผลพนักงานทดลองงาน</h1>
                    <div className={styles.subtitle}>รายการประเมินทั้งหมดที่หัวหน้างานส่งเข้ามาเพื่อขออนุมัติ</div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.btnRefresh} onClick={refresh} disabled={loading}>
                        <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} /> รีเฟรช
                    </button>
                </div>
            </div>

            {/* ── CONTENT CARD ── */}
            <div className={styles.card}>
                <div className={styles.cardTopAccent} />
                
                {/* Table Top Bar */}
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        <DocumentCheckIcon width={20} /> รายการส่งประเมิน
                    </div>
                    <div>
                        <span className={styles.rowCount}>{list.length} ทั้งหมด</span>
                    </div>
                </div>

                {/* Filter Bar */}
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
                                <tr>
                                    <td colSpan={8} className={styles.tdLoading}>
                                        <div className={styles.spinner} style={{ marginRight: 8 }} />
                                        กำลังโหลดข้อมูล...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className={styles.tdEmpty}>ไม่พบรายการที่ตรงกับเงื่อนไข</td>
                                </tr>
                            ) : filtered.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <UserIcon width={18} />
                                            </div>
                                            <div className={styles.empInfo}>
                                                <div className={styles.empName}>{item.employee.name}</div>
                                                <div className={styles.empId}>{item.employee.emp_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.supervisorName}>{item.supervisor.name}</div>
                                    </td>
                                    <td>
                                        <span className={styles.evalNo}>{item.evaluation_no}</span>
                                    </td>
                                    <td>
                                        <div className={styles.period}>
                                            {new Date(item.period_start).toLocaleDateString("th-TH")}
                                            <span style={{ margin: '0 4px', color: '#cbd5e1' }}>—</span>
                                            {new Date(item.period_end).toLocaleDateString("th-TH")}
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.scoreRow}>
                                            <span className={styles.scoreVal}>{item.total_score}</span>
                                            <span className={styles.gradeVal}>{item.grade}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span 
                                            className={styles.badge} 
                                            style={{ 
                                                background: (decisionMap[item.decision]?.color || "#94a3b8") + "15", 
                                                color: decisionMap[item.decision]?.color || "#94a3b8" 
                                            }}
                                        >
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
                                            <button 
                                                className={styles.btnAction}
                                                style={{ color: '#0ea5e9' }}
                                                title="คลิกเพื่อตรวจสอบและแก้ไข"
                                                onClick={() => openReview(item.id)}
                                            >
                                                <MagnifyingGlassIcon width={18} />
                                            </button>
                                            <a 
                                                href={`/api/admin/probation/evaluations/${item.id}/pdf`}
                                                className={styles.btnAction}
                                                style={{ color: '#0369a1' }}
                                                title="ดาวน์โหลด PDF"
                                                target="_blank"
                                            >
                                                <DocumentArrowDownIcon width={18} />
                                            </a>
                                            <button 
                                                className={styles.btnAction}
                                                title="ส่งให้ LINE ฝ่ายบริหาร"
                                                style={{ color: '#D93025' }}
                                                onClick={() => sendToManagement(item.id)}
                                                disabled={sendingId === item.id}
                                            >
                                                {sendingId === item.id ? (
                                                    <div className={styles.spinner} style={{ width: 14, height: 14 }} />
                                                ) : (
                                                    <PaperAirplaneIcon width={18} />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── MODAL: REVIEW & EDIT ── */}
            {selectedId && editData && (
                <div className={styles.modalOverlay} onClick={() => setSelectedId(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>
                                <DocumentCheckIcon width={24} color="#D93025" />
                                ตรวจสอบและแก้ไขผลการประเมิน
                            </h2>
                            <button onClick={() => setSelectedId(null)} className={styles.btnAction}>
                                <XMarkIcon width={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            
                            {/* Section: Employee Info */}
                            <div className={styles.section}>
                                <div className={styles.grid}>
                                    <div className={styles.infoBox}>
                                        <div className={styles.label}>พนักงาน</div>
                                        <div className={styles.value}>{list.find(it => it.id === selectedId)?.employee.name}</div>
                                    </div>
                                    <div className={styles.infoBox}>
                                        <div className={styles.label}>ผู้ประเมิน (หัวหน้า)</div>
                                        <div className={styles.value}>{list.find(it => it.id === selectedId)?.supervisor.name}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Attendance Corrections */}
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}><div className={styles.dot}/> ตรวจสอบและแก้ไขสถิติการมาทำงาน</div>
                                
                                <div className={styles.statRow}>
                                    <div className={styles.statInfo}>
                                        <div className={styles.statName}>มาสาย</div>
                                        {realtimeStats ? (
                                            <div className={styles.statSub}>
                                                ระบบตรวจพบ: {realtimeStats.stats.late} ครั้ง ({realtimeStats.stats.late_min} นาที)
                                            </div>
                                        ) : <div className={styles.statSub}>กำลังโหลดสถิติ...</div>}
                                    </div>
                                    <div className={styles.statActions}>
                                        <button className={styles.btnDetail} onClick={() => setShowBreakdown(showBreakdown === 'late' ? null : 'late')}>
                                            <EyeIcon width={14} style={{display:'inline', marginRight:4}}/> รายละเอียด
                                        </button>
                                        <input 
                                            type="number" 
                                            className={styles.inputSmall}
                                            value={editData.attendance_counts.late}
                                            onChange={e => setEditData({ ...editData, attendance_counts: { ...editData.attendance_counts, late: Number(e.target.value) }})}
                                        />
                                    </div>
                                </div>
                                {showBreakdown === 'late' && realtimeStats && (
                                    <div className={styles.detailPanel}>
                                        {realtimeStats.details.lates.map((it:any, idx:number) => (
                                            <div key={idx} className={styles.detailItem}>
                                                <span>{new Date(it.date).toLocaleDateString("th-TH")}</span>
                                                <span style={{fontWeight:700, color:'#D93025'}}>{it.minutes} นาที</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className={styles.statRow}>
                                    <div className={styles.statInfo}>
                                        <div className={styles.statName}>ลาป่วย</div>
                                        {realtimeStats ? (
                                            <div className={styles.statSub}>
                                                ระบบตรวจพบ: {realtimeStats.stats.sick} วัน
                                            </div>
                                        ) : <div className={styles.statSub}>กำลังโหลดสถิติ...</div>}
                                    </div>
                                    <div className={styles.statActions}>
                                        <button className={styles.btnDetail} onClick={() => setShowBreakdown(showBreakdown === 'sick' ? null : 'sick')}>
                                            <EyeIcon width={14} style={{display:'inline', marginRight:4}}/> รายละเอียด
                                        </button>
                                        <input 
                                            type="number" 
                                            step="0.5"
                                            className={styles.inputSmall}
                                            value={editData.attendance_counts.sick}
                                            onChange={e => setEditData({ ...editData, attendance_counts: { ...editData.attendance_counts, sick: Number(e.target.value) }})}
                                        />
                                    </div>
                                </div>
                                {showBreakdown === 'sick' && realtimeStats && (
                                    <div className={styles.detailPanel}>
                                        {realtimeStats.details.sick.map((it:any, idx:number) => (
                                            <div key={idx} className={styles.detailItem}>
                                                <span>{new Date(it.start).toLocaleDateString("th-TH")} - {new Date(it.end).toLocaleDateString("th-TH")} ({it.days} วัน)</span>
                                                <span style={{fontSize:12, color:'#64748b'}}>{it.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className={styles.statRow}>
                                    <div className={styles.statInfo}>
                                        <div className={styles.statName}>ลากิจ</div>
                                        {realtimeStats ? (
                                            <div className={styles.statSub}>
                                                ระบบตรวจพบ: {realtimeStats.stats.personal} วัน
                                            </div>
                                        ) : <div className={styles.statSub}>กำลังโหลดสถิติ...</div>}
                                    </div>
                                    <div className={styles.statActions}>
                                        <button className={styles.btnDetail} onClick={() => setShowBreakdown(showBreakdown === 'personal' ? null : 'personal')}>
                                            <EyeIcon width={14} style={{display:'inline', marginRight:4}}/> รายละเอียด
                                        </button>
                                        <input 
                                            type="number" 
                                            step="0.5"
                                            className={styles.inputSmall}
                                            value={editData.attendance_counts.personal}
                                            onChange={e => setEditData({ ...editData, attendance_counts: { ...editData.attendance_counts, personal: Number(e.target.value) }})}
                                        />
                                    </div>
                                </div>
                                {showBreakdown === 'personal' && realtimeStats && (
                                    <div className={styles.detailPanel}>
                                        {realtimeStats.details.personal.map((it:any, idx:number) => (
                                            <div key={idx} className={styles.detailItem}>
                                                <span>{new Date(it.start).toLocaleDateString("th-TH")} - {new Date(it.end).toLocaleDateString("th-TH")} ({it.days} วัน)</span>
                                                <span style={{fontSize:12, color:'#64748b'}}>{it.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Section: Rubric Scores */}
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}><div className={styles.dot}/> คะแนนตามหัวข้อประเมิน (Rubric)</div>
                                <div className={styles.scoreGrid}>
                                    {CATEGORIES.map(cat => (
                                        <div key={cat.key} className={styles.scoreItem}>
                                            <div className={styles.scoreLabel}>{cat.label}</div>
                                            <input 
                                                type="number" 
                                                min="1" max="5"
                                                className={styles.scoreInput}
                                                value={editData.scores[cat.key]}
                                                onChange={e => setEditData({ ...editData, scores: { ...editData.scores, [cat.key]: Number(e.target.value) }})}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section: Decision & HR Remarks */}
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}><div className={styles.dot}/> สรุปผลและหมายเหตุจาก HR</div>
                                <div className={styles.grid}>
                                    <div>
                                        <div className={styles.label}>สถานะการประเมิน</div>
                                        <select 
                                            style={{ width:'100%', padding: 12, borderRadius: 12, border:'1px solid #e2e8f0', background:'#fff', fontWeight:700 }}
                                            value={editData.decision}
                                            onChange={e => setEditData({ ...editData, decision: e.target.value })}
                                        >
                                            <option value="pass">ผ่านทดลองงาน</option>
                                            <option value="fail">ไม่ผ่านทดลองงาน</option>
                                            <option value="extend">ขยายเวลา</option>
                                            <option value="salary_adjust">ปรับเงินเดือน</option>
                                        </select>
                                    </div>
                                    {editData.decision === 'salary_adjust' && (
                                        <div style={{ display:'flex', gap: 12 }}>
                                            <div style={{ flex:1 }}>
                                                <div className={styles.label}>เงินเดือนเดิม</div>
                                                <input type="number" style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid #e2e8f0' }} value={editData.salary_adjust_from} onChange={e => setEditData({ ...editData, salary_adjust_from: e.target.value })} />
                                            </div>
                                            <div style={{ flex:1 }}>
                                                <div className={styles.label}>ปรับเป็น</div>
                                                <input type="number" style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid #e2e8f0' }} value={editData.salary_adjust_to} onChange={e => setEditData({ ...editData, salary_adjust_to: e.target.value })} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginTop: 20 }}>
                                    <div className={styles.label}>หมายเหตุจากฝ่ายบุคคล (HR Notes)</div>
                                    <textarea 
                                        style={{ width:'100%', padding: 12, borderRadius: 12, border:'1px solid #e2e8f0', fontFamily:'var(--font-th)' }}
                                        rows={3}
                                        placeholder="ใส่หมายเหตุหรือบันทึกการแก้ไขที่นี่..."
                                        value={editData.hr_remark}
                                        onChange={e => setEditData({ ...editData, hr_remark: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sticky Result Summary */}
                        <div className={styles.modalFooter}>
                            <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>คะแนนรวม</div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: '#1e293b' }}>{currentTotal} / 300</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: '#D93025' }}>{currentGrade}</div>
                            </div>
                            <button className={styles.btnCancel} onClick={() => setSelectedId(null)}>ยกเลิก</button>
                            <button className={styles.btnSave} onClick={handleSaveReview} disabled={saving}>
                                {saving ? "กำลังบันทึก..." : "ยืนยันและบันทึกผล"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
