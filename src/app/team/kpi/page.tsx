"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    UserIcon,
    ArrowPathIcon,
    UserCircleIcon,
    PencilSquareIcon,
    CheckBadgeIcon,
    EyeIcon,
    AcademicCapIcon,
    UsersIcon
} from "@heroicons/react/24/solid";
import styles from "./page.module.css";

interface KPIEvaluation {
    id: number;
    evaluation_no: number;
    status: string;
    total_supervisor_score: number | null;
    evaluation_date: string;
}

interface Subordinate {
    emp_id: string;
    name: string;
    hire_date: string | null;
    position: string;
    department: string;
    is_on_trial: boolean;
    evaluations: KPIEvaluation[];
    prob_next_round: number;
    prob_due_date: string | null;
    prob_unlock_date: string | null;
    prob_is_unlocked: boolean;
}

export default function SupervisorKPIPage() {
    const [list, setList] = useState<Subordinate[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'trial' | 'regular'>('trial');

    useEffect(() => {
        fetch("/api/team/kpi/employees")
            .then(r => r.json())
            .then(data => {
                if (data.ok) setList(data.list);
            })
            .finally(() => setLoading(false));
    }, []);

    const getStatusInfo = (status: string) => {
        switch (status) {
            case "draft": return { label: "ร่าง (ยังไม่ส่ง)", color: "#94a3b8", icon: <PencilSquareIcon width={14} /> };
            case "pending_employee": return { label: "รอพนักงานประเมิน", color: "#f59e0b", icon: <EyeIcon width={14} /> };
            case "pending_supervisor": return { label: "รอหัวหน้าประเมิน", color: "#3b82f6", icon: <CheckBadgeIcon width={14} /> };
            case "completed": return { label: "ประเมินเสร็จสิ้น", color: "#10b981", icon: <CheckBadgeIcon width={14} /> };
            default: return { label: status, color: "#94a3b8", icon: null };
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>จัดการ KPI รายบุคคล</h1>
                    <div className={styles.heroSubtitle}>นิยามเป้าหมายและประเมินผลสำหรับพนักงานในทีมของคุณ</div>
                </div>

                {/* ── TABS ── */}
                <div className={styles.tabs}>
                    <div 
                        className={`${styles.tab} ${activeTab === 'trial' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('trial')}
                    >
                        <UsersIcon width={18} />
                        <span>พนักงานทดลองงาน</span>
                    </div>
                    <div 
                        className={`${styles.tab} ${activeTab === 'regular' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('regular')}
                    >
                        <AcademicCapIcon width={18} />
                        <span>พนักงานประจำ</span>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingContainer}>
                        <ArrowPathIcon width={40} className="animate-spin mx-auto mb-4 opacity-10" />
                        <div>กำลังรวบรวมข้อมูลพนักงาน...</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(() => {
                            const filtered = list.filter(e => activeTab === 'trial' ? e.is_on_trial : !e.is_on_trial);

                            if (filtered.length === 0) {
                                return (
                                    <div className={styles.emptyState}>
                                        <UserCircleIcon width={48} className="mx-auto mb-4 text-slate-300" />
                                        <h3 style={{ fontWeight: 700, color: "#475569" }}>
                                            {activeTab === 'trial' ? "ไม่พบพนักงานทดลองงาน" : "ไม่พบพนักงานประจำ"}
                                        </h3>
                                        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                                            คุณไม่มีพนักงานในทีมกลุ่มนี้ที่ต้องจัดการ KPI
                                        </p>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    <div className={styles.sectionLabel}>
                                        <div className={styles.dot} />
                                        <span>{activeTab === 'trial' ? 'Trial Period' : 'Regular Staff'} ({filtered.length})</span>
                                    </div>

                                    {filtered.map((emp, i) => {
                                        // Priority Logic: Find the latest evaluation for the CURRENT track
                                        const categoryToFind = activeTab === 'trial' ? 'PROBATION' : 'ANNUAL';
                                        // Priority: 1. Active evaluation of the correct category, 2. Latest evaluation of correct category, 3. Any latest
                                        let currentEval = emp.evaluations.find(ev => (ev as any).category === categoryToFind && ev.status !== 'completed');
                                        if (!currentEval) {
                                            currentEval = emp.evaluations.find(ev => (ev as any).category === categoryToFind);
                                        }
                                        if (!currentEval) currentEval = emp.evaluations[0];

                                        const isMidYearDone = currentEval && 
                                                              (currentEval as any).category === 'ANNUAL' && 
                                                              (currentEval as any).session_name?.includes('Mid-Year') && 
                                                              currentEval.status === 'completed';

                                        const statusInfo = currentEval ? getStatusInfo(currentEval.status) : null;
                                        const isMismatch = currentEval && (currentEval as any).category !== categoryToFind;

                                        return (
                                            <div key={emp.emp_id} className={styles.card} style={{ animationDelay: `${i * 0.05}s` }}>
                                                <div className={styles.empInfo}>
                                                    <div className={styles.avatar}>
                                                        <UserIcon width={24} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                            <div className={styles.empName}>{emp.name}</div>
                                                            {statusInfo && (
                                                                <div className={styles.statusBadge} style={{ backgroundColor: statusInfo.color + "15", color: statusInfo.color }}>
                                                                    {statusInfo.icon}
                                                                    <span>{statusInfo.label}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className={styles.empDetails}>{emp.emp_id} · {emp.position || "Staff"}</div>
                                                    </div>
                                                </div>

                                                <div className={styles.metaGrid}>
                                                    <div className={styles.metaItem}>
                                                        <span className={styles.metaLabel}>วันที่เริ่มงาน</span>
                                                        <span className={styles.metaVal}>
                                                            {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString("th-TH") : "-"}
                                                        </span>
                                                    </div>
                                                    <div className={styles.metaItem}>
                                                        <span className={styles.metaLabel}>รอบการประเมิน (Session)</span>
                                                        <span className={styles.metaVal} style={{ color: isMidYearDone ? 'var(--blue)' : '#d93025', fontWeight: 800 }}>
                                                            {isMidYearDone ? (
                                                                "Ready for Year-End Assessment"
                                                            ) : currentEval && !isMismatch ? (
                                                                <>
                                                                    {(currentEval as any).category === 'ANNUAL' ? (currentEval as any).session_name || 'Annual' : `ครั้งที่ ${currentEval.evaluation_no}`}
                                                                    <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: 4 }}>
                                                                        {(currentEval as any).year || ''}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                `ยังไม่ได้เริ่ม (ครั้งที่ ${activeTab === 'trial' ? (emp.evaluations.filter(ev => (ev as any).category === 'PROBATION').length + 1) : 1})`
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className={styles.actions}>
                                                    {(!currentEval || isMismatch || currentEval.status === "completed") ? (
                                                        (activeTab === 'trial' && !emp.prob_is_unlocked) ? (
                                                            <div style={{
                                                                background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '8px',
                                                                padding: '8px 12px', display: 'flex', flexDirection: 'column',
                                                                alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%'
                                                            }}>
                                                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                                                    เปิดให้ทำ KPI วันที่ {emp.prob_unlock_date ? new Date(emp.prob_unlock_date).toLocaleDateString("th-TH") : "ไม่ระบุ"}
                                                                </div>
                                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                                    (กำหนด {emp.prob_next_round === 1 ? 30 : emp.prob_next_round === 2 ? 60 : emp.prob_next_round === 3 ? 90 : 119} วัน: {emp.prob_due_date ? new Date(emp.prob_due_date).toLocaleDateString("th-TH") : "ไม่ระบุ"})
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <Link href={`/team/kpi/define/${emp.emp_id}?category=${categoryToFind}`} className={styles.btnPrimary}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                                    <PencilSquareIcon width={18} />
                                                                    <span>เริ่มกำหนดเป้าหมาย {activeTab === 'trial' ? 'KPI' : 'ประจำปี'}</span>
                                                                </div>
                                                            </Link>
                                                        )
                                                    ) : currentEval.status === "pending_supervisor" ? (
                                                        <Link href={`/team/kpi/evaluate/${currentEval.id}`} className={styles.btnPrimary} style={{ background: '#3b82f6', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                                <CheckBadgeIcon width={18} />
                                                                <span>ประเมินคะแนน KPI</span>
                                                            </div>
                                                        </Link>
                                                    ) : (
                                                        <Link href={`/team/kpi/define/${emp.emp_id}?category=${categoryToFind}`} className={styles.btnSecondary}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                                <EyeIcon width={18} />
                                                                <span>ดูรายละเอียด / แก้ไข</span>
                                                            </div>
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}
