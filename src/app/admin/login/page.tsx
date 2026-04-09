"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { 
    UserIcon, 
    LockClosedIcon, 
    EyeIcon, 
    EyeSlashIcon, 
    ExclamationTriangleIcon,
    ArrowRightIcon
} from "@heroicons/react/24/outline";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                router.push("/admin");
            } else {
                setError(data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
            }
        } catch {
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={styles.page}>
            {/* Dynamic Background Elements */}
            <div className={styles.aura1}></div>
            <div className={styles.aura2}></div>
            <div className={styles.aura3}></div>

            <div className={styles.container}>
                <div className={styles.glassCard}>
                    <div className={styles.formSection}>
                        {/* Header Section */}
                        <div className={styles.header}>
                            <div className={styles.logoBadge}>TG</div>
                            <div className={styles.brandTitle}>TERA GROUP</div>
                            <div className={styles.brandSubtitle}>Human Resource Management</div>
                        </div>

                        <div className={styles.intro}>
                            <h1>Admin Portal</h1>
                            <p>เข้าสู่ระบบเพื่อจัดการข้อมูลพนักงาน</p>
                        </div>

                        {/* Form Section */}
                        <form className={styles.form} onSubmit={handleLogin} noValidate>
                            <div className={styles.inputGroup}>
                                <label htmlFor="username">Username</label>
                                <div className={styles.inputWrapper}>
                                    <UserIcon className={styles.inputIcon} />
                                    <input
                                        id="username"
                                        type="text"
                                        placeholder="ชื่อผู้ใช้งานของคุณ"
                                        value={username}
                                        onChange={e => { setUsername(e.target.value); setError(""); }}
                                        autoComplete="username"
                                        autoFocus
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label htmlFor="password">Password</label>
                                <div className={styles.inputWrapper}>
                                    <LockClosedIcon className={styles.inputIcon} />
                                    <input
                                        id="password"
                                        type={showPass ? "text" : "password"}
                                        placeholder="รหัสผ่านของคุณ"
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setError(""); }}
                                        autoComplete="current-password"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className={styles.toggleVisibility}
                                        onClick={() => setShowPass(v => !v)}
                                        tabIndex={-1}
                                    >
                                        {showPass ? <EyeSlashIcon /> : <EyeIcon />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className={styles.errorAlert} role="alert">
                                    <ExclamationTriangleIcon />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                className={styles.submitBtn}
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className={styles.loader}></div>
                                ) : (
                                    <>
                                        เข้าสู่ระบบตอนนี้
                                        <ArrowRightIcon className={styles.btnIcon} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className={styles.footer}>
                            <p>© 2024 TERA GROUP. Authorized Personnel Only.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}