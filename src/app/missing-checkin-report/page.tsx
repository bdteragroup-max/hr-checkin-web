"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "../travel-allowance/page.module.css";
import { format } from "date-fns";
import { HOUR_OPTIONS, MINUTE_OPTIONS } from "@/utils/time";
import AlertModal, { AlertState } from "@/components/AlertModal";
import {
    DocumentTextIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
    UserGroupIcon,
    ShieldCheckIcon,
    CalendarIcon,
    PhotoIcon,
    HashtagIcon,
    PencilSquareIcon,
    TrashIcon,
    PlusIcon,
    ClockIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CheckIcon
} from "@heroicons/react/24/outline";

function CustomSelect({
    value,
    options,
    onChange,
    centerText = false,
    height = 44
}: {
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (val: string) => void;
    centerText?: boolean;
    height?: number;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const selected = options.find(o => o.value === value);

    return (
        <div ref={ref} style={{ position: "relative", width: "100%" }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    width: "100%",
                    height,
                    padding: centerText ? "0 10px" : "0 14px",
                    borderRadius: "var(--radius-sm)",
                    border: open ? "1.5px solid var(--red)" : "1.5px solid var(--gray-300)",
                    background: "#fff",
                    color: "#1e293b",
                    fontWeight: 700,
                    fontSize: 15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 6,
                    cursor: "pointer",
                    boxShadow: open ? "0 0 0 3px rgba(217, 48, 37, 0.1)" : "var(--shadow-sm)",
                    transition: "all 0.18s",
                    boxSizing: "border-box"
                }}
            >
                <span style={{
                    flex: 1,
                    textAlign: centerText ? "center" : "left",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                }}>
                    {selected ? selected.label : value}
                </span>
                <ChevronDownIcon
                    width={15}
                    strokeWidth={2.5}
                    style={{
                        color: "#64748b",
                        flexShrink: 0,
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform 0.18s"
                    }}
                />
            </button>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        right: 0,
                        background: "#fff",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 12,
                        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06)",
                        maxHeight: 210,
                        overflowY: "auto",
                        zIndex: 80,
                        padding: 5
                    }}
                >
                    {options.map(opt => {
                        const isActive = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                                style={{
                                    width: "100%",
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: "none",
                                    background: isActive ? "#fef2f2" : "transparent",
                                    color: isActive ? "var(--red)" : "#1e293b",
                                    fontWeight: isActive ? 800 : 600,
                                    fontSize: 14,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: centerText ? "center" : "space-between",
                                    cursor: "pointer",
                                    textAlign: centerText ? "center" : "left",
                                    transition: "background 0.12s"
                                }}
                            >
                                <span>{opt.label}</span>
                                {!centerText && isActive && <CheckIcon width={14} strokeWidth={3} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ThaiMonthPicker({
    value,
    onChange
}: {
    value: string; // YYYY-MM
    onChange: (val: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const [curY, curM] = (value && value.includes("-"))
        ? value.split("-").map(Number)
        : [new Date().getFullYear(), new Date().getMonth() + 1];

    const [viewYear, setViewYear] = useState<number>(curY || new Date().getFullYear());

    useEffect(() => {
        if (curY) setViewYear(curY);
    }, [curY]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    return (
        <div ref={ref} style={{ position: "relative", width: "100%" }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    width: "100%",
                    height: 48,
                    padding: "0 14px",
                    borderRadius: "var(--radius-sm)",
                    border: open ? "1.5px solid var(--red)" : "1.5px solid var(--gray-300)",
                    background: "#fff",
                    color: "#1e293b",
                    fontWeight: 800,
                    fontSize: 15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    cursor: "pointer",
                    boxShadow: open ? "0 0 0 3px rgba(217, 48, 37, 0.1)" : "var(--shadow-sm)",
                    transition: "all 0.18s",
                    boxSizing: "border-box"
                }}
            >
                <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <CalendarIcon width={17} style={{ color: "var(--red)", flexShrink: 0 }} />
                    <span>{formatPeriodMonthThai(value)}</span>
                </span>
                <ChevronDownIcon
                    width={16}
                    strokeWidth={2.5}
                    style={{
                        color: "#64748b",
                        flexShrink: 0,
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform 0.18s"
                    }}
                />
            </button>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        width: "min(300px, 88vw)",
                        background: "#fff",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 16,
                        boxShadow: "0 16px 36px rgba(15, 23, 42, 0.16), 0 4px 10px rgba(15, 23, 42, 0.06)",
                        padding: 14,
                        zIndex: 90
                    }}
                >
                    {/* Year switcher header */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 12,
                            paddingBottom: 10,
                            borderBottom: "1px solid #f1f5f9"
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setViewYear(y => y - 1)}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                border: "1px solid #e2e8f0",
                                background: "#f8fafc",
                                color: "#334155",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer"
                            }}
                            title="ปีก่อนหน้า"
                        >
                            <ChevronLeftIcon width={15} strokeWidth={2.5} />
                        </button>
                        <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                            พ.ศ. {viewYear + 543}
                        </span>
                        <button
                            type="button"
                            onClick={() => setViewYear(y => y + 1)}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                border: "1px solid #e2e8f0",
                                background: "#f8fafc",
                                color: "#334155",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer"
                            }}
                            title="ปีถัดไป"
                        >
                            <ChevronRightIcon width={15} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* 12 Months 3x4 Grid */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 6
                        }}
                    >
                        {THAI_MONTHS.map((mName, idx) => {
                            const mNum = idx + 1;
                            const candidateVal = `${viewYear}-${String(mNum).padStart(2, "0")}`;
                            const isSelected = candidateVal === value;
                            return (
                                <button
                                    key={mNum}
                                    type="button"
                                    onClick={() => {
                                        onChange(candidateVal);
                                        setOpen(false);
                                    }}
                                    style={{
                                        padding: "9px 6px",
                                        borderRadius: 9,
                                        border: isSelected ? "1.5px solid var(--red)" : "1px solid #f1f5f9",
                                        background: isSelected ? "linear-gradient(135deg, var(--red), var(--red-dark))" : "#f8fafc",
                                        color: isSelected ? "#fff" : "#334155",
                                        fontWeight: isSelected ? 800 : 600,
                                        fontSize: 12.5,
                                        cursor: "pointer",
                                        textAlign: "center",
                                        transition: "all 0.15s",
                                        boxShadow: isSelected ? "0 3px 10px rgba(217, 48, 37, 0.25)" : "none"
                                    }}
                                >
                                    {mName}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

interface DayItemDraft {
    workDate: string; // YYYY-MM-DD
    inHour: string;
    inMin: string;
    outHour: string;
    outMin: string;
    workDetails: string;
}

const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

function formatPeriodMonthThai(periodMonth: string): string {
    if (!periodMonth || !periodMonth.includes("-")) return periodMonth || "-";
    const [y, m] = periodMonth.split("-").map(Number);
    if (!y || !m) return periodMonth;
    return `${THAI_MONTHS[m - 1] || m} ${y + 543}`;
}

function getPeriodDateRangeLabel(periodMonth: string): string {
    if (!periodMonth || !periodMonth.includes("-")) return "";
    const [y, m] = periodMonth.split("-").map(Number);
    if (!y || !m) return "";
    let prevM = m - 1;
    let prevY = y;
    if (prevM <= 0) {
        prevM = 12;
        prevY -= 1;
    }
    return `รอบวันที่ 26/${String(prevM).padStart(2, "0")}/${prevY + 543} – 25/${String(m).padStart(2, "0")}/${y + 543}`;
}

function formatDateDMY(dateStr: string): string {
    if (!dateStr) return "เลือกวัน/เดือน/ปี";
    const clean = String(dateStr).slice(0, 10);
    const parts = clean.split("-");
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const yearNum = parseInt(y, 10);
    if (isNaN(yearNum)) return dateStr;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${yearNum + 543}`;
}

function generateThaiMonthOptions(): Array<{ value: string; label: string }> {
    const now = new Date();
    const curY = now.getFullYear();
    const years = [curY - 1, curY, curY + 1];
    const options: Array<{ value: string; label: string }> = [];
    for (const y of years) {
        for (let m = 1; m <= 12; m++) {
            const val = `${y}-${String(m).padStart(2, "0")}`;
            const label = `${THAI_MONTHS[m - 1]} ${y + 543}`;
            options.push({ value: val, label });
        }
    }
    return options;
}

const THAI_MONTH_OPTIONS = generateThaiMonthOptions();

function createEmptyDayItem(): DayItemDraft {
    return {
        workDate: format(new Date(), "yyyy-MM-dd"),
        inHour: "08",
        inMin: "00",
        outHour: "17",
        outMin: "00",
        workDetails: ""
    };
}

export default function MissingCheckinReportPage() {
    const queryClient = useQueryClient();

    const defaultDocPrefix = `MCR-${format(new Date(), "yyyyMM")}-0001`;
    const defaultMonthStr = format(new Date(), "yyyy-MM");

    const { data, isLoading: loading } = useQuery({
        queryKey: ["missing-checkin-reports"],
        queryFn: async () => {
            const r = await fetch("/api/missing-checkin-reports");
            const res = await r.json();
            if (res.ok) return res;
            return { list: [], next_doc_no: defaultDocPrefix, default_period_month: defaultMonthStr, employee: null };
        }
    });

    const history = data?.list || [];
    const nextDocNo = data?.next_doc_no || defaultDocPrefix;
    const apiDefaultPeriodMonth = data?.default_period_month || defaultMonthStr;
    const employeeInfo = data?.employee || null;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [msg, setMsg] = useState({ text: "", type: "" });

    // Edit & Delete states
    const [editingReport, setEditingReport] = useState<any | null>(null);
    const [existingEvidenceUrls, setExistingEvidenceUrls] = useState<string>("");
    const [alert, setAlert] = useState<AlertState>({ visible: false, message: "", type: "ok" });
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    // Form states (1 submission per month containing multiple day items)
    const [periodMonth, setPeriodMonth] = useState<string>(defaultMonthStr);
    const [dayItems, setDayItems] = useState<DayItemDraft[]>([createEmptyDayItem()]);
    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

    useEffect(() => {
        if (apiDefaultPeriodMonth && !editingReport) {
            setPeriodMonth(apiDefaultPeriodMonth);
        }
    }, [apiDefaultPeriodMonth, editingReport]);

    // Check if employee already submitted a non-rejected report for the selected month
    const existingReportForMonth = history.find(
        (h: any) => h.period_month === periodMonth && h.status !== "rejected"
    );

    function addDayItem() {
        setDayItems(prev => [...prev, createEmptyDayItem()]);
    }

    function removeDayItem(index: number) {
        if (dayItems.length <= 1) return;
        setDayItems(prev => prev.filter((_, idx) => idx !== index));
    }

    function updateDayItem(index: number, patch: Partial<DayItemDraft>) {
        setDayItems(prev => prev.map((it, idx) => (idx === index ? { ...it, ...patch } : it)));
    }

    function startEdit(item: any) {
        setEditingReport(item);
        setPeriodMonth(item.period_month || apiDefaultPeriodMonth);

        const rawItems = Array.isArray(item.items) && item.items.length > 0
            ? item.items
            : [{
                work_date: item.work_date,
                check_in_time: item.check_in_time,
                check_out_time: item.check_out_time,
                work_details: item.work_details
            }];

        const parsedDrafts: DayItemDraft[] = rawItems.map((it: any) => {
            const [ih = "08", im = "00"] = String(it.check_in_time || "08:00").split(":");
            const [oh = "17", om = "00"] = String(it.check_out_time || "17:00").split(":");
            const wd = it.work_date ? format(new Date(it.work_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
            return {
                workDate: wd,
                inHour: ih.padStart(2, "0"),
                inMin: im.padStart(2, "0"),
                outHour: oh.padStart(2, "0"),
                outMin: om.padStart(2, "0"),
                workDetails: it.work_details || ""
            };
        });

        setDayItems(parsedDrafts);
        setExistingEvidenceUrls(item.evidence_urls || "");
        setEvidenceFiles([]);
        setMsg({ text: "", type: "" });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function cancelEdit() {
        setEditingReport(null);
        setPeriodMonth(apiDefaultPeriodMonth);
        setDayItems([createEmptyDayItem()]);
        setExistingEvidenceUrls("");
        setEvidenceFiles([]);
    }

    function confirmDelete(id: string, docNo: string) {
        setPendingDeleteId(id);
        setAlert({
            visible: true,
            message: `ยืนยันการลบเอกสารเลขที่ ${docNo} ใช่หรือไม่?`,
            type: "ok"
        });
    }

    async function executeDelete() {
        if (!pendingDeleteId) return;
        const id = pendingDeleteId;
        setPendingDeleteId(null);
        setAlert(p => ({ ...p, visible: false }));

        try {
            const r = await fetch(`/api/missing-checkin-reports?id=${encodeURIComponent(id)}`, {
                method: "DELETE"
            });
            const resData = await r.json();
            if (resData.ok) {
                if (editingReport?.id === id) cancelEdit();
                setMsg({ text: "ลบเอกสารเรียบร้อยแล้ว", type: "ok" });
                queryClient.invalidateQueries({ queryKey: ["missing-checkin-reports"] });
            } else {
                setMsg({ text: resData.error || "ลบไม่สำเร็จ", type: "bad" });
            }
        } catch (e: any) {
            setMsg({ text: e.message, type: "bad" });
        }
    }

    async function compressImage(file: File): Promise<File> {
        if (!file.type.startsWith("image/")) return file;
        // Always compress images > 350KB to ensure fast upload and avoid Vercel 413 payload limits
        if (file.size < 350 * 1024) return file;

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let { width, height } = img;
                    const MAX = 1400;

                    if (width > height) {
                        if (width > MAX) { height = Math.round(height * (MAX / width)); width = MAX; }
                    } else {
                        if (height > MAX) { width = Math.round(width * (MAX / height)); height = MAX; }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
                        } else resolve(file);
                    }, "image/jpeg", 0.75);
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    }

    async function uploadFile(rawFile: File, prefix: string) {
        const file = await compressImage(rawFile);

        // 1. If file is > 3MB (or as primary for large files), use Signed Upload URL directly to Supabase Storage to avoid Vercel 413 limit
        if (file.size > 2.5 * 1024 * 1024) {
            const signRes = await fetch("/api/upload", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileType: file.type, prefix })
            });
            if (signRes.ok) {
                const signData = await signRes.json();
                if (signData.ok && signData.signedUrl) {
                    const putRes = await fetch(signData.signedUrl, {
                        method: "PUT",
                        headers: { "Content-Type": file.type },
                        body: file
                    });
                    if (putRes.ok) {
                        return signData.publicUrl;
                    }
                }
            }
        }

        // 2. Standard multipart upload (with automatic fallback to Signed URL if 413 occurs)
        const formData = new FormData();
        const parts = file.name.split(".");
        let ext = parts.length > 1 ? parts.pop() || "tmp" : "tmp";
        ext = ext.replace(/[^a-zA-Z0-9]/g, "");
        if (!ext) ext = "tmp";

        const safeName = `upload-${Date.now()}.${ext}`;
        formData.append("file", file, safeName);
        formData.append("prefix", prefix);

        const r = await fetch("/api/upload", { method: "POST", body: formData });
        if (r.status === 413) {
            // Fallback to direct signed upload URL when Vercel rejects body size (413)
            const signRes = await fetch("/api/upload", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileType: file.type, prefix })
            });
            const signData = await signRes.json().catch(() => ({}));
            if (signRes.ok && signData.ok && signData.signedUrl) {
                const putRes = await fetch(signData.signedUrl, {
                    method: "PUT",
                    headers: { "Content-Type": file.type },
                    body: file
                });
                if (putRes.ok) {
                    return signData.publicUrl;
                }
            }
            throw new Error("ไฟล์มีขนาดใหญ่เกินกำหนด กรุณาใช้ไฟล์รูปภาพหรือย่อขนาดไฟล์ PDF ให้ไม่เกิน 15MB");
        }
        if (!r.ok) {
            throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ (${r.status})`);
        }

        const res = await r.json();
        if (!res.ok) throw new Error(res.error || "Upload failed");
        return res.url;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg({ text: "", type: "" });

        if (!periodMonth) {
            return setMsg({ text: "กรุณาเลือกรอบเดือนที่ต้องการแจ้งรายงาน", type: "bad" });
        }

        if (!editingReport && existingReportForMonth) {
            return setMsg({
                text: `คุณได้ส่งเอกสารของรอบเดือน ${formatPeriodMonthThai(periodMonth)} ไปแล้ว (${existingReportForMonth.doc_no}) — 1 คนแจ้งรวมรายการได้ 1 ครั้งต่อเดือน กรุณากดปุ่ม "แก้ไข" ที่เอกสารเดิมด้านล่างหากต้องการเพิ่มรายการ`,
                type: "bad"
            });
        }

        for (let i = 0; i < dayItems.length; i++) {
            const it = dayItems[i];
            if (!it.workDate) {
                return setMsg({ text: `กรุณาระบุวันที่ไม่ได้ลงเวลาทำงาน (รายการที่ ${i + 1})`, type: "bad" });
            }
            if (!it.workDetails.trim()) {
                return setMsg({ text: `กรุณาระบุรายละเอียดงานที่ทำ (รายการที่ ${i + 1})`, type: "bad" });
            }
        }

        if (!editingReport && evidenceFiles.length === 0) {
            return setMsg({ text: "กรุณาแนบหลักฐานการทำงาน เช่น รูปภาพงาน หรือ Google Timeline ที่เห็นชื่อบัญชี", type: "bad" });
        }
        if (editingReport && evidenceFiles.length === 0 && !existingEvidenceUrls) {
            return setMsg({ text: "กรุณาแนบหลักฐานการทำงาน", type: "bad" });
        }

        const formattedItems = dayItems.map(it => ({
            work_date: it.workDate,
            check_in_time: `${it.inHour}:${it.inMin}`,
            check_out_time: `${it.outHour}:${it.outMin}`,
            work_details: it.workDetails.trim()
        }));

        setIsSubmitting(true);
        try {
            const uploadedUrls: string[] = [];
            for (const file of evidenceFiles) {
                const url = await uploadFile(file, "missing-checkin");
                uploadedUrls.push(url);
            }

            const finalEvidenceUrls = uploadedUrls.length > 0 ? uploadedUrls.join(",") : existingEvidenceUrls;

            if (editingReport) {
                const r = await fetch("/api/missing-checkin-reports", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: editingReport.id,
                        period_month: periodMonth,
                        items: formattedItems,
                        evidence_urls: finalEvidenceUrls
                    })
                });
                const resData = await r.json();
                if (resData.ok) {
                    setMsg({
                        text: `แก้ไขเอกสารเลขที่ ${editingReport.doc_no} (รวม ${formattedItems.length} รายการ) เรียบร้อยแล้ว`,
                        type: "ok"
                    });
                    cancelEdit();
                    queryClient.invalidateQueries({ queryKey: ["missing-checkin-reports"] });
                } else {
                    setMsg({ text: resData.error || "เกิดข้อผิดพลาดในการแก้ไข", type: "bad" });
                }
            } else {
                const r = await fetch("/api/missing-checkin-reports", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        period_month: periodMonth,
                        items: formattedItems,
                        evidence_urls: finalEvidenceUrls
                    })
                });

                const resData = await r.json();
                if (resData.ok) {
                    setMsg({
                        text: `สร้างเอกสารเลขที่ ${resData.data?.doc_no || ""} (รวม ${formattedItems.length} รายการ) และส่งต่อให้หัวหน้างานตรวจสอบเรียบร้อยแล้ว`,
                        type: "ok"
                    });
                    setDayItems([createEmptyDayItem()]);
                    setEvidenceFiles([]);
                    queryClient.invalidateQueries({ queryKey: ["missing-checkin-reports"] });
                } else {
                    setMsg({ text: resData.error || "เกิดข้อผิดพลาด", type: "bad" });
                }
            }
        } catch (error: any) {
            setMsg({ text: error.message, type: "bad" });
        } finally {
            setIsSubmitting(false);
        }
    }

    // Ensure current periodMonth is in options
    const monthSelectOptions = THAI_MONTH_OPTIONS.some(o => o.value === periodMonth)
        ? THAI_MONTH_OPTIONS
        : [{ value: periodMonth, label: formatPeriodMonthThai(periodMonth) }, ...THAI_MONTH_OPTIONS];

    if (loading) return <div className={styles.loading}>กำลังโหลดข้อมูล...</div>;

    return (
        <div className={styles.page}>
            <AlertModal
                alert={alert}
                onClose={() => {
                    setAlert(p => ({ ...p, visible: false }));
                    setPendingDeleteId(null);
                }}
                onConfirm={pendingDeleteId ? executeDelete : undefined}
                confirmText={pendingDeleteId ? "ยืนยันลบ" : "ตกลง"}
            />

            <div className={styles.wrap}>
                {/* ── HERO ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>รายงานการทำงาน (Human Soft)</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            แจ้งสรุปรวมรายการวันที่ลงเวลาไม่ครบในรอบเดือน (ทุกวันที่ 25 — 1 คน แจ้งรวม 1 ครั้งต่อเดือน)
                        </div>
                    </div>
                </div>

                {/* ── MONTHLY POLICY BANNER ── */}
                <div style={{
                    background: "#eff6ff",
                    border: "1.5px solid #bfdbfe",
                    borderRadius: "var(--radius-sm)",
                    padding: "12px 16px",
                    marginBottom: 16,
                    fontSize: 13,
                    color: "#1e3a8a",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    lineHeight: 1.5
                }}>
                    <CalendarIcon width={20} style={{ color: "#2563eb", flexShrink: 0, marginTop: 1 }} />
                    <div>
                        <b>เงื่อนไขการส่งเอกสาร (รอบสรุปทุกวันที่ 25 ของเดือน):</b> พนักงาน 1 คน ส่งเอกสารสรุปรวม <b>1 ครั้งต่อเดือน</b> โดยสามารถกดปุ่ม <b>&ldquo;+ เพิ่มวันที่ไม่ได้ลงเวลา&rdquo;</b> เพื่อรวมทุกวันที่ลงเวลาไม่ครบในเดือนนั้นไว้ในเอกสารใบเดียวได้ทันที
                    </div>
                </div>

                {msg.text && (
                    <div className={msg.type === "ok" ? styles.msgOk : styles.msgBad} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {msg.type === "ok" ? <CheckCircleIcon width={20} /> : <ExclamationTriangleIcon width={20} />}
                        {msg.text}
                    </div>
                )}

                <form className={styles.card} onSubmit={handleSubmit}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                        <div className={styles.cardTitle} style={{ margin: 0 }}>
                            {editingReport ? `แก้ไขเอกสารรายงานการทำงาน (${editingReport.doc_no})` : "สร้างเอกสารรายงานการทำงานประจำเดือน"}
                        </div>
                        {editingReport && (
                            <button
                                type="button"
                                onClick={cancelEdit}
                                style={{
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    border: "1px solid #cbd5e1",
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer"
                                }}
                            >
                                ยกเลิกการแก้ไข
                            </button>
                        )}
                    </div>

                    <div className={styles.form}>
                        {/* 1. เลขที่รายการ & ประจำรอบเดือน — จัดสมมาตรและรองรับจอมือถือแคบโดยไม่ล้น */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 16,
                            alignItems: "start"
                        }}>
                            {/* ฝั่งซ้าย: เลขที่รายการ */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                                <label
                                    className={styles.label}
                                    style={{ margin: 0, minHeight: 20, display: "flex", alignItems: "center" }}
                                >
                                    เลขที่รายการ (DOCUMENT NO.)
                                </label>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                        padding: "0 14px",
                                        borderRadius: "var(--radius-sm)",
                                        border: "1.5px solid var(--gray-200)",
                                        background: "#f1f5f9",
                                        color: "#1e293b",
                                        fontWeight: 800,
                                        fontSize: 15,
                                        userSelect: "none",
                                        pointerEvents: "none",
                                        height: 48,
                                        boxSizing: "border-box"
                                    }}
                                    aria-readonly="true"
                                >
                                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {editingReport ? editingReport.doc_no : nextDocNo}
                                    </span>
                                    <span style={{
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        background: "#e2e8f0",
                                        color: "#475569",
                                        padding: "3px 7px",
                                        borderRadius: 6,
                                        flexShrink: 0
                                    }}>
                                        AUTO
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text3)", minHeight: 18 }}>
                                    {employeeInfo?.supervisor ? (
                                        <>ผู้ตรวจสอบ (หัวหน้างาน): <b>{employeeInfo.supervisor.name}{employeeInfo.supervisor.nickname ? ` (${employeeInfo.supervisor.nickname})` : ""}</b></>
                                    ) : (
                                        <span>ระบบสร้างเลขที่เอกสารอัตโนมัติ</span>
                                    )}
                                </div>
                            </div>

                            {/* ฝั่งขวา: ประจำรอบเดือน (ภาษาไทย - Custom Popover Grid) */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                                <label
                                    className={styles.label}
                                    style={{ margin: 0, minHeight: 20, display: "flex", alignItems: "center" }}
                                >
                                    ประจำรอบเดือน (ตัดรอบทุกวันที่ 25)
                                </label>
                                <ThaiMonthPicker
                                    value={periodMonth}
                                    onChange={val => setPeriodMonth(val)}
                                />
                                <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 600, minHeight: 18 }}>
                                    {getPeriodDateRangeLabel(periodMonth)}
                                </div>
                            </div>
                        </div>

                        {/* Warning if already submitted for this month */}
                        {!editingReport && existingReportForMonth && (
                            <div style={{
                                background: "#fffbeb",
                                border: "1.5px solid #fcd34d",
                                borderRadius: 10,
                                padding: "12px 16px",
                                color: "#92400e",
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: 10
                            }}>
                                <div>
                                    <b>คุณได้ส่งเอกสารของเดือน {formatPeriodMonthThai(periodMonth)} ไปแล้ว ({existingReportForMonth.doc_no})</b>
                                    <div style={{ fontSize: 12, marginTop: 2 }}>
                                        กำหนดให้ 1 คนแจ้ง 1 ครั้งต่อเดือน หากต้องการเพิ่มหรือแก้ไขวันที่ในรอบเดือนนี้ สามารถแก้ไขที่เอกสารเดิมได้
                                    </div>
                                </div>
                                {existingReportForMonth.status === "pending_supervisor" && (
                                    <button
                                        type="button"
                                        onClick={() => startEdit(existingReportForMonth)}
                                        style={{
                                            background: "#d97706",
                                            color: "#fff",
                                            border: "none",
                                            padding: "7px 14px",
                                            borderRadius: 8,
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6
                                        }}
                                    >
                                        <PencilSquareIcon width={15} /> แก้ไขเอกสารเดิม ({existingReportForMonth.doc_no})
                                    </button>
                                )}
                            </div>
                        )}

                        {/* 2. รายการวันที่ไม่ได้ลงเวลาทำงานในเดือนนั้น (Multiple rows) */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                <label className={styles.label} style={{ margin: 0 }}>
                                    รายการวันที่ไม่ได้ลงเวลาทำงานในรอบเดือน {formatPeriodMonthThai(periodMonth)} ({dayItems.length} วัน)
                                </label>
                                <button
                                    type="button"
                                    onClick={addDayItem}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        background: "#eff6ff",
                                        color: "#1d4ed8",
                                        border: "1.5px solid #bfdbfe",
                                        padding: "7px 13px",
                                        borderRadius: 8,
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        cursor: "pointer"
                                    }}
                                >
                                    <PlusIcon width={15} strokeWidth={2.5} /> เพิ่มวันที่ไม่ได้ลงเวลา
                                </button>
                            </div>

                            {dayItems.map((item, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        background: "var(--gray-50)",
                                        border: "1.5px solid var(--gray-200)",
                                        borderRadius: "var(--radius-sm)",
                                        padding: "18px 20px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 16
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{
                                            fontSize: 12.5,
                                            fontWeight: 800,
                                            color: "var(--red)",
                                            background: "#fef2f2",
                                            border: "1px solid #fecaca",
                                            padding: "3px 10px",
                                            borderRadius: 6
                                        }}>
                                            รายการที่ {idx + 1}
                                        </span>
                                        {dayItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeDayItem(idx)}
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                    background: "#fff",
                                                    color: "#dc2626",
                                                    border: "1px solid #fecaca",
                                                    padding: "4px 10px",
                                                    borderRadius: 6,
                                                    fontSize: 11.5,
                                                    fontWeight: 700,
                                                    cursor: "pointer"
                                                }}
                                            >
                                                <TrashIcon width={13} /> ลบวันนี้
                                            </button>
                                        )}
                                    </div>

                                    {/* วันที่ไม่ได้ลงเวลา — แสดงรูปแบบ วัน/เดือน/ปี (DD/MM/YYYY พ.ศ.) */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label className={styles.label} style={{ margin: 0 }}>
                                            วันที่ไม่ได้ลงเวลาทำงานใน HUMAN SOFT (วัน/เดือน/ปี)
                                        </label>
                                        <div
                                            style={{
                                                position: "relative",
                                                height: 48,
                                                borderRadius: "var(--radius-sm)",
                                                border: "1.5px solid var(--gray-200)",
                                                background: "#fff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "0 16px",
                                                boxSizing: "border-box"
                                            }}
                                        >
                                            <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>
                                                {formatDateDMY(item.workDate)}
                                            </span>
                                            <CalendarIcon width={19} style={{ color: "#64748b", pointerEvents: "none" }} />
                                            <input
                                                type="date"
                                                value={item.workDate}
                                                onChange={e => updateDayItem(idx, { workDate: e.target.value })}
                                                onClick={e => {
                                                    try {
                                                        (e.currentTarget as any).showPicker?.();
                                                    } catch {
                                                        // fallback for browsers without showPicker
                                                    }
                                                }}
                                                required
                                                style={{
                                                    position: "absolute",
                                                    inset: 0,
                                                    width: "100%",
                                                    height: "100%",
                                                    opacity: 0,
                                                    cursor: "pointer"
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* เวลาเข้า-ออกงาน (สมมาตร 24 ชม. — Custom Dropdown) */}
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 20,
                                        alignItems: "start"
                                    }}>
                                        {/* เวลาเข้างาน */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            <label className={styles.label} style={{ margin: 0, whiteSpace: "nowrap" }}>
                                                เวลาเข้างาน (CHECK-IN)
                                            </label>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <CustomSelect
                                                        value={item.inHour}
                                                        options={HOUR_OPTIONS.map(h => ({ value: h, label: h }))}
                                                        onChange={val => updateDayItem(idx, { inHour: val })}
                                                        centerText
                                                        height={44}
                                                    />
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text4)", textAlign: "center" }}>ชั่วโมง</span>
                                                </div>
                                                <span style={{ fontWeight: 800, fontSize: 18, color: "var(--gray-400)", marginTop: -18 }}>:</span>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <CustomSelect
                                                        value={item.inMin}
                                                        options={MINUTE_OPTIONS.map(m => ({ value: m, label: m }))}
                                                        onChange={val => updateDayItem(idx, { inMin: val })}
                                                        centerText
                                                        height={44}
                                                    />
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text4)", textAlign: "center" }}>นาที</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* เวลาออกงาน */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            <label className={styles.label} style={{ margin: 0, whiteSpace: "nowrap" }}>
                                                เวลาออกงาน (CHECK-OUT)
                                            </label>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <CustomSelect
                                                        value={item.outHour}
                                                        options={HOUR_OPTIONS.map(h => ({ value: h, label: h }))}
                                                        onChange={val => updateDayItem(idx, { outHour: val })}
                                                        centerText
                                                        height={44}
                                                    />
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text4)", textAlign: "center" }}>ชั่วโมง</span>
                                                </div>
                                                <span style={{ fontWeight: 800, fontSize: 18, color: "var(--gray-400)", marginTop: -18 }}>:</span>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <CustomSelect
                                                        value={item.outMin}
                                                        options={MINUTE_OPTIONS.map(m => ({ value: m, label: m }))}
                                                        onChange={val => updateDayItem(idx, { outMin: val })}
                                                        centerText
                                                        height={44}
                                                    />
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text4)", textAlign: "center" }}>นาที</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* รายละเอียดงานในวันนั้น */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label className={styles.label} style={{ margin: 0 }}>
                                            รายละเอียดเวลาเข้า-ออกงาน และงานที่ทำในวันนั้น
                                        </label>
                                        <textarea
                                            className={styles.input}
                                            rows={3}
                                            placeholder="ระบุสาเหตุที่ลงเวลาไม่ครบ รายละเอียดเวลาเข้า-ออกงาน และรายละเอียดงานที่ปฏิบัติในวันนั้น..."
                                            value={item.workDetails}
                                            onChange={e => updateDayItem(idx, { workDetails: e.target.value })}
                                            required
                                            style={{ resize: "vertical", background: "#fff" }}
                                        />
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={addDayItem}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    background: "#f8fafc",
                                    color: "#1d4ed8",
                                    border: "1.5px dashed #93c5fd",
                                    padding: "11px 14px",
                                    borderRadius: 10,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: "pointer"
                                }}
                            >
                                <PlusIcon width={16} strokeWidth={2.5} /> เพิ่มวันที่ไม่ได้ลงเวลาในรอบเดือนนี้อีก
                            </button>
                        </div>

                        {/* 4. แนบหลักฐานการทำงาน */}
                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                แนบหลักฐานการทำงานทั้งหมดของรอบเดือนนี้ (เช่น รูปภาพงาน หรือ Google Timeline ที่เห็นชื่อบัญชี) *
                            </label>
                            {editingReport && existingEvidenceUrls && evidenceFiles.length === 0 && (
                                <div style={{ fontSize: 12, color: "var(--ok)", marginBottom: 6, fontWeight: 600 }}>
                                    ✓ มีไฟล์หลักฐานเดิมแนบอยู่แล้ว ({existingEvidenceUrls.split(",").length} ไฟล์) — เลือกไฟล์ใหม่ด้านล่างหากต้องการเปลี่ยนไฟล์
                                </div>
                            )}
                            <div className={styles.fileInputWrapper}>
                                <input
                                    type="file"
                                    className={styles.fileInput}
                                    accept="image/*,.pdf"
                                    multiple
                                    onChange={e => setEvidenceFiles(Array.from(e.target.files || []))}
                                />
                                <div className={styles.uploadIcon}><PhotoIcon width={28} /></div>
                                <div className={`${styles.fileHint} ${evidenceFiles.length > 0 ? styles.fileHintSuccess : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                    {evidenceFiles.length > 0 ? (
                                        <>
                                            <CheckCircleIcon width={18} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {evidenceFiles.length === 1 ? evidenceFiles[0].name : `${evidenceFiles.length} ไฟล์: ${evidenceFiles.map(f => f.name).join(", ")}`}
                                            </span>
                                        </>
                                    ) : "คลิกเพื่อเลือกรูปภาพงาน หรือภาพแคปหน้าจอ Google Timeline ที่เห็นชื่อบัญชีชัดเจน (แนบได้หลายไฟล์)"}
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={styles.btnPrimary}
                            style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                            disabled={isSubmitting || (!editingReport && Boolean(existingReportForMonth))}
                        >
                            {isSubmitting ? (
                                <><ArrowPathIcon width={18} className="animate-spin" /> กำลังบันทึกข้อมูล...</>
                            ) : editingReport ? (
                                `บันทึกการแก้ไขเอกสาร (รวม ${dayItems.length} วัน)`
                            ) : (
                                `ส่งเอกสารรวมประจำเดือนให้หัวหน้างานอนุมัติ (${dayItems.length} วัน)`
                            )}
                        </button>
                    </div>
                </form>

                {/* ── HISTORY ── */}
                <div className={styles.historySection}>
                    <h2 className={styles.cardTitle} style={{ margin: "32px 0 16px", paddingLeft: 4 }}>ประวัติเอกสารรายงานการทำงานประจำเดือน</h2>

                    {history.length === 0 ? (
                        <div className={styles.empty}>ยังไม่มีประวัติการสร้างเอกสาร</div>
                    ) : (
                        <div className={styles.historyList}>
                            {history.map((h: any) => {
                                const items: Array<{ work_date: string; check_in_time: string; check_out_time: string; work_details: string }> =
                                    Array.isArray(h.items) && h.items.length > 0
                                        ? h.items
                                        : [{
                                            work_date: h.work_date,
                                            check_in_time: h.check_in_time,
                                            check_out_time: h.check_out_time,
                                            work_details: h.work_details
                                        }];

                                return (
                                    <div key={h.id} className={styles.historyCard} style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--red)" }}>
                                                        <HashtagIcon width={13} style={{ display: "inline", verticalAlign: "text-bottom" }} />
                                                        {h.doc_no}
                                                    </span>
                                                    {h.period_month && (
                                                        <span style={{
                                                            fontSize: 11.5,
                                                            fontWeight: 700,
                                                            background: "#eff6ff",
                                                            color: "#1d4ed8",
                                                            border: "1px solid #bfdbfe",
                                                            padding: "2px 8px",
                                                            borderRadius: 6
                                                        }}>
                                                            รอบเดือน {formatPeriodMonthThai(h.period_month)} ({items.length} วัน)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div
                                                className={`${styles.statusBadge} ${
                                                    h.status === "pending_supervisor" ? styles.status_pending_supervisor :
                                                    h.status === "pending_hr" ? styles.status_pending_admin :
                                                    h.status === "approved" ? styles.status_approved :
                                                    styles.status_rejected
                                                }`}
                                                style={{ display: "flex", alignItems: "center", gap: 4 }}
                                            >
                                                {h.status === "pending_supervisor" ? <><UserGroupIcon width={14} /> รอหัวหน้างานอนุมัติ</> :
                                                 h.status === "pending_hr" ? <><ShieldCheckIcon width={14} /> หัวหน้าอนุมัติแล้ว (ส่งต่อ HR)</> :
                                                 h.status === "approved" ? <><CheckCircleIcon width={14} /> HR อนุมัติแล้ว</> :
                                                 <><XCircleIcon width={14} /> ไม่อนุมัติ</>}
                                            </div>
                                        </div>

                                        {/* Table/List of all days in this monthly report */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {items.map((it, iIdx) => (
                                                <div
                                                    key={iIdx}
                                                    style={{
                                                        background: "#f8fafc",
                                                        padding: "10px 12px",
                                                        borderRadius: 8,
                                                        border: "1px solid #e2e8f0",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 4
                                                    }}
                                                >
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                                                            <CalendarIcon width={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4, color: "var(--red)" }} />
                                                            วันที่ {formatDateDMY(it.work_date)}
                                                        </span>
                                                        <span style={{
                                                            fontSize: 11.5,
                                                            fontWeight: 700,
                                                            color: "#1d4ed8",
                                                            background: "#eff6ff",
                                                            padding: "2px 8px",
                                                            borderRadius: 5
                                                        }}>
                                                            <ClockIcon width={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />
                                                            {it.check_in_time} - {it.check_out_time} น.
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 13, color: "var(--text2)", whiteSpace: "pre-wrap" }}>
                                                        {it.work_details}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {(h.supervisor_remark || h.hr_remark) && (
                                            <div style={{ fontSize: 12, color: "#b45309", background: "#fffbeb", padding: "8px 12px", borderRadius: 8 }}>
                                                {h.supervisor_remark && <div><b>หมายเหตุหัวหน้างาน:</b> {h.supervisor_remark}</div>}
                                                {h.hr_remark && <div><b>หมายเหตุ HR:</b> {h.hr_remark}</div>}
                                            </div>
                                        )}

                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                {h.evidence_urls && h.evidence_urls.split(",").map((url: string, idx: number) => (
                                                    <a
                                                        key={idx}
                                                        href={url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ fontSize: 12, color: "#2563eb", background: "#eff6ff", padding: "5px 10px", borderRadius: 6, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4 }}
                                                    >
                                                        <DocumentTextIcon width={14} /> หลักฐานแนบ {idx + 1}
                                                    </a>
                                                ))}
                                            </div>

                                            {h.status === "pending_supervisor" && (
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(h)}
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: 4,
                                                            padding: "5px 12px",
                                                            borderRadius: 6,
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            background: "#f8fafc",
                                                            color: "#334155",
                                                            border: "1px solid #cbd5e1",
                                                            cursor: "pointer"
                                                        }}
                                                    >
                                                        <PencilSquareIcon width={14} /> แก้ไข / เพิ่มวัน
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => confirmDelete(h.id, h.doc_no)}
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: 4,
                                                            padding: "5px 12px",
                                                            borderRadius: 6,
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            background: "#fef2f2",
                                                            color: "#dc2626",
                                                            border: "1px solid #fecaca",
                                                            cursor: "pointer"
                                                        }}
                                                    >
                                                        <TrashIcon width={14} /> ลบ
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
