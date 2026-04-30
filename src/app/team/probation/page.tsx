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
    const [activeTab, setActiveTab] = useState<'trial' | 'regular'>('trial');

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
                </div>

                {loading ? (
                    <div className={styles.loadingContainer}>
                        <ArrowPathIcon width={40} className="animate-spin mx-auto mb-4 opacity-10" />
                        <div>กำลังรวบรวมข้อมูลพนักงาน...</div>
                    </div>
                ) : (() => {
                    const filtered = list.filter(e => {
                        if (activeTab === 'trial') return e.is_on_trial;
                        if (activeTab === 'regular') return !e.is_on_trial && e.salary_type === 'monthly';
                        return false;
                    });

                    if (filtered.length === 0) {
                        return (
                            <div className={styles.emptyState}>
                                <UserCircleIcon width={48} className="mx-auto mb-4 text-slate-300" />
                                <h3 style={{ fontWeight: 700, color: "#475569" }}>ไม่พบประเมิน</h3>
                                <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                                    ขณะนี้ไม่มีพนักงาน{activeTab === 'trial' ? 'ที่อยู่ระหว่างทดลองงาน' : 'ประจำ'}ที่ต้องประเมิน
                                </p>
                            </div>
                        );
                    }

                    const sectionLabel = activeTab === 'trial' ? 'Probation Period' : 'Monthly Performance';

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div className={styles.sectionLabel}>
                                <div className={styles.dot} />
                                <span>{sectionLabel} ({filtered.length})</span>
                            </div>

                            {filtered.map((emp, i) => (
                                <div key={emp.emp_id} className={styles.card} style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div className={styles.empInfo}>
                                        <div className={styles.avatar}>
                                            <UserIcon width={24} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div className={styles.empName}>{emp.name}</div>
                                            <div className={styles.empDetails}>{emp.emp_id} · {emp.position || "Staff"}</div>
                                        </div>
                                    </div>

                                    <div className={styles.metaGrid}>
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
                                        <div className={styles.metaItem}>
                                            <span className={styles.metaLabel}>รอบการประเมิน (Session)</span>
                                            <span className={styles.metaVal} style={{ color: '#d93025', fontWeight: 800 }}>
                                                {emp.is_on_trial ? `ครั้งที่ ${emp.next_round}` : `ประจำเดือน ${new Date().toLocaleDateString("th-TH", { month: 'long', year: 'numeric' })}`}
                                            </span>
                                        </div>
                                    </div>

                                    {emp.is_on_trial && emp.evaluation_history && emp.evaluation_history.length > 0 && (
                                        <div className={styles.historyContainer}>
                                            <div className={styles.historyTitle}>ประวัติการประเมินที่ผ่านมา:</div>
                                            <div className={styles.historyGrid}>
                                                {[1, 2, 3].map(round => {
                                                    const hist = emp.evaluation_history?.find(h => h.evaluation_no === round);
                                                    if (!hist) return null;

                                                    const hire = new Date(emp.hire_date!);
                                                    const target = new Date(hire);
                                                    target.setDate(hire.getDate() + (round * 30));
                                                    const actual = new Date(hist.evaluation_date);
                                                    const diff = Math.floor((actual.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
                                                    const isDelayed = diff > 0;

                                                    return (
                                                        <div key={round} className={styles.historyTag}>
                                                            <span className={styles.tagRound}>ครั้งที่ {round}</span>
                                                            <span className={styles.tagScore}>{hist.total_score}</span>
                                                            <span className={styles.tagGrade}>{hist.grade}</span>
                                                            <span className={isDelayed ? styles.tagDelayed : styles.tagNormal}>
                                                                {isDelayed ? `ล่าช้า ${diff} วัน` : 'ปกติ'}
                                                            </span>
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
                                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                                                {emp.is_on_trial ? (
                                                    `เปิดให้ประเมินวันที่ ${emp.unlock_date ? new Date(emp.unlock_date).toLocaleDateString("th-TH") : "ไม่ระบุ"}`
                                                ) : (
                                                    `จะเปิดให้ประเมินวันที่ 20 ของทุกเดือน`
                                                )}
                                            </div>
                                            {emp.is_on_trial && (
                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
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
