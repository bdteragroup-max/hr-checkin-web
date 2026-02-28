"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import styles from "./layout.module.css";

const NAV_MAIN_BASE = [
    { id: "checkin", href: "/app", icon: "⏱", label: "เช็คอิน", sub: "Check-in" },
    { id: "project-checkin", href: "/project-checkin", icon: "🏢", label: "เช็คอินโครงการ", sub: "Project Check-in", isProject: true },
    { id: "leave", href: "/leave", icon: "📝", label: "ลางาน", sub: "Leave" },
    { id: "travel", href: "/travel-allowance", icon: "🚗", label: "เบี้ยเลี้ยง", sub: "Travel" },
    { id: "ot", href: "/ot-request", icon: "⏰", label: "ขอ OT", sub: "OT Request" },
    { id: "birthday", href: "/birthday-benefit", icon: "🎂", label: "รางวัลวันเกิด", sub: "Birthday" },
];

const NAV_BOTTOM = [{ href: "/", icon: "🔐", label: "ล็อกอิน", sub: "Login" }];

export default function AppShell({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [isSupervisor, setIsSupervisor] = useState(false);
    const [baseSalary, setBaseSalary] = useState(0);
    const [birthMonth, setBirthMonth] = useState<number | null>(null); // 0-11
    const pathname = usePathname();

    useEffect(() => {
        if (pathname === "/" || pathname?.startsWith("/admin") || pathname === "/reset-pin") return;
        fetch("/api/me")
            .then(r => r.json())
            .then(d => {
                setIsSupervisor(!!d?.is_supervisor);
                setBaseSalary(Number(d?.base_salary) || 0);
                if (d?.birth_date) {
                    const bDate = new Date(d.birth_date);
                    setBirthMonth(bDate.getMonth());
                }
            })
            .catch(() => { });
    }, [pathname]);

    const navMain = NAV_MAIN_BASE.filter(item => {
        // Hide OT for salary > 20000
        if (item.id === "ot" && baseSalary > 20000) return false;

        // Hide Birthday if not birth month
        if (item.id === "birthday") {
            if (birthMonth === null) return false; // Hide until loaded
            const currentMonth = new Date().getMonth();
            if (birthMonth !== currentMonth) return false;
        }

        return true;
    });

    if (isSupervisor) {
        navMain.push({ id: "team-leaves", href: "/team-leaves", icon: "📋", label: "อนุมัติลา", sub: "Team Leaves" });
        navMain.push({ id: "team-ot", href: "/team-ot", icon: "🕒", label: "อนุมัติ OT", sub: "Team OT" });
        navMain.push({ id: "team-travel", href: "/team/travel-claims", icon: "🚜", label: "อนุมัติเบี้ยเลี้ยงทีม", sub: "Team Travel" });
    }

    // ✅ ไม่แสดง Sidebar ในหน้า Login และหน้า Admin ทั้งหมด
    const hideShell = pathname === "/" || pathname?.startsWith("/admin") || pathname === "/reset-pin";

    // ถ้าเป็นหน้า login/admin/reset ให้แสดงแค่เนื้อหาหน้านั้นๆ
    if (hideShell) {
        return <>{children}</>;
    }

    return (
        <div className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
            {/* ── Sidebar ── */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarAccent} />

                <div className={styles.brand}>
                    <div className={styles.logoWrap}>
                        <div className={styles.logo}>T</div>
                    </div>
                    <div className={styles.brandText}>
                        <span className={styles.brandName}>TERA GROUP</span>
                        <span className={styles.brandTag}>Attendance System</span>
                    </div>
                </div>

                <nav className={styles.nav}>
                    <span className={styles.navSection}>เมนูหลัก</span>
                    {navMain.map((item, i) => {
                        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                        return (
                            <div key={item.href} style={item.isProject ? { marginTop: 12 } : {}}>
                                <Link
                                    href={item.href}
                                    data-label={item.label}
                                    className={`${styles.navItem} ${active ? styles.navActive : ""}`}
                                    style={{ animationDelay: `${i * 0.05}s` }}
                                >
                                    {active && <span className={styles.activeBg} />}
                                    <span className={styles.navIcon}>{item.icon}</span>
                                    <span className={styles.navText}>
                                        <span className={styles.navLabel}>{item.label}</span>
                                        <span className={styles.navSub}>{item.sub}</span>
                                    </span>
                                    {active && <span className={styles.activePip} />}
                                </Link>
                            </div>
                        );
                    })}
                </nav>

                <div className={styles.spacer} />

                <div className={styles.navFooter}>
                    <div className={styles.footerDivider} />
                    {NAV_BOTTOM.map((item) => {
                        const active = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                data-label={item.label}
                                className={`${styles.navItem} ${active ? styles.navActive : ""}`}
                            >
                                {active && <span className={styles.activeBg} />}
                                <span className={styles.navIcon}>{item.icon}</span>
                                <span className={styles.navText}>
                                    <span className={styles.navLabel}>{item.label}</span>
                                    <span className={styles.navSub}>{item.sub}</span>
                                </span>
                            </Link>
                        );
                    })}
                </div>

                <button
                    className={styles.collapseBtn}
                    onClick={() => setCollapsed((c) => !c)}
                    aria-label="Toggle sidebar"
                >
                    <span className={styles.collapseBtnIcon}>{collapsed ? "›" : "‹"}</span>
                </button>
            </aside>

            {/* ── Main ── */}
            <main className={styles.main}>{children}</main>

            {/* ── Mobile bottom bar ── */}
            <nav className={styles.mobileBar}>
                {navMain.map((item) => {
                    const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.mobileItem} ${active ? styles.mobileActive : ""}`}
                        >
                            {active && <span className={styles.mobilePip} />}
                            <span className={styles.mobileIcon}>{item.icon}</span>
                            <span className={styles.mobileLabel}>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
