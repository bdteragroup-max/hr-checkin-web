"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function LoginPage() {
    const [emp_id, setEmpId] = useState("");
    const [pin, setPin] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);

    async function login() {
        if (!emp_id.trim() || !pin.trim()) return setMsg("กรุณากรอก ID และ PIN");
        setMsg("");
        setLoading(true);
        try {
            const r = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emp_id: emp_id.trim(), pin: pin.trim() }),
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) return setMsg(data?.error === "INVALID_CREDENTIALS" ? "ID หรือ PIN ไม่ถูกต้อง" : data?.error || "เข้าสู่ระบบไม่สำเร็จ");
            window.location.href = "/app";
        } catch {
            setMsg("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") login();
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
            </div>

            {/* ── Login card ── */}
            <div className={styles.card}>

                {/* EMP ID */}
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
                        autoComplete="username"
                        spellCheck={false}
                    />
                </div>

                {/* PIN */}
                <label className={styles.label}>PIN</label>
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
                        autoComplete="current-password"
                    />
                </div>

                {/* Submit */}
                <button
                    className={`${styles.btnLogin} ${loading ? styles.loading : ""}`}
                    onClick={login}
                    disabled={loading}
                >
                    {loading ? "" : "เข้าสู่ระบบ"}
                </button>

                {/* Error */}
                {msg && <div className={styles.error}>{msg}</div>}

                {/* Forgot PIN */}
                <div style={{ marginTop: "24px", textAlign: "center" }}>
                    <a href="/reset-pin" style={{ color: "var(--primary)", fontSize: "14px", textDecoration: "none", fontWeight: 500 }}>
                        ลืมรหัสผ่าน? (รีเซ็ต PIN)
                    </a>
                </div>
            </div>

            {/* ── Footer ── */}
            <p className={styles.footer}>© {new Date().getFullYear()} TERA GROUP</p>

        </div>
    );
}