"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { 
    ClockIcon, 
    CheckCircleIcon, 
    XCircleIcon, 
    InformationCircleIcon, 
    ExclamationTriangleIcon,
    PaperClipIcon,
    ArrowPathIcon,
    TrashIcon,
    PaperAirplaneIcon,
    CalendarIcon
} from "@heroicons/react/24/solid";
import { formatTime24h, HOUR_OPTIONS, MINUTE_OPTIONS } from "@/utils/time";

/* ── Types ── */
type LeaveType = {
    id: string; name: string;
    require_attachment?: boolean; note?: string | null; max_days?: number | null;
    quota?: number | null;
    used?: number;
    advance_notice?: number;
};
type LeaveItem = {
    id: string; timestamp: string; leave_type: string; leave_type_id: string;
    start_at: string; end_at: string; minutes: number; days: number;
    status: "pending" | "approved" | "rejected" | string;
    reason?: string | null; attachment_url?: string | null;
};
interface AlertModal { visible: boolean; message: string; type: "error" | "ok" }

/* ── Helpers ── */
function isTypingTarget(el: Element | null) {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}

function fmtDateTimeTH(d: string) {
    try {
        const dateObj = new Date(d);
        return `${dateObj.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })} ${formatTime24h(dateObj)}`;
    } catch { return d; }
}

function fmtDuration(days: number, minutes: number) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return `${days} วันทำงาน • ${h}ชม ${m}นาที`;
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; icon: any; color: string }> = {
        pending: { label: "รออนุมัติ", icon: ClockIcon, color: "var(--orange-500)" },
        pending_supervisor: { label: "รอหัวหน้าอนุมัติ", icon: ClockIcon, color: "var(--orange-500)" },
        pending_hr: { label: "รอ HR อนุมัติ", icon: ClockIcon, color: "var(--orange-500)" },
        approved: { label: "อนุมัติแล้ว", icon: CheckCircleIcon, color: "var(--green-600)" },
        rejected: { label: "ไม่อนุมัติ", icon: XCircleIcon, color: "var(--red-600)" },
    };
    const info = map[status] ?? { label: status, icon: InformationCircleIcon, color: "var(--blue-500)" };
    const isPending = status.startsWith('pending');
    const badgeClass = isPending ? styles.statusBadgePending : status === 'approved' ? styles.statusBadgeApproved : status === 'rejected' ? styles.statusBadgeRejected : '';
    const Icon = info.icon;
    return (
        <span className={`${styles.statusBadge} ${badgeClass}`} role="status" aria-label={info.label}>
            <Icon width={14} className={styles.statusIcon} aria-hidden />
            <span className={styles.statusLabel}>{info.label}</span>
        </span>
    );
}

