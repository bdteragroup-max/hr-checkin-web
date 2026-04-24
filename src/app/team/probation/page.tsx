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
    emp_id: string;
    name: string;
    hire_date: string | null;
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
                    <div className={styles.heroSubtitle}>รายชื่อพนักงานทดลองงานในทีมของคุณ (Assessment)</div>
                </div>

                {loading ? (
                    <div className={styles.loadingContainer}>
                        <ArrowPathIcon width={40} className="animate-spin mx-auto mb-4 opacity-10" />
                        <div>กำลังรวบรวมข้อมูลพนักงาน...</div>
                    </div>
                ) : list.length === 0 ? (
                    <div className={styles.emptyState}>
                        <UserCircleIcon width={48} className="mx-auto mb-4 text-slate-300" />
                        <h3 style={{ fontWeight: 700, color: "#475569" }}>ไม่พบคิวรี่ประเมิน</h3>
                        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>ขณะนี้ไม่มีพนักงานในทีมที่อยู่ระหว่างทดลองงาน</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div className={styles.sectionLabel}>
                            <div className={styles.dot} />
                            <span>Team Members ({list.length})</span>
                        </div>
                        
                        {list.map((emp, i) => (
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
                                            ครั้งที่ {emp.next_round}
                                        </span>
                                    </div>
                                </div>

                                {emp.is_unlocked ? (
                                    <Link 
                                        href={`/team/probation/evaluate/${emp.emp_id}`}
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
                                            เปิดให้ประเมินวันที่ {emp.unlock_date ? new Date(emp.unlock_date).toLocaleDateString("th-TH") : "ไม่ระบุ"}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            (กำหนดครบ {emp.next_round === 1 ? 30 : emp.next_round === 2 ? 60 : emp.next_round === 3 ? 90 : 119} วัน: {emp.due_date ? new Date(emp.due_date).toLocaleDateString("th-TH") : "ไม่ระบุ"})
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
