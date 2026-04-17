"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import {
    ChartBarIcon, ClipboardDocumentListIcon, UsersIcon,
    BuildingOfficeIcon, MapPinIcon, BriefcaseIcon,
    SunIcon, ClockIcon, GiftIcon, TruckIcon,
    CalendarIcon, BanknotesIcon, PresentationChartLineIcon,
    ArrowRightOnRectangleIcon,
    CubeIcon,
    DocumentCheckIcon
} from "@heroicons/react/24/outline";

type TabKey = "dashboard" | "attendance" | "leave" | "holiday" | "projects";

function getTabFromSearch(searchParams: ReturnType<typeof useSearchParams>): TabKey {
    const t = (searchParams.get("tab") || "dashboard").toLowerCase();
    if (t === "attendance" || t === "leave" || t === "holiday" || t === "projects") return t as TabKey;
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
        await fetch("/admin/logout", { method: "POST" }).catch(() => { });
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
                        <ArrowRightOnRectangleIcon className={styles.navIcon} style={{ width: 16, height: 16, marginRight: 4 }} /> ออกจากระบบ
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
                                <span className={styles.navIcon}><ChartBarIcon width={20} /></span>Dashboard
                            </Link>

                            <Link
                                href="/admin?tab=attendance"
                                className={`${styles.navItem} ${inAdminHome && activeTab === "attendance" ? styles.active : ""
                                    }`}
                            >
                                <span className={styles.navIcon}><ClipboardDocumentListIcon width={20} /></span>การเข้างาน
                            </Link>

                            <div className={styles.navSection}>จัดการ</div>

                            {/* ✅ Employees menu (active by pathname) */}
                            <Link
                                href="/admin/employees"
                                className={`${styles.navItem} ${isEmployeesActive ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><UsersIcon width={20} /></span>Employees
                            </Link>

                            {/* ✅ Organization menu */}
                            <Link
                                href="/admin/organization"
                                className={`${styles.navItem} ${isOrganizationActive ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><BuildingOfficeIcon width={20} /></span>โครงสร้างองค์กร
                            </Link>

                            {/* ✅ Branches menu */}
                            <Link
                                href="/admin/branches"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/branches") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><MapPinIcon width={20} /></span>สาขา (Branches)
                            </Link>

                            {/* ✅ Projects menu */}
                            <Link
                                href="/admin?tab=projects"
                                className={`${styles.navItem} ${inAdminHome && activeTab === "projects" ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><BriefcaseIcon width={20} /></span>โครงการ / ลูกค้า
                            </Link>

                            {/* ✅ Leave -> link to /admin/leaves */}
                            <Link
                                href="/admin/leaves"
                                className={`${styles.navItem} ${isLeavesActive ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><SunIcon width={20} /></span>การลา
                            </Link>

                            {/* ✅ OT Requests -> link to /admin/ot */}
                            <Link
                                href="/admin/ot"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/ot") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><ClockIcon width={20} /></span>คำขอ OT
                            </Link>

                            {/* ✅ Probation Evaluations */}
                            <Link
                                href="/admin/probation"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/probation") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><DocumentCheckIcon width={20} /></span>ประเมินทดลองงาน
                            </Link>

                            {/* ✅ Birthday Claims */}
                            <Link
                                href="/admin/birthday-claims"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/birthday-claims") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><GiftIcon width={20} /></span>สวัสดิการวันเกิด
                            </Link>

                             {/* ✅ Travel & Off-Site Claims */}
                             <Link
                                 href="/admin/travel-claims"
                                 className={`${styles.navItem} ${pathname.startsWith("/admin/travel-claims") ? styles.active : ""}`}
                             >
                                 <span className={styles.navIcon}><TruckIcon width={20} /></span>ค่าเดินทาง / ที่พัก
                             </Link>
 
                             {/* ✅ Asset Management */}
                             <Link
                                 href="/admin/assets"
                                 className={`${styles.navItem} ${pathname.startsWith("/admin/assets") ? styles.active : ""}`}
                             >
                                 <span className={styles.navIcon}><CubeIcon width={20} /></span>ระบบอุปกรณ์ (Assets)
                             </Link>

                             {/* ✅ Car Management */}
                             <Link
                                 href="/admin/cars"
                                 className={`${styles.navItem} ${pathname.startsWith("/admin/cars") ? styles.active : ""}`}
                             >
                                 <span className={styles.navIcon}><TruckIcon width={20} /></span>ระบบพาหนะ (Cars)
                             </Link>

                            {/* ✅ Holiday -> link to /admin/holiday */}
                            <Link
                                href="/admin/holiday"
                                className={`${styles.navItem} ${isHolidayActive ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><CalendarIcon width={20} /></span>วันหยุด
                            </Link>

                            <div className={styles.navSection}>รายงาน</div>

                            {/* ✅ Payroll / OT menu */}
                            <Link
                                href="/admin/payroll"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/payroll") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><BanknotesIcon width={20} /></span>ระบบเงินเดือน
                            </Link>
                            {/* ✅ Historical Records */}
                            <Link
                                href="/admin/records"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/records") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><PresentationChartLineIcon width={20} /></span>สถิติย้อนหลัง
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