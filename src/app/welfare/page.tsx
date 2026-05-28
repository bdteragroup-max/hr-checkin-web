"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { 
    ExclamationTriangleIcon, 
    CheckCircleIcon, 
    CloudArrowUpIcon, 
    ArrowPathIcon,
    BanknotesIcon,
    XCircleIcon,
    AcademicCapIcon,
    UserGroupIcon,
    SparklesIcon,
    HandRaisedIcon,
    HeartIcon,
    InformationCircleIcon,
    PaperClipIcon,
    TrashIcon
} from "@heroicons/react/24/outline";
import AlertModal, { AlertState } from "@/components/AlertModal";

type WelfareType = "CHILD_EDUCATION" | "MARRIAGE" | "CHILDBIRTH" | "ORDINATION" | "FUNERAL";

const WELFARE_CONFIG: Record<WelfareType, { title: string; icon: any; color: string }> = {
    CHILD_EDUCATION: { title: "ทุนการศึกษาบุตร", icon: AcademicCapIcon, color: "#3b82f6" },
    MARRIAGE: { title: "เงินแสดงความยินดีมงคลสมรส", icon: HeartIcon, color: "#ec4899" },
    CHILDBIRTH: { title: "เงินรับขวัญบุตร", icon: SparklesIcon, color: "#8b5cf6" },
    ORDINATION: { title: "เงินช่วยเหลืองานอุปสมบท", icon: HandRaisedIcon, color: "#f59e0b" },
    FUNERAL: { title: "เงินช่วยเหลืองานฌาปนกิจ", icon: UserGroupIcon, color: "#64748b" }
};

const CHILD_EDU_LEVELS = [
    { id: "P1_3", label: "ประถม (ป.1 - ป.3)", minGpa: 3.85 },
    { id: "P4_6", label: "ประถม (ป.4 - ป.6)", minGpa: 3.75 },
    { id: "M1_3", label: "มัธยมต้น (ม.1 - ม.3)", minGpa: 3.50 },
    { id: "M4_6", label: "มัธยมปลาย / ปวช.", minGpa: 3.50 },
    { id: "DIP_BACH", label: "ปวส. / ปริญญาตรี", minGpa: 3.25 },
];

const CHILD_EDU_RATES: Record<string, number[]> = {
    "P1_3": [0, 800, 1100, 1400, 1700, 2000, 2000, 2000],
    "P4_6": [0, 1000, 1300, 1600, 1900, 2200, 2200, 2200],
    "M1_3": [0, 1300, 1600, 1900, 2200, 2500, 2500, 2500],
    "M4_6": [0, 1600, 1900, 2200, 2500, 2800, 2800, 2800],
    "DIP_BACH": [0, 2300, 2600, 2900, 3200, 3500, 3500, 3500],
};

const MARRIAGE_RATES = [2500, 3000, 3500, 4000, 4500, 5000, 5000, 5000];
const CHILDBIRTH_RATES = [1000, 2000, 3000, 4000, 5000, 5000, 5000, 5000];
const ORDINATION_RATES = [1500, 1800, 2100, 2400, 2700, 3000, 3000, 3000];
const FUNERAL_RATES = [1000, 2000, 3000, 4000, 5000, 5000, 5000, 5000];

type Claim = {
    id: string;
    welfare_type: string;
    amount: number;
    status: string;
    attachment_url?: string;
    created_at: string;
    admin_comment?: string;
};

