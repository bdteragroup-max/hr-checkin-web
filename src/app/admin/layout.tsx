"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

type TabKey = "dashboard" | "attendance" | "leave" | "holiday" | "report" | "projects";

function getTabFromSearch(searchParams: ReturnType<typeof useSearchParams>): TabKey {
    const t = (searchParams.get("tab") || "dashboard").toLowerCase();
    if (t === "attendance" || t === "leave" || t === "holiday" || t === "report" || t === "projects") return t as TabKey;
    return "dashboard";
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const inAdminHome = pathname === "/admin";
    const activeTab: TabKey = inAdminHome ? getTabFromSearch(searchParams) : "dashboard";
    const isLoginPage = pathname === "/admin/login";

    if (isLoginPage) {
        return <>{children}</>;
    }

    const todayLabel = new Date().toLocaleDateString("th-TH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Bangkok",
    });

    async function logout() {
        await fetch("/api/admin/logout", { method: "POST" }).catch(() => { });
        window.location.href = "/admin/login";
    }

    const isEmployeesActive = pathname.startsWith("/admin/employees");
    const isLeavesActive = pathname.startsWith("/admin/leaves");
    const isHolidayActive = pathname.startsWith("/admin/holiday");
    const isOrganizationActive = pathname.startsWith("/admin/organization");

    return (
        <div className={styles.wrapper}>
            {/* ── TOPBAR ── */}
            <div className={styles.topbar}>
                <div className={styles.topbarBrand}>
                    <div className={styles.topbarLogo}>T</div>
                    <div>
                        <div className={styles.topbarTitle}>TERA GROUP</div>
                        <div className={styles.topbarSub}>Admin Panel</div>
                    </div>
                </div>
                <div className={styles.topbarRight}>
                    <span className={styles.topbarDate}>{todayLabel}</span>
                    <button className={styles.btnLogout} onClick={logout}>
                        🚪 ออกจากระบบ
                    </button>
                </div>
            </div>

            {/* ── LAYOUT ── */}
            <div className={styles.appLayout}>
                {/* ── SIDEBAR ── */}
                <aside className={styles.sidebar}>
                    <div className={styles.sidebarInner}>
                        <nav className={styles.nav}>
                            <div className={styles.navSection}>หลัก</div>

                            <Link
                                href="/admin?tab=dashboard"
                                className={`${styles.navItem} ${inAdminHome && activeTab === "dashboard" ? styles.active : ""
                                    }`}
                            >
                                <span className={styles.navIcon}>📊</span>Dashboard
                            </Link>

                            <Link
                                href="/admin?tab=attendance"
                                className={`${styles.navItem} ${inAdminHome && activeTab === "attendance" ? styles.active : ""
                                    }`}
                            >
                                <span className={styles.navIcon}>📋</span>การเข้างาน
                            </Link>

                            <div className={styles.navSection}>จัดการ</div>

                            {/* ✅ Employees menu (active by pathname) */}
                            <Link
                                href="/admin/employees"
                                className={`${styles.navItem} ${isEmployeesActive ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}>👥</span>Employees
                            </Link>

                            {/* ✅ Organization menu */}
                            <Link
                                href="/admin/organization"
                                className={`${styles.navItem} ${isOrganizationActive ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}>🏢</span>โครงสร้างองค์กร
                            </Link>

                            {/* ✅ Projects menu */}
                            <Link
                                href="/admin?tab=projects"
                                className={`${styles.navItem} ${inAdminHome && activeTab === "projects" ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}>🏗️</span>โครงการ / ลูกค้า
                            </Link>

                            {/* ✅ Leave -> link to /admin/leaves */}
                            <Link
                                href="/admin/leaves"
                                className={`${styles.navItem} ${isLeavesActive ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}>🏖️</span>การลา
                            </Link>

                            {/* ✅ OT Requests -> link to /admin/ot */}
                            <Link
                                href="/admin/ot"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/ot") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}>⏱️</span>คำขอ OT
                            </Link>

                            {/* ✅ Birthday Claims */}
                            <Link
                                href="/admin/birthday-claims"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/birthday-claims") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}>🎂</span>สวัสดิการวันเกิด
                            </Link>

                            {/* ✅ Travel & Off-Site Claims */}
                            <Link
                                href="/admin/travel-claims"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/travel-claims") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}>🚕</span>ค่าเดินทาง / ที่พัก
                            </Link>

                            {/* ✅ Holiday -> link to /admin/holiday */}
                            <Link
                                href="/admin/holiday"
                                className={`${styles.navItem} ${isHolidayActive ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}>📅</span>วันหยุด
                            </Link>

                            <div className={styles.navSection}>รายงาน</div>

                            {/* ✅ Payroll / OT menu */}
                            <Link
                                href="/admin/payroll"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/payroll") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}>💰</span>ระบบเงินเดือน
                            </Link>
                            <Link
                                href="/admin?tab=report"
                                className={`${styles.navItem} ${inAdminHome && activeTab === "report" ? styles.active : ""
                                    }`}
                            >
                                <span className={styles.navIcon}>📈</span>สรุปรายเดือน
                            </Link>
                        </nav>
                    </div>
                </aside>

                {/* ── MAIN ── */}
                <main className={styles.main}>{children}</main>
            </div>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#666" }}>กำลังโหลดส่วนจัดการ...</div>}>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </Suspense>
    );
}