/* ── Alert Modal ── */
function AlertModalComponent({ alert, onClose }: { alert: AlertModal; onClose: () => void }) {
    const isErr = alert.type === "error";

    useEffect(() => {
        if (!alert.visible) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [alert.visible, onClose]);

    if (!alert.visible) return null;

    return (
        <div className={styles.alertOverlay} onClick={onClose} role="dialog" aria-modal="true">
            <div className={styles.alertModal} onClick={e => e.stopPropagation()}>
                <div className={`${styles.alertIcon} ${isErr ? styles.alertIconErr : styles.alertIconOk}`}>
                    {isErr ? <ExclamationTriangleIcon width={32} /> : <CheckCircleIcon width={32} />}
                </div>
                <div className={`${styles.alertTitle} ${isErr ? styles.alertTitleErr : styles.alertTitleOk}`}>
                    {isErr ? "เกิดข้อผิดพลาด" : "สำเร็จ"}
                </div>
                <div className={styles.alertMsg}>{alert.message}</div>
                <button
                    className={`${styles.alertBtn} ${isErr ? styles.alertBtnErr : styles.alertBtnOk}`}
                    onClick={onClose}
                    autoFocus
                >
                    ตกลง
                </button>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════ */
export default function LeavePage() {
    const [types, setTypes] = useState<LeaveType[]>([]);
    const [list, setList] = useState<LeaveItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [leaveTypeId, setLeaveTypeId] = useState("");
    
    // Sub-states for 24h Time Picker
    const [startDate, setStartDate] = useState("");
    const [startHour, setStartHour] = useState("08");
    const [startMin, setStartMin] = useState("00");
    const [endDate, setEndDate] = useState("");
    const [endHour, setEndHour] = useState("17");
    const [endMin, setEndMin] = useState("00");

    const startAt = useMemo(() => startDate ? `${startDate}T${startHour}:${startMin}:00` : "", [startDate, startHour, startMin]);
    const endAt = useMemo(() => endDate ? `${endDate}T${endHour}:${endMin}:00` : "", [endDate, endHour, endMin]);
    
    const [reason, setReason] = useState("");
    const [attachmentUrl, setAttachmentUrl] = useState("");
    const [fileName, setFileName] = useState("");

    const [alert, setAlert] = useState<AlertModal>({ visible: false, message: "", type: "error" });
    const closeAlert = useCallback(() => setAlert(p => ({ ...p, visible: false })), []);

    const fileRef = useRef<HTMLInputElement>(null);

    const selectedType = useMemo(() => types.find(t => t.id === leaveTypeId), [types, leaveTypeId]);
    const requireAttachment = useMemo(() => selectedType?.id === "sick", [selectedType]);

    const canSubmit = useMemo(() => {
        if (!leaveTypeId || !startDate || !endDate || loading || uploading) return false;
        return true;
    }, [leaveTypeId, startDate, endDate, loading, uploading]);

    const currentMinDate = useMemo(() => {
        if (!selectedType) return "";
        const notice = selectedType.advance_notice || 0;
        if (notice === 0) return "";
        const d = new Date();
        d.setDate(d.getDate() + notice);
        return d.toISOString().split('T')[0];
    }, [selectedType]);

    function showAlert(message: string, type: "error" | "ok" = "error") {
        setAlert({ visible: true, message, type });
    }

    async function load() {
        const r = await fetch("/api/leave", { cache: "no-store" });
        if (!r.ok) { window.location.href = "/"; return; }
        const data = await r.json().catch(() => ({}));
        const loadedTypes: LeaveType[] = data.types || [];
        setTypes(loadedTypes);
        setList(data.list || []);
        if (!leaveTypeId && loadedTypes.length > 0) setLeaveTypeId(loadedTypes[0].id);
    }

    async function uploadFile(file: File) {
        setUploading(true); setFileName(file.name);
        try {
            const fd = new FormData(); fd.append("file", file, file.name);
            const r = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data?.error || "UPLOAD_FAILED");
            setAttachmentUrl(String(data.url || ""));
            showAlert("อัปโหลดเอกสารแนบสำเร็จ", "ok");
        } catch {
            setFileName(""); setAttachmentUrl("");
            if (fileRef.current) fileRef.current.value = "";
            showAlert("อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
        } finally { setUploading(false); }
    }

    async function removeFile() {
        if (!attachmentUrl) return;
        setUploading(true);
        try {
            await fetch("/api/upload", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: attachmentUrl })
            });
        } catch { }
        setAttachmentUrl("");
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
        setUploading(false);
    }

    async function submit() {
        if (!canSubmit) return;
        setLoading(true);

        const r = await fetch("/api/leave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                leave_type_id: leaveTypeId,
                start_at: startAt, end_at: endAt,
                reason: reason || null,
                attachment_url: attachmentUrl || null,
            }),
        });

        const data = await r.json().catch(() => ({}));
        setLoading(false);

        if (!r.ok) {
            const errMap: Record<string, string> = {
                OVERLAP_LEAVE: "ช่วงเวลาลาซ้อนกับใบลาที่มีอยู่แล้ว",
                ZERO_WORKING_DAYS: "ช่วงที่เลือกไม่มีวันทำงาน (ติดวันหยุด/อาทิตย์)",
                END_BEFORE_START: "เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม",
                SICK_ATTACHMENT_REQUIRED: "ลาป่วยเกิน 2 วันทำงาน ต้องแนบเอกสารประกอบ",
                GENDER_NOT_ALLOWED: "ประเภทลานี้ไม่ตรงตามเพศที่กำหนด",
                NO_ENTITLEMENT: "คุณยังไม่ได้รับสิทธิ์การลานี้ (อายุงานไม่ถึงเกณฑ์)",
                MAX_3_CONSECUTIVE_DAYS: "ลากิจ ลาติดต่อกันได้สูงสุด 3 วันทำงาน",
                ANNUAL_FULL_DAYS_ONLY: "ลาพักร้อนต้องลาเป็นวันเต็มเท่านั้น (08:00 - 17:00)",
                ADVANCE_NOTICE_REQUIRED: `ประเภทลานี้ต้องแจ้งล่วงหน้าอย่างน้อย ${data?.required_days} วัน`,
                EXCEED_ENTITLEMENT: `ใช้วันลาเกินสิทธิ์ คงเหลือ ${data?.remaining || 0} วัน (ขอลา ${data?.requested || 0} วัน)`,
                ANNUAL_EXCEED_ENTITLEMENT_SINGLE: `ลาพักร้อนครั้งนี้เกินสิทธิ์ (สิทธิ์ต่อครั้ง ${data.entitlement_days} วัน)`,
                PROBATION_PERSONAL_NOT_ALLOWED: "พนักงานทดลองงานยังไม่ได้รับสิทธิ์ลากิจ หรือ ลากรณีฉุกเฉิน",
            };
            showAlert(errMap[data?.error] || data?.error || "ส่งคำขอไม่สำเร็จ", "error");
            return;
        }

        setStartDate(""); setEndDate(""); setReason("");
        setAttachmentUrl(""); setFileName("");
        if (fileRef.current) fileRef.current.value = "";
        await load();
        showAlert(`ส่งคำขอลาสำเร็จ\n${data.days} วันทำงาน · ${Math.floor((data.minutes || 0) / 60)}ชม ${(data.minutes || 0) % 60}นาที`, "ok");
    }

    useEffect(() => { load(); }, []);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.code !== "Space" || e.repeat) return;
            if (isTypingTarget(document.activeElement)) return;
            e.preventDefault(); submit();
        }
        window.addEventListener("keydown", onKeyDown, { passive: false });
        return () => window.removeEventListener("keydown", onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canSubmit, leaveTypeId, startAt, endAt, reason, attachmentUrl]);

    /* ──────────────────────────────────────────
       RENDER
    ────────────────────────────────────────── */
    return (
        <div className={styles.page}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>ระบบลางาน</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            ทำรายการลาและประวัติ
                        </div>
                    </div>
                </div>

                {/* ── SUMMARY DASHBOARD ── */}
                <div className={styles.quotaBar}>
                    {types.filter(t => ["annual", "sick", "personal"].includes(t.id)).map(t => {
                        const remaining = Math.max(0, (t.quota || 0) - (t.used || 0));
                        const isWarning = remaining <= 1 && (t.quota || 0) > 0;
                        const isNoQuota = (t.quota || 0) === 0;

                        // Unified label for Personal/Emergency
                        const displayName = t.id === 'personal' ? 'ลากิจ / ฉุกเฉิน' : t.name;

                        return (
                            <div key={t.id} className={styles.quotaItem}>
                                <div className={styles.quotaLabel}>{displayName}</div>
                                <div className={`${styles.quotaVal} ${isNoQuota ? styles.quotaValBad : isWarning ? styles.quotaValWarn : styles.quotaValOk}`}>
                                    {remaining} <span style={{ fontSize: 12, fontWeight: 500 }}>วัน</span>
                                </div>
                                <div className={styles.quotaSub}>ใช้แล้ว {t.used || 0} / {t.quota || 0}</div>
                            </div>
                        );
                    })}
                </div>

                {/* ── FORM CARD ── */}
                <div className={styles.card}>
                    <div className={styles.cardTitle}>แบบฟอร์มยื่นใบลา</div>

                    <div className={styles.form}>

                        {/* Leave type */}
                        <div>
                            <label className={styles.label}>ประเภทลา</label>
                            <select className={styles.select} value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)}>
                                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            {selectedType?.note ? <div className={styles.smallNote}>{selectedType.note}</div> : null}
                            {selectedType?.id === 'annual' && (
                                <div className={styles.smallNote} style={{ color: 'var(--red)', fontWeight: 600 }}>
                                    * ต้องลาล่วงหน้า 30 วัน และลาเป็นวันเต็มเท่านั้น
                                </div>
                            )}
                            {(selectedType?.id === 'personal' || selectedType?.id === 'emergency') && selectedType?.quota === 0 && (
                                <div className={styles.smallNote} style={{ color: 'var(--red)', fontWeight: 600 }}>
                                    * พนักงานช่วงทดลองงานยังไม่ได้รับสิทธิ์ลากิจ/ฉุกเฉิน กรุณาเลือก "ลาไม่รับค่าจ้าง" แทน
                                </div>
                            )}
                            {selectedType?.quota !== null && selectedType?.quota !== undefined ? (
                                <div className={styles.quotaBox}>
                                    <div className={styles.quotaRow}>
                                        <span className={styles.quotaLabel}>สิทธิ์ทั้งหมด</span>
                                        <span className={styles.quotaVal}>{selectedType.quota} วัน</span>
                                    </div>
                                    <div className={styles.quotaRow}>
                                        <span className={styles.quotaLabel}>ใช้ไปแล้ว</span>
                                        <span className={styles.quotaVal}>{selectedType.used} วัน</span>
                                    </div>
                                    <div className={styles.quotaRow} style={{ borderTop: "1px solid var(--gray-200)", paddingTop: 6, marginTop: 4 }}>
                                        <span className={styles.quotaLabel} style={{ fontWeight: 600, color: "var(--text)" }}>คงเหลือ</span>
                                        <span className={styles.quotaVal} style={{ fontWeight: 600, color: "var(--red)" }}>
                                            {Math.max(0, selectedType.quota - (selectedType.used || 0))} วัน
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Date range - Compact Layout */}
                        <div>
                            <div className={styles.timePickerContainer}>
                                <div className={`${styles.dtBlock} ${styles.dateBlock}`}>
                                    <label className={styles.label}>วัน/เวลา เริ่มต้น *</label>
                                    <input className={styles.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={currentMinDate} />
                                </div>
                                <div className={`${styles.dtBlock} ${styles.timeBlock}`}>
                                    <label className={styles.label}>ชั่วโมง</label>
                                    <select className={styles.select} value={startHour} onChange={e => setStartHour(e.target.value)}>
                                        {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                                <span className={styles.timeSeparator}>:</span>
                                <div className={`${styles.dtBlock} ${styles.timeBlock}`}>
                                    <label className={styles.label}>นาที</label>
                                    <select className={styles.select} value={startMin} onChange={e => setStartMin(e.target.value)}>
                                        {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className={styles.timePickerContainer}>
                                <div className={`${styles.dtBlock} ${styles.dateBlock}`}>
                                    <label className={styles.label}>วัน/เวลา สิ้นสุด *</label>
                                    <input className={styles.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || currentMinDate} />
                                </div>
                                <div className={`${styles.dtBlock} ${styles.timeBlock}`}>
                                    <label className={styles.label}>ชั่วโมง</label>
                                    <select className={styles.select} value={endHour} onChange={e => setEndHour(e.target.value)}>
                                        {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                                <span className={styles.timeSeparator}>:</span>
                                <div className={`${styles.dtBlock} ${styles.timeBlock}`}>
                                    <label className={styles.label}>นาที</label>
                                    <select className={styles.select} value={endMin} onChange={e => setEndMin(e.target.value)}>
                                        {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Reason */}
                        <div>
                            <label className={styles.label}>เหตุผล (ถ้ามี)</label>
                            <textarea className={styles.textarea} value={reason} onChange={e => setReason(e.target.value)} placeholder="ระบุเหตุผลการลา..." />
                        </div>

                        {/* Upload */}
                        <div className={styles.uploadBox}>
                            <div className={styles.uploadHeader}>
                                <div>
                                    <div className={styles.uploadTitle}>เอกสารแนบ (ถ้ามี)</div>
                                    <div className={styles.uploadSub}>
                                        {requireAttachment
                                            ? "ลาป่วยเกิน 2 วันทำงาน ระบบจะบังคับแนบเอกสาร"
                                            : "แนบเอกสารได้ตามต้องการ · JPG, PNG, PDF"}
                                    </div>
                                </div>
                                <button className={styles.btnOutline} onClick={() => fileRef.current?.click()} disabled={uploading} type="button">
                                    {uploading ? "กำลังอัปโหลด..." : "เลือกไฟล์"}
                                </button>
                            </div>
                            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: "none" }}
                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                            {fileName ? (
                                <div className={styles.filePreviewRow}>
                                    <div className={styles.fileName}>{fileName}</div>
                                    {attachmentUrl && (
                                        <a className={styles.fileLink} href={attachmentUrl} target="_blank" rel="noreferrer">
                                            <PaperClipIcon width={14} style={{ marginRight: 4 }} /> เปิดเอกสาร
                                        </a>
                                    )}
                                    <button type="button" className={styles.btnRemoveFile} onClick={removeFile} disabled={uploading}>
                                        <TrashIcon width={14} /> ลบไฟล์
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {/* Actions */}
                        <div className={styles.btnRowSingle}>
                            <button className={styles.btnPrimaryFull} disabled={!canSubmit} onClick={submit}>
                                {loading 
                                    ? <ArrowPathIcon width={20} className="animate-spin" /> 
                                    : <><PaperAirplaneIcon width={20} style={{ marginRight: 8, transform: 'rotate(-20deg)' }} /> ส่งคำขอลา</>
                                }
                            </button>
                        </div>

                    </div>
                </div>

                {/* ── LIST CARD ── */}
                <div className={styles.card}>
                    <div className={styles.cardTitle}>รายการใบลา</div>
                    {list.length === 0 ? (
                        <div className={styles.emptyState}>ยังไม่มีประวัติการลางานของคุณ</div>
                    ) : (
                        <div className={styles.historyTable}>
                            <div className={styles.historyHeader}>
                                <div className={styles.colType}>ประเภท</div>
                                <div className={styles.colDate}>วันที่</div>
                                <div className={styles.colDays}>จำนวน</div>
                                <div className={styles.colStatus}>สถานะ</div>
                            </div>
                            {list.map(x => (
                                <div key={x.id} className={styles.historyRow} data-status={x.status}>
                                    <div className={styles.colType}>{x.leave_type}</div>
                                    <div className={styles.colDate}>
                                        <span className={styles.dateStart}>{fmtDateTimeTH(x.start_at)}</span>
                                        <span className={styles.dateEnd}>{fmtDateTimeTH(x.end_at)}</span>
                                    </div>
                                    <div className={styles.colDays}>{x.days} วัน</div>
                                    <div className={styles.colStatus}><StatusBadge status={x.status} /></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Alert Modal */}
                <AlertModalComponent alert={alert} onClose={closeAlert} />
            </div>
        </div>
    );
}