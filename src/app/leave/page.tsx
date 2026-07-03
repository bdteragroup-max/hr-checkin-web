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
import SearchableSelect from "@/components/SearchableSelect";
import { formatTime24h, HOUR_OPTIONS, MINUTE_OPTIONS, formatDateShortThai } from "@/utils/time";

const getLeaveHourOptions = (dateStr: string) => {
    const isSat = dateStr ? new Date(dateStr).getDay() === 6 : false;
    const max = isSat ? 15 : 17;
    return HOUR_OPTIONS.filter(h => Number(h) >= 8 && Number(h) <= max);
};
const LEAVE_MINUTE_OPTIONS = MINUTE_OPTIONS;

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
    handover_person?: string | null;
    substitute_date?: string | null;
};
interface AlertModal { visible: boolean; message: string; type: "error" | "ok" }

/* ── Helpers ── */
function isTypingTarget(el: Element | null) {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}

function formatLeaveMins(totalMins?: number) {
    if (!totalMins || totalMins === 0) return "0 วัน";
    const days = Math.floor(totalMins / 480);
    const remainingMins = totalMins % 480;
    const hours = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;

    let res = "";
    if (days > 0) res += `${days} วัน `;
    if (hours > 0) res += `${hours} ชม. `;
    if (mins > 0) res += `${mins} นาที`;
    return res.trim() || "0 วัน";
}

function calculateNetMinutes(startStr: string, endStr: string) {
    if (!startStr || !endStr) return 0;
    const startAt = new Date(startStr);
    const endAt = new Date(endStr);
    if (endAt <= startAt) return 0;

    let totalWorkingMinutes = 0;
    const current = new Date(startAt.getTime());

    while (current < endAt) {
        const dateStr = current.getFullYear() + "-" + String(current.getMonth() + 1).padStart(2, '0') + "-" + String(current.getDate()).padStart(2, '0');
        const dayStart = new Date(`${dateStr}T08:00:00+07:00`);
        const lunchStart = new Date(`${dateStr}T12:00:00+07:00`);
        const lunchEnd = new Date(`${dateStr}T13:00:00+07:00`);
        const dayOfWeek = current.getDay();

        // standard end 17:00, Saturday end 15:00
        const dayEnd = new Date(`${dateStr}T${dayOfWeek === 6 ? "15" : "17"}:00:00+07:00`);

        const actualStart = current > dayStart ? current : dayStart;
        const actualEnd = endAt < dayEnd ? endAt : dayEnd;

        if (actualStart < actualEnd) {
            let mins = Math.floor((actualEnd.getTime() - actualStart.getTime()) / 60000);
            const overlapLunchStart = actualStart > lunchStart ? actualStart : lunchStart;
            const overlapLunchEnd = actualEnd < lunchEnd ? actualEnd : lunchEnd;
            if (overlapLunchStart < overlapLunchEnd) {
                const lunchOverlapMins = Math.floor((overlapLunchEnd.getTime() - overlapLunchStart.getTime()) / 60000);
                mins -= lunchOverlapMins;
            }
            totalWorkingMinutes += Math.max(0, mins);
        }
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
    }
    return totalWorkingMinutes;
}

