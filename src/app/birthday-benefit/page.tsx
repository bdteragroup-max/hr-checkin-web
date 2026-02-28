"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import Image from "next/image";

type Claim = {
    id: string;
    amount_cash: number;
    amount_meal: number;
    status: string;
    receipt_url: string;
    created_at: string;
};

type Holiday = {
    date: string;
    name: string;
};

export default function BirthdayPage() {
    const [me, setMe] = useState<any>(null);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(true);

    const [mealAmount, setMealAmount] = useState("");
    const [transferSlipFile, setTransferSlipFile] = useState<File | null>(null);
    const [celebrationPhotoFile, setCelebrationPhotoFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState<{ text: string, type: 'ok' | 'bad' } | null>(null);

    async function load() {
        try {
            const [meRes, hRes, cRes] = await Promise.all([
                fetch("/api/me").then(r => r.json()),
                fetch("/api/holidays").then(r => r.json()),
                fetch("/api/birthday-claims").then(r => r.json())
            ]);
            setMe(meRes);
            setHolidays(hRes.list || []);
            setClaims(cRes.claims || []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    if (loading) return <div className={styles.loading}>กำลังโหลด...</div>;

    const birthDate = me?.birth_date ? new Date(me.birth_date) : null;
    const today = new Date();

    // Check if birthday vs holiday
    const isBirthdayMonth = birthDate ? today.getMonth() === birthDate.getMonth() : false;
    const isBirthdayToday = birthDate ?
        (today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate()) : false;

    // Substitute logic: if birthday is holiday, can claim 1 day before.
    let substituteTarget: Date | null = null;
    if (birthDate) {
        const thisYearBday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        const isHoliday = holidays.some(h => new Date(h.date).toDateString() === thisYearBday.toDateString());
        if (isHoliday) {
            substituteTarget = new Date(thisYearBday);
            substituteTarget.setDate(substituteTarget.getDate() - 1);
        }
    }

    const canClaimToday = isBirthdayMonth;

    async function submitClaim() {
        if (!transferSlipFile) return setMsg({ text: "กรุณาแนบสลิปการโอนเงิน", type: 'bad' });
        if (!celebrationPhotoFile) return setMsg({ text: "กรุณาแนบรูปภาพฉลองวันเกิดร่วมกับเพื่อนร่วมงาน", type: 'bad' });
        if (!mealAmount || Number(mealAmount) <= 0) return setMsg({ text: "กรุณาระบุจำนวนเงินตามใบเสร็จ", type: 'bad' });

        setUploading(true);
        try {
            // 1. Upload files
            const upload = async (f: File, prefix: string) => {
                const formData = new FormData();
                formData.append("file", f);
                formData.append("prefix", prefix);
                const res = await fetch("/api/upload", { method: "POST", body: formData }).then(r => r.json());
                if (!res.ok) throw new Error(res.error || "UPLOAD_FAILED");
                return res.url;
            };

            const [transferUrl, photoUrl] = await Promise.all([
                upload(transferSlipFile, "slip"),
                upload(celebrationPhotoFile, "photo")
            ]);

            // 2. Submit claim
            const body = {
                transfer_slip_url: transferUrl,
                celebration_photo_url: photoUrl,
                meal_amount: Number(mealAmount),
                substitute_date: (substituteTarget && today.toDateString() === substituteTarget.toDateString()) ? substituteTarget.toISOString() : null
            };
            const cRes = await fetch("/api/birthday-claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }).then(r => r.json());

            if (!cRes.ok) {
                const map: any = {
                    NO_ATTENDANCE: "ไม่พบประวัติการรูดบัตรในวันเกิดของคุณ (ต้องรูดบัตรเข้า-ออกในวันเกิด)",
                    SALES_NO_PROJECT_SCAN: "พนักงานฝ่ายขายต้องมีประวัติการรูดบัตรเข้าโครงการ (Customer Check-in) ในวันเกิด"
                };
                throw new Error(map[cRes.error] || cRes.error);
            }

            setMsg({ text: "✅ ส่งคำขอสำเร็จ! กรุณารอฝ่ายบุคคลอนุมัติ", type: 'ok' });
            setTransferSlipFile(null);
            setCelebrationPhotoFile(null);
            setMealAmount("");
            load();
        } catch (e: any) {
            setMsg({ text: "❌ " + (e.message || "เกิดข้อผิดพลาด"), type: 'bad' });
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.wrap}>
                {/* ── HERO ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>สวัสดิการวันเกิด</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            รับเงินขวัญถุงและค่าอาหารในเดือนเกิดของคุณ
                        </div>
                    </div>
                </div>

                {/* ── INFO & FORM CARD ── */}
                <div className={styles.card}>
                    <div className={styles.cardTitle}>รายละเอียดการขอรับสวัสดิการ</div>

                    {!birthDate ? (
                        <div className={styles.alertWarn}>
                            ⚠️ ยังไม่ได้ระบุวันเกิดในระบบ กรุณาติดต่อฝ่ายบุคคลเพื่อแก้ไขข้อมูล
                        </div>
                    ) : (
                        <>
                            <div className={styles.bdayInfoBar}>
                                <div className={styles.bdayIcon}>🎂</div>
                                <div className={styles.bdayText}>ยินดีด้วย! เดือนนี้เป็นเดือนเกิดของคุณ</div>
                            </div>

                            {canClaimToday ? (
                                <div className={styles.form}>
                                    <div>
                                        <label className={styles.label}>จำนวนเงินค่าอาหาร (ตามใบเสร็จ)</label>
                                        <input
                                            type="number"
                                            className={styles.input}
                                            placeholder="ระบุจำนวนเงิน 0.00"
                                            value={mealAmount}
                                            onChange={e => setMealAmount(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className={styles.label}>แนบสลิปการโอนเงิน (Transfer Slip)</label>
                                        <div className={styles.fileInputWrapper}>
                                            <input
                                                type="file"
                                                className={styles.fileInput}
                                                accept="image/*"
                                                onChange={e => setTransferSlipFile(e.target.files?.[0] || null)}
                                            />
                                            <div className={`${styles.fileHint} ${transferSlipFile ? styles.fileHintSuccess : ''}`}>
                                                {transferSlipFile ? `✅ ${transferSlipFile.name}` : "📂 คลิกหรือลากไฟล์สลิปมาวางที่นี่"}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={styles.label}>รูปภาพฉลองร่วมกับเพื่อนร่วมงาน</label>
                                        <div className={styles.fileInputWrapper}>
                                            <input
                                                type="file"
                                                className={styles.fileInput}
                                                accept="image/*"
                                                onChange={e => setCelebrationPhotoFile(e.target.files?.[0] || null)}
                                            />
                                            <div className={`${styles.fileHint} ${celebrationPhotoFile ? styles.fileHintSuccess : ''}`}>
                                                {celebrationPhotoFile ? `✅ ${celebrationPhotoFile.name}` : "📂 คลิกหรือลากรูปภาพมาวางที่นี่"}
                                            </div>
                                        </div>
                                    </div>

                                    {msg && (
                                        <div className={msg.type === 'ok' ? styles.msgOk : styles.msgBad}>
                                            {msg.text}
                                        </div>
                                    )}

                                    <button
                                        className={styles.btnPrimary}
                                        onClick={submitClaim}
                                        disabled={uploading}
                                    >
                                        {uploading ? "กำลังบันทึกข้อมูล..." : "ยืนยันส่งคำขอ"}
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.waitBox}>
                                    {isBirthdayMonth ? (
                                        <>
                                            <div className={styles.waitIcon}>⏳</div>
                                            <div className={styles.waitTitle}>อดใจรออีกนิด!</div>
                                            <div>กรุณาส่งคำขอในวันเกิดของคุณ ({birthDate.getDate()} {new Intl.DateTimeFormat('th-TH', { month: 'long' }).format(birthDate)})</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className={styles.waitIcon}>📅</div>
                                            <div className={styles.waitTitle}>ยังไม่ถึงเวลา</div>
                                            <div>ขณะนี้ยังไม่ถึงช่วงเวลาขอรับสวัสดิการวันเกิดของคุณ</div>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── HISTORY CARD ── */}
                <div className={styles.card}>
                    <div className={styles.cardTitle}>ประวัติการขอรับสวัสดิการ</div>
                    {claims.length === 0 ? (
                        <div className={styles.empty}>ยังไม่มีประวัติการส่งคำขอ</div>
                    ) : (
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>วันที่</th>
                                        <th>เงินขวัญถุง</th>
                                        <th>ค่าอาหาร</th>
                                        <th style={{ textAlign: 'center' }}>สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claims.map(c => (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 600 }}>{new Date(c.created_at).toLocaleDateString("th-TH", { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                                            <td>฿{Number(c.amount_cash).toLocaleString()}</td>
                                            <td>฿{Number(c.amount_meal).toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={
                                                    c.status === 'approved' ? styles.stApproved :
                                                        c.status === 'rejected' ? styles.stRejected :
                                                            styles.stPending
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

