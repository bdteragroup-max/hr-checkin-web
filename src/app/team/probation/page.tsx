"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    UserIcon,
    ClipboardDocumentCheckIcon,
    CalendarDaysIcon,
    ArrowPathIcon,
    ChevronRightIcon,
    UserCircleIcon
} from "@heroicons/react/24/solid";
import styles from "./page.module.css";

interface Subordinate {
    evaluation_history: { evaluation_no: number; evaluation_date: string; total_score: number; grade: string }[];
    emp_id: string;
    name: string;
    hire_date: string | null;
    is_on_trial: boolean;
    salary_type: string | null;
    position: string;
    department: string;
    last_evaluation_no: number;
    next_round: number;
    due_date: string | null;
    unlock_date: string | null;
    is_unlocked: boolean;
}

export default function SupervisorProbationPage() {
    const [list, setList] = useState<Subordinate[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'trial' | 'regular' | 'other_managers'>('trial');

    useEffect(() => {
        fetch("/api/team/probation/employees")
            .then(r => r.json())
            .then(data => {
                if (data.ok) setList(data.list);
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>ประเมินผลการทำงาน</h1>
                    <div className={styles.heroSubtitle}>รายชื่อพนักงานในทีมที่ถึงกำหนดประเมิน (Assessment)</div>
                </div>

                {/* ── TABS ── */}
                <div className={styles.tabs}>
                    <div
                        className={`${styles.tab} ${activeTab === 'trial' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('trial')}
                    >
                        <span>พนักงานทดลองงาน</span>
                    </div>
                    <div
                        className={`${styles.tab} ${activeTab === 'regular' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('regular')}
                    >
                        <span>พนักงานประจำ</span>
                    </div>
                    <div
                        className={`${styles.tab} ${activeTab === 'other_managers' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('other_managers')}
                    >
                        <span>ผู้จัดการทดลองงานท่านอื่น</span>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingContainer}>
                        <ArrowPathIcon width={40} className="animate-spin mx-auto mb-4 opacity-10" />
                        <div>กำลังรวบรวมข้อมูลพนักงาน...</div>
                    </div>
                ) : (() => {
                    const filtered = list.filter(e => {
                        const isOther = (e as any).is_other_manager;
                        if (activeTab === 'trial') return e.is_on_trial && !isOther;
                        if (activeTab === 'regular') return !e.is_on_trial && e.salary_type === 'monthly' && !isOther;
                        if (activeTab === 'other_managers') return isOther;
                        return false;
                    });

                    if (filtered.length === 0) {
                        return (
                            <div className={styles.emptyState}>
                                <UserCircleIcon width={48} className="mx-auto mb-4 text-slate-300" />
                                <h3 style={{ fontWeight: 700, color: "#475569" }}>ไม่พบประเมิน</h3>
                                <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                                    ขณะนี้ไม่มีพนักงาน{activeTab === 'trial' ? 'ที่อยู่ระหว่างทดลองงาน' : activeTab === 'other_managers' ? 'ระดับผู้จัดการท่านอื่น' : 'ประจำ'}ที่ต้องประเมิน
                                </p>
                            </div>
                        );
                    }

                    const sectionLabel = activeTab === 'trial' ? 'Probation Period' : activeTab === 'other_managers' ? 'Other Managers' : 'Monthly Performance';

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div className={styles.sectionLabel}>
                                <div className={styles.dot} />
                                <span>{sectionLabel} ({filtered.length})</span>
                            </div>

                            {filtered.map((emp, i) => (
                                <div key={emp.emp_id} className={styles.card} style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div className={styles.empInfo}>
                                        <div className={styles.avatar} style={{ background: '#d93025', color: 'white', border: '2px solid #fecaca' }}>
                                            <UserIcon width={24} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div className={styles.empName}>{emp.name}</div>
                                            <div className={styles.empDetails}>{emp.emp_id} · {emp.position || "Staff"}</div>
                                        </div>
                                    </div>

                                    <div style={{ borderBottom: '1px dashed #e2e8f0', marginBottom: 16 }}></div>

                                    <div className={styles.metaGrid} style={{ border: 'none', padding: 0, marginBottom: 16 }}>
                                        <div className={styles.metaItem}>
                                            <span className={styles.metaLabel}>สังกัด/แผนก</span>
                                            <span className={styles.metaVal}>{emp.department || "-"}</span>
                                        </div>
                                        <div className={styles.metaItem}>
                                            <span className={styles.metaLabel}>วันที่เริ่มงาน</span>
                                            <span className={styles.metaVal}>
                                                {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString("th-TH") : "-"}
                                            </span>
                                        </div>
                                    </div>

                                    {emp.is_on_trial && emp.hire_date && (
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>รอบการประเมิน (SESSION)</div>
                                            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '12px 16px' }}>
                                                {[1, 2, 3, 4].map((round, idx) => {
                                                    const dueDays = round === 1 ? 30 : round === 2 ? 60 : round === 3 ? 90 : 119;
                                                    const hire = new Date(emp.hire_date!);
                                                    const target = new Date(hire);
                                                    target.setDate(hire.getDate() + dueDays);
                                                    
                                                    const isEvaluated = round < emp.next_round;
                                                    const isCurrentRound = round === emp.next_round;
                                                    
                                                    let statusText = null;
                                                    let statusColor = "";
                                                    
                                                    if (isEvaluated) {
                                                        statusText = "ประเมินแล้ว";
                                                        statusColor = "#16a34a"; // green
                                                    } else if (isCurrentRound) {
                                                        const now = new Date();
                                                        now.setHours(0, 0, 0, 0);
                                                        const tgt = new Date(target);
                                                        tgt.setHours(0, 0, 0, 0);
                                                        
                                                        const unlockDate = new Date(tgt);
                                                        unlockDate.setDate(unlockDate.getDate() - 14);
                                                        
                                                        const diffMs = now.getTime() - tgt.getTime();
                                                        if (diffMs > 0) {
                                                            const delayDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                            statusText = `ล่าช้า ${delayDays} วัน`;
                                                            statusColor = "#ef4444"; // red
                                                        } else if (now >= unlockDate) {
                                                            statusText = "ถึงกำหนด";
                                                            statusColor = "#eab308"; // yellow
                                                        }
                                                    }
                                                    
                                                    return (
                                                        <div key={round} style={{ 
                                                            display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between',
                                                            padding: '8px 0', 
                                                            borderBottom: idx < 3 ? '1px dashed #e2e8f0' : 'none',
                                                            opacity: isEvaluated ? 0.6 : 1
                                                        }}>
                                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                                <div style={{ color: isEvaluated ? '#94a3b8' : '#d93025', fontWeight: 800, fontSize: 14, minWidth: 60 }}>ครั้งที่ {round}</div>
                                                                <div style={{ color: isEvaluated ? '#94a3b8' : '#475569', fontSize: 13 }}>กำหนดครบ {dueDays} วัน: {target.toLocaleDateString("th-TH")}</div>
                                                            </div>
                                                            {statusText && (
                                                                <div style={{ color: statusColor, fontSize: 13, fontWeight: 700 }}>
                                                                    {statusText}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {emp.is_unlocked ? (
                                        <Link
                                            href={`/team/probation/evaluate/${emp.emp_id}?is_regular=${!emp.is_on_trial}`}
                                            className={styles.btnPrimary}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                <span>เริ่มการประเมินผล</span>
                                                <ChevronRightIcon width={16} />
                                            </div>
                                        </Link>
                                    ) : (
                                        <div style={{
                                            background: '#f1f5f9',
                                            border: '1px dashed #cbd5e1',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px'
                                        }}>
                                            <div style={{ fontSize: '14px', color: '#475569', fontWeight: 700 }}>
                                                {emp.is_on_trial ? (
                                                    `เปิดให้ประเมินวันที่ ${emp.unlock_date ? new Date(emp.unlock_date).toLocaleDateString("th-TH") : "ไม่ระบุ"}`
                                                ) : (
                                                    `จะเปิดให้ประเมินวันที่ 20 ของทุกเดือน`
                                                )}
                                            </div>
                                            {emp.is_on_trial && (
                                                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                                                    (กำหนดครบ {emp.next_round === 1 ? 30 : emp.next_round === 2 ? 60 : emp.next_round === 3 ? 90 : 119} วัน: {emp.due_date ? new Date(emp.due_date).toLocaleDateString("th-TH") : "ไม่ระบุ"})
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