function fmtDateTimeTH(d: string) {
    try {
        const dateObj = new Date(d);
        return `${formatDateShortThai(dateObj)} ${formatTime24h(dateObj)}`;
    } catch { return d; }
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; icon: any; color: string }> = {
        pending: { label: "รออนุมัติ", icon: ClockIcon, color: "var(--orange-500)" },
        pending_supervisor: { label: "รอหัวหน้าอนุมัติ", icon: ClockIcon, color: "var(--orange-500)" },
        pending_hr: { label: "รอ HR อนุมัติ", icon: ClockIcon, color: "var(--orange-500)" },
        approved: { label: "อนุมัติแล้ว", icon: CheckCircleIcon, color: "var(--green-600)" },
        rejected: { label: "ไม่อนุมัติ", icon: XCircleIcon, color: "var(--red-600)" },
        cancelled: { label: "ยกเลิกแล้ว", icon: XCircleIcon, color: "var(--gray-500)" },
    };
    const info = map[status] ?? { label: status, icon: InformationCircleIcon, color: "var(--blue-500)" };
    const isPending = status.startsWith('pending');
    const badgeClass = isPending ? styles.statusBadgePending : status === 'approved' ? styles.statusBadgeApproved : status === 'rejected' ? styles.statusBadgeRejected : status === 'cancelled' ? styles.statusBadgeCancelled : '';
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
    const [editingId, setEditingId] = useState("");
    const [leaveTypeId, setLeaveTypeId] = useState("");

    const [startDate, setStartDate] = useState("");
    const [startHour, setStartHour] = useState("08");
    const [startMin, setStartMin] = useState("00");
    const [endDate, setEndDate] = useState("");
    const [endHour, setEndHour] = useState("17");
    const [endMin, setEndMin] = useState("00");
    const [handoverPerson, setHandoverPerson] = useState("");
    const [substituteDate, setSubstituteDate] = useState("");
    const [colleagues, setColleagues] = useState<string[]>([]);
    const [holidays, setHolidays] = useState<string[]>([]);

    const startAt = useMemo(() => startDate ? `${startDate}T${startHour}:${startMin}:00+07:00` : "", [startDate, startHour, startMin]);
    const endAt = useMemo(() => endDate ? `${endDate}T${endHour}:${endMin}:00+07:00` : "", [endDate, endHour, endMin]);

    const estimatedMinutes = useMemo(() => {
        if (!startAt || !endAt) return 0;
        // The helper in src/utils/time.ts already has the Saturday padding logic
        const { calcWorkingMinutes } = require("@/utils/time");
        return calcWorkingMinutes(new Date(startAt), new Date(endAt), holidays);
    }, [startAt, endAt, holidays]);

    const handlePresetDuration = (days: number) => {
        let current = startDate ? new Date(startDate) : new Date();
        // If today is Sunday, start from Monday
        if (current.getDay() === 0) current.setDate(current.getDate() + 1);

        const start = new Date(current.getTime());
        const startStr = start.toISOString().split('T')[0];
        setStartDate(startStr);
        setStartHour("08");
        setStartMin("00");

        let workDaysCount = 0;
        let end = new Date(current.getTime());

        while (workDaysCount < days) {
            if (end.getDay() !== 0) { // Not Sunday
                workDaysCount++;
                if (workDaysCount === days) break;
            }
            end.setDate(end.getDate() + 1);
        }

        const endStr = end.toISOString().split('T')[0];
        setEndDate(endStr);
        setEndHour(end.getDay() === 6 ? "15" : "17");
        setEndMin("00");
    };

    const startHourOptions = useMemo(() => getLeaveHourOptions(startDate), [startDate]);
    const endHourOptions = useMemo(() => getLeaveHourOptions(endDate), [endDate]);

    useEffect(() => {
        if (startDate && new Date(startDate).getDay() === 6 && Number(startHour) > 15) {
            setStartHour("15");
        }
    }, [startDate, startHour]);

    useEffect(() => {
        if (endDate && new Date(endDate).getDay() === 6 && Number(endHour) > 15) {
            setEndHour("15");
        }
    }, [endDate, endHour]);

    const [reason, setReason] = useState("");
    const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
    const [fileNames, setFileNames] = useState<string[]>([]);

    const [alert, setAlert] = useState<AlertModal>({ visible: false, message: "", type: "error" });
    const closeAlert = useCallback(() => setAlert(p => ({ ...p, visible: false })), []);

    const fileRef = useRef<HTMLInputElement>(null);

    const selectedType = useMemo(() => types.find(t => t.id === leaveTypeId), [types, leaveTypeId]);
    const requireAttachment = useMemo(() => selectedType?.id === "sick", [selectedType]);

    const canSubmit = useMemo(() => {
        if (!leaveTypeId || !startDate || !endDate || !handoverPerson || !reason || reason.trim() === "" || loading || uploading) return false;
        if (leaveTypeId === "holiday_swap" && !substituteDate) return false;
        return true;
    }, [leaveTypeId, startDate, endDate, handoverPerson, reason, substituteDate, loading, uploading]);

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

    const cleanText = (val: string) => {
        // Allow Thai, English, Numbers, spaces, and parentheses for nicknames.
        return val.replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s()]/g, "");
    };

    async function load() {
        const r = await fetch("/api/leave", { cache: "no-store" });
        if (!r.ok) { window.location.href = "/"; return; }
        const data = await r.json().catch(() => ({}));
        const loadedTypes: LeaveType[] = data.types || [];
        setTypes(loadedTypes);
        setList(data.list || []);
        setColleagues(data.colleagues || []);
        if (!leaveTypeId && loadedTypes.length > 0) setLeaveTypeId(loadedTypes[0].id);

        const r2 = await fetch("/api/holidays", { cache: "no-store" });
        if (r2.ok) {
            const hData = await r2.json().catch(() => ({}));
            const hDates = (hData.list || []).map((h: any) => {
                // Ensure date string is properly formatted as YYYY-MM-DD in local time
                const d = new Date(h.date);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            });
            setHolidays(hDates);
        }
    }

    async function uploadFile(file: File) {
        setUploading(true);
        try {
            const fd = new FormData();
            const safeName = `upload-${Date.now()}.${file.name.split('.').pop() || 'tmp'}`;
            fd.append("file", file, safeName);
            const r = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data?.error || "UPLOAD_FAILED");

            const newUrl = String(data.url || "");
            setAttachmentUrls(prev => [...prev, newUrl]);
            setFileNames(prev => [...prev, file.name]);

            showAlert("อัปโหลดเอกสารแนบสำเร็จ", "ok");
        } catch {
            showAlert("อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    async function removeFile(index: number) {
        const urlToRemove = attachmentUrls[index];
        if (!urlToRemove) return;

        setUploading(true);
        try {
            await fetch("/api/upload", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: urlToRemove })
            });
        } catch { }

        setAttachmentUrls(prev => prev.filter((_, i) => i !== index));
        setFileNames(prev => prev.filter((_, i) => i !== index));
        setUploading(false);
    }

    async function submit() {
        if (!canSubmit) return;
        setLoading(true);
        const method = editingId ? "PUT" : "POST";
        const payload: any = {
            leave_type_id: leaveTypeId,
            start_at: startAt, end_at: endAt,
            reason: reason || null,
            attachment_url: attachmentUrls.length > 0 ? attachmentUrls.join(",") : null,
            handover_person: handoverPerson,
            ...(leaveTypeId === "holiday_swap" ? { substitute_date: substituteDate } : {})
        };
        if (editingId) payload.id = editingId;

        const r = await fetch("/api/leave", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        setLoading(false);
        if (!r.ok) {
            const errMap: Record<string, string> = {
                MISSING_REASON: "กรุณาระบุเหตุผลการลาเสมอ",
                OVERLAP_LEAVE: "ช่วงเวลาลาซ้อนกับใบลาที่มีอยู่แล้ว",
                ZERO_WORKING_DAYS: "ช่วงที่เลือกไม่มีวันทำงาน (ติดวันหยุด/อาทิตย์)",
                END_BEFORE_START: "เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม",
                SICK_ATTACHMENT_REQUIRED: "ลาป่วยเกิน 2 วันทำงาน ต้องแนบเอกสารประกอบ",
                GENDER_NOT_ALLOWED: "ประเภทลานี้ไม่ตรงตามเพศที่กำหนด",
                NO_ENTITLEMENT: "คุณยังไม่ได้รับสิทธิ์การลานี้ (อายุงานไม่ถึงเกณฑ์)",
                MAX_3_CONSECUTIVE_DAYS: "ลากิจ ลาติดต่อกันได้สูงสุด 3 วันทำงาน",
                ANNUAL_FULL_DAYS_ONLY: "ลาพักร้อนต้องลาเป็นวันเต็มเท่านั้น (08:00 - 17:00)",
                ADVANCE_NOTICE_REQUIRED: `ประเภทลานี้ต้องแจ้งล่วงหน้าอย่างน้อย ${data?.required_days} วัน`,
                EXCEED_ENTITLEMENT: `ใช้วันลาเกินสิทธิ์ คงเหลือ ${formatLeaveMins(data?.remaining_mins || 0)} (ขอลา ${formatLeaveMins(data?.requested_mins || 0)})`,
                PROBATION_PERSONAL_NOT_ALLOWED: "พนักงานทดลองงาน ไม่สามารถลากิจหรือลาฉุกเฉินได้",
                CANNOT_EDIT_APPROVED: "ไม่สามารถแก้ไขใบลาที่อนุมัติแล้วได้",
            };
            showAlert(errMap[data?.error] || data?.error || "ส่งคำขอไม่สำเร็จ", "error");
            return;
        }
        setStartDate(""); setEndDate(""); setReason(""); setHandoverPerson(""); setSubstituteDate("");
        setAttachmentUrls([]); setFileNames([]);
        setEditingId("");
        if (fileRef.current) fileRef.current.value = "";
        await load();
        showAlert(editingId ? `อัปเดตคำขอลาสำเร็จ` : `ส่งคำขอลาสำเร็จ\n${data.days} วันทำงาน · ${Math.floor((data.minutes || 0) / 60)}ชม ${(data.minutes || 0) % 60}นาที`, "ok");
    }

    function cancelEdit() {
        setStartDate(""); setEndDate(""); setReason(""); setHandoverPerson(""); setSubstituteDate("");
        setAttachmentUrls([]); setFileNames([]);
        setEditingId("");
        if (fileRef.current) fileRef.current.value = "";
    }

    function startEdit(item: LeaveItem) {
        setEditingId(item.id);
        setLeaveTypeId(item.leave_type_id);

        const dStart = new Date(item.start_at);
        const stYear = dStart.getFullYear();
        const stMonth = String(dStart.getMonth() + 1).padStart(2, '0');
        const stDay = String(dStart.getDate()).padStart(2, '0');
        setStartDate(`${stYear}-${stMonth}-${stDay}`);
        setStartHour(String(dStart.getHours()).padStart(2, '0'));
        setStartMin(String(dStart.getMinutes()).padStart(2, '0'));

        const dEnd = new Date(item.end_at);
        const enYear = dEnd.getFullYear();
        const enMonth = String(dEnd.getMonth() + 1).padStart(2, '0');
        const enDay = String(dEnd.getDate()).padStart(2, '0');
        setEndDate(`${enYear}-${enMonth}-${enDay}`);
        setEndHour(String(dEnd.getHours()).padStart(2, '0'));
        setEndMin(String(dEnd.getMinutes()).padStart(2, '0'));
        setHandoverPerson(cleanText((item as any).handover_person || ""));
        setReason(cleanText(item.reason || ""));
        setSubstituteDate(item.substitute_date ? new Date(item.substitute_date).toISOString().split('T')[0] : "");

        const urls = item.attachment_url ? item.attachment_url.split(",") : [];
        setAttachmentUrls(urls);
        setFileNames(urls.map(() => "ไฟล์แนบเดิม"));

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function cancelRequest(id: string) {
        if (!window.confirm("ยืนยันการยกเลิกใบลาใบนี้? (ไม่สามารถย้อนกลับได้)")) return;
        setLoading(true);
        try {
            const r = await fetch("/api/leave", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!r.ok) {
                const data = await r.json().catch(() => ({}));
                const err = (data as any)?.error;
                let msg = "ไม่สามารถยกเลิกได้";
                if (err === "CANNOT_CANCEL_APPROVED") msg = "ไม่สามารถยกเลิกใบลาที่อนุมัติแล้วได้";
                if (err === "CANNOT_CANCEL_COMPLETED") msg = "ไม่สามารถยกเลิกรายการที่ดำเนินการเสร็จสิ้นแล้วได้";
                if (err === "CANNOT_CANCEL_PAST_LEAVE") msg = "สามารถยกเลิกได้เฉพาะใบลาในอนาคตเท่านั้น";
                showAlert(msg, "error");
                return;
            }
            showAlert("ยกเลิกใบลาสำเร็จ", "ok");
            await load();
        } catch {
            showAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
        } finally {
            setLoading(false);
        }
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
    }, [canSubmit, startAt, endAt, reason, attachmentUrls]);

    return (
        <div className={styles.page}>
            <div className={styles.wrap}>
                {/* ── HERO ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>ระบบลางาน</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            ทำรายการลาและตรวจสอบประวัติ
                        </div>
                    </div>
                </div>

                {/* ── QUOTA ── */}
                <div className={styles.quotaBar}>
                    {types.filter(t => ["annual", "sick", "personal"].includes(t.id)).map(t => {
                        const remaining = Math.max(0, (t.quota || 0) - (t.used || 0));
                        const isWarning = remaining <= 1 && (t.quota || 0) > 0;
                        const isNoQuota = (t.quota || 0) === 0;
                        const displayName = t.id === 'personal' ? 'ลากิจ / ฉุกเฉิน' : t.name;

                        return (
                            <div key={t.id} className={styles.quotaItem}>
                                <div className={styles.quotaLabel}>{displayName}</div>
                                <div className={`${styles.quotaVal} ${isNoQuota ? styles.quotaValBad : isWarning ? styles.quotaValWarn : styles.quotaValOk}`}>
                                    {formatLeaveMins(remaining)}
                                </div>
                                <div className={styles.quotaSub}>ใช้ไป {formatLeaveMins(t.used || 0)} / {formatLeaveMins(t.quota || 0)}</div>
                            </div>
                        );
                    })}
                </div>

                {/* ── FORM CARD ── */}
                <div className={styles.card}>
                    <div className={styles.cardTitle}>
                        <div className={styles.dot} />
                        แบบฟอร์มยื่นใบลา
                    </div>

                    <div className={styles.form}>
                        {/* Leave Type selection */}
                        <div style={{ marginBottom: 20 }}>
                            <label className={styles.label}>ประเภทการลา</label>
                            <select className={styles.select} value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)}>
                                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>

                            {selectedType?.note && <div className={styles.smallNote}>{selectedType.note}</div>}

                            {selectedType?.id === 'annual' && (
                                <div className={`${styles.smallNote} ${styles.smallNoteWarn}`}>
                                    * ต้องลาล่วงหน้า 30 วัน
                                </div>
                            )}

                            {selectedType?.quota !== null && selectedType?.quota !== undefined && (
                                <div className={styles.quotaBox}>
                                    <div className={styles.quotaRow}>
                                        <span className={styles.quotaLabel}>สิทธิ์ทั้งหมด</span>
                                        <span className={styles.quotaVal}>{formatLeaveMins(selectedType.quota)}</span>
                                    </div>
                                    <div className={styles.quotaRow}>
                                        <span className={styles.quotaLabel}>ใช้ไปแล้ว</span>
                                        <span className={styles.quotaVal}>{formatLeaveMins(selectedType.used || 0)}</span>
                                    </div>
                                    <div className={styles.quotaRow} style={{ borderTop: "1px solid var(--gray-200)", paddingTop: 8, marginTop: 6 }}>
                                        <span className={styles.quotaLabel} style={{ fontWeight: 600, color: "var(--text)" }}>คงเหลือสุทธิ</span>
                                        <span className={styles.quotaVal} style={{ fontWeight: 700, color: "var(--red)", fontSize: 16 }}>
                                            {formatLeaveMins(Math.max(0, selectedType.quota - (selectedType.used || 0)))}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedType?.id === 'holiday_swap' && (
                            <div className={`${styles.dtBlock} ${styles.dateBlock}`} style={{ marginBottom: 16 }}>
                                <label className={styles.label}>วันที่มาทำงานแทน (สลับวันหยุด) *</label>
                                <input className={styles.input} type="date" value={substituteDate} onChange={e => setSubstituteDate(e.target.value)} />
                                <div className={styles.smallNote}>
                                    * กรุณาเลือกวันที่เป็นวันหยุดปกติ (เช่น อาทิตย์, หรือวันหยุดนักขัตฤกษ์) เพื่อมาทำงานชดเชย
                                </div>
                            </div>
                        )}

                        {/* QUICK PRESET BUTTONS */}
                        <div className={styles.presetButtonGroup}>
                            {[1, 2, 3, 5].map(d => (
                                <button key={d} type="button" className={styles.presetBtn} onClick={() => handlePresetDuration(d)}>
                                    {d} วัน
                                    <span className={styles.presetBtnSub}>FULL DAY</span>
                                </button>
                            ))}
                        </div>

                        {/* Date and time layer (STAYS LAYERED) */}
                        <div className={styles.cardSection}>
                            <div className={styles.dateTimeLayerRow}>
                                {/* Start Picker Container (All on one line) */}
                                <div className={styles.timePickerContainer}>
                                    <div className={`${styles.dtBlock} ${styles.dateBlock}`}>
                                        <label className={styles.label}>เริ่มต้นการลา *</label>
                                        <input className={styles.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={currentMinDate} />
                                    </div>
                                    <div className={styles.timeBlockWrap}>
                                        <div className={`${styles.dtBlock} ${styles.timeBlock}`}>
                                            <label className={styles.label}>ชม.</label>
                                            <select className={styles.select} value={startHour} onChange={e => setStartHour(e.target.value)}>
                                                {startHourOptions.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                        <span className={styles.timeSeparator}>:</span>
                                        <div className={`${styles.dtBlock} ${styles.timeBlock}`}>
                                            <label className={styles.label}>นาที</label>
                                            <select className={styles.select} value={startMin} onChange={e => setStartMin(e.target.value)}>
                                                {LEAVE_MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* End Picker Container (All on one line) */}
                                <div className={styles.timePickerContainer}>
                                    <div className={`${styles.dtBlock} ${styles.dateBlock}`}>
                                        <label className={styles.label}>สิ้นสุดการลา *</label>
                                        <input className={styles.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || currentMinDate} />
                                    </div>
                                    <div className={styles.timeBlockWrap}>
                                        <div className={`${styles.dtBlock} ${styles.timeBlock}`}>
                                            <label className={styles.label}>ชม.</label>
                                            <select className={styles.select} value={endHour} onChange={e => setEndHour(e.target.value)}>
                                                {endHourOptions.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                        <span className={styles.timeSeparator}>:</span>
                                        <div className={`${styles.dtBlock} ${styles.timeBlock}`}>
                                            <label className={styles.label}>นาที</label>
                                            <select className={styles.select} value={endMin} onChange={e => setEndMin(e.target.value)}>
                                                {LEAVE_MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {estimatedMinutes > 0 && (
                                <div style={{
                                    marginTop: 16,
                                    padding: "12px 16px",
                                    background: "rgba(34, 197, 94, 0.08)",
                                    border: "1px dashed #22c55e",
                                    borderRadius: 12,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                }}>
                                    <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>ระยะเวลาที่เลือก (หักพักเที่ยง):</span>
                                    <span style={{ fontSize: 15, color: "#15803d", fontWeight: 700 }}>{formatLeaveMins(estimatedMinutes)}</span>
                                </div>
                            )}
                        </div>

                        {/* Handover Person */}
                        <div style={{ marginBottom: 16 }}>
                            <label className={styles.label}>ผู้รับผิดชอบงานแทน *</label>
                            <SearchableSelect
                                options={colleagues.map(name => ({ value: name, label: name }))}
                                value={handoverPerson}
                                onChange={val => setHandoverPerson(val)}
                                placeholder="เลือกหรือค้นหาชื่อผู้ที่จะรับผิดชอบงานแทน..."
                            />
                        </div>

                        {/* Reason & Action */}
                        <div style={{ marginBottom: 16 }}>
                            <label className={styles.label}>เหตุผลการลา *</label>
                            <textarea
                                className={styles.textarea}
                                value={reason}
                                onChange={e => setReason(cleanText(e.target.value))}
                                placeholder="ระบุรายละเอียดที่จำเป็น..."
                                required
                            />
                        </div>

                        <div className={styles.uploadBox}>
                            <div className={styles.uploadHeader}>
                                <div>
                                    <div className={styles.uploadTitle}>เอกสารแนบ</div>
                                    <div className={styles.uploadSub}>
                                        {requireAttachment ? "บังคับแนบเอกสาร (ลาเกิน 2 วัน)" : "แนบรูปภาพหรือ PDF (ได้มากกว่า 1 ไฟล์)"}
                                    </div>
                                </div>
                                <button className={styles.btnOutline} onClick={() => fileRef.current?.click()} disabled={uploading} type="button">
                                    {uploading ? "กำลังอัปโหลด..." : "เลือกไฟล์"}
                                </button>
                            </div>
                            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" multiple style={{ display: "none" }}
                                onChange={e => {
                                    const files = e.target.files;
                                    if (files) {
                                        for (let i = 0; i < files.length; i++) {
                                            uploadFile(files[i]);
                                        }
                                    }
                                }} />

                            {attachmentUrls.map((url, idx) => (
                                <div key={url} className={styles.filePreviewRow} style={{ marginTop: 8 }}>
                                    <div className={styles.fileName}>{fileNames[idx] || "ไฟล์แนบ"}</div>
                                    <button type="button" className={styles.btnRemoveFile} onClick={() => removeFile(idx)} disabled={uploading}>
                                        <TrashIcon width={14} /> ลบ
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button className={styles.btnPrimaryFull} disabled={!canSubmit || loading} onClick={submit}>
                            {loading ? <ArrowPathIcon width={20} className="animate-spin" /> :
                                editingId ? <><ArrowPathIcon width={18} style={{ marginRight: 8 }} /> อัปเดตใบลา</> :
                                    <><PaperAirplaneIcon width={18} style={{ marginRight: 8, transform: 'rotate(-20deg)' }} /> ยืนยันการส่งใบลา</>}
                        </button>
                        {editingId && (
                            <button className={styles.btnOutlineFull} style={{ marginTop: 8, width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-300)', backgroundColor: 'transparent', fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }} onClick={cancelEdit} disabled={loading}>
                                ยกเลิกการแก้ไข
                            </button>
                        )}
                    </div>
                </div>

                {/* ── HISTORY CARD ── */}
                <div className={styles.card}>
                    <div className={styles.cardTitle}>
                        <div className={styles.dot} style={{ background: 'var(--text3)' }} />
                        ประวัติการลา
                    </div>
                    {list.length === 0 ? (
                        <div className={styles.emptyState}>ยังไม่มีประวัติ</div>
                    ) : (
                        <div className={styles.historyTable}>
                            {list.map(x => (
                                <div key={x.id} className={`${styles.historyRow} ${x.status.startsWith('pending') ? styles.historyRowPending : x.status === 'approved' ? styles.historyRowApproved : x.status === 'cancelled' ? styles.historyRowCancelled : styles.historyRowRejected}`} data-status={x.status}>
                                    <div className={styles.historyRowTop}>
                                        <div className={styles.colType}>{x.leave_type}</div>
                                        <StatusBadge status={x.status} />
                                    </div>
                                    <div className={styles.historyRowMid}>
                                        <CalendarIcon width={14} style={{ color: 'var(--text4)' }} />
                                        <div className={styles.colDate}>
                                            {fmtDateTimeTH(x.start_at)}
                                        </div>
                                    </div>
                                    {x.handover_person && (
                                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ fontWeight: 600 }}>ผู้รับผิดชอบแทน:</span> {x.handover_person}
                                        </div>
                                    )}
                                    <div className={styles.historyRowBot}>
                                        <div className={styles.colDays}>{formatLeaveMins(x.minutes)}</div>
                                        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                            {x.status.startsWith('pending') && (
                                                <button
                                                    className={styles.btnOutlineSm}
                                                    style={{ fontSize: 13, padding: "4px 10px", borderRadius: 6, border: '1px solid var(--gray-300)', backgroundColor: 'white', color: 'var(--text2)' }}
                                                    onClick={() => startEdit(x)}
                                                >
                                                    แก้ไข
                                                </button>
                                            )}
                                            {(x.status.startsWith('pending') || x.status === 'approved') && new Date(x.start_at) > new Date() && (
                                                <button
                                                    className={styles.btnOutlineSm}
                                                    style={{ fontSize: 13, padding: "4px 10px", borderRadius: 6, border: '1px solid var(--red-hover)', backgroundColor: 'white', color: 'var(--red)' }}
                                                    onClick={() => cancelRequest(x.id)}
                                                >
                                                    ยกเลิก
                                                </button>
                                            )}
                                        </div>
                                    </div>
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