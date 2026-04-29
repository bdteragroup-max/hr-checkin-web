"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
    ClipboardDocumentCheckIcon, 
    CalendarDaysIcon,
    ArrowPathIcon,
    ChevronRightIcon,
    AcademicCapIcon,
    ChatBubbleLeftEllipsisIcon,
    CheckBadgeIcon,
    EyeIcon,
    PencilSquareIcon
} from "@heroicons/react/24/solid";
import styles from "./page.module.css";

interface Evaluation {
    id: number;
    evaluation_no: number;
    status: string;
    total_supervisor_score: string | number | null;
    grade: string | null;
    period_start: string | null;
    period_end: string | null;
    supervisor?: {
        name: string;
    };
}

export default function EmployeeKPIPage() {
    const [list, setList] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/kpi")
            .then(r => r.json())
            .then(data => {
                if (data.ok) setList(data.list);
            })
            .finally(() => setLoading(false));
    }, []);

    const getStatusInfo = (status: string) => {
        switch (status) {
            case "pending_employee": return { label: "รอยืนยัน / ประเมินตนเอง", color: "#f59e0b", icon: <PencilSquareIcon width={14} /> };
            case "pending_supervisor": return { label: "รอหัวหน้าประเมิน", color: "#3b82f6", icon: <EyeIcon width={14} /> };
            case "completed": return { label: "ประเมินเสร็จสิ้น", color: "#10b981", icon: <CheckBadgeIcon width={14} /> };
            default: return { label: status, color: "#94a3b8", icon: null };
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>KPI รายบุคคล</h1>
                    <div className={styles.heroSubtitle}>ติดตามเป้าหมายและผลการทำงานรายบุคคลของคุณ</div>
                </div>

                {loading ? (
                    <div className={styles.loading}>
                        <ArrowPathIcon width={40} className="animate-spin mx-auto mb-4 opacity-10" />
                        <div>กำลังรวบรวมข้อมูลของคุณ...</div>
                    </div>
                ) : list.length === 0 ? (
                    <div className={styles.empty}>ยังไม่มีข้อมูล KPI ที่ได้รับมอบหมาย</div>
                ) : (
                    <div className={styles.list}>
                        <div className={styles.sectionLabel}>
                            <div className={styles.dot} />
                            <span>My KPI Sessions ({list.length})</span>
                        </div>

                        {/* Probationary KPI Timeline */}
                        {list.length > 0 && (list[0] as any).employee?.is_on_trial && (list[0] as any).employee?.hire_date && (
                            <div className={styles.timelineCard}>
                                <div className={styles.timelineHeader}>
                                    <AcademicCapIcon width={20} />
                                    <span>KPI Probation Timeline</span>
                                </div>
                                <div className={styles.timelineGrid}>
                                    {[1, 2, 3].map(round => {
                                        const hist = list.find(ev => (ev as any).category === 'PROBATION' && ev.evaluation_no === round);
                                        const hire = new Date((list[0] as any).employee.hire_date);
                                        const target = new Date(hire);
                                        target.setDate(hire.getDate() + (round * 30));
                                        
                                        if (!hist) {
                                            return (
                                                <div key={round} className={styles.timelineItem}>
                                                    <div className={styles.itemDotPending} />
                                                    <div className={styles.itemInfo}>
                                                        <div className={styles.itemLabel}>ครั้งที่ {round}</div>
                                                        <div className={styles.itemDate}>กำหนด: {target.toLocaleDateString("th-TH")}</div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const actual = new Date((hist as any).evaluation_date || (hist as any).created_at);
                                        const diff = Math.floor((actual.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
                                        const isDelayed = diff > 0;

                                        return (
                                            <div key={round} className={styles.timelineItem}>
                                                <div className={isDelayed ? styles.itemDotDelayed : styles.itemDotNormal} />
                                                <div className={styles.itemInfo}>
                                                    <div className={styles.itemLabel}>ครั้งที่ {round}</div>
                                                    <div className={isDelayed ? styles.itemStatusDelayed : styles.itemStatusNormal}>
                                                        {isDelayed ? `ล่าช้า ${diff} วัน` : 'ปกติ'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {list.map((evalData, idx) => {
                            const statusInfo = getStatusInfo(evalData.status);
                            return (
                                <div key={evalData.id} className={styles.card} style={{ animationDelay: `${idx * 0.05}s` }}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.evalNo}>
                                            {(evalData as any).category === 'ANNUAL' ? (evalData as any).session_name : `การประเมินครั้งที่ ${evalData.evaluation_no}`}
                                            {(evalData as any).category === 'ANNUAL' && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>({(evalData as any).year})</span>}
                                        </div>
                                        <div className={styles.statusBadge} style={{ backgroundColor: statusInfo.color + "15", color: statusInfo.color }}>
                                            {statusInfo.icon}
                                            <span>{statusInfo.label}</span>
                                        </div>
                                    </div>

                                    <div className={styles.metaGrid}>
                                        <div className={styles.metaItem}>
                                          <span className={styles.metaLabel}>รอบการประเมิน</span>
                                          <span className={styles.metaVal}>
                                            {evalData.period_start ? new Date(evalData.period_start).toLocaleDateString("th-TH") : "N/A"} - {evalData.period_end ? new Date(evalData.period_end).toLocaleDateString("th-TH") : "N/A"}
                                          </span>
                                        </div>
                                        <div className={styles.metaItem}>
                                          <span className={styles.metaLabel}>ผู้ประเมิน / หัวหน้างาน</span>
                                          <span className={styles.metaVal}>{evalData.supervisor?.name || "N/A"}</span>
                                        </div>
                                    </div>

                                    {evalData.status === "completed" && (
                                        <div className={styles.resultGrid}>
                                            <div className={styles.resultBox}>
                                                <div className={styles.resultLabel}>คะแนนเฉลี่ย</div>
                                                <div className={styles.resultVal} style={{ color: '#3b82f6' }}>
                                                    {Number(evalData.total_supervisor_score).toFixed(2)}
                                                </div>
                                            </div>
                                            <div className={styles.resultBox}>
                                                <div className={styles.resultLabel}>เกรดที่ได้</div>
                                                <div className={styles.resultVal} style={{ color: '#10b981' }}>
                                                    {evalData.grade}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {evalData.status === "pending_employee" ? (
                                        <Link href={`/kpi/self-rate/${evalData.id}`} className={styles.btnPrimary}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                <ClipboardDocumentCheckIcon width={18} />
                                                <span>เริ่มประเมินตนเอง</span>
                                            </div>
                                        </Link>
                                    ) : (
                                        <div className={styles.btnDisabled}>ประมวลผลแล้ว</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
