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
    evaluations: any[];
    track_info: {
        probation: { next_round: number; due_date: string | null; unlock_date: string | null; is_unlocked: boolean };
        monthly: { next_round: number; due_date: string | null; unlock_date: string | null; is_unlocked: boolean };
        annual: { is_unlocked: boolean };
    };
}

export default function SupervisorKPIPage() {
    const [list, setList] = useState<Subordinate[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'trial' | 'regular'>('trial');

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

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
                                        const renderTrack = (category: string, label: string, info: any) => {
                                            // Priority Logic: 
                                            // 1. For MONTHLY, try to find current month/year first
                                            // 2. Otherwise find first uncompleted for that category
                                            // 3. Otherwise find latest completed for that category
                                            
                                            let currentEval = null;
                                            if (category === 'MONTHLY') {
                                                currentEval = emp.evaluations.find(ev => 
                                                    (ev as any).category === 'MONTHLY' && 
                                                    ev.year === currentYear && 
                                                    ev.evaluation_no === currentMonth
                                                );
                                            }

                                            // Only fall back to others if we don't have a current one
                                            if (!currentEval) {
                                                currentEval = emp.evaluations.find(ev => (ev as any).category === category && ev.status !== 'completed');
                                            }
                                            
                                            // Only show completed ones if we are NOT currently in an unlocked state for a new one
                                            if (!currentEval && !info.is_unlocked) {
                                                currentEval = emp.evaluations.find(ev => (ev as any).category === category && ev.status === 'completed');
                                            }

                                            const statusInfo = currentEval ? getStatusInfo(currentEval.status) : null;
                                            const isMismatch = currentEval && (currentEval as any).category !== category;

                                            return (
                                                <div className={styles.trackRow} key={category}>
                                                    <div className={styles.trackMeta}>
                                                        <div className={styles.trackLabel}>{label}</div>
                                                        <div className={styles.trackVal}>
                                                            {currentEval && !isMismatch ? (
                                                                <>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <span style={{ color: '#d93025', fontWeight: 800 }}>
                                                                            {category === 'MONTHLY' ? `KPI เดือน ${currentEval.evaluation_no}/${currentEval.year || ''}` :
                                                                                category === 'ANNUAL' ? (currentEval.session_name || 'Annual KPI') : `ครั้งที่ ${currentEval.evaluation_no}`}
                                                                        </span>
                                                                        {statusInfo && (
                                                                            <div className={styles.statusBadgeSmall} style={{ backgroundColor: statusInfo.color + "15", color: statusInfo.color }}>
                                                                                {statusInfo.label}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {category === 'MONTHLY' && (
                                                                        <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.8, color: '#94a3b8' }}>
                                                                            (เปิดให้ประเมินวันที่ 20 ของทุกเดือน)
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span style={{ color: '#94a3b8' }}>
                                                                        ยังไม่ได้เริ่ม{category === 'MONTHLY' ? ` (เดือน ${info.next_round})` : category === 'PROBATION' ? ` (ครั้งที่ ${info.next_round})` : ''}
                                                                    </span>
                                                                    {category === 'MONTHLY' && (
                                                                        <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.8, color: '#94a3b8' }}>
                                                                            (เปิดให้ประเมินวันที่ 20 ของทุกเดือน)
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className={styles.trackActions}>
                                                        {(!currentEval || isMismatch || currentEval.status === "completed") ? (
                                                            (!info.is_unlocked) ? (
                                                                <div className={styles.lockedHint}>
                                                                    เปิด {info.unlock_date ? new Date(info.unlock_date).toLocaleDateString("th-TH") : "-"}
                                                                </div>
                                                            ) : (
                                                                <Link 
                                                                    href={`/team/kpi/define/${emp.emp_id}?category=${category}${category === 'MONTHLY' ? `&round=${currentMonth}&year=${currentYear}` : ''}`} 
                                                                    className={currentEval?.status === 'completed' ? styles.btnActionDone : styles.btnActionPrimary}
                                                                >
                                                                    {currentEval?.status === 'completed' ? <CheckBadgeIcon width={14} /> : <PencilSquareIcon width={14} />}
                                                                    <span>{currentEval?.status === 'completed' ? 'เสร็จสิ้น' : `เริ่ม${category === 'ANNUAL' ? 'ประเมินปี' : 'เป้าหมาย'}`}</span>
                                                                </Link>
                                                            )
                                                        ) : currentEval.status === "pending_supervisor" ? (
                                                            <Link href={`/team/kpi/evaluate/${currentEval.id}`} className={styles.btnActionEvaluate}>
                                                                <CheckBadgeIcon width={14} /> <span>ประเมิน</span>
                                                            </Link>
                                                        ) : (
                                                            <Link href={`/team/kpi/define/${emp.emp_id}?category=${category}`} className={styles.btnActionSecondary}>
                                                                <EyeIcon width={14} /> <span>ดู/แก้</span>
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        };

                                        return (
                                            <div key={emp.emp_id} className={styles.card} style={{ animationDelay: `${i * 0.05}s` }}>
                                                <div className={styles.empHeader}>
                                                    <div className={styles.avatar}>
                                                        <UserIcon width={24} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div className={styles.empName}>{emp.name}</div>
                                                        <div className={styles.empDetails}>
                                                            {emp.emp_id} · {emp.position} · {emp.department}
                                                            {emp.hire_date && <span style={{ marginLeft: 8, opacity: 0.7 }}>เริ่มงาน: {new Date(emp.hire_date).toLocaleDateString("th-TH")}</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={styles.tracksContainer}>
                                                    {activeTab === 'trial' ? (
                                                        renderTrack('PROBATION', 'ประเมินผลทดลองงาน', emp.track_info.probation)
                                                    ) : (
                                                        <>
                                                            {renderTrack('MONTHLY', 'ประเมินผลการทำงานรายเดือน', emp.track_info.monthly)}
                                                            <div style={{ borderTop: '1px dashed #f1f5f9', margin: '4px 0' }} />
                                                            {renderTrack('ANNUAL', 'ประเมินปรับเงินเดือน', emp.track_info.annual)}
                                                        </>
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
