"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

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
        return new Date(d).toLocaleString("th-TH", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    } catch { return d; }
}

function fmtDuration(days: number, minutes: number) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return `${days} วันทำงาน • ${h}ชม ${m}นาที`;
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; icon: string }> = {
        pending: { label: "รออนุมัติ", icon: "🕒" },
        pending_supervisor: { label: "รอหัวหน้าอนุมัติ", icon: "🕒" },
        pending_hr: { label: "รอ HR อนุมัติ", icon: "🕒" },
        approved: { label: "อนุมัติแล้ว", icon: "✓" },
        rejected: { label: "ไม่อนุมัติ", icon: "✕" },
    };
    const info = map[status] ?? { label: status, icon: "ℹ️" };
    const isPending = status.startsWith('pending');
    const badgeClass = isPending ? styles.statusBadgePending : status === 'approved' ? styles.statusBadgeApproved : status === 'rejected' ? styles.statusBadgeRejected : '';
    return (
        <span className={`${styles.statusBadge} ${badgeClass}`} role="status" aria-label={info.label}>
            <span className={styles.statusIcon} aria-hidden>{info.icon}</span>
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
                    {isErr ? "⚠" : "✓"}
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
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");
    const [reason, setReason] = useState("");
    const [attachmentUrl, setAttachmentUrl] = useState("");
    const [fileName, setFileName] = useState("");

    const [alert, setAlert] = useState<AlertModal>({ visible: false, message: "", type: "error" });
    const closeAlert = useCallback(() => setAlert(p => ({ ...p, visible: false })), []);

    const fileRef = useRef<HTMLInputElement>(null);

    const selectedType = useMemo(() => types.find(t => t.id === leaveTypeId), [types, leaveTypeId]);
    const requireAttachment = useMemo(() => selectedType?.id === "sick", [selectedType]);

    const canSubmit = useMemo(() => {
        if (!leaveTypeId || !startAt || !endAt || loading || uploading) return false;
        return true;
    }, [leaveTypeId, startAt, endAt, loading, uploading]);

    const currentMinDatetime = useMemo(() => {
        if (!selectedType) return "";
        const notice = selectedType.advance_notice || 0;
        if (notice === 0) return "";
        const d = new Date();
        d.setDate(d.getDate() + notice);
        d.setHours(0, 0, 0, 0);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dt = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dt}T00:00`;
    }, [selectedType]);

    useEffect(() => {
        if (!startAt && !endAt && selectedType) {
            const notice = selectedType.advance_notice || 0;
            // Default to at least the required notice constraint + 1 day to be safe, or tomorrow if none
            const targetDays = notice === 0 ? 1 : notice + 1;
            const d = new Date();
            d.setDate(d.getDate() + targetDays);

            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const dt = String(d.getDate()).padStart(2, "0");

            setStartAt(`${y}-${m}-${dt}T08:00`);
            setEndAt(`${y}-${m}-${dt}T17:00`);
        }
    }, [startAt, endAt, selectedType]);

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
            };
            showAlert(errMap[data?.error] || data?.error || "ส่งคำขอไม่สำเร็จ", "error");
            return;
        }

        setStartAt(""); setEndAt(""); setReason("");
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

                        {/* Date range */}
                        <div className={styles.row2}>
                            <div>
                                <label className={styles.label}>เริ่มลา</label>
                                <input className={styles.input} type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} min={currentMinDatetime} />
                            </div>
                            <div>
                                <label className={styles.label}>สิ้นสุด</label>
                                <input className={styles.input} type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} min={startAt || currentMinDatetime} />
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
                                            เปิดเอกสาร
                                        </a>
                                    )}
                                    <button type="button" className={styles.btnRemoveFile} onClick={removeFile} disabled={uploading}>
                                        ✕ ลบไฟล์
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {/* Actions */}
                        <div className={styles.btnRowSingle}>
                            <button className={styles.btnPrimaryFull} disabled={!canSubmit} onClick={submit}>
                                {loading ? "กำลังส่ง..." : (<><span className={styles.btnIcon}></span> ส่งคำขอลา</>)}
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