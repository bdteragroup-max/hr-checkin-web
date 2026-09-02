import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./wizard.module.css";
import { PlusIcon, CheckCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import SearchableSelect from "@/components/SearchableSelect";
import AlertModal, { AlertState } from "@/components/AlertModal";

type Props = {
    onClose: () => void;
    onSuccess: () => void;
    branches: any[];
    departments: any[];
    positions: any[];
    employees: any[];
};

export default function EmployeeWizard({ onClose, onSuccess, branches, departments, positions, employees }: Props) {
    const [step, setStep] = useState(1);
    const [empId, setEmpId] = useState("");
    const [alertConfig, setAlertConfig] = useState<{ alert: AlertState, onConfirm?: () => void }>({ alert: { visible: false, message: "", type: "ok" } });
    const closeAlert = () => setAlertConfig(prev => ({ ...prev, alert: { ...prev.alert, visible: false } }));
    const showAlert = (message: string, type: "ok" | "error" = "error") => setAlertConfig({ alert: { visible: true, message, type } });

    const [form, setForm] = useState({
        // Step 1
        emp_id: "", name: "", nickname: "", gender: "M", birth_date: "", hire_date: "", branch_id: "",
        department_id: 0, job_position_id: 0, nationality: "THA", id_document_type: "national_id", national_id_card: "",
        is_on_trial: false, probation_days: 90, probation_end_date: "",

        // Step 2
        salary_type: "monthly", base_salary: "", bank_name: "", bank_account_no: "",
        fixed_tax_deduction: "",

        // Step 3
        phone_number: "", email: "", line_user_id: "", supervisor_id: "", secondary_supervisor_id: "",
        pin: "", is_checkin_exempt: false, company_car: false, company_accommodation: false
    });

    const [idError, setIdError] = useState("");
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Helpers
    const calculateAge = (dob: string) => {
        if (!dob) return null;
        const today = new Date();
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    };

    const validateNationalId = (id: string) => {
        const str = id.replace(/-/g, "");
        if (str.length !== 13) return false;
        let sum = 0;
        for (let i = 0; i < 12; i++) sum += parseInt(str.charAt(i)) * (13 - i);
        return (11 - (sum % 11)) % 10 === parseInt(str.charAt(12));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
        updateForm(name, val);
    };

    const updateForm = (name: string, val: any) => {
        setForm(prev => {
            const next = { ...prev, [name]: val };
            if (name === "hire_date" || name === "is_on_trial" || name === "probation_days") {
                if (next.is_on_trial && next.hire_date && next.probation_days > 0) {
                    const hd = new Date(next.hire_date);
                    hd.setDate(hd.getDate() + (Number(next.probation_days) - 1));
                    next.probation_end_date = hd.toISOString().split("T")[0];
                } else if (!next.is_on_trial) next.probation_end_date = "";
            }
            if (name === "national_id_card" || name === "id_document_type") {
                if (next.id_document_type === "national_id" && next.national_id_card.length === 13) {
                    if (!validateNationalId(next.national_id_card)) setIdError("เลขบัตรประชาชนไม่ถูกต้อง");
                    else setIdError("");
                } else setIdError("");
            }
            if (name === "salary_type" && val === "cash") {
                next.bank_name = "";
                next.bank_account_no = "";
            }
            if (name === "department_id") {
                next.job_position_id = 0;
            }
            return next;
        });

        if (step > 1) triggerAutoSave();
    };

    const triggerAutoSave = () => {
        setSaveState("saving");
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            if (!empId) return;
            try {
                // Remove dynamic non-DB fields or handle specially
                const payload = { ...form };
                await fetch(`/api/admin/employees/${empId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setSaveState("saved");
            } catch (e) {
                setSaveState("idle");
            }
        }, 1000);
    };

    const handleStep1Submit = async () => {
        if (!form.emp_id || !form.name) {
            showAlert("กรุณากรอกรหัสและชื่อ", "error");
            return;
        }
        if (idError) {
            showAlert(idError, "error");
            return;
        }
        setSaveState("saving");
        const res = await fetch("/api/admin/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, is_onboarding_complete: false })
        });
        const data = await res.json();
        if (data.ok) {
            setEmpId(form.emp_id);
            setStep(2);
            setSaveState("saved");
        } else showAlert(data.error, "error");
    };

    const handleFinish = async () => {
        setSaveState("saving");
        await fetch(`/api/admin/employees/${empId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_onboarding_complete: true })
        });
        setSaveState("saved");
        onSuccess();
        onClose();
    };

    const ssoPreview = () => {
        const base = Number(form.base_salary) || 0;
        const total = base;
        const capped = Math.min(Math.max(total, 1650), 15000); // UI fallback (Server uses 17500 in 2026)
        return Math.round(capped * 0.05);
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>
                        {step === 1 ? "สร้างพนักงานใหม่" : `ข้อมูลพนักงาน: ${form.name}`}
                    </h2>
                    <button className={styles.modalClose} onClick={onClose}>✕</button>
                </div>

                <div className={styles.stepper}>
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`${styles.step} ${step === s ? styles.active : ''} ${step > s ? styles.completed : ''}`}>
                            <div className={styles.stepNum}>{step > s ? '✓' : s}</div>
                            <span>{s === 1 ? "ข้อมูลพื้นฐาน" : s === 2 ? "เงินเดือน & ภาษี" : "ตั้งค่าระบบ"}</span>
                        </div>
                    ))}
                </div>

                <div className={styles.modalBody}>
                    {step === 1 && (
                        <>
                            <div className={styles.grid}>
                                <div><label className={styles.lbl}>รหัสพนักงาน *</label><input className={styles.input} name="emp_id" value={form.emp_id} onChange={handleChange} /></div>
                                <div><label className={styles.lbl}>สาขา</label>
                                    <SearchableSelect className={styles.input} value={form.branch_id} onChange={(v) => updateForm("branch_id", v || "")} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="— ไม่ระบุ —" />
                                </div>
                            </div>
                            <div className={styles.grid}>
                                <div><label className={styles.lbl}>แผนก</label>
                                    <SearchableSelect className={styles.input} value={form.department_id} onChange={(v) => updateForm("department_id", v || 0)} options={departments.map(d => ({ value: d.id, label: d.name }))} placeholder="— ไม่ระบุ —" />
                                </div>
                                <div><label className={styles.lbl}>ตำแหน่ง</label>
                                    <SearchableSelect className={styles.input} value={form.job_position_id} onChange={(v) => updateForm("job_position_id", v || 0)} options={positions.filter(p => !form.department_id || p.department_id === Number(form.department_id)).map(p => ({ value: p.id, label: p.title }))} placeholder="— ไม่ระบุ —" />
                                </div>
                            </div>
                            <div className={styles.grid}>
                                <div><label className={styles.lbl}>ชื่อ-สกุล *</label><input className={styles.input} name="name" value={form.name} onChange={handleChange} /></div>
                                <div><label className={styles.lbl}>ชื่อเล่น</label><input className={styles.input} name="nickname" value={form.nickname} onChange={handleChange} /></div>
                            </div>
                            <div className={styles.grid}>
                                <div><label className={styles.lbl}>สัญชาติ</label>
                                    <select className={styles.input} name="nationality" value={form.nationality} onChange={handleChange}>
                                        <option value="THA">ไทย</option><option value="MMR">เมียนมา</option><option value="OTH">อื่นๆ</option>
                                    </select>
                                </div>
                                <div><label className={styles.lbl}>ประเภทเอกสาร</label>
                                    <select className={styles.input} name="id_document_type" value={form.id_document_type} onChange={handleChange}>
                                        <option value="national_id">บัตร ปชช</option><option value="passport">พาสปอร์ต</option><option value="none">ไม่มี</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.grid}>
                                <div style={{ gridColumn: "span 2" }}>
                                    <label className={styles.lbl}>เลขที่เอกสาร</label>
                                    <input className={styles.input} name="national_id_card" value={form.national_id_card} onChange={handleChange} />
                                    {idError && <div style={{ color: "var(--bad)", fontSize: 12, marginTop: -12, marginBottom: 16 }}>{idError}</div>}
                                </div>
                            </div>
                            <div className={styles.grid}>
                                <div><label className={styles.lbl}>วันเกิด (อายุ: {calculateAge(form.birth_date) ?? '-'})</label><input type="date" className={styles.input} name="birth_date" value={form.birth_date} onChange={handleChange} /></div>
                                <div><label className={styles.lbl}>เพศ</label>
                                    <select className={styles.input} name="gender" value={form.gender} onChange={handleChange}><option value="M">ชาย</option><option value="F">หญิง</option></select>
                                </div>
                            </div>
                            <div className={styles.grid} style={{ background: "var(--surface-2)", padding: 16, borderRadius: 8 }}>
                                <div><label className={styles.lbl}>วันที่เริ่มงาน</label><input type="date" className={styles.input} name="hire_date" value={form.hire_date} onChange={handleChange} /></div>
                                <div><label className={styles.lbl}><input type="checkbox" name="is_on_trial" checked={form.is_on_trial} onChange={handleChange} /> ทดลองงาน</label>
                                    {form.is_on_trial && (
                                        <div style={{ display: "flex", gap: 10 }}>
                                            <div style={{ width: 80 }}><input type="number" className={styles.input} name="probation_days" value={form.probation_days} onChange={handleChange} /></div>
                                            <div style={{ flex: 1 }}><input type="date" className={styles.input} name="probation_end_date" value={form.probation_end_date} readOnly /></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className={styles.grid}>
                                <div><label className={styles.lbl}>ประเภทการจ่ายเงิน</label>
                                    <select className={styles.input} name="salary_type" value={form.salary_type} onChange={handleChange}>
                                        <option value="monthly">โอนผ่านธนาคาร (รายเดือน)</option>
                                        <option value="daily">รายวัน</option>
                                        <option value="cash">เงินสด</option>
                                    </select>
                                </div>
                                <div><label className={styles.lbl}>เงินเดือนฐาน / ค่าแรง</label>
                                    <input type="number" className={styles.input} name="base_salary" value={form.base_salary} onChange={handleChange} />
                                </div>
                            </div>
                            {form.salary_type !== "cash" && (
                                <div className={styles.grid}>
                                    <div><label className={styles.lbl}>ธนาคาร</label><input className={styles.input} name="bank_name" value={form.bank_name} onChange={handleChange} /></div>
                                    <div><label className={styles.lbl}>เลขบัญชี</label><input className={styles.input} name="bank_account_no" value={form.bank_account_no} onChange={handleChange} /></div>
                                </div>
                            )}
                            <div className={styles.grid} style={{ background: "var(--surface-2)", padding: 16, borderRadius: 8 }}>
                                <div style={{ gridColumn: "span 2", fontWeight: 700, marginBottom: 8 }}>รายได้อื่นๆ & ภาษี</div>
                                <div style={{ gridColumn: "span 2", padding: 12, border: "1px solid var(--line-2)", borderRadius: 6, background: "white" }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>การคำนวณประกันสังคม (SSO)</div>
                                    <div style={{ marginTop: 12, padding: 8, background: "var(--surface-3)", borderRadius: 4, fontSize: 13 }}>
                                        ยอดหักประกันสังคมโดยประมาณ (5%): <strong style={{ color: "var(--red)" }}>{ssoPreview()} THB</strong>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <div className={styles.grid}>
                                <div><label className={styles.lbl}>เบอร์โทรศัพท์</label><input className={styles.input} name="phone_number" value={form.phone_number} onChange={handleChange} /></div>
                                <div><label className={styles.lbl}>อีเมล</label><input className={styles.input} name="email" value={form.email} onChange={handleChange} /></div>
                            </div>
                            <div className={styles.grid}>
                                <div><label className={styles.lbl}>หัวหน้างาน (Supervisor)</label>
                                    <SearchableSelect className={styles.input} value={form.supervisor_id} onChange={(v) => updateForm("supervisor_id", v)} options={employees.map(e => ({ value: e.emp_id, label: e.name }))} placeholder="— ไม่ระบุ —" />
                                </div>
                                <div><label className={styles.lbl}>ผู้ประเมินร่วม (Co-Evaluator)</label>
                                    <SearchableSelect className={styles.input} value={form.secondary_supervisor_id} onChange={(v) => updateForm("secondary_supervisor_id", v)} options={employees.map(e => ({ value: e.emp_id, label: e.name }))} placeholder="— ไม่ระบุ —" />
                                </div>
                            </div>
                            <div className={styles.grid}>
                                <div><label className={styles.lbl}>PIN เข้าสู่ระบบ (ไม่บังคับ)</label><input type="password" className={styles.input} name="pin" value={form.pin} onChange={handleChange} placeholder="ขั้นต่ำ 4 หลัก" /></div>
                            </div>
                            <div style={{ background: "var(--surface-2)", padding: 16, borderRadius: 8, marginTop: 16 }}>
                                <label style={{ display: "flex", gap: 8, fontSize: 14 }}><input type="checkbox" name="is_checkin_exempt" checked={form.is_checkin_exempt} onChange={handleChange} /> ยกเว้นการสแกนเวลาเข้าออกงาน</label>
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.modalFooter}>
                    <div className={styles.autoSave}>
                        {step > 1 && (
                            <>
                                {saveState === "saving" && <span>กำลังบันทึก...</span>}
                                {saveState === "saved" && <><CheckCircleIcon width={14} /> บันทึกแล้ว</>}
                            </>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        {step === 1 ? (
                            <><button className={styles.btnSecondary} onClick={onClose}>ยกเลิก</button><button className={styles.btnPrimary} onClick={handleStep1Submit} disabled={saveState === "saving"}>ถัดไป</button></>
                        ) : step === 2 ? (
                            <><button className={styles.btnSecondary} onClick={() => setStep(1)}>ย้อนกลับ</button><button className={styles.btnPrimary} onClick={() => setStep(3)}>ถัดไป</button></>
                        ) : (
                            <><button className={styles.btnSecondary} onClick={() => setStep(2)}>ย้อนกลับ</button><button className={styles.btnPrimary} onClick={handleFinish}>เสร็จสิ้น</button></>
                        )}
                    </div>
                </div>
                <AlertModal
                    alert={alertConfig.alert}
                    onClose={closeAlert}
                    onConfirm={alertConfig.onConfirm}
                />
            </div>
        </div>
    );
}
