"use client";

import { useState, useMemo } from "react";
import Swal from "sweetalert2";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
    EyeIcon,
    ArrowDownTrayIcon
} from "@heroicons/react/24/outline";
import { 
    calculateTotalScore, 
    calculateGrade, 
    calculateAttendanceScore 
} from "@/utils/probationCalculations";
import * as XLSX from "xlsx";

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
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [staffType, setStaffType] = useState<'all' | 'trial' | 'regular'>('all');
    const [sendingId, setSendingId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'to_action' | 'upcoming'>('to_action');

    // -- REVIEW UI STATE --
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editData, setEditData] = useState<any>(null);
    const [realtimeStats, setRealtimeStats] = useState<any>(null);
    const [showBreakdown, setShowBreakdown] = useState<string | null>(null); 
    const [saving, setSaving] = useState(false);

    // -- SEND BACK STATE --
    const [returnReason, setReturnReason] = useState("");
    const [showReturnInput, setShowReturnInput] = useState(false);
    const [sendingBack, setSendingBack] = useState(false);

    const { data, isLoading: loading } = useQuery({
        queryKey: ['admin-probation'],
        queryFn: async () => {
            const res = await fetch("/api/admin/probation/evaluations");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return { list: json.list || [], pending: json.pending || [] };
        }
    });

    const list: any[] = data?.list || [];
    const pendingList: any[] = data?.pending || [];

    const filtered = (list || []).filter(item => {
        const matchesSearch = (item.employee?.name || "").toLowerCase().includes(search.toLowerCase()) ||
                              (item.employee?.emp_id || "").toLowerCase().includes(search.toLowerCase());
        
        if (staffType === 'trial') return matchesSearch && item.employee?.is_on_trial;
        if (staffType === 'regular') return matchesSearch && !item.employee?.is_on_trial;
        return matchesSearch;
    });

    const filteredPending = (pendingList || []).filter(item => {
        const matchesSearch = (item.name || "").toLowerCase().includes(search.toLowerCase()) ||
                              (item.emp_id || "").toLowerCase().includes(search.toLowerCase());
                              
        if (staffType === 'regular') return false; // Backend currently only sends trial employees for upcoming
        return matchesSearch;
    });

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
            score_comments: evalItem.score_comments || {},
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

    const handleSendBack = async () => {
        if (!selectedId || sendingBack) return;
        if (!returnReason.trim()) {
            Swal.fire({ icon: 'warning', title: 'กรุณาระบุข้อมูล', text: 'กรุณาระบุเหตุผลที่ต้องส่งกลับให้แก้ไข', confirmButtonColor: '#DC2626' });
            return;
        }

        setSendingBack(true);
        try {
            const res = await fetch(`/api/admin/probation/evaluations/${selectedId}/send-back`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ return_reason: returnReason.trim() })
            });
            const data = await res.json();
            
            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'สำเร็จ!', text: 'ส่งกลับสำเร็จ และระบบได้แจ้งเตือนหัวหน้างานผ่าน LINE แล้ว', confirmButtonColor: '#16a34a' });
                setSelectedId(null);
                setReturnReason("");
                setShowReturnInput(false);
                queryClient.invalidateQueries({ queryKey: ['admin-probation'] });
            } else {
                Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: `เกิดข้อผิดพลาด: ${data.message || data.error}` });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
        } finally {
            setSendingBack(false);
        }
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
                queryClient.invalidateQueries({ queryKey: ['admin-probation'] });
            } else {
                Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'เกิดข้อผิดพลาดในการบันทึก' });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
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
        const result = await Swal.fire({
            title: 'ยืนยันการส่ง?',
            text: "ต้องการส่งสรุปผลการประเมินนี้ไปยัง LINE ฝ่ายบริหารใช่หรือไม่?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'ใช่, ส่งเลย!',
            cancelButtonText: 'ยกเลิก'
        });
        
        if (!result.isConfirmed) return;

        setSendingId(id);
        try {
            const res = await fetch(`/api/admin/probation/evaluations/${id}/send-summary`, { method: "POST" });
            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'สำเร็จ!', text: 'ส่งเรียบร้อยแล้ว', timer: 2000, showConfirmButton: false });
                queryClient.invalidateQueries({ queryKey: ['admin-probation'] });
            } else {
                Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'เกิดข้อผิดพลาดในการส่ง' });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
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

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        // 1. To Action Sheet
        const toActionData = filtered.map(item => ({
            "ชื่อพนักงาน": item.employee?.name || "-",
            "รหัสพนักงาน": item.employee?.emp_id || "-",
            "ผู้ประเมิน": item.supervisor?.name || "-",
            "ครั้งที่": item.evaluation_no,
            "วันที่เริ่มประเมิน": item.period_start ? new Date(item.period_start).toLocaleDateString("th-TH") : "-",
            "วันที่สิ้นสุดประเมิน": item.period_end ? new Date(item.period_end).toLocaleDateString("th-TH") : "-",
            "คะแนน": item.total_score,
            "เกรด": item.grade,
            "ผลสรุป": decisionMap[item.decision]?.label || item.decision,
            "สถานะ HR": item.status === "reviewed" ? "ตรวจสอบแล้ว" : "รอการตรวจสอบ"
        }));
        const wsToAction = XLSX.utils.json_to_sheet(toActionData);
        XLSX.utils.book_append_sheet(wb, wsToAction, "To Action");

        // 2. Upcoming Sheet
        const upcomingData = filteredPending.map(emp => {
            const info = getDaysInfo(emp.probation_end_date);
            
            const getTargetDate = (round: number) => {
                if (!emp.hire_date) return "-";
                const dueDays = round === 1 ? 30 : round === 2 ? 60 : round === 3 ? 90 : 119;
                const hire = new Date(emp.hire_date);
                const target = new Date(hire);
                target.setDate(hire.getDate() + dueDays);
                return target.toLocaleDateString("th-TH");
            };

            return {
                "ชื่อพนักงาน": emp.name,
                "รหัสพนักงาน": emp.emp_id,
                "ตำแหน่ง": emp.job_title,
                "ประเมินครั้งถัดไป": emp.next_round,
                "วันที่เริ่มงาน": emp.hire_date ? new Date(emp.hire_date).toLocaleDateString("th-TH") : "-",
                "วันสิ้นสุดทดลองงาน": emp.probation_end_date ? new Date(emp.probation_end_date).toLocaleDateString("th-TH") : "-",
                "เหลือเวลา (วัน)": info ? info.days : "-",
                "กำหนดประเมินครั้งที่ 1 (30 วัน)": getTargetDate(1),
                "กำหนดประเมินครั้งที่ 2 (60 วัน)": getTargetDate(2),
                "กำหนดประเมินครั้งที่ 3 (90 วัน)": getTargetDate(3),
                "กำหนดประเมินครั้งที่ 4 (119 วัน)": getTargetDate(4)
            };
        });
        const wsUpcoming = XLSX.utils.json_to_sheet(upcomingData);
        XLSX.utils.book_append_sheet(wb, wsUpcoming, "Upcoming");

        XLSX.writeFile(wb, `Probation_Overview_${new Date().toISOString().split('T')[0]}.xlsx`);
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
                    className={`${styles.tab} ${activeTab === 'to_action' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('to_action')}
                >
                    To Action (รอตรวจสอบ)
                </div>
                <div 
                    className={`${styles.tab} ${activeTab === 'upcoming' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('upcoming')}
                >
                    Upcoming (รอดำเนินการประเมิน)
                </div>
            </div>

            {/* --- CONTENT CARD --- */}
            <div className={styles.card}>
                <div className={styles.cardTopAccent} />
                
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        <DocumentCheckIcon width={20} /> {activeTab === 'to_action' ? 'รายการส่งประเมินที่รอตรวจสอบ' : 'พนักงานที่ใกล้ถึงกำหนดประเมิน'}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span className={styles.rowCount}>
                            {activeTab === 'to_action' ? filtered.length : filteredPending.length} รายการ
                        </span>
                        <button onClick={handleExportExcel} style={{ background: '#10b981', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                            <ArrowDownTrayIcon width={16} /> Export Excel
                        </button>
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
                    <div className={styles.filterGroup}>
                        <select 
                            className={styles.filterSelect}
                            value={staffType}
                            onChange={e => setStaffType(e.target.value as any)}
                        >
                            <option value="all">พนักงานทั้งหมด (All Staff)</option>
                            <option value="trial">พนักงานทดลองงาน (Probation)</option>
                            <option value="regular">พนักงานประจำ (Permanent)</option>
                        </select>
                    </div>
                </div>

                {/* --- UPCOMING (PENDING) EVALUATIONS SECTION --- */}
                {activeTab === 'upcoming' && (
                    <div className={styles.sectionPending}>
                        {filteredPending.length === 0 ? (
                            <div className={styles.tdEmpty}>ไม่มีพนักงานที่รอรับการประเมิน</div>
                        ) : (
                            <div className={styles.pendingGrid}>
                                {filteredPending.map(emp => {
                                    const info = getDaysInfo(emp.probation_end_date);
                                    return (
                                        <div key={emp.emp_id} className={styles.pendingCardCompact}>
                                            <div className={styles.pendingEmpCompact}>
                                                <div className={styles.pendingAvatar}><UserIcon width={20} /></div>
                                                <div style={{ flex: 1 }}>
                                                    <div className={styles.pendingName}>{emp.name}</div>
                                                    <div className={styles.pendingId}>{emp.emp_id} • {emp.job_title}</div>
                                                </div>
                                                <div className={styles.pendingRoundCompact}>
                                                    <span>ครั้งที่</span>
                                                    <b>{emp.next_round}</b>
                                                </div>
                                            </div>
                                            <div className={styles.pendingMetaCompact}>
                                                <div className={styles.metaCol}>
                                                    <span className={styles.metaLabel}>วันสิ้นสุดทดลองงาน</span>
                                                    <span className={styles.metaVal}>{emp.probation_end_date ? new Date(emp.probation_end_date).toLocaleDateString("th-TH") : "-"}</span>
                                                </div>
                                                {info && (
                                                    <div className={styles.metaCol} style={{ color: info.color }}>
                                                        <span className={styles.metaLabel}>สถานะ</span>
                                                        <span className={styles.metaVal}><ExclamationTriangleIcon width={12} style={{ display: 'inline', marginRight: 4 }} />เหลือ {info.days} วัน</span>
                                                    </div>
                                                )}
                                            </div>

                                            {emp.hire_date && (
                                                <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px dashed #e2e8f0' }}>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>รอบการประเมิน (SESSION)</div>
                                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>
                                                        {[1, 2, 3, 4].map((round, idx) => {
                                                            const dueDays = round === 1 ? 30 : round === 2 ? 60 : round === 3 ? 90 : 119;
                                                            const hire = new Date(emp.hire_date);
                                                            const target = new Date(hire);
                                                            target.setDate(hire.getDate() + dueDays);
                                                            
                                                            const isCompleted = round < emp.next_round;
                                                            const isPending = round === emp.next_round;
                                                            
                                                            const now = new Date();
                                                            now.setHours(0,0,0,0);
                                                            const diff = now.getTime() - target.getTime();
                                                            const delayDays = isPending && diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;

                                                            return (
                                                                <div key={round} style={{ 
                                                                    display: 'flex', gap: 12, alignItems: 'center', 
                                                                    padding: '6px 0', 
                                                                    borderBottom: idx < 3 ? '1px dashed #e2e8f0' : 'none',
                                                                    opacity: isCompleted ? 0.5 : 1
                                                                }}>
                                                                    <div style={{ color: isCompleted ? '#94a3b8' : '#d93025', fontWeight: 800, fontSize: 13, minWidth: 50 }}>ครั้งที่ {round}</div>
                                                                    <div style={{ color: '#475569', fontSize: 12, flex: 1 }}>
                                                                        ครบ {dueDays} วัน: {target.toLocaleDateString("th-TH")}
                                                                    </div>
                                                                    {isCompleted && (
                                                                        <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>ประเมินแล้ว</div>
                                                                    )}
                                                                    {delayDays > 0 && (
                                                                        <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, background: '#fee2e2', padding: '2px 8px', borderRadius: 12 }}>
                                                                            เลยกำหนด {delayDays} วัน
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* --- TO ACTION (SUBMITTED) TABLE --- */}
                {activeTab === 'to_action' && (
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
                                                <span className={styles.pendingStatus} style={{ background: '#fef3c7', color: '#d97706' }}>รอการตรวจสอบ</span>
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
                )}
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
                            <div className={styles.scoreList}>
                                {CATEGORIES.map(cat => (
                                    <div key={cat.key} className={styles.scoreListItem}>
                                        <div className={styles.scoreListInfo}>
                                            <div className={styles.scoreCatLabel}>
                                                {cat.label} <span className={styles.scoreWeight}>(น้ำหนัก {cat.weight})</span>
                                            </div>
                                            <input 
                                                type="text" 
                                                className={styles.scoreCommentInput}
                                                placeholder="เพิ่มความคิดเห็น (ถ้ามี)..."
                                                value={editData.score_comments[cat.key] || ""}
                                                onChange={e => setEditData({
                                                    ...editData, 
                                                    score_comments: { ...editData.score_comments, [cat.key]: e.target.value }
                                                })}
                                            />
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
                             
                             <button className={styles.btnSave} style={{ background: '#fff', color: '#DC2626', borderColor: '#DC2626', marginRight: 'auto', marginLeft: 16 }} onClick={() => setShowReturnInput(true)}>
                                 ส่งกลับให้แก้ไข
                             </button>
                             <button className={styles.btnCancel} onClick={() => setSelectedId(null)}>ยกเลิก</button>
                             <button className={styles.btnSave} onClick={handleSaveReview} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกผล"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SEND BACK REVISION DIALOG */}
            {showReturnInput && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ExclamationTriangleIcon width={24} style={{ color: '#DC2626' }} /> ยืนยันการส่งกลับให้แก้ไข
                        </h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#4b5563' }}>กรุณาระบุเหตุผลที่ต้องส่งกลับ เพื่อให้หัวหน้างานทราบถึงสิ่งที่ต้องแก้ไข</p>
                        <textarea 
                            style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'none', marginBottom: '24px', outline: 'none', fontSize: '14px', color: '#1f2937' }}
                            placeholder="ระบุเหตุผลที่ต้องส่งกลับ..."
                            value={returnReason}
                            onChange={e => setReturnReason(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setShowReturnInput(false); setReturnReason(""); }} style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} disabled={sendingBack}>ยกเลิก</button>
                            <button onClick={handleSendBack} style={{ padding: '8px 16px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} disabled={sendingBack}>
                                {sendingBack ? "กำลังส่ง..." : "ยืนยันส่งกลับ"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