export default function WelfarePage() {
    const [me, setMe] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<Claim[]>([]);
    const [selectedType, setSelectedType] = useState<WelfareType | null>(null);
    const [amount, setAmount] = useState("");
    const [remark, setRemark] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState<{ text: string, type: 'ok' | 'bad' } | null>(null);
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });

    const showAlert = (message: string, type: 'ok' | 'error' = 'error') => {
        setAlert({ visible: true, message, type });
    };

    // Child Education Specifics
    const [childName, setChildName] = useState("");
    const [eduLevel, setEduLevel] = useState("");
    const [gpa, setGpa] = useState("");

    async function load() {
        try {
            const [meRes, wRes] = await Promise.all([
                fetch("/api/me").then(r => r.json()),
                fetch("/api/welfare").then(r => r.json())
            ]);
            setMe(meRes);
            if (wRes.ok) setClaims(wRes.list || []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    // Auto-calculate amount for Child Education & Marriage
    useEffect(() => {
        if (me?.hire_date) {
            const idx = getServiceYearsIndex(me.hire_date);
            if (selectedType === "CHILD_EDUCATION" && eduLevel) {
                const rate = CHILD_EDU_RATES[eduLevel]?.[idx] || 0;
                setAmount(rate.toString());
            } else if (selectedType === "MARRIAGE") {
                const rate = MARRIAGE_RATES[idx] || 0;
                setAmount(rate.toString());
            } else if (selectedType === "CHILDBIRTH") {
                const rate = CHILDBIRTH_RATES[idx] || 0;
                setAmount(rate.toString());
            } else if (selectedType === "ORDINATION") {
                const rate = ORDINATION_RATES[idx] || 0;
                setAmount(rate.toString());
            } else if (selectedType === "FUNERAL") {
                const rate = FUNERAL_RATES[idx] || 0;
                setAmount(rate.toString());
            }
        }
    }, [selectedType, eduLevel, me]);

    function getServiceYearsIndex(hireDate: string | null) {
        if (!hireDate) return 0;
        const start = new Date(hireDate);
        if (isNaN(start.getTime())) return 0;
        const now = new Date();
        const diffYears = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (diffYears < 1) return 0;
        if (diffYears < 2) return 1;
        if (diffYears < 3) return 2;
        if (diffYears < 4) return 3;
        if (diffYears < 5) return 4;
        if (diffYears < 10) return 5;
        if (diffYears < 15) return 6;
        return 7;
    }

    function getServiceYearsLabel(hireDate: string | null) {
        if (!hireDate) return "ไม่พบข้อมูลวันเริ่มงาน";
        const start = new Date(hireDate);
        if (isNaN(start.getTime())) return "ข้อมูลวันเริ่มงานไม่ถูกต้อง";
        const now = new Date();
        
        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();
        let days = now.getDate() - start.getDate();

        if (days < 0) {
            months -= 1;
            const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
            days += lastDayPrevMonth;
        }

        if (months < 0) {
            years -= 1;
            months += 12;
        }

        const parts = [];
        if (years > 0) parts.push(`${years} ปี`);
        if (months > 0) parts.push(`${months} เดือน`);
        if (days > 0) parts.push(`${days} วัน`);
        
        return parts.length > 0 ? parts.join(" ") : "เริ่มงานวันนี้";
    }

    async function submitClaim() {
        if (!selectedType) return setMsg({ text: "กรุณาเลือกประเภทสวัสดิการ", type: 'bad' });
        if (!amount || Number(amount) <= 0) return setMsg({ text: "กรุณาระบุจำนวนเงิน", type: 'bad' });

        // Specific validation for Child Education
        if (selectedType === "CHILD_EDUCATION") {
            if (!childName) return setMsg({ text: "กรุณาระบุชื่อ-นามสกุลบุตร", type: 'bad' });
            if (!eduLevel) return setMsg({ text: "กรุณาเลือกระดับการศึกษา", type: 'bad' });
            if (!gpa) return setMsg({ text: "กรุณาระบุเกรดเฉลี่ย", type: 'bad' });

            const levelCfg = CHILD_EDU_LEVELS.find(l => l.id === eduLevel);
            if (levelCfg && Number(gpa) < levelCfg.minGpa) {
                return setMsg({ text: `เกรดเฉลี่ยไม่ถึงเกณฑ์ขั้นต่ำ (${levelCfg.minGpa})`, type: 'bad' });
            }

            const idx = getServiceYearsIndex(me?.hire_date);
            if (idx === 0) {
                return setMsg({ text: "อายุงานต้องครบ 1 ปีขึ้นไปจึงจะได้รับสวัสดิการนี้", type: 'bad' });
            }
            
            if (files.length === 0) {
                return setMsg({ text: "กรุณาแนบไฟล์หลักฐาน (ผลการเรียน/สูติบัตร/ทะเบียนสมรส)", type: 'bad' });
            }
        }
        
        setUploading(true);
        try {
            const attachmentUrls: string[] = [];
            for (const f of files) {
                const formData = new FormData();
                formData.append("file", f);
                formData.append("prefix", "welfare");
                const res = await fetch("/api/upload", { method: "POST", body: formData }).then(r => r.json());
                
                if (res.ok) {
                    attachmentUrls.push(res.url);
                } else {
                    throw new Error(`ไม่สามารถอัปโหลดไฟล์ ${f.name} ได้: ${res.error || 'Unknown error'}`);
                }
            }

            const metadata: any = {};
            if (selectedType === "CHILD_EDUCATION") {
                metadata.child_name = childName;
                metadata.education_level = eduLevel;
                metadata.gpa = Number(gpa);
                metadata.service_years_at_claim = getServiceYearsLabel(me?.hire_date);
            } else if (selectedType === "MARRIAGE" || selectedType === "CHILDBIRTH" || selectedType === "ORDINATION" || selectedType === "FUNERAL") {
                metadata.service_years_at_claim = getServiceYearsLabel(me?.hire_date);
            }

            const body = {
                welfare_type: selectedType,
                amount: Number(amount),
                attachment_url: attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : null,
                remark,
                metadata
            };

            const cRes = await fetch("/api/welfare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }).then(r => r.json());

            if (!cRes.ok) throw new Error(cRes.error || "SUBMIT_FAILED");

            setMsg({ text: "ส่งคำขอสำเร็จ! กรุณารอฝ่ายบุคคลอนุมัติ", type: 'ok' });
            setSelectedType(null);
            setAmount("");
            setRemark("");
            setFiles([]);
            setChildName("");
            setEduLevel("");
            setGpa("");
            load();
        } catch (e: any) {
            setMsg({ text: e.message || "เกิดข้อผิดพลาด", type: 'bad' });
        } finally {
            setUploading(false);
        }
    }

    if (loading) return <div className={styles.loading}>กำลังโหลด...</div>;

    const hireDateIdx = me?.hire_date ? getServiceYearsIndex(me.hire_date) : 0;

    return (
        <div className={styles.page}>
            <AlertModal 
                alert={alert} 
                onClose={() => setAlert(p => ({ ...p, visible: false }))} 
            />
            <div className={styles.wrap}>
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>สวัสดิการและเงินช่วยเหลือ</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            ยื่นคำขอรับสวัสดิการและเงินช่วยเหลือตามนโยบายบริษัท
                        </div>
                    </div>
                </div>

                {/* ── SELECT TYPE ── */}
                <div className={styles.card}>
                    <div className={styles.cardTitle}>เลือกประเภทที่ต้องการขอรับ</div>
                    <div className={styles.typeGrid}>
                        {(Object.entries(WELFARE_CONFIG) as [WelfareType, any][]).map(([key, cfg]) => (
                            <div 
                                key={key} 
                                className={`${styles.typeItem} ${selectedType === key ? styles.typeItemActive : ""}`}
                                onClick={() => {
                                    if (key === "ORDINATION" && me?.gender !== "M") {
                                        showAlert("สวัสดิการเงินอุปสมบทเฉพาะพนักงานชายเท่านั้น");
                                        return;
                                    }
                                    setSelectedType(key);
                                    setMsg(null);
                                    setAmount("");
                                }}
                            >
                                <div className={styles.typeIcon} style={{ color: cfg.color }}>
                                    <cfg.icon width={28} />
                                </div>
                                <div className={styles.typeTitle}>{cfg.title}</div>
                            </div>
                        ))}
                    </div>

                    {selectedType && (
                        <div className={styles.form}>
                            <div className={styles.formDivider} />
                            <div className={styles.formHeader}>
                                <div className={styles.formTitle}>รายละเอียด: {WELFARE_CONFIG[selectedType].title}</div>
                                {selectedType === "CHILD_EDUCATION" && (
                                    <div className={styles.infoBox}>
                                        <InformationCircleIcon width={18} />
                                        <span>อายุงานของคุณ: <b>{getServiceYearsLabel(me?.hire_date)}</b></span>
                                    </div>
                                )}
                            </div>

                            {selectedType === "CHILD_EDUCATION" && (
                                <div className={styles.formGrid}>
                                    <div>
                                        <label className={styles.label}>ชื่อ-นามสกุลบุตร</label>
                                        <input 
                                            className={styles.input} 
                                            placeholder="ด.ช. สมชาย ใจดี"
                                            value={childName}
                                            onChange={e => setChildName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className={styles.label}>ระดับการศึกษา</label>
                                        <select 
                                            className={styles.input}
                                            value={eduLevel}
                                            onChange={e => setEduLevel(e.target.value)}
                                        >
                                            <option value="">-- เลือกระดับการศึกษา --</option>
                                            {CHILD_EDU_LEVELS.map(l => (
                                                <option key={l.id} value={l.id}>{l.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={styles.label}>เกรดเฉลี่ยสะสม (GPA)</label>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            className={styles.input} 
                                            placeholder="4.00"
                                            value={gpa}
                                            onChange={e => setGpa(e.target.value)}
                                        />
                                        {eduLevel && (
                                            <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 4 }}>
                                                เกณฑ์ขั้นต่ำ: {CHILD_EDU_LEVELS.find(l => l.id === eduLevel)?.minGpa}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className={styles.label}>สิทธิ์เบิกได้ (คำนวณตามอายุงาน)</label>
                                        <div className={styles.amountBadge}>
                                            ฿{Number(amount).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ marginBottom: 16 }}>
                                <label className={styles.label}>
                                    แนบไฟล์หลักฐาน (เลือกได้หลายไฟล์)
                                        {selectedType === "CHILD_EDUCATION" && <span style={{ color: "var(--red)", marginLeft: 4 }}>* (ผลการเรียน/สูติบัตร/ทะเบียนสมรส)</span>}
                                        {selectedType === "MARRIAGE" && <span style={{ color: "var(--red)", marginLeft: 4 }}>* (ทะเบียนสมรส/ภาพถ่ายงานแต่งงาน)</span>}
                                        {selectedType === "CHILDBIRTH" && <span style={{ color: "var(--red)", marginLeft: 4 }}>* (ทะเบียนสมรส/สูติบัตร)</span>}
                                        {selectedType === "ORDINATION" && <span style={{ color: "var(--red)", marginLeft: 4 }}>* (การ์ดเชิญ/ภาพถ่ายงานอุปสมบท)</span>}
                                    </label>
                                    <div className={styles.fileInputWrapper}>
                                        <input 
                                            type="file" 
                                            multiple
                                            className={styles.fileInput} 
                                            onChange={e => {
                                                const MAX_SIZE = 5 * 1024 * 1024; // 5MB
                                                const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
                                                const newFiles = Array.from(e.target.files || []);
                                                
                                                const validFiles: File[] = [];
                                                for (const f of newFiles) {
                                                    if (f.size > MAX_SIZE) {
                                                        showAlert(`ไฟล์ "${f.name}" มีขนาดใหญ่เกินไป (ไม่เกิน 5MB)`);
                                                        continue;
                                                    }
                                                    if (!ALLOWED_TYPES.includes(f.type)) {
                                                        showAlert(`ไฟล์ "${f.name}" เป็นประเภทที่ไม่รองรับ (รองรับเฉพาะ รูปภาพ และ PDF)`);
                                                        continue;
                                                    }
                                                    validFiles.push(f);
                                                }
                                                
                                                setFiles(prev => [...prev, ...validFiles]);
                                                e.target.value = ""; // Clear input to allow re-selecting same file
                                            }}
                                        />
                                        <div className={styles.fileHint}>
                                            <CloudArrowUpIcon width={18} /> คลิกหรือลากไฟล์เพื่อแนบ (เลือกได้หลายไฟล์)
                                        </div>
                                    </div>
                                    {files.length > 0 && (
                                        <div className={styles.fileList}>
                                            {files.map((f, i) => (
                                                <div key={i} className={styles.fileItem}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
                                                        <PaperClipIcon width={14} style={{ flexShrink: 0 }} />
                                                        <span className={styles.fileName}>{f.name}</span>
                                                    </div>
                                                    <button 
                                                        className={styles.fileRemove}
                                                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                                                    >
                                                        <TrashIcon width={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                            </div>

                            <div>
                                <label className={styles.label}>หมายเหตุ / รายละเอียดเพิ่มเติม</label>
                                <textarea 
                                    className={styles.input} 
                                    rows={2} 
                                    placeholder="ระบุข้อมูลเพิ่มเติม..."
                                    value={remark}
                                    onChange={e => setRemark(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className={styles.label}>จำนวนเงินที่ขอเบิก (บาท)</label>
                                <div className={styles.amountBadge} style={{ marginBottom: 12 }}>
                                    ฿{Number(amount).toLocaleString()}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text4)", marginTop: -8, marginBottom: 20 }}>
                                    * คำนวณตามอายุงานโดยอัตโนมัติ ({getServiceYearsLabel(me?.hire_date)})
                                </div>
                            </div>

                            {msg && (
                                <div className={msg.type === 'ok' ? styles.msgOk : styles.msgBad}>
                                    {msg.type === 'ok' ? <CheckCircleIcon width={20} /> : <XCircleIcon width={20} />}
                                    {msg.text}
                                </div>
                            )}

                            <button 
                                className={styles.btnPrimary} 
                                onClick={submitClaim}
                                disabled={uploading || (selectedType === "CHILD_EDUCATION" && hireDateIdx === 0)}
                            >
                                {uploading ? <><ArrowPathIcon width={18} className="animate-spin" /> กำลังดำเนินการ...</> : "ส่งคำขอเบิกสวัสดิการ"}
                            </button>
                            
                            {selectedType === "CHILD_EDUCATION" && hireDateIdx === 0 && (
                                <div className={styles.msgBad} style={{ marginTop: 10 }}>
                                    <ExclamationTriangleIcon width={18} />
                                    คุณยังทำงานไม่ครบ 1 ปี จึงไม่สามารถขอรับทุนการศึกษาบุตรได้
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── HISTORY ── */}
                <div className={styles.card}>
                    <div className={styles.cardTitle}>ประวัติคำขอของคุณ</div>
                    {claims.length === 0 ? (
                        <div className={styles.empty}>ยังไม่มีประวัติการส่งคำขอ</div>
                    ) : (
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>วันที่ส่ง</th>
                                        <th>ประเภท</th>
                                        <th>จำนวนเงิน</th>
                                        <th style={{ textAlign: 'center' }}>สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claims.map(c => (
                                        <tr key={c.id}>
                                            <td>{new Date(c.created_at).toLocaleDateString("th-TH")}</td>
                                            <td style={{ fontWeight: 600 }}>{WELFARE_CONFIG[c.welfare_type as WelfareType]?.title || c.welfare_type}</td>
                                            <td>฿{Number(c.amount).toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={
                                                    c.status === 'approved' ? styles.stApproved :
                                                    c.status === 'rejected' ? styles.stRejected : styles.stPending
                                                }>
                                                    {c.status === 'approved' ? 'อนุมัติแล้ว' :
                                                     c.status === 'rejected' ? 'ปฏิเสธ' : 'รอตรวจสอบ'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
