"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
    ClipboardDocumentListIcon,
    ArrowPathIcon,
    ArrowDownTrayIcon,
    MagnifyingGlassIcon,
    UserIcon,
    DocumentCheckIcon,
    BuildingOfficeIcon,
    BriefcaseIcon,
    EyeIcon,
    XMarkIcon,
    PencilSquareIcon,
    CheckIcon
} from "@heroicons/react/24/outline";
import styles from "./page.module.css";

export default function AdminKPIPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState<"trial" | "permanent">("permanent");
    
    // Modal State
    const [selectedEval, setSelectedEval] = useState<any>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editData, setEditData] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [attendance, setAttendance] = useState<any>(null);

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());

    const handleConfirmExport = () => {
        window.open(`/api/admin/kpi/export-excel${exportYear ? `?year=${exportYear}` : ''}`, "_blank");
        setShowExportModal(false);
    };

    const { data: list = [], isLoading: loading } = useQuery<any[]>({
        queryKey: ['admin-kpi'],
        queryFn: async () => {
            const res = await fetch("/api/admin/kpi");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            return data.list || [];
        }
    });

    const handleRetroAward = async () => {
        const cat = prompt("กรุณาระบุหมวดหมู่การประเมิน (เช่น MID_YEAR, ANNUAL, PROBATION):", "MID_YEAR");
        if (!cat) return;
        const yearStr = prompt("กรุณาระบุปี (เช่น 2026):", "2026");
        if (!yearStr) return;

        if (!confirm(`ยืนยันการแจกเหรียญ KPI ย้อนหลังสำหรับ ${cat} ปี ${yearStr} หรือไม่?`)) return;

        try {
            const res = await fetch("/api/admin/kpi/retro-award", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category: cat, year: parseInt(yearStr) })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`สำเร็จ! แจกเหรียญให้พนักงาน ${data.awarded} คน (ข้าม ${data.skipped} คน) จากทั้งหมด ${data.total_found} รายการ`);
            } else {
                alert("ผิดพลาด: " + data.error);
            }
        } catch (e) {
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        }
    };

    const filtered = (list || []).filter(item => {
        const matchesSearch = (item.employee?.name || "").toLowerCase().includes(search.toLowerCase()) ||
                             (item.employee?.emp_id || "").toLowerCase().includes(search.toLowerCase());
        const isTrial = item.employee?.is_on_trial;
        const matchesTab = tab === "trial" ? isTrial : !isTrial;
        return matchesSearch && matchesTab;
    });

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "completed": return "ประเมินเสร็จสิ้น";
            case "pending_supervisor": return "รอหัวหน้าประเมิน";
            case "pending_employee": return "รอพนักงานประเมิน";
            case "draft": return "ร่าง (ยังไม่ส่ง)";
            case "PENDING_APPROVAL":
            case "pending_approval": return "รออนุมัติ";
            default: return status;
        }
    };

    const handleExportPDF = (id: number) => {
        window.open(`/api/admin/kpi/pdf/${id}`, "_blank");
    };

    const openView = async (evalData: any) => {
        setSelectedEval(evalData);
        setEditData(JSON.parse(JSON.stringify(evalData))); // Deep copy for editing
        setIsEditMode(false);
        setAttendance(null);

        if (evalData.category === 'ANNUAL') {
            try {
                const aRes = await fetch(`/api/team/kpi/attendance?emp_id=${evalData.emp_id}&start=${evalData.period_start}&end=${evalData.period_end}`);
                if (aRes.ok) {
                    const aData = await aRes.json();
                    setAttendance(aData.stats);
                }
            } catch (err) {
                console.error("Failed to fetch attendance:", err);
            }
        }
    };

    const updateEditItem = (index: number, field: string, value: any) => {
        const newItems = [...editData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        
        // --- SECTION-BASED CALCULATION ---
        const p1Items = newItems.filter(it => it.section === "KPI");
        const p2Items = newItems.filter(it => it.section === "CORE_VALUE");
        const p3Items = newItems.filter(it => it.section === "COMPETENCY");

        const hasP3 = p3Items.length > 0;
        const w1 = hasP3 ? 0.70 : 0.80;
        const w2 = 0.20;
        const w3 = hasP3 ? 0.10 : 0;

        // Part 1: Weighted sum (p1 weight sums to 100)
        const s1 = p1Items.reduce((sum, it) => sum + (Number(it.weight) / 100) * (Number(it.supervisor_score) || 0), 0);
        // Part 2: Average
        const s2 = p2Items.length > 0 ? (p2Items.reduce((sum, it) => sum + (Number(it.supervisor_score) || 0), 0) / p2Items.length) : 0;
        // Part 3: Average
        const s3 = p3Items.length > 0 ? (p3Items.reduce((sum, it) => sum + (Number(it.supervisor_score) || 0), 0) / p3Items.length) : 0;

        const total = (s1 * w1) + (s2 * w2) + (s3 * w3);
        
        let grade = "E";
        if (total >= 4.5) grade = "A";
        else if (total >= 3.5) grade = "B";
        else if (total >= 2.5) grade = "C";
        else if (total >= 1.5) grade = "D";

        setEditData({ ...editData, items: newItems, total_supervisor_score: total, grade });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/kpi", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editData)
            });
            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ['admin-kpi'] });
                setSelectedEval(editData);
                setIsEditMode(false);
            } else {
                alert("บันทึกไม่สำเร็จ");
            }
        } catch (e) {
            alert("เกิดข้อผิดพลาด");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.wrap}>
            {/* --- HEADER --- */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>สรุปผลการประเมิน KPI</h1>
                    <div className={styles.subtitle}>ภาพรวมการประเมินผลการปฏิบัติงานรายบุคคลสำหรับพนักงานทั้งหมด</div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.btnRefresh} onClick={() => setShowExportModal(true)} style={{ background: '#10b981', color: 'white', borderColor: '#059669' }}>
                        <ArrowDownTrayIcon width={16} /> Export Excel
                    </button>
                    <button className={styles.btnRefresh} onClick={handleRetroAward} style={{ background: '#f59e0b', color: 'white', borderColor: '#d97706' }}>
                        แจกเหรียญย้อนหลัง
                    </button>
                    <button className={styles.btnRefresh} onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-kpi'] })} disabled={loading}>
                        <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} /> รีเฟรช
                    </button>
                </div>
            </div>

            {/* --- TABS --- */}
            <div className={styles.tabs}>
                <div 
                    className={`${styles.tabItem} ${tab === 'permanent' ? styles.tabActive : ''}`}
                    onClick={() => setTab('permanent')}
                >
                    <UserIcon width={18} /> พนักงานประจำ
                </div>
                <div 
                    className={`${styles.tabItem} ${tab === 'trial' ? styles.tabActive : ''}`}
                    onClick={() => setTab('trial')}
                >
                    <UserIcon width={18} /> พนักงานทดลองงาน
                </div>
            </div>

            {/* --- CONTENT CARD --- */}
            <div className={styles.card}>
                <div className={styles.cardTopAccent} />
                
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        <DocumentCheckIcon width={20} /> รายการประเมิน KPI ทั้งหมด
                    </div>
                    <div>
                        <span className={styles.rowCount}>{filtered.length} รายการ</span>
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

                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>พนักงาน</th>
                                <th>หน่วยงาน / ตำแหน่ง</th>
                                <th>ผู้ประเมิน</th>
                                <th>ครั้งที่ / รอบ</th>
                                <th>สถานะ</th>
                                <th>คะแนน / เกรด</th>
                                <th style={{ textAlign: "right" }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className={styles.tdLoading}>
                                    <ArrowPathIcon width={24} className="animate-spin mx-auto mb-2 opacity-20" />
                                    กำลังโหลดข้อมูล...
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className={styles.tdEmpty}>ไม่พบรายการที่ตรงกับเงื่อนไข</td></tr>
                            ) : filtered.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <UserIcon width={20} />
                                            </div>
                                            <div className={styles.empInfo}>
                                                <div className={styles.empName}>{item.employee?.name}</div>
                                                <div className={styles.empId}>{item.employee?.emp_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <BuildingOfficeIcon width={12} color="#cbd5e1" />
                                            <span style={{ fontSize: 12 }}>{item.employee?.departments?.name || "-"}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <BriefcaseIcon width={12} color="#cbd5e1" />
                                            <span style={{ fontSize: 11, color: '#64748b' }}>{item.employee?.job_positions?.title || "-"}</span>
                                        </div>
                                    </td>
                                    <td>{item.supervisor?.name || "-"}</td>
                                    <td>
                                        <div className={styles.evalNo}>
                                            {item.category === 'ANNUAL' ? (item.session_name === 'Mid-Year' ? 'Mid-Year Assessment' : item.session_name) : `ครั้งที่ ${item.evaluation_no}`}
                                        </div>
                                        {item.category === 'ANNUAL' && <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{item.year}</div>}
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${styles['badge_' + item.status]}`}>
                                            {getStatusLabel(item.status)}
                                        </span>
                                    </td>
                                    <td>
                                        {item.status === "completed" ? (
                                            <div className={styles.scoreRow}>
                                                <span className={styles.scoreVal}>{Number(item.total_supervisor_score).toFixed(2)}</span>
                                                <span className={styles.gradeVal}>{item.grade}</span>
                                            </div>
                                        ) : "-"}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        <div className={styles.actions}>
                                            <button 
                                                className={styles.btnAction} 
                                                title="ดูรายละเอียด"
                                                onClick={() => openView(item)}
                                            >
                                                <EyeIcon width={18} />
                                            </button>
                                            {item.status === "completed" && (
                                                <button 
                                                    className={styles.btnAction} 
                                                    style={{ color: '#0369a1' }} 
                                                    title="ดาวน์โหลด PDF"
                                                    onClick={() => handleExportPDF(item.id)}
                                                >
                                                    <ArrowDownTrayIcon width={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODAL: VIEW DETAILS --- */}
            {selectedEval && (
                <div className={styles.modalOverlay} onClick={() => { if(!saving) setSelectedEval(null); }}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <ClipboardDocumentListIcon width={24} color="#D93025" />
                                <h2>{isEditMode ? "แก้ไขข้อมูลการประเมิน (Admin Override)" : "รายละเอียดการประเมิน KPI"}</h2>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {!isEditMode ? (
                                    <button onClick={() => setIsEditMode(true)} className={styles.btnAction} title="แก้ไข"><PencilSquareIcon width={20} /></button>
                                ) : (
                                    <button onClick={handleSave} disabled={saving} className={styles.btnAction} style={{ color: '#10b981' }} title="บันทึก">
                                        {saving ? <ArrowPathIcon width={20} className="animate-spin" /> : <CheckIcon width={20} />}
                                    </button>
                                )}
                                <button onClick={() => setSelectedEval(null)} className={styles.btnAction}><XMarkIcon width={20} /></button>
                            </div>
                        </div>
                        <div className={styles.modalBody}>
                            {/* Score Summary */}
                            <div className={styles.section}>
                                <div className={styles.grid}>
                                    <div className={styles.infoBox} style={{ borderLeft: '4px solid #3b82f6' }}>
                                        <div className={styles.label}>คะแนนรวม (สุทธิ)</div>
                                        <div className={styles.value} style={{ fontSize: 24, color: '#3b82f6' }}>
                                            {Number(isEditMode ? editData.total_supervisor_score : selectedEval.total_supervisor_score).toFixed(2)}
                                        </div>
                                    </div>
                                    <div className={styles.infoBox} style={{ borderLeft: '4px solid #16a34a' }}>
                                        <div className={styles.label}>เกรด</div>
                                        <div className={styles.value} style={{ fontSize: 24, color: '#16a34a' }}>
                                            {isEditMode ? editData.grade : selectedEval.grade}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className={styles.section}>
                                {["KPI", "CORE_VALUE", "COMPETENCY"].map((sec) => {
                                    const items = (isEditMode ? editData.items : selectedEval.items)?.filter((it: any) => it.section === sec);
                                    if (!items || items.length === 0) return null;

                                    return (
                                        <div key={sec} style={{ marginBottom: 24 }}>
                                            <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderLeft: '3px solid #D93025', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                {sec === "KPI" ? "Part 1: Performance KPIs" : sec === "CORE_VALUE" ? "Part 2: Core Values / Attributes" : "Part 3: Competencies"}
                                            </div>
                                            <table className={styles.rubricTable}>
                                                <thead>
                                                    <tr>
                                                        <th>หัวข้อ / ตัวชี้วัด</th>
                                                        <th style={{ width: 80, textAlign: 'center' }}>น้ำหนัก</th>
                                                        <th>ผลลัพธ์ (Actual)</th>
                                                        <th style={{ width: 100, textAlign: 'center' }}>คะแนน (1-5)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((it: any, idx: number) => {
                                                        const globalIdx = (isEditMode ? editData.items : selectedEval.items).findIndex((x: any) => x.id === it.id);
                                                        return (
                                                            <tr key={it.id}>
                                                                <td>
                                                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{it.objective}</div>
                                                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{it.indicator}</div>
                                                                    {(it.objective.includes("มาสาย") || it.objective.includes("ลาป่วย") || it.objective.includes("ลากิจ")) && attendance && (
                                                                        <div style={{ fontSize: 10, color: '#D93025', fontWeight: 800, marginTop: 4, background: '#FEF2F2', display: 'inline-block', padding: '2px 6px', borderRadius: 4 }}>
                                                                            สถิติ: {
                                                                                it.objective.includes("มาสาย") ? `${attendance.latenessCount} ครั้ง` :
                                                                                it.objective.includes("ลาป่วย") ? `${attendance.sickLeaveCount} วัน` :
                                                                                it.objective.includes("ลากิจ") ? `${attendance.personalLeaveCount} วัน` : ""
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    {isEditMode ? (
                                                                        <input 
                                                                            type="number" 
                                                                            value={it.weight} 
                                                                            onChange={e => updateEditItem(globalIdx, 'weight', e.target.value)}
                                                                            className={styles.modalInput}
                                                                            style={{ width: 60, textAlign: 'center' }}
                                                                        />
                                                                    ) : `${it.weight}%`}
                                                                </td>
                                                                <td>
                                                                    {isEditMode ? (
                                                                        <input 
                                                                            value={it.result_description || ""} 
                                                                            onChange={e => updateEditItem(globalIdx, 'result_description', e.target.value)}
                                                                            className={styles.modalInput}
                                                                        />
                                                                    ) : (it.result_description || "-")}
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    {isEditMode ? (
                                                                        <input 
                                                                            type="number" 
                                                                            min="1" max="5" step="0.5"
                                                                            value={it.supervisor_score} 
                                                                            onChange={e => updateEditItem(globalIdx, 'supervisor_score', e.target.value)}
                                                                            className={styles.modalInput}
                                                                            style={{ width: 60, textAlign: 'center' }}
                                                                        />
                                                                    ) : Number(it.supervisor_score || 0).toFixed(1)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Comments */}
                            <div className={styles.section}>
                                <div className={styles.grid}>
                                    <div className={styles.infoBox}>
                                        <div className={styles.label}>ความเห็นพนักงาน</div>
                                        <div className={styles.value} style={{ fontStyle: 'italic', fontSize: 13 }}>
                                            {isEditMode ? (
                                                <textarea 
                                                    value={editData.employee_comment || ""} 
                                                    onChange={e => setEditData({...editData, employee_comment: e.target.value})}
                                                    className={styles.modalTextarea}
                                                />
                                            ) : (selectedEval.employee_comment || "-")}
                                        </div>
                                    </div>
                                    <div className={styles.infoBox}>
                                        <div className={styles.label}>ความเห็นหัวหน้างาน</div>
                                        <div className={styles.value} style={{ fontStyle: 'italic', fontSize: 13 }}>
                                            {isEditMode ? (
                                                <textarea 
                                                    value={editData.supervisor_comment || ""} 
                                                    onChange={e => setEditData({...editData, supervisor_comment: e.target.value})}
                                                    className={styles.modalTextarea}
                                                />
                                            ) : (selectedEval.supervisor_comment || "-")}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && (
                <div className={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className={styles.modalHeader}>
                            <h2>ระบุปีที่ต้องการ Export</h2>
                            <button className={styles.btnAction} onClick={() => setShowExportModal(false)}>
                                <XMarkIcon width={24} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                                โปรดระบุปีที่ต้องการดึงข้อมูล (ปล่อยว่างถ้าต้องการดึงข้อมูลทั้งหมด)
                            </p>
                            <input 
                                type="text" 
                                value={exportYear} 
                                onChange={e => setExportYear(e.target.value)} 
                                placeholder="เช่น 2026"
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none', marginBottom: '15px' }}
                            />
                            
                            <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                                รอบการประเมิน (Session)
                            </p>
                            <select 
                                onChange={e => {
                                    // Save the selected session. We will just use a global or state variable.
                                    // Wait, we don't have a state for exportSession yet. Let's just use window.exportSession.
                                    (window as any).exportSession = e.target.value;
                                }}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none' }}
                                defaultValue=""
                            >
                                <option value="">ทั้งหมด (All)</option>
                                <option value="Mid-Year">Mid-Year Assessment</option>
                                <option value="Year-End">Year-End Assessment</option>
                            </select>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.btnCancel} onClick={() => setShowExportModal(false)}>ยกเลิก</button>
                            <button className={styles.btnSave} onClick={() => {
                                const session = (window as any).exportSession || '';
                                let url = `/api/admin/kpi/export-excel?`;
                                if (exportYear) url += `year=${exportYear}&`;
                                if (session) url += `session=${session}`;
                                window.open(url, "_blank");
                                setShowExportModal(false);
                            }}>ยืนยัน</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
