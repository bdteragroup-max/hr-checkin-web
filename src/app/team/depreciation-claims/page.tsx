"use client";

import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
    PlusCircleIcon,
    ArrowPathIcon,
    PaperClipIcon,
    PencilSquareIcon,
    CheckCircleIcon,
    XCircleIcon,
    CheckIcon,
    ShieldCheckIcon,
    DocumentTextIcon,
    ClockIcon,
    InboxIcon,
    DocumentCheckIcon,
    ArrowTopRightOnSquareIcon,
    ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import {
    getCurrentDepreciationUser,
    getMyTeamClaims,
    getMyTeamMembers,
    getInitialApprovalPendingClaims,
    createDepreciationClaim,
    resubmitClaim,
    initialApproveClaim,
    returnClaimForRevision
} from "@/app/actions/depreciation-claims";

export default function TeamDepreciationClaimsPage() {
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"initial_approval" | "my_claims">("initial_approval");

    const [claims, setClaims] = useState<any[]>([]);
    const [initialPendingClaims, setInitialPendingClaims] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [msg, setMsg] = useState({ text: "", type: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Approval / Return modal states
    const [approvingClaim, setApprovingClaim] = useState<any | null>(null);
    const [returningClaim, setReturningClaim] = useState<any | null>(null);
    const [returnReason, setReturnReason] = useState("");
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [resubmitId, setResubmitId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        emp_id: "",
        amount: "",
        claim_month: format(new Date(), "yyyy-MM"),
        file: null as File | null
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    async function fetchInitialData() {
        setLoading(true);
        try {
            const [userData, claimsData, membersData] = await Promise.all([
                getCurrentDepreciationUser(),
                getMyTeamClaims(),
                getMyTeamMembers()
            ]);
            setCurrentUser(userData);
            setClaims(claimsData || []);
            setMembers(membersData || []);

            if (userData?.isInitialApprover) {
                const pending = await getInitialApprovalPendingClaims();
                setInitialPendingClaims(pending || []);
            } else {
                setActiveTab("my_claims");
            }
        } catch (e: any) {
            console.error(e);
            setMsg({ text: "ไม่สามารถโหลดข้อมูลได้: " + e.message, type: "bad" });
        } finally {
            setLoading(false);
        }
    }

    async function compressImage(file: File): Promise<File> {
        if (!file.type.startsWith('image/')) return file;
        if (file.size < 1024 * 1024) return file; // Skip < 1MB

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    const MAX = 1600;

                    if (width > height) {
                        if (width > MAX) { height = Math.round(height * (MAX / width)); width = MAX; }
                    } else {
                        if (height > MAX) { width = Math.round(height * (MAX / height)); height = MAX; }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
                        } else resolve(file);
                    }, 'image/jpeg', 0.8);
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "application/pdf",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ];

            if (!allowedTypes.includes(file.type)) {
                alert("กรุณาอัปโหลดไฟล์ JPG, PNG, PDF หรือ Excel เท่านั้น");
                e.target.value = "";
                return;
            }

            // For non-images (PDF / Excel), enforce 4.5MB limit due to Vercel/serverless payload limit
            if (!file.type.startsWith("image/") && file.size > 4.5 * 1024 * 1024) {
                alert("ไฟล์ PDF หรือ Excel ต้องมีขนาดไม่เกิน 4.5MB กรุณาลดขนาดไฟล์ก่อนอัปโหลด");
                e.target.value = "";
                return;
            }

            if (file.size > 15 * 1024 * 1024) {
                alert("ไฟล์ต้องมีขนาดไม่เกิน 15MB");
                e.target.value = "";
                return;
            }

            setFormData({ ...formData, file });
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg({ text: "", type: "" });

        if (!resubmitId && !formData.emp_id) {
            alert("กรุณาเลือกพนักงาน");
            return;
        }
        if (!formData.amount || Number(formData.amount) <= 0) {
            alert("กรุณาระบุจำนวนเงินที่ถูกต้อง");
            return;
        }
        if (!formData.file) {
            alert("กรุณาแนบไฟล์เอกสาร");
            return;
        }

        setIsSubmitting(true);
        try {
            const fileToUpload = await compressImage(formData.file);

            const uploadData = new FormData();
            const parts = fileToUpload.name.split(".");
            let ext = parts.length > 1 ? parts.pop() || "tmp" : "tmp";
            ext = ext.replace(/[^a-zA-Z0-9]/g, "");
            if (!ext) ext = "tmp";
            const safeName = `upload-${Date.now()}.${ext}`;
            uploadData.append("file", fileToUpload, safeName);
            uploadData.append("prefix", "depreciation");

            let uploadRes: Response;
            try {
                uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: uploadData
                });
            } catch (fetchErr: any) {
                console.error("Upload network error:", fetchErr);
                throw new Error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่ออัปโหลดไฟล์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือขนาดไฟล์");
            }

            const uploadJson = await uploadRes.json().catch(() => null);

            if (!uploadRes.ok || !uploadJson?.url) {
                const errDetail = uploadJson?.error || uploadJson?.details || `HTTP ${uploadRes.status}`;
                throw new Error("อัปโหลดไฟล์ไม่สำเร็จ: " + errDetail);
            }

            const receipt_url = uploadJson.url;
            const amount = Number(formData.amount);

            if (resubmitId) {
                await resubmitClaim(resubmitId, { amount, receipt_url });
                setMsg({ text: "แก้ไขและส่งคำขอใหม่เรียบร้อยแล้ว (ส่งถึงคุณณัฎธินีเพื่ออนุมัติเบื้องต้น)", type: "ok" });
            } else {
                const claimMonth = new Date(formData.claim_month + "-01");
                await createDepreciationClaim({
                    emp_id: formData.emp_id,
                    amount,
                    receipt_url,
                    claim_month: claimMonth
                });
                setMsg({ text: "ส่งคำขอเรียบร้อยแล้ว (ส่งถึงคุณณัฎธินีเพื่ออนุมัติเบื้องต้น)", type: "ok" });
            }

            setShowForm(false);
            setResubmitId(null);
            setFormData({ emp_id: "", amount: "", claim_month: format(new Date(), "yyyy-MM"), file: null });
            fetchInitialData();

        } catch (e: any) {
            console.error(e);
            const displayMsg = e.message === "Failed to fetch"
                ? "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือลองใหม่อีกครั้ง"
                : (e.message || "เกิดข้อผิดพลาดในการบันทึก");
            setMsg({ text: displayMsg, type: "bad" });
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleInitialApprove() {
        if (!approvingClaim) return;
        setIsActionLoading(true);
        try {
            await initialApproveClaim(approvingClaim.id);
            setMsg({
                text: `อนุมัติเบื้องต้นคำขอของ ${approvingClaim.employee?.name} เรียบร้อยแล้ว (ส่งต่อฝ่ายบุคคลเพื่ออนุมัติขั้นสุดท้าย)`,
                type: "ok"
            });
            setApprovingClaim(null);
            await fetchInitialData();
        } catch (e: any) {
            console.error(e);
            setMsg({ text: e.message || "เกิดข้อผิดพลาดในการอนุมัติเบื้องต้น", type: "bad" });
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleReturnForRevision() {
        if (!returningClaim) return;
        if (!returnReason.trim()) {
            alert("กรุณาระบุเหตุผลในการตีกลับแก้ไข");
            return;
        }
        setIsActionLoading(true);
        try {
            await returnClaimForRevision(returningClaim.id, returnReason.trim());
            setMsg({
                text: `ตีกลับคำขอของ ${returningClaim.employee?.name} เพื่อแก้ไขเรียบร้อยแล้ว`,
                type: "ok"
            });
            setReturningClaim(null);
            setReturnReason("");
            await fetchInitialData();
        } catch (e: any) {
            console.error(e);
            setMsg({ text: e.message || "เกิดข้อผิดพลาดในการตีกลับแก้ไข", type: "bad" });
        } finally {
            setIsActionLoading(false);
        }
    }

    function openResubmit(claim: any) {
        setFormData({
            emp_id: claim.emp_id,
            amount: claim.amount.toString(),
            claim_month: format(new Date(claim.claim_month), "yyyy-MM"),
            file: null
        });
        setResubmitId(claim.id);
        setShowForm(true);
        window.scrollTo(0, 0);
    }

    function renderStatusBadge(status: string) {
        if (status === "PENDING_INITIAL") {
            return (
                <span className={`${styles.statusBadge} ${styles.status_PENDING_INITIAL}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <ClockIcon width={13} />
                    รอคุณณัฎธินีอนุมัติเบื้องต้น
                </span>
            );
        }
        if (status === "PENDING_HR" || status === "PENDING") {
            return (
                <span className={`${styles.statusBadge} ${styles.status_PENDING_HR}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <ShieldCheckIcon width={13} />
                    ผ่านอนุมัติเบื้องต้น (รอ HR อนุมัติ)
                </span>
            );
        }
        if (status === "APPROVED") {
            return (
                <span className={`${styles.statusBadge} ${styles.status_APPROVED}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <CheckCircleIcon width={13} />
                    อนุมัติแล้ว
                </span>
            );
        }
        if (status === "RETURNED") {
            return (
                <span className={`${styles.statusBadge} ${styles.status_RETURNED}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <XCircleIcon width={13} />
                    ตีกลับเพื่อแก้ไข
                </span>
            );
        }
        return (
            <span className={styles.statusBadge}>
                {status}
            </span>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.wrap}>
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>ค่าเสื่อม/ค่าน้ำมัน (ทีม)</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            ระบบขอเบิกและอนุมัติค่าเสื่อม/ค่าน้ำมัน
                        </div>
                    </div>
                </div>

                {msg.text && (
                    <div className={msg.type === "ok" ? styles.msgOk : styles.msgBad} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {msg.type === "ok" ? (
                            <CheckCircleIcon width={20} style={{ flexShrink: 0, color: "#16a34a" }} />
                        ) : (
                            <XCircleIcon width={20} style={{ flexShrink: 0, color: "#dc2626" }} />
                        )}
                        <span>{msg.text}</span>
                    </div>
                )}

                {/* Tabs for Khun Natthinee / Admin */}
                {currentUser?.isInitialApprover && (
                    <div className={styles.tabGroup}>
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${activeTab === "initial_approval" ? styles.tabBtnActive : ""}`}
                            onClick={() => { setActiveTab("initial_approval"); setShowForm(false); }}
                        >
                            <ShieldCheckIcon width={18} />
                            รออนุมัติเบื้องต้น
                            {initialPendingClaims.length > 0 && (
                                <span className={styles.tabBadge}>
                                    {initialPendingClaims.length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${activeTab === "my_claims" ? styles.tabBtnActive : ""}`}
                            onClick={() => setActiveTab("my_claims")}
                        >
                            <DocumentTextIcon width={18} />
                            รายการที่ฉันยื่นขอ
                        </button>
                    </div>
                )}

                {/* TAB 1: Initial Approval Desk (Khun Natthinee / Admin) */}
                {currentUser?.isInitialApprover && activeTab === "initial_approval" && (
                    <div className={styles.card}>
                        <div className={styles.infoBanner}>
                            <ShieldCheckIcon width={24} style={{ flexShrink: 0, color: "#2563eb" }} />
                            <div>
                                <strong>ขั้นตอนที่ 1: การอนุมัติเบื้องต้นโดย คุณณัฎธินี (TE65001)</strong><br />
                                ตรวจสอบรายการและเอกสารแนบที่หัวหน้างานยื่นขอเบิก เมื่อตรวจสอบและอนุมัติเบื้องต้นแล้ว ระบบจะส่งเรื่องต่อให้ฝ่ายบุคคล (HR) อนุมัติขั้นสุดท้าย
                            </div>
                        </div>

                        <div className={styles.cardTitle} style={{ margin: "0 0 16px 0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span>รายการรออนุมัติเบื้องต้น</span>
                                {initialPendingClaims.length > 0 && (
                                    <span style={{ fontSize: 13, background: "#fee2e2", color: "#b91c1c", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                                        {initialPendingClaims.length} รายการ
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => fetchInitialData()}
                                disabled={loading}
                                style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600, fontSize: 13 }}
                            >
                                <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} /> รีเฟรช
                            </button>
                        </div>

                        {loading ? (
                            <div className={styles.emptyState}>
                                <ArrowPathIcon width={32} className="animate-spin" style={{ color: "var(--gray-400)" }} />
                                <span>กำลังโหลดข้อมูล...</span>
                            </div>
                        ) : initialPendingClaims.length === 0 ? (
                            <div className={styles.emptyState}>
                                <InboxIcon width={40} style={{ color: "var(--gray-400)" }} />
                                <span>ไม่มีรายการรออนุมัติเบื้องต้นในขณะนี้</span>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {initialPendingClaims.map((c: any) => (
                                    <div key={c.id} className={styles.listItem} style={{ borderColor: "#fed7aa", background: "#fffdfb" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: 12 }}>
                                            <div>
                                                <div className={styles.empName}>
                                                    {c.employee?.name} {c.employee?.nickname ? `(${c.employee.nickname})` : ""}
                                                </div>
                                                <div className={styles.empId}>
                                                    รหัสพนักงาน: {c.emp_id} • ยื่นโดย: <strong style={{ color: "#374151" }}>{c.supervisor?.name || c.submitted_by}</strong>
                                                </div>
                                            </div>
                                            <div>
                                                {renderStatusBadge(c.status)}
                                            </div>
                                        </div>

                                        <div className={styles.kv}>
                                            <span className={styles.kvKey}>เดือนที่ขอเบิก:</span>
                                            <span className={styles.kvValBold}>{format(new Date(c.claim_month), "MMMM yyyy", { locale: th })}</span>

                                            <span className={styles.kvKey}>จำนวนเงิน:</span>
                                            <span className={styles.redText}>฿{Number(c.amount).toLocaleString()}.-</span>

                                            <span className={styles.kvKey}>วันที่ยื่น:</span>
                                            <span className={styles.kvValBold}>{format(new Date(c.created_at), "d MMM yyyy (HH:mm)", { locale: th })}</span>
                                        </div>

                                        <div style={{ marginTop: 14, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
                                                <PaperClipIcon width={18} style={{ color: "#2563eb" }} />
                                                <span>หลักฐานค่าใช้จ่าย:</span>
                                            </div>
                                            <a
                                                href={c.receipt_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.link}
                                                style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}
                                            >
                                                <span>คลิกดูไฟล์แนบ (บิล/ใบเสร็จ)</span>
                                                <ArrowTopRightOnSquareIcon width={14} />
                                            </a>
                                        </div>

                                        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                                            <button
                                                type="button"
                                                onClick={() => { setReturningClaim(c); setReturnReason(""); }}
                                                className={styles.btnReject}
                                                title="ตีกลับเพื่อให้แก้ไข"
                                            >
                                                <XCircleIcon width={16} /> ตีกลับแก้ไข
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setApprovingClaim(c)}
                                                className={styles.btnApprove}
                                                title="อนุมัติเบื้องต้นและส่งต่อ HR"
                                            >
                                                <CheckIcon width={16} /> อนุมัติเบื้องต้น
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: Submitter's Own Claims */}
                {(!currentUser?.isInitialApprover || activeTab === "my_claims") && (
                    <>
                        {showForm ? (
                            <div className={styles.card}>
                                <div className={styles.cardTitle} style={{ marginBottom: 16 }}>
                                    {resubmitId ? "แก้ไขและส่งคำขอใหม่" : "สร้างคำขอเบิกใหม่"}
                                </div>
                                <form onSubmit={handleSubmit}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>พนักงาน</label>
                                        <select
                                            className={styles.select}
                                            value={formData.emp_id}
                                            onChange={e => setFormData({ ...formData, emp_id: e.target.value })}
                                            disabled={!!resubmitId}
                                            required
                                        >
                                            <option value="">-- เลือกพนักงานในทีม --</option>
                                            {members.map(m => (
                                                <option key={m.emp_id} value={m.emp_id}>
                                                    {m.name} {m.nickname ? `(${m.nickname})` : ""} {m.supervisor?.name ? `- หัวหน้า: ${m.supervisor.name}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>จำนวนเงิน (บาท)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className={styles.input}
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>เดือนที่ขอเบิก</label>
                                        <input
                                            type="month"
                                            className={styles.input}
                                            value={formData.claim_month}
                                            onChange={e => setFormData({ ...formData, claim_month: e.target.value })}
                                            disabled={!!resubmitId}
                                            required
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>ไฟล์เอกสาร (รูปภาพไม่เกิน 15MB, PDF/Excel ไม่เกิน 4.5MB)</label>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                                            className={styles.fileInput}
                                            onChange={handleFileChange}
                                            required
                                        />
                                    </div>

                                    <div className={styles.actions}>
                                        <button type="submit" className={styles.btnPrimary} disabled={isSubmitting}>
                                            {isSubmitting ? "กำลังส่ง..." : "ยืนยันการส่ง"}
                                        </button>
                                        <button type="button" className={styles.btnSecondary} onClick={() => {
                                            setShowForm(false);
                                            setResubmitId(null);
                                        }}>
                                            ยกเลิก
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className={styles.card}>
                                <div className={styles.cardTitle} style={{ margin: "0 0 16px 0" }}>
                                    <div>รายการขอเบิกที่คุณยื่น</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <button onClick={() => fetchInitialData()} disabled={loading} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600, fontSize: 13 }}>
                                            <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} /> รีเฟรช
                                        </button>
                                        <button onClick={() => setShowForm(true)} className={styles.btnPrimary} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px" }}>
                                            <PlusCircleIcon width={18} /> ส่งคำขอใหม่
                                        </button>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className={styles.emptyState}>
                                        <ArrowPathIcon width={32} className="animate-spin" style={{ color: "var(--gray-400)" }} />
                                        <span>กำลังโหลดข้อมูล...</span>
                                    </div>
                                ) : claims.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <DocumentCheckIcon width={40} style={{ color: "var(--gray-400)" }} />
                                        <span>ยังไม่มีรายการขอเบิก</span>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                        {claims.map((c: any) => (
                                            <div key={c.id} className={styles.listItem}>
                                                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: 12 }}>
                                                    <div>
                                                        <div className={styles.empName}>{c.employee?.name} {c.employee?.nickname ? `(${c.employee.nickname})` : ""}</div>
                                                        <div className={styles.empId}>ID: {c.emp_id}</div>
                                                    </div>
                                                    <div>
                                                        {renderStatusBadge(c.status)}
                                                    </div>
                                                </div>

                                                <div className={styles.kv}>
                                                    <span className={styles.kvKey}>เดือนที่ขอเบิก:</span>
                                                    <span className={styles.kvValBold}>{format(new Date(c.claim_month), "MMMM yyyy", { locale: th })}</span>

                                                    <span className={styles.kvKey}>จำนวนเงิน:</span>
                                                    <span className={styles.redText}>฿{Number(c.amount).toLocaleString()}.-</span>

                                                    <span className={styles.kvKey}>วันที่ยื่น:</span>
                                                    <span className={styles.kvValBold}>{format(new Date(c.created_at), "d MMM yyyy (HH:mm)", { locale: th })}</span>
                                                </div>

                                                {c.status === "RETURNED" && c.return_reason && (
                                                    <div style={{ marginTop: 12, padding: 12, background: "#fee2e2", borderRadius: 8, fontSize: 14, color: "#991b1b", display: "flex", alignItems: "flex-start", gap: 8 }}>
                                                        <ExclamationTriangleIcon width={18} style={{ flexShrink: 0, marginTop: 2, color: "#b91c1c" }} />
                                                        <div>
                                                            <strong>เหตุผลที่ตีกลับ:</strong> {c.return_reason}
                                                        </div>
                                                    </div>
                                                )}

                                                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: "wrap", gap: 8 }}>
                                                    <a
                                                        href={c.receipt_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={styles.link}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                                                    >
                                                        <PaperClipIcon width={16} />
                                                        <span>ดูไฟล์แนบ</span>
                                                        <ArrowTopRightOnSquareIcon width={13} />
                                                    </a>

                                                    {c.status === "RETURNED" && (
                                                        <button onClick={() => openResubmit(c)} className={styles.btnSecondary} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: "6px 12px", fontSize: 13 }}>
                                                            <PencilSquareIcon width={16} /> แก้ไขและส่งใหม่
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal: Confirm Initial Approval */}
            {approvingClaim && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <CheckCircleIcon width={22} style={{ color: "#16a34a" }} />
                            <span>ยืนยันการอนุมัติเบื้องต้น</span>
                        </div>
                        <div className={styles.modalDesc}>
                            ท่านต้องการอนุมัติเบื้องต้นคำขอเบิกค่าเสื่อม/ค่าน้ำมันของ <strong>{approvingClaim.employee?.name}</strong> จำนวน <strong style={{ color: "#dc2626" }}>฿{Number(approvingClaim.amount).toLocaleString()}.-</strong> ใช่หรือไม่?<br /><br />
                            <span style={{ fontSize: 13, color: "#64748b" }}>
                                * เมื่อท่านอนุมัติแล้ว ระบบจะส่งเรื่องต่อไปยังฝ่ายบุคคล (HR) เพื่อตรวจสอบเอกสารและอนุมัติขั้นสุดท้าย
                            </span>
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={() => setApprovingClaim(null)}
                                disabled={isActionLoading}
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                className={styles.btnApprove}
                                onClick={handleInitialApprove}
                                disabled={isActionLoading}
                                style={{ padding: "8px 18px", fontSize: 14 }}
                            >
                                {isActionLoading ? "กำลังดำเนินการ..." : "ยืนยันอนุมัติเบื้องต้น"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Return for Revision */}
            {returningClaim && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalTitle} style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: 8 }}>
                            <XCircleIcon width={22} style={{ color: "#dc2626" }} />
                            <span>ตีกลับเพื่อแก้ไข</span>
                        </div>
                        <div className={styles.modalDesc}>
                            ระบุเหตุผลที่ต้องการให้ <strong>{returningClaim.supervisor?.name || "หัวหน้างาน"}</strong> แก้ไขคำขอของ {returningClaim.employee?.name}:
                        </div>
                        <textarea
                            className={styles.textarea}
                            placeholder="ระบุสิ่งที่ต้องแก้ไข เช่น ยอดเงินไม่ตรงกับใบเสร็จ, เอกสารไม่ชัดเจน..."
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            autoFocus
                        />
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={() => { setReturningClaim(null); setReturnReason(""); }}
                                disabled={isActionLoading}
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                className={styles.btnReject}
                                onClick={handleReturnForRevision}
                                disabled={isActionLoading}
                                style={{ padding: "8px 18px", fontSize: 14 }}
                            >
                                {isActionLoading ? "กำลังดำเนินการ..." : "ยืนยันตีกลับ"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
