"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    UserIcon,
    ClipboardDocumentCheckIcon,
    CalendarDaysIcon,
    ArrowPathIcon,
    ChevronRightIcon,
    UserCircleIcon,
    ExclamationTriangleIcon,
    ExclamationCircleIcon,
    CheckCircleIcon,
    ClockIcon,
    InformationCircleIcon,
    XMarkIcon,
    DocumentTextIcon
} from "@heroicons/react/24/solid";
import { calculateProbationNoticeDeadline, getRound3NoticeGuidance } from "@/utils/probationCalculations";
import styles from "./page.module.css";

interface EvaluationItem {
    id?: number;
    evaluation_no: number;
    evaluation_date: string;
    period_start?: string;
    period_end?: string;
    total_score: number;
    grade: string;
    supervisor_id?: string;
    status?: string;
    decision?: string;
}

interface Subordinate {
    evaluation_history: EvaluationItem[];
    my_evaluations?: EvaluationItem[];
    returned_evaluation?: any;
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

function getGradeBadgeStyle(grade: string | null | undefined) {
    switch (grade?.toUpperCase()) {
        case "A":
            return { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0", dot: "#10b981" };
        case "B":
            return { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", dot: "#3b82f6" };
        case "C":
            return { bg: "#fefce8", color: "#ca8a04", border: "#fef08a", dot: "#eab308" };
        case "D":
            return { bg: "#fff7ed", color: "#c2410c", border: "#ffedd5", dot: "#f97316" };
        case "E":
            return { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", dot: "#ef4444" };
        default:
            return { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", dot: "#94a3b8" };
    }
}

export default function SupervisorProbationPage() {
    const [list, setList] = useState<Subordinate[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'trial' | 'regular' | 'other_managers'>('trial');
    const [showSuccessAlert, setShowSuccessAlert] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.has("success")) {
                setShowSuccessAlert(true);
            }
        }
    }, []);

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

                {/* ── SUCCESS BANNER (FROM /team/probation?success) ── */}
                {showSuccessAlert && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#ecfdf5',
                        border: '1.5px solid #a7f3d0',
                        borderRadius: 12,
                        padding: '12px 18px',
                        marginBottom: 20,
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <CheckCircleIcon width={24} height={24} color="#059669" style={{ flexShrink: 0 }} />
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 14, color: '#065f46' }}>
                                    บันทึกและส่งผลการประเมินเรียบร้อยแล้ว
                                </div>
                                <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                                    ข้อมูลผลการประเมินถูกส่งไปยังฝ่ายบุคคล (HR) เพื่อดำเนินการตรวจสอบขั้นตอนถัดไป
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowSuccessAlert(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#059669',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px'
                            }}
                            title="ปิดการแจ้งเตือน"
                        >
                            <XMarkIcon width={20} height={20} />
                        </button>
                    </div>
                )}

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

                            {filtered.map((emp, i) => {
                                const evaluatedRounds = (emp.evaluation_history || [])
                                    .filter((ev: any) => ev.status !== "returned")
                                    .sort((a: any, b: any) => a.evaluation_no - b.evaluation_no);

                                const lowScoreRounds = evaluatedRounds.filter(
                                    (ev: any) => ev.grade === "D" || ev.grade === "E" || ev.decision === "fail"
                                );

                                let consecutiveLowCount = 0;
                                let maxConsecutiveLow = 0;
                                for (const ev of evaluatedRounds) {
                                    if (ev.grade === "D" || ev.grade === "E" || ev.decision === "fail") {
                                        consecutiveLowCount++;
                                        if (consecutiveLowCount > maxConsecutiveLow) maxConsecutiveLow = consecutiveLowCount;
                                    } else {
                                        consecutiveLowCount = 0;
                                    }
                                }

                                const isSecondWarning = maxConsecutiveLow >= 2 || lowScoreRounds.length >= 2;
                                const isFirstWarning = !isSecondWarning && lowScoreRounds.length === 1;

                                return (
                                    <div key={emp.emp_id} className={styles.card} style={{ animationDelay: `${i * 0.05}s` }}>
                                        <div className={styles.empInfo}>
                                            <div className={styles.avatar} style={{ background: '#d93025', color: 'white', border: '2px solid #fecaca' }}>
                                                <UserIcon width={24} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <div className={styles.empName}>{emp.name}</div>
                                                    {isSecondWarning && (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            background: '#fef2f2',
                                                            color: '#dc2626',
                                                            border: '1px solid #fecaca',
                                                            fontSize: 11,
                                                            fontWeight: 800,
                                                            padding: '2px 8px',
                                                            borderRadius: 12
                                                        }}>
                                                            <ExclamationTriangleIcon width={12} />
                                                            เตือนครั้งที่ 2
                                                        </span>
                                                    )}
                                                    {isFirstWarning && (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            background: '#fffbeb',
                                                            color: '#d97706',
                                                            border: '1px solid #fde68a',
                                                            fontSize: 11,
                                                            fontWeight: 800,
                                                            padding: '2px 8px',
                                                            borderRadius: 12
                                                        }}>
                                                            <ExclamationCircleIcon width={12} />
                                                            เตือนครั้งที่ 1
                                                        </span>
                                                    )}
                                                </div>
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

                                        {emp.is_on_trial && emp.hire_date && (() => {
                                            const noticeInfo = calculateProbationNoticeDeadline(emp.hire_date);
                                            if (!noticeInfo) return null;
                                            return (
                                                <div style={{
                                                    marginBottom: 16,
                                                    background: noticeInfo.badgeStyle.bg,
                                                    border: `1.5px solid ${noticeInfo.badgeStyle.border}`,
                                                    borderRadius: 10,
                                                    padding: '12px 14px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {noticeInfo.status === "overdue" && <ExclamationCircleIcon width={18} height={18} color={noticeInfo.badgeStyle.color} style={{ flexShrink: 0 }} />}
                                                            {noticeInfo.status === "due_today" && <ExclamationTriangleIcon width={18} height={18} color={noticeInfo.badgeStyle.color} style={{ flexShrink: 0 }} />}
                                                            {noticeInfo.status === "urgent" && <ClockIcon width={18} height={18} color={noticeInfo.badgeStyle.color} style={{ flexShrink: 0 }} />}
                                                            {noticeInfo.status === "monitoring" && <InformationCircleIcon width={18} height={18} color={noticeInfo.badgeStyle.color} style={{ flexShrink: 0 }} />}
                                                            {noticeInfo.status === "normal" && <CheckCircleIcon width={18} height={18} color={noticeInfo.badgeStyle.color} style={{ flexShrink: 0 }} />}
                                                            <span style={{ fontSize: 13, fontWeight: 800, color: noticeInfo.badgeStyle.color }}>
                                                                กำหนดแจ้งไม่ผ่านทดลองงาน
                                                            </span>
                                                        </div>
                                                        <span style={{
                                                            fontSize: 11,
                                                            fontWeight: 800,
                                                            padding: '3px 8px',
                                                            borderRadius: 12,
                                                            background: noticeInfo.badgeStyle.iconBg,
                                                            color: noticeInfo.badgeStyle.color
                                                        }}>
                                                            {noticeInfo.statusLabel}
                                                        </span>
                                                    </div>

                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                                        gap: 8,
                                                        background: '#ffffff',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: 8,
                                                        padding: '10px 12px',
                                                        fontSize: 12
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>วันครบ 119 วัน</div>
                                                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 13 }}>{noticeInfo.d119.toLocaleDateString("th-TH")}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>สิ้นสุดจ้างสูงสุด</div>
                                                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 13 }}>{noticeInfo.terminationDate.toLocaleDateString("th-TH")}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>วันสุดท้ายที่ต้องแจ้ง</div>
                                                            <div style={{ fontWeight: 800, color: noticeInfo.badgeStyle.color, fontSize: 13 }}>{noticeInfo.noticeDeadline.toLocaleDateString("th-TH")}</div>
                                                        </div>
                                                    </div>

                                                    {(() => {
                                                        const r3 = getRound3NoticeGuidance(emp.hire_date);
                                                        if (!r3) return null;
                                                        return (
                                                            <div style={{
                                                                marginTop: 10,
                                                                padding: '10px 12px',
                                                                background: r3.isPastDeadline ? '#fef2f2' : '#fffbeb',
                                                                border: `1px solid ${r3.isPastDeadline ? '#fecaca' : '#fde68a'}`,
                                                                borderRadius: 8,
                                                                display: 'flex',
                                                                alignItems: 'flex-start',
                                                                gap: 8,
                                                                fontSize: 12,
                                                                color: r3.isPastDeadline ? '#991b1b' : '#92400e'
                                                            }}>
                                                                {r3.isPastDeadline ? (
                                                                    <ExclamationTriangleIcon width={18} height={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                                                                ) : (
                                                                    <ClockIcon width={18} height={18} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                                                                )}
                                                                <div>
                                                                    <div style={{ fontWeight: 800, marginBottom: 2 }}>
                                                                        ข้อความแจ้งเตือนหัวหน้างาน (รอบที่ 3):
                                                                    </div>
                                                                    <div style={{ lineHeight: 1.45 }}>
                                                                        ระบบเปิดให้ประเมินตั้งแต่วันที่ครบ 75 วัน ({r3.unlockDate75.toLocaleDateString("th-TH")}) — {r3.guidanceMessage}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            );
                                        })()}

                                        {emp.is_on_trial && emp.hire_date && (
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>รอบการประเมิน (SESSION)</div>
                                                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '12px 16px' }}>
                                                    {[1, 2, 3, 4].map((round, idx) => {
                                                        const dueDays = round === 1 ? 30 : round === 2 ? 60 : round === 3 ? 90 : 119;
                                                        const hire = new Date(emp.hire_date!);
                                                        const target = new Date(hire);
                                                        target.setDate(hire.getDate() + dueDays);

                                                        const pastEval = emp.my_evaluations?.find(ev => ev.evaluation_no === round)
                                                            || emp.evaluation_history?.find(ev => ev.evaluation_no === round);

                                                        const isReturned = pastEval?.status === "returned";
                                                        const isEvaluated = Boolean(pastEval && !isReturned) || (round < emp.next_round && !isReturned);
                                                        const isCurrentRound = round === emp.next_round;

                                                        let statusBadge = null;

                                                        if (isReturned) {
                                                            statusBadge = (
                                                                <div style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                                                    padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700
                                                                }}>
                                                                    ส่งกลับให้แก้ไข
                                                                </div>
                                                            );
                                                        } else if (pastEval && pastEval.grade) {
                                                            const badgeStyle = getGradeBadgeStyle(pastEval.grade);
                                                            statusBadge = (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <div style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                        background: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.border}`,
                                                                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700
                                                                    }}>
                                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: badgeStyle.dot }} />
                                                                        <span>เกรด {pastEval.grade}</span>
                                                                        {pastEval.total_score != null && (
                                                                            <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>({pastEval.total_score} คะแนน)</span>
                                                                        )}
                                                                    </div>
                                                                    {pastEval.id && (
                                                                        <a
                                                                            href={`/api/team/probation/evaluations/${pastEval.id}/pdf`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            title={`เปิดดูเอกสาร PDF แบบประเมิน ครั้งที่ ${round}`}
                                                                            style={{
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: 4,
                                                                                padding: '3px 8px',
                                                                                borderRadius: 6,
                                                                                background: '#f0f9ff',
                                                                                color: '#0284c7',
                                                                                border: '1px solid #bae6fd',
                                                                                fontSize: 11,
                                                                                fontWeight: 700,
                                                                                textDecoration: 'none',
                                                                                transition: 'all 0.15s ease'
                                                                            }}
                                                                        >
                                                                            <DocumentTextIcon width={13} height={13} />
                                                                            <span>PDF</span>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else if (isEvaluated) {
                                                            statusBadge = (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <div style={{ color: "#16a34a", fontSize: 13, fontWeight: 700 }}>
                                                                        ประเมินแล้ว
                                                                    </div>
                                                                    {pastEval?.id && (
                                                                        <a
                                                                            href={`/api/team/probation/evaluations/${pastEval.id}/pdf`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            title={`เปิดดูเอกสาร PDF แบบประเมิน ครั้งที่ ${round}`}
                                                                            style={{
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: 4,
                                                                                padding: '3px 8px',
                                                                                borderRadius: 6,
                                                                                background: '#f0f9ff',
                                                                                color: '#0284c7',
                                                                                border: '1px solid #bae6fd',
                                                                                fontSize: 11,
                                                                                fontWeight: 700,
                                                                                textDecoration: 'none',
                                                                                transition: 'all 0.15s ease'
                                                                            }}
                                                                        >
                                                                            <DocumentTextIcon width={13} height={13} />
                                                                            <span>PDF</span>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else if (isCurrentRound) {
                                                            const now = new Date();
                                                            now.setHours(0, 0, 0, 0);
                                                            const tgt = new Date(target);
                                                            tgt.setHours(0, 0, 0, 0);

                                                            const unlockDate = new Date(tgt);
                                                            if (round === 3) {
                                                                // Round 3 opens at 75 days mark
                                                                unlockDate.setTime(hire.getTime() + (75 * 24 * 60 * 60 * 1000));
                                                            } else {
                                                                unlockDate.setDate(unlockDate.getDate() - 14);
                                                            }

                                                            const diffMs = now.getTime() - tgt.getTime();
                                                            if (diffMs > 0) {
                                                                const delayDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                                statusBadge = (
                                                                    <div style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                        background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca',
                                                                        padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700
                                                                    }}>
                                                                        ล่าช้า {delayDays} วัน
                                                                    </div>
                                                                );
                                                            } else if (now >= unlockDate) {
                                                                statusBadge = (
                                                                    <div style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                        background: '#fef9c3', color: '#a16207', border: '1px solid #fef08a',
                                                                        padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700
                                                                    }}>
                                                                        ถึงกำหนด
                                                                    </div>
                                                                );
                                                            } else {
                                                                statusBadge = (
                                                                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                                                                        รอถึงกำหนด
                                                                    </div>
                                                                );
                                                            }
                                                        } else {
                                                            statusBadge = (
                                                                <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 600 }}>
                                                                    ยังไม่ถึงกำหนด
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div key={round} style={{
                                                                display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between',
                                                                padding: '8px 0',
                                                                borderBottom: idx < 3 ? '1px dashed #e2e8f0' : 'none'
                                                            }}>
                                                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                                    <div style={{ color: isEvaluated ? '#334155' : isCurrentRound ? '#d93025' : '#94a3b8', fontWeight: 800, fontSize: 14, minWidth: 60 }}>ครั้งที่ {round}</div>
                                                                    <div>
                                                                        <div style={{ color: isEvaluated ? '#64748b' : '#475569', fontSize: 13 }}>กำหนดครบ {dueDays} วัน: {target.toLocaleDateString("th-TH")}</div>
                                                                        {round === 3 && (
                                                                            <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600, marginTop: 1 }}>
                                                                                * เปิดประเมินเร็วขึ้นเมื่อครบ 75 วัน ({new Date(hire.getTime() + (75 * 24 * 60 * 60 * 1000)).toLocaleDateString("th-TH")}) — ต้องส่งผลภายใน {calculateProbationNoticeDeadline(emp.hire_date)?.noticeDeadline.toLocaleDateString("th-TH")}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {statusBadge}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {!emp.is_on_trial && emp.evaluation_history && emp.evaluation_history.length > 0 && (
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>ประวัติการประเมิน (EVALUATION HISTORY)</div>
                                                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '10px 16px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {emp.evaluation_history.slice(-3).reverse().map((ev, idx) => {
                                                            const b = getGradeBadgeStyle(ev.grade);
                                                            return (
                                                                <div key={ev.id || idx} style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    padding: '6px 0',
                                                                    borderBottom: idx < Math.min(emp.evaluation_history.length, 3) - 1 ? '1px dashed #e2e8f0' : 'none'
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <span style={{ color: '#475569', fontWeight: 700, fontSize: 13 }}>
                                                                            รอบที่ {ev.evaluation_no}
                                                                        </span>
                                                                        {ev.period_start && (
                                                                            <span style={{ color: '#94a3b8', fontSize: 12 }}>
                                                                                ({new Date(ev.period_start).toLocaleDateString("th-TH", { month: 'short', year: 'numeric' })})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <div style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: 6,
                                                                            background: b.bg,
                                                                            color: b.color,
                                                                            border: `1px solid ${b.border}`,
                                                                            padding: '3px 10px',
                                                                            borderRadius: '20px',
                                                                            fontSize: 12,
                                                                            fontWeight: 700
                                                                        }}>
                                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.dot }} />
                                                                            <span>เกรด {ev.grade}</span>
                                                                            {ev.total_score != null && (
                                                                                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>({ev.total_score} คะแนน)</span>
                                                                            )}
                                                                        </div>
                                                                        {ev.id && (
                                                                            <a
                                                                                href={`/api/team/probation/evaluations/${ev.id}/pdf`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                title={`เปิดดูเอกสาร PDF แบบประเมิน รอบที่ ${ev.evaluation_no}`}
                                                                                style={{
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: 4,
                                                                                    padding: '3px 8px',
                                                                                    borderRadius: 6,
                                                                                    background: '#f0f9ff',
                                                                                    color: '#0284c7',
                                                                                    border: '1px solid #bae6fd',
                                                                                    fontSize: 11,
                                                                                    fontWeight: 700,
                                                                                    textDecoration: 'none',
                                                                                    transition: 'all 0.15s ease'
                                                                                }}
                                                                            >
                                                                                <DocumentTextIcon width={13} height={13} />
                                                                                <span>PDF</span>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {emp.is_unlocked ? (
                                            <Link
                                                href={`/team/probation/evaluate/${emp.emp_id}?is_regular=${!emp.is_on_trial}`}
                                                className={styles.btnPrimary}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                    <span>{emp.returned_evaluation ? "แก้ไขการประเมิน (ส่งกลับ)" : "เริ่มการประเมินผล"}</span>
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
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
