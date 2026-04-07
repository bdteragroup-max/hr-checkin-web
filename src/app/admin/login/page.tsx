"use client";

import { useState, useEffect } from "react";
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

    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(true);

    useEffect(() => {
        fetch("/api/branches")
            .then(res => res.json())
            .then(data => {
                if (data.ok) setBranches(data.branches || []);
            })
            .catch(console.error)
            .finally(() => setLoadingBranches(false));
    }, []);

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
            <div className={styles.right}>
                <div className={styles.formCard}>
                    <div className={styles.formWrap}>
                        {/* Header */}
                        <div className={styles.formHeader}>
                            <div className={styles.brandAlt}>
                                <div className={styles.brandLogo}>TG</div>
                                <div>
                                    <div className={styles.brandNameAlt}>TERA GROUP</div>
                                    <div className={styles.brandSubAlt}>HR Admin System</div>
                                </div>
                            </div>

                            <div className={styles.formEyebrow}>เข้าสู่ระบบ</div>
                            <h2 className={styles.formTitle}>ยินดีต้อนรับกลับ</h2>
                            <p className={styles.formSubtitle}>
                                กรอกข้อมูลเพื่อเข้าสู่หน้าจัดการระบบ HR
                            </p>
                        </div>

                        {/* Form */}
                        <form className={styles.form} onSubmit={handleLogin} noValidate>
                            {/* Username */}
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="username">
                                    ชื่อผู้ใช้
                                </label>
                                <div className={styles.fieldInputWrap}>
                                    <span className={styles.fieldIcon}><UserIcon width={18} /></span>
                                    <input
                                        id="username"
                                        type="text"
                                        className={styles.fieldInput}
                                        placeholder="กรอกชื่อผู้ใช้"
                                        value={username}
                                        onChange={e => { setUsername(e.target.value); setError(""); }}
                                        autoComplete="username"
                                        autoFocus
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="password">
                                    รหัสผ่าน
                                </label>
                                <div className={styles.fieldInputWrap}>
                                    <span className={styles.fieldIcon}><LockClosedIcon width={18} /></span>
                                    <input
                                        id="password"
                                        type={showPass ? "text" : "password"}
                                        className={styles.fieldInput}
                                        placeholder="กรอกรหัสผ่าน"
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setError(""); }}
                                        autoComplete="current-password"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className={styles.fieldToggle}
                                        onClick={() => setShowPass(v => !v)}
                                        tabIndex={-1}
                                        aria-label={showPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                                    >
                                        {showPass ? <EyeSlashIcon width={20} /> : <EyeIcon width={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className={styles.errorBox} role="alert">
                                    <ExclamationTriangleIcon width={18} />
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                className={styles.btnSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className={styles.btnSpinner} />
                                        กำลังเข้าสู่ระบบ...
                                    </>
                                ) : (
                                    <>
                                        เข้าสู่ระบบ
                                        <ArrowRightIcon width={18} />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className={styles.formFooter}>
                            ระบบนี้สำหรับ <strong>เจ้าหน้าที่ที่ได้รับอนุญาต</strong> เท่านั้น<br />
                            หากมีปัญหาการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบ
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}