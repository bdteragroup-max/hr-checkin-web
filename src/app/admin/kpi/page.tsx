"use client";

import { useEffect, useState } from "react";
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
    ChatBubbleLeftEllipsisIcon
} from "@heroicons/react/24/outline";
import styles from "./page.module.css";

export default function AdminKPIPage() {
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    
    // Modal State
    const [selectedEval, setSelectedEval] = useState<any>(null);

    const refresh = () => {
        setLoading(true);
        fetch("/api/admin/kpi")
            .then(r => r.json())
            .then(data => {
                if (data.ok) setList(data.list || []);
            })
            .catch(err => console.error("Refresh Error:", err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refresh();
    }, []);

    const filtered = (list || []).filter(item => 
        (item.employee?.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.employee?.emp_id || "").toLowerCase().includes(search.toLowerCase())
    );

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "completed": return "ประเมินเสร็จสิ้น";
            case "pending_supervisor": return "รอหัวหน้าประเมิน";
            case "pending_employee": return "รอพนักงานประเมิน";
            case "draft": return "ร่าง (ยังไม่ส่ง)";
            default: return status;
        }
    };

    const handleExportPDF = (id: number) => {
        window.open(`/api/admin/kpi/pdf/${id}`, "_blank");
    };

    const openView = (evalData: any) => {
        setSelectedEval(evalData);
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
                    <button className={styles.btnRefresh} onClick={refresh} disabled={loading}>
                        <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} /> รีเฟรช
                    </button>
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
                                <th>ครั้งที่</th>
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
                                    <td><span className={styles.evalNo}>{item.evaluation_no}</span></td>
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
                <div className={styles.modalOverlay} onClick={() => setSelectedEval(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2><ClipboardDocumentListIcon width={24} color="#D93025" /> รายละเอียดการประเมิน KPI</h2>
                            <button onClick={() => setSelectedEval(null)} className={styles.btnAction}><XMarkIcon width={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            {/* Employee Info Header */}
                            <div className={styles.section}>
                                <div className={styles.grid}>
                                    <div className={styles.infoBox}>
                                        <div className={styles.label}>พนักงานที่รับการประเมิน</div>
                                        <div className={styles.value}>{selectedEval.employee?.name} ({selectedEval.employee?.emp_id})</div>
                                    </div>
                                    <div className={styles.infoBox}>
                                        <div className={styles.label}>ผู้ประเมิน (หัวหน้างาน)</div>
                                        <div className={styles.value}>{selectedEval.supervisor?.name || "N/A"}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Evaluation Result if completed */}
                            {selectedEval.status === "completed" && (
                                <div className={styles.section}>
                                    <div className={styles.sectionTitle}>สรุปผลการประเมิน</div>
                                    <div className={styles.grid}>
                                        <div className={styles.infoBox} style={{ borderLeft: '4px solid #3b82f6' }}>
                                            <div className={styles.label}>คะแนนเฉลี่ยรวม</div>
                                            <div className={styles.value} style={{ fontSize: 24, color: '#3b82f6' }}>
                                                {Number(selectedEval.total_supervisor_score).toFixed(2)} / 5.00
                                            </div>
                                        </div>
                                        <div className={styles.infoBox} style={{ borderLeft: '4px solid #16a34a' }}>
                                            <div className={styles.label}>เกรดที่ได้รับ</div>
                                            <div className={styles.value} style={{ fontSize: 24, color: '#16a34a' }}>
                                                {selectedEval.grade}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Rubric Items Table */}
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>หัวข้อการประเมินและเกณฑ์คะแนน</div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className={styles.rubricTable}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40%' }}>หัวข้อ / ตัวชี้วัด</th>
                                                <th>น้ำหนัก</th>
                                                <th style={{ textAlign: 'center' }}>คะแนนพนักงาน</th>
                                                <th style={{ textAlign: 'center' }}>คะแนนหัวหน้า</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedEval.items?.map((it: any) => (
                                                <tr key={it.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{it.objective}</div>
                                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{it.indicator}</div>
                                                    </td>
                                                    <td><span className={styles.weightTag}>{it.weight}%</span></td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {it.employee_score ? (
                                                            <span className={styles.scoreBadge} style={{ background: '#fffbeb', color: '#d97706' }}>
                                                                {it.employee_score}
                                                            </span>
                                                        ) : "-"}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {it.supervisor_score ? (
                                                            <span className={styles.scoreBadge} style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                                                {it.supervisor_score}
                                                            </span>
                                                        ) : "-"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Comments Section */}
                            <div className={styles.section}>
                                <div className={styles.grid}>
                                    <div>
                                        <div className={styles.sectionTitle}><ChatBubbleLeftEllipsisIcon width={16} /> ความเห็นของพนักงาน</div>
                                        {selectedEval.employee_comment ? (
                                            <div className={styles.comment}>{selectedEval.employee_comment}</div>
                                        ) : (
                                            <div style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>ไม่มีความเห็น</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className={styles.sectionTitle}><ChatBubbleLeftEllipsisIcon width={16} /> ความเห็นของหัวหน้างาน</div>
                                        {selectedEval.supervisor_comment ? (
                                            <div className={styles.comment} style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
                                                {selectedEval.supervisor_comment}
                                            </div>
                                        ) : (
                                            <div style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>ไม่มีความเห็น</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                             <button className={styles.btnCancel} onClick={() => setSelectedEval(null)}>ปิดหน้าต่าง</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
