"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    UserIcon,
    ArrowPathIcon,
    UserCircleIcon,
    PencilSquareIcon,
    CheckBadgeIcon,
    EyeIcon
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
    hire_date: string;
    position: string;
    department: string;
    evaluations: KPIEvaluation[];
}

export default function SupervisorKPIPage() {
    const [list, setList] = useState<Subordinate[]>([]);
    const [loading, setLoading] = useState(true);

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
                    <h1 className={styles.heroH1}>จัดการ KPI พนักงานทดลองงาน</h1>
                    <div className={styles.heroSubtitle}>นิยามเป้าหมายและประเมินผลสำหรับรอบการทดลองงาน</div>
                </div>

                {loading ? (
                    <div className={styles.loadingContainer}>
                        <ArrowPathIcon width={40} className="animate-spin mx-auto mb-4 opacity-10" />
                        <div>กำลังรวบรวมข้อมูลพนักงาน...</div>
                    </div>
                ) : list.length === 0 ? (
                    <div className={styles.emptyState}>
                        <UserCircleIcon width={48} className="mx-auto mb-4 text-slate-300" />
                        <h3 style={{ fontWeight: 700, color: "#475569" }}>ไม่พบคิวรี่พนักงานทดลองงาน</h3>
                        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>คุณไม่มีพนักงานในทีมที่อยู่ระหว่างทดลองงานที่ต้องจัดการ KPI</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div className={styles.sectionLabel}>
                            <div className={styles.dot} />
                            <span>Team Members ({list.length})</span>
                        </div>

                        {list.map((emp, i) => {
                            const currentEval = emp.evaluations[0];
                            const statusInfo = currentEval ? getStatusInfo(currentEval.status) : null;

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
                                            <span className={styles.metaVal} style={{ color: '#d93025', fontWeight: 800 }}>
                                                {currentEval ? `ครั้งที่ ${currentEval.evaluation_no}` : `ครั้งที่ ${(emp.evaluations?.length || 0) + 1}`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={styles.actions}>
                                        {!currentEval || currentEval.status === "completed" ? (
                                            <Link href={`/team/kpi/define/${emp.emp_id}`} className={styles.btnPrimary}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                    <PencilSquareIcon width={18} />
                                                    <span>เริ่มกำหนดเป้าหมาย KPI</span>
                                                </div>
                                            </Link>
                                        ) : currentEval.status === "pending_supervisor" ? (
                                            <Link href={`/team/kpi/evaluate/${currentEval.id}`} className={styles.btnPrimary} style={{ background: '#3b82f6', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                    <CheckBadgeIcon width={18} />
                                                    <span>ประเมินคะแนน KPI</span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <Link href={`/team/kpi/define/${emp.emp_id}`} className={styles.btnSecondary}>
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
                    </div>
                )}
            </div>
        </div>
    );
}
