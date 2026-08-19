"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";
import AlertModal, { AlertState } from "@/components/AlertModal";
import { PlusIcon, TrashIcon, AcademicCapIcon, CalendarIcon, ChatBubbleBottomCenterTextIcon } from "@heroicons/react/24/solid";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Loader2 } from "lucide-react";

interface TrainingItem {
    id: number;
    course_name: string;
    institution_name: string | null;
    training_date_start: string | null;
    completion_percentage: string | number | null;
    training_evaluation_result: string | null;
    instructor_evaluation_result: string | null;
    created_at: string;
}

export default function TrainingHistoryPage() {
    const queryClient = useQueryClient();

    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const closeAlert = () => setAlert({ ...alert, visible: false });
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        course_name: "",
        institution_name: "",
        training_date_start: "",
        completion_percentage: "",
        training_evaluation_result: ""
    });

    const { data: me, isLoading: meLoading } = useQuery({
        queryKey: ["me"],
        queryFn: async () => {
            const r = await fetch("/api/me");
            if (!r.ok) { window.location.href = "/"; throw new Error("Not logged in"); }
            return r.json();
        }
    });

    const { data: history = [], isLoading: historyLoading } = useQuery({
        queryKey: ["trainings"],
        queryFn: async () => {
            const r = await fetch("/api/trainings");
            const data = await r.json();
            return (data.data || []) as TrainingItem[];
        }
    });

    const { data: topics = [] } = useQuery({
        queryKey: ["training-topics"],
        queryFn: async () => {
            const r = await fetch("/api/training-topics");
            const data = await r.json();
            return (data.data || []) as { id: number, topic_name: string }[];
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/trainings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");

            setAlert({ visible: true, message: "บันทึกประวัติการอบรมสำเร็จ", type: "ok" });
            setShowForm(false);
            setFormData({ course_name: "", institution_name: "", training_date_start: "", completion_percentage: "", training_evaluation_result: "" });
            queryClient.invalidateQueries({ queryKey: ["trainings"] });
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = (id: number) => {
        setDeleteConfirm(id);
    };

    const executeDelete = async () => {
        if (deleteConfirm === null) return;
        const id = deleteConfirm;
        setDeleteConfirm(null);
        try {
            const res = await fetch(`/api/trainings/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
            queryClient.invalidateQueries({ queryKey: ["trainings"] });
        } catch (err: any) {
            setAlert({ visible: true, message: err.message, type: "error" });
        }
    };

    if (meLoading || historyLoading) return (
        <div className={styles.wrapper}>
            <div className={styles.loading}>
                <Loader2 className="animate-spin" size={32} color="var(--red)" />
                <span>กำลังโหลด...</span>
            </div>
        </div>
    );

    return (
        <div className={styles.wrapper}>
            <div className={styles.hero}>
                <div className={styles.wrap} style={{ paddingBottom: 0 }}>
                    <div style={{ marginBottom: "16px" }}>
                        <Link href="/app" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text3)", fontSize: "14px", textDecoration: "none", fontWeight: 500 }}>
                            <ArrowLeftIcon width={16} /> กลับหน้าหลัก
                        </Link>
                    </div>
                    <h1 className={styles.heroH1}>ประวัติการฝึกอบรม</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.dot} />
                            บันทึกและดูประวัติการฝึกอบรมของคุณ
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.wrap}>
                {!showForm && (
                    <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginBottom: 20 }} onClick={() => setShowForm(true)}>
                        <PlusIcon width={18} /> เพิ่มประวัติการอบรม
                    </button>
                )}

                {showForm && (
                    <div className={`${styles.card} ${styles.cardTopRed}`}>
                        <div className={styles.sectionLabel}>
                            <div className={styles.dot} />
                            <span>แบบฟอร์มบันทึกการอบรม</span>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <label className={styles.label}>หัวข้อการอบรม <span className={styles.req}>*</span></label>
                            <input
                                className={styles.input}
                                required
                                type="text"
                                list="trainingTopics"
                                value={formData.course_name}
                                onChange={e => {
                                    const val = e.target.value;
                                    const matchedTopic = topics.find((t: any) => t.topic_name === val);
                                    if (matchedTopic) {
                                        setFormData(prev => ({
                                            ...prev,
                                            course_name: val,
                                            institution_name: matchedTopic.institution_name || prev.institution_name
                                        }));
                                    } else {
                                        setFormData(prev => ({ ...prev, course_name: val }));
                                    }
                                }}
                                placeholder="เลือกหรือพิมพ์หัวข้อการอบรม"
                            />
                            <datalist id="trainingTopics">
                                {topics.map((t: any) => (
                                    <option key={t.id} value={t.topic_name} />
                                ))}
                            </datalist>

                            <label className={styles.label}>สถาบัน/หน่วยงานที่จัดอบรม</label>
                            <input
                                className={styles.input}
                                type="text"
                                value={formData.institution_name}
                                onChange={e => setFormData({ ...formData, institution_name: e.target.value })}
                                placeholder="เช่น สถาบันพัฒนาฝีมือแรงงาน"
                            />

                            <label className={styles.label}>วันที่อบรม</label>
                            <input
                                className={styles.input}
                                type="date"
                                value={formData.training_date_start}
                                onChange={e => setFormData({ ...formData, training_date_start: e.target.value })}
                            />

                            <label className={styles.label}>Success Rate (%)</label>
                            <input
                                className={styles.input}
                                type="number"
                                min="0" max="100" step="0.01"
                                value={formData.completion_percentage}
                                onChange={e => setFormData({ ...formData, completion_percentage: e.target.value })}
                                placeholder="เช่น 100"
                            />

                            <label className={styles.label}>Evaluation Results Management (ผลการประเมิน)</label>
                            <textarea
                                className={styles.textarea}
                                value={formData.training_evaluation_result}
                                onChange={e => setFormData({ ...formData, training_evaluation_result: e.target.value })}
                                placeholder="เช่น สิ่งที่ได้รับจากการอบรม, ข้อเสนอแนะ"
                            />

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "20px" }}>
                                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowForm(false)}>
                                    ยกเลิก
                                </button>
                                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={isSubmitting}>
                                    {isSubmitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className={styles.sectionLabel} style={{ marginTop: 24, marginBottom: 12 }}>
                    <div className={styles.dot} style={{ background: "var(--gray-400)", boxShadow: "none" }} />
                    <span>ประวัติของฉัน</span>
                </div>

                {history.length === 0 ? (
                    <div className={styles.emptyState}>
                        <AcademicCapIcon width={32} style={{ margin: "0 auto 12px", color: "var(--gray-300)" }} />
                        คุณยังไม่มีประวัติการฝึกอบรมในระบบ
                    </div>
                ) : (
                    history.map(item => (
                        <div key={item.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardTitle}>{item.course_name}</div>
                                <button className={styles.deleteBtn} onClick={() => handleDeleteClick(item.id)} title="ลบประวัติ">
                                    <TrashIcon width={16} />
                                </button>
                            </div>

                            <div className={styles.kv}>
                                <div className={styles.kvKey}><CalendarIcon width={14} /> วันที่อบรม:</div>
                                <div className={styles.kvVal}>
                                    {item.training_date_start ? new Date(item.training_date_start).toLocaleDateString("th-TH") : "ไม่ได้ระบุ"}
                                </div>
                            </div>

                            {item.institution_name && (
                                <div className={styles.kv}>
                                    <div className={styles.kvKey}><AcademicCapIcon width={14} /> สถาบัน:</div>
                                    <div className={styles.kvVal}>{item.institution_name}</div>
                                </div>
                            )}

                            {item.completion_percentage != null && (
                                <div className={styles.kv}>
                                    <div className={styles.kvKey} style={{ color: "var(--ok)" }}>✓ Success Rate:</div>
                                    <div className={styles.kvVal} style={{ color: "var(--ok)" }}>{item.completion_percentage}%</div>
                                </div>
                            )}

                            {(item.training_evaluation_result || item.instructor_evaluation_result) && (
                                <div className={styles.statusBox}>
                                    {item.training_evaluation_result && (
                                        <div style={{ marginBottom: item.instructor_evaluation_result ? 12 : 0 }}>
                                            <div className={styles.kvKey} style={{ marginBottom: 4 }}><ChatBubbleBottomCenterTextIcon width={14} /> ความคิดเห็นของคุณ:</div>
                                            <div style={{ color: "var(--text)" }}>{item.training_evaluation_result}</div>
                                        </div>
                                    )}
                                    {item.instructor_evaluation_result && (
                                        <div style={{ borderTop: item.training_evaluation_result ? "1px dashed var(--gray-300)" : "none", paddingTop: item.training_evaluation_result ? 12 : 0 }}>
                                            <div className={styles.kvKey} style={{ marginBottom: 4 }}><ChatBubbleBottomCenterTextIcon width={14} /> ความคิดเห็นจากผู้สอน:</div>
                                            <div style={{ color: "var(--text)" }}>{item.instructor_evaluation_result}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {alert.visible && (
                <AlertModal alert={alert} onClose={closeAlert} />
            )}

            {deleteConfirm !== null && (
                <AlertModal
                    alert={{ visible: true, message: "คุณต้องการลบประวัติการอบรมนี้ใช่หรือไม่?", type: "error" }}
                    onClose={() => setDeleteConfirm(null)}
                    onConfirm={executeDelete}
                    confirmText="ยืนยันการลบ"
                    cancelText="ยกเลิก"
                />
            )}
        </div>
    );
}
