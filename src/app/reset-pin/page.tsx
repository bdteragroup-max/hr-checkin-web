"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";

export default function ResetPinPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [emp_id, setEmpId] = useState("");
    const [phone_number, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [pin, setPin] = useState("");

    const [msg, setMsg] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    async function requestOtp() {
        if (!emp_id.trim() || !phone_number.trim()) return setMsg("กรุณากรอกรหัสพนักงานและเบอร์โทรศัพท์");

        setMsg("");
        setLoading(true);

        try {
            const r = await fetch("/api/auth/reset-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "request_otp",
                    emp_id: emp_id.trim(),
                    phone_number: phone_number.trim(),
                }),
            });

            const data = await r.json().catch(() => ({}));
            if (!r.ok) {
                const errMap: Record<string, string> = {
                    INVALID_CREDENTIALS: "รหัสพนักงาน หรือเบอร์โทรศัพท์มือถือไม่ถูกต้อง",
                    MISSING_FIELDS: "กรุณากรอกข้อมูลให้ครบถ้วน",
                };
                return setMsg(errMap[data?.error] || data?.error || "เกิดข้อผิดพลาด");
            }

            setStep(2);
            setMsg(`ระบบได้ส่งรหัส OTP 6 หลัก ไปยังเบอร์มือถือของคุณแล้ว (Simulated OTP: ${data.otp_debug})`);
        } catch {
            setMsg("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setLoading(false);
        }
    }

    async function submitReset() {
        if (!otp.trim() || !pin.trim()) return setMsg("กรุณากรอก OTP และ PIN ใหม่");
        if (pin.length < 4) return setMsg("PIN ใหม่ต้องมีอย่างน้อย 4 หลัก");

        setMsg("");
        setLoading(true);

        try {
            const r = await fetch("/api/auth/reset-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "verify_and_reset",
                    emp_id: emp_id.trim(),
                    phone_number: phone_number.trim(),
                    otp: otp.trim(),
                    pin: pin.trim(),
                }),
            });

            const data = await r.json().catch(() => ({}));
            if (!r.ok) {
                const errMap: Record<string, string> = {
                    INVALID_OTP: "รหัส OTP ไม่ถูกต้อง",
                    EXPIRED_OTP: "รหัส OTP หมดอายุแล้ว กรุณาขอใหม่",
                    PIN_TOO_SHORT: "PIN ใหม่ต้องมีอย่างน้อย 4 หลัก",
                    MISSING_FIELDS: "กรุณากรอกข้อมูลให้ครบถ้วน",
                };
                return setMsg(errMap[data?.error] || data?.error || "ไม่สามารถรีเซ็ตรหัสผ่านได้");
            }

            setIsSuccess(true);
            setMsg("รีเซ็ต PIN สำเร็จ! รอสักครู่...");

            setTimeout(() => {
                router.push("/");
            }, 3000);

        } catch {
            setMsg("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            if (step === 1) requestOtp();
            else submitReset();
        }
    }

    return (
        <div className={styles.page}>
            {/* ── Hero band ── */}
            <div className={styles.hero}>
                <div className={styles.heroCircle2} />

                <div className={styles.logo}>
                    <span>T</span>
                </div>

                <h1 className={styles.heroTitle}>TERA GROUP</h1>
                <p className={styles.heroSub}>Attendance System</p>
            </div>

            {/* ── Reset Card ── */}
            <div className={styles.card}>
                <h2 className={styles.cardTitle}>รีเซ็ตรหัส PIN</h2>
                <p className={styles.cardDesc}>
                    {step === 1
                        ? "ยืนยันตัวตนด้วยรหัสพนักงานและเบอร์โทรศัพท์ที่ลงทะเบียนไว้"
                        : "กรอกรหัส OTP 6 หลัก และตั้งค่า PIN ใหม่ของคุณ"}
                </p>

                {step === 1 && (
                    <>
                        <label className={styles.label}>รหัสพนักงาน</label>
                        <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>👤</span>
                            <input
                                className={styles.input}
                                placeholder="เช่น TE00001"
                                value={emp_id}
                                onChange={(e) => setEmpId(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoCapitalize="characters"
                                disabled={loading}
                            />
                        </div>

                        <label className={styles.label}>เบอร์โทรศัพท์มือถือ</label>
                        <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>📱</span>
                            <input
                                type="tel"
                                className={styles.input}
                                placeholder="08XXXXXXXX"
                                value={phone_number}
                                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                                onKeyDown={handleKeyDown}
                                disabled={loading}
                            />
                        </div>

                        <button
                            className={`${styles.btnReset} ${loading ? styles.loading : ""}`}
                            onClick={requestOtp}
                            disabled={loading}
                        >
                            {loading ? "" : "ขอรหัส OTP"}
                        </button>
                    </>
                )}

                {step === 2 && (
                    <>
                        <label className={styles.label}>รหัส OTP 6 หลัก</label>
                        <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>✉️</span>
                            <input
                                className={styles.input}
                                placeholder="XXXXXX"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                onKeyDown={handleKeyDown}
                                maxLength={6}
                                disabled={isSuccess}
                            />
                        </div>

                        <label className={styles.label}>PIN ใหม่ (ตัวเลข 4-8 หลัก)</label>
                        <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>🔒</span>
                            <input
                                className={`${styles.input} ${styles.inputPin}`}
                                placeholder="••••••"
                                type="password"
                                inputMode="numeric"
                                maxLength={8}
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                                onKeyDown={handleKeyDown}
                                disabled={isSuccess}
                            />
                        </div>

                        <button
                            className={`${styles.btnReset} ${loading ? styles.loading : ""}`}
                            onClick={submitReset}
                            disabled={loading || isSuccess}
                        >
                            {loading ? "" : "ยืนยันและรีเซ็ต PIN"}
                        </button>

                        {!isSuccess && (
                            <button
                                className={styles.btnBack}
                                style={{ marginTop: 16, background: "transparent", border: "1.5px solid var(--line2)", padding: "10px", borderRadius: "10px", fontWeight: "600", cursor: "pointer" }}
                                onClick={() => { setStep(1); setMsg(""); setOtp(""); setPin(""); }}
                            >
                                ยกเลิกและขอ OTP ใหม่
                            </button>
                        )}
                    </>
                )}

                {msg && (
                    <div className={isSuccess || msg.includes("OTP") ? styles.success : styles.error}>
                        {msg}
                    </div>
                )}

                {!isSuccess && step === 1 && (
                    <div style={{ marginTop: "24px", textAlign: "center" }}>
                        <Link href="/" style={{ color: "var(--red)", fontSize: "14px", textDecoration: "none", fontWeight: 600 }}>
                            ← กลับไปหน้าเข้าสู่ระบบ
                        </Link>
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <p className={styles.footer}>© {new Date().getFullYear()} TERA GROUP</p>
        </div>
    );
}
