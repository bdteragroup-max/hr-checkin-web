"use client";

import { useState, useEffect } from "react";
import styles from "./WorkPlanModal.module.css";
import { 
    ClipboardDocumentListIcon, 
    SunIcon, 
    MoonIcon, 
    ClockIcon,
    MapPinIcon,
    UserIcon
} from "@heroicons/react/24/solid";
import { Loader2 } from "lucide-react";

interface Supervisor {
    id: string;
    name: string;
}

interface WorkPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    employeeName: string;
}

export default function WorkPlanModal({ isOpen, onClose, onSubmit, employeeName }: WorkPlanModalProps) {
    const sanitize = (val: string) => {
        // Allow Thai, English, numbers, spaces, and basic punctuation: . , - _ ( ) /
        return val.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s.,\-_()\/]/g, "");
    };

    const [morningPlan, setMorningPlan] = useState("");
    const [morningLocation, setMorningLocation] = useState("");
    const [morningLocType, setMorningLocType] = useState("สำนักงานใหญ่");
    
    const [afternoonPlan, setAfternoonPlan] = useState("");
    const [afternoonLocation, setAfternoonLocation] = useState("");
    const [afternoonLocType, setAfternoonLocType] = useState("สำนักงานใหญ่");

    const [otPlan, setOtPlan] = useState("");
    const [otLocation, setOtLocation] = useState("");
    const [otLocType, setOtLocType] = useState("สำนักงานใหญ่");

    const [defaultOffice, setDefaultOffice] = useState("สำนักงานใหญ่");

    const [otAttendant, setOtAttendant] = useState("");
    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingSupervisors, setFetchingSupervisors] = useState(false);
    const [showOt, setShowOt] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchSupervisors();
        }
    }, [isOpen]);

    async function fetchSupervisors() {
        setFetchingSupervisors(true);
        try {
            const res = await fetch("/api/work-plans");
            const data = await res.json();
            if (data.ok) {
                setSupervisors(data.supervisors || []);
                if (data.defaultOffice) {
                    setDefaultOffice(data.defaultOffice);
                    setMorningLocType(data.defaultOffice);
                    setAfternoonLocType(data.defaultOffice);
                    setOtLocType(data.defaultOffice);
                }
            }
        } catch (e) {
            console.error("Failed to fetch supervisors", e);
        } finally {
            setFetchingSupervisors(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const finalMorningLoc = morningLocType === "Other" ? morningLocation : morningLocType;
            const finalAfternoonLoc = afternoonLocType === "Other" ? afternoonLocation : afternoonLocType;
            const finalOtLoc = otLocType === "Other" ? otLocation : otLocType;

            await onSubmit({
                morning_plan: morningPlan,
                morning_location: finalMorningLoc,
                afternoon_plan: afternoonPlan,
                afternoon_location: finalAfternoonLoc,
                ot_plan: otPlan,
                ot_location: finalOtLoc,
                ot_attendant: otAttendant
            });
            onClose();
        } catch (e) {
            console.error("Submission failed", e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const hasValidText = (val: string) => /[a-zA-Z0-9\u0E00-\u0E7F]/.test(val);

    const isFormValid = 
        hasValidText(morningPlan) && 
        ([defaultOffice, "Work From Home"].includes(morningLocType) || hasValidText(morningLocation)) && 
        hasValidText(afternoonPlan) && 
        ([defaultOffice, "Work From Home"].includes(afternoonLocType) || hasValidText(afternoonLocation));

    return (
        <div className={styles.overlay}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>แผนงานประจำวัน</h2>
                    <p className={styles.subtitle}>{employeeName}</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* --- Morning --- */}
                    <div className={styles.fieldGroup}>
                        <div className={styles.field}>
                            <div className={styles.fieldHeader}>
                                <label className={styles.label}>ช่วงเช้า (08:00 - 12:00)</label>
                                <select 
                                    className={styles.miniSelect} 
                                    value={morningLocType}
                                    onChange={e => setMorningLocType(e.target.value)}
                                >
                                    <option value={defaultOffice}>ออฟฟิศ ({defaultOffice})</option>
                                    <option value="ไซต์งานลูกค้า">ไซต์งาน</option>
                                    <option value="Work From Home">WFH</option>
                                    <option value="Other">อื่น ๆ...</option>
                                </select>
                            </div>
                            {["ไซต์งานลูกค้า", "Other"].includes(morningLocType) && (
                                <input 
                                    className={styles.input} 
                                    placeholder={morningLocType === "ไซต์งานลูกค้า" ? "ระบุชื่อลูกค้า/ไซต์งาน..." : "ระบุสถานที่..."}
                                    value={morningLocation}
                                    onChange={e => setMorningLocation(sanitize(e.target.value))}
                                    style={{ marginBottom: 8 }}
                                    required
                                />
                            )}
                            <textarea 
                                className={styles.textarea} 
                                placeholder="แผนงานช่วงเช้า..."
                                value={morningPlan}
                                onChange={e => setMorningPlan(sanitize(e.target.value))}
                                required
                            />
                        </div>
                    </div>

                    {/* --- Afternoon --- */}
                    <div className={styles.fieldGroup}>
                        <div className={styles.field}>
                            <div className={styles.fieldHeader}>
                                <label className={styles.label}>ช่วงบ่าย (13:00 - 17:00)</label>
                                <select 
                                    className={styles.miniSelect} 
                                    value={afternoonLocType}
                                    onChange={e => setAfternoonLocType(e.target.value)}
                                >
                                    <option value={defaultOffice}>ออฟฟิศ ({defaultOffice})</option>
                                    <option value="ไซต์งานลูกค้า">ไซต์งาน</option>
                                    <option value="Work From Home">WFH</option>
                                    <option value="Other">อื่น ๆ...</option>
                                </select>
                            </div>
                            {["ไซต์งานลูกค้า", "Other"].includes(afternoonLocType) && (
                                <input 
                                    className={styles.input} 
                                    placeholder={afternoonLocType === "ไซต์งานลูกค้า" ? "ระบุชื่อลูกค้า/ไซต์งาน..." : "ระบุสถานที่..."}
                                    value={afternoonLocation}
                                    onChange={e => setAfternoonLocation(sanitize(e.target.value))}
                                    style={{ marginBottom: 8 }}
                                    required
                                />
                            )}
                            <textarea 
                                className={styles.textarea} 
                                placeholder="แผนงานช่วงบ่าย..."
                                value={afternoonPlan}
                                onChange={e => setAfternoonPlan(sanitize(e.target.value))}
                                required
                            />
                        </div>
                    </div>

                    {/* --- OT Toggle --- */}
                    <div className={styles.otToggle}>
                        <label className={styles.checkboxLabel}>
                            <input 
                                type="checkbox" 
                                checked={showOt} 
                                onChange={e => setShowOt(e.target.checked)} 
                            />
                            <span>มีแผนงานล่วงเวลา (OT)</span>
                        </label>
                    </div>

                    {showOt && (
                        <div className={styles.otSection}>
                            <div className={styles.field}>
                                <div className={styles.fieldHeader}>
                                    <label className={styles.label}>OT (หลัง 17:00)</label>
                                    <select 
                                        className={styles.miniSelect} 
                                        value={otLocType}
                                        onChange={e => setOtLocType(e.target.value)}
                                    >
                                        <option value={defaultOffice}>ออฟฟิศ ({defaultOffice})</option>
                                        <option value="ไซต์งานลูกค้า">ไซต์งาน</option>
                                        <option value="Work From Home">WFH</option>
                                        <option value="Other">อื่น ๆ...</option>
                                    </select>
                                </div>
                                {["ไซต์งานลูกค้า", "Other"].includes(otLocType) && (
                                    <input 
                                        className={styles.input} 
                                        placeholder={otLocType === "ไซต์งานลูกค้า" ? "ระบุชื่อลูกค้า/ไซต์งาน..." : "ระบุสถานที่..."}
                                        value={otLocation}
                                        onChange={e => setOtLocation(sanitize(e.target.value))}
                                        style={{ marginBottom: 8 }}
                                    />
                                )}
                                <textarea 
                                    className={styles.textarea} 
                                    placeholder="แผนงาน OT..."
                                    value={otPlan}
                                    onChange={e => setOtPlan(sanitize(e.target.value))}
                                    style={{ height: 60 }}
                                />
                                <div style={{ marginTop: 10 }}>
                                    <label className={styles.label} style={{ fontSize: 11 }}>ผู้ดูแล (Supervisor)</label>
                                    <select 
                                        className={styles.select}
                                        style={{ marginTop: 4, height: 38, fontSize: 13 }}
                                        value={otAttendant}
                                        onChange={e => setOtAttendant(e.target.value)}
                                    >
                                        <option value="">เลือกผู้ดูแล...</option>
                                        {supervisors.map(s => (
                                            <option key={s.id} value={s.name}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.footer}>
                        <button type="submit" className={styles.btnSubmit} disabled={loading || !isFormValid}>
                            {loading ? "กำลังบันทึก..." : "บันทึกแผนงาน"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
