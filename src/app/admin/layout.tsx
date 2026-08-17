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
    DocumentCheckIcon,
    AcademicCapIcon,
    ArchiveBoxIcon,
    MegaphoneIcon,
    BuildingStorefrontIcon
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

type TabKey = "dashboard" | "attendance" | "leave" | "holiday" | "projects";

function getTabFromSearch(searchParams: ReturnType<typeof useSearchParams>): TabKey {
    const t = (searchParams.get("tab") || "dashboard").toLowerCase();
    if (t === "attendance" || t === "leave" || t === "holiday" || t === "projects") return t as TabKey;
    return "dashboard";
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [admin, setAdmin] = useState<any>(null);

    const [loading, setLoading] = useState(true);
    const isLoginPage = pathname === "/admin/login";

    useEffect(() => {
        if (isLoginPage) {
            setLoading(false);
            return;
        }

        setLoading(true);
        fetch("/api/admin/me")
            .then(res => {
                if (!res.ok) throw new Error("API_ERROR_" + res.status);
                return res.json();
            })
            .then(data => {
                if (data.ok) setAdmin(data.admin);
                else setAdmin({ role: 'GUEST' });
            })
            .catch(err => {
                console.error("Role Fetch Error:", err);
                setAdmin({ role: 'ERROR' });
                // If it's a 401, redirect to login
                if (err.message?.includes("401") && !isLoginPage) {
                    window.location.href = "/admin/login";
                }
            })
            .finally(() => setLoading(false));
    }, [isLoginPage]);

    const role = admin?.role;

    function hasAccess(path: string) {
        if (!role || role === 'ERROR' || role === 'GUEST') return false;
        const upRole = role.toUpperCase();
        if (upRole === "SUPER_ADMIN" || upRole === "ADMIN") return true;

        if (upRole === "SUPERVISOR") {
            // Supervisor can ONLY see records page
            return path === "/admin/records" || path.startsWith("/admin/records/");
        }

        if (upRole === "WAREHOUSE_MANAGER") {
            // Warehouse Manager can only see Dashboard, Assets (Items/Equipment), and Cars
            const allowedPaths = [
                "/admin/assets",
                "/admin/cars",
                "/admin/reports/vehicles",
                "/admin/clothing"
            ];

            // Allow exact match for /admin (Dashboard)
            if (path === "/admin") return true;

            // Allow specific sub-paths
            return allowedPaths.some(p => path === p || path.startsWith(p + "/"));
        }
        return false;
    }

    const inAdminHome = pathname === "/admin";
    const activeTab: TabKey = inAdminHome ? getTabFromSearch(searchParams) : "dashboard";

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
                            {/* DEBUG: Remove after verify */}
                            <div style={{ fontSize: '10px', color: '#64748b', padding: '0 16px 8px' }}>
                                Role: {loading ? 'Fetching...' : (role || 'MISSING')}
                            </div>
                            <div className={styles.navSection}>หลัก</div>

                            <Link
                                href="/admin?tab=dashboard"
                                className={`${styles.navItem} ${inAdminHome && activeTab === "dashboard" ? styles.active : ""
                                    }`}
                            >
                                <span className={styles.navIcon}><ChartBarIcon width={20} /></span>Dashboard
                            </Link>

                            <Link
                                href="/admin/announcements"
                                className={`${styles.navItem} ${pathname.startsWith("/admin/announcements") ? styles.active : ""}`}
                            >
                                <span className={styles.navIcon}><MegaphoneIcon width={20} /></span>ประกาศ (Announcements)
                            </Link>

                            {hasAccess("/admin/attendance") && (
                                <Link
                                    href="/admin?tab=attendance"
                                    className={`${styles.navItem} ${inAdminHome && activeTab === "attendance" ? styles.active : ""
                                        }`}
                                >
                                    <span className={styles.navIcon}><ClipboardDocumentListIcon width={20} /></span>การเข้างาน
                                </Link>
                            )}

                            {hasAccess("/admin/employees") && <div className={styles.navSection}>จัดการ</div>}
                            {admin?.role?.toUpperCase() === "WAREHOUSE_MANAGER" && <div className={styles.navSection}>คลังสินค้า / ยานพาหนะ</div>}

                            {/* ✅ Employees menu (active by pathname) */}
                            {hasAccess("/admin/employees") && (
                                <Link
                                    href="/admin/employees"
                                    className={`${styles.navItem} ${isEmployeesActive ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><UsersIcon width={20} /></span>Employees
                                </Link>
                            )}

                            {/* ✅ Organization menu */}
                            {hasAccess("/admin/organization") && (
                                <Link
                                    href="/admin/organization"
                                    className={`${styles.navItem} ${isOrganizationActive ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><BuildingOfficeIcon width={20} /></span>โครงสร้างองค์กร
                                </Link>
                            )}

                            {/* ✅ Branches menu */}
                            {hasAccess("/admin/branches") && (
                                <Link
                                    href="/admin/branches"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/branches") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><MapPinIcon width={20} /></span>สาขา (Branches)
                                </Link>
                            )}

                            {/* ✅ Company Settings */}
                            {hasAccess("/admin/organization") && (
                                <Link
                                    href="/admin/company-settings"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/company-settings") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><BuildingStorefrontIcon width={20} /></span>ข้อมูลบริษัท (Company)
                                </Link>
                            )}

                            {/* ✅ Projects menu */}
                            {hasAccess("/admin/projects") && (
                                <Link
                                    href="/admin?tab=projects"
                                    className={`${styles.navItem} ${inAdminHome && activeTab === "projects" ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><BriefcaseIcon width={20} /></span>โครงการ / ลูกค้า
                                </Link>
                            )}

                            {/* ✅ Leave -> link to /admin/leaves */}
                            {hasAccess("/admin/leaves") && (
                                <Link
                                    href="/admin/leaves"
                                    className={`${styles.navItem} ${isLeavesActive ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><SunIcon width={20} /></span>การลา
                                </Link>
                            )}

                            {/* ✅ OT Requests -> link to /admin/ot */}
                            {hasAccess("/admin/ot") && (
                                <Link
                                    href="/admin/ot"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/ot") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><ClockIcon width={20} /></span>คำขอ OT
                                </Link>
                            )}

                            {/* ✅ Probation Evaluations */}
                            {hasAccess("/admin/probation") && (
                                <Link
                                    href="/admin/probation"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/probation") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><DocumentCheckIcon width={20} /></span>ประเมินทดลองงาน
                                </Link>
                            )}

                            {/* ✅ KPI Evaluations */}
                            {hasAccess("/admin/kpi") && (
                                <Link
                                    href="/admin/kpi"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/kpi") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><ChartBarIcon width={20} /></span>ประเมิน KPI
                                </Link>
                            )}

                            {/* ✅ Birthday Claims */}
                            {hasAccess("/admin/birthday-claims") && (
                                <Link
                                    href="/admin/birthday-claims"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/birthday-claims") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><GiftIcon width={20} /></span>สวัสดิการวันเกิด
                                </Link>
                            )}

                            {/* ✅ General Welfare Claims */}
                            {hasAccess("/admin/welfare") && (
                                <Link
                                    href="/admin/welfare"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/welfare") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><BanknotesIcon width={20} /></span>สวัสดิการและเงินช่วยเหลือ
                                </Link>
                            )}

                            {/* ✅ Travel & Off-Site Claims */}
                            {hasAccess("/admin/travel-claims") && (
                                <Link
                                    href="/admin/travel-claims"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/travel-claims") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><TruckIcon width={20} /></span>ค่าเดินทาง / ที่พัก
                                </Link>
                            )}

                            {/* ✅ Commission Claims */}
                            {hasAccess("/admin/commission-claims") && (
                                <Link
                                    href="/admin/commission-claims"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/commission-claims") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><BanknotesIcon width={20} /></span>ค่าคอมมิชชั่น
                                </Link>
                            )}

                            {/* ✅ Equipment Management */}
                            {hasAccess("/admin/assets") && (
                                <Link
                                    href="/admin/assets?type=equipment"
                                    className={`${styles.navItem} ${pathname === "/admin/assets" && searchParams.get("type") === "equipment" ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><CubeIcon width={20} /></span>ยืมอุปกรณ์ (Equipment)
                                </Link>
                            )}

                            {/* ✅ Item/Inventory Management */}
                            {hasAccess("/admin/assets") && (
                                <Link
                                    href="/admin/assets?type=item"
                                    className={`${styles.navItem} ${pathname === "/admin/assets" && searchParams.get("type") === "item" ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><ClipboardDocumentListIcon width={20} /></span>ยืมสินค้า (Borrow Item)
                                </Link>
                            )}

                            {/* ✅ Clothing/Uniform Management */}
                            {hasAccess("/admin/clothing") && (
                                <Link
                                    href="/admin/clothing"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/clothing") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><ArchiveBoxIcon width={20} /></span>ชุดยูนิฟอร์ม (Clothing)
                                </Link>
                            )}

                            {hasAccess("/admin/cars") && (
                                <Link
                                    href="/admin/cars"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/cars") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><TruckIcon width={20} /></span>ระบบพาหนะ (Cars)
                                </Link>
                            )}

                            {/* ✅ Vehicle Reports (Grouped for Warehouse Manager) */}
                            {admin?.role?.toUpperCase() === "WAREHOUSE_MANAGER" && (
                                <Link
                                    href="/admin/reports/vehicles"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/reports/vehicles") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><PresentationChartLineIcon width={20} /></span>รายงานยานพาหนะ
                                </Link>
                            )}


                            {/* ✅ Meeting Room Management */}
                            {hasAccess("/admin/meeting-rooms") && (
                                <Link
                                    href="/admin/meeting-rooms"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/meeting-rooms") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><BuildingOfficeIcon width={20} /></span>ระบบห้องประชุม
                                </Link>
                            )}

                            {/* ✅ Training & Development */}
                            {hasAccess("/admin/employees") && (
                                <Link
                                    href="/admin/trainings"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/trainings") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><AcademicCapIcon width={20} /></span>การฝึกอบรม
                                </Link>
                            )}

                            {/* ✅ Holiday -> link to /admin/holiday */}
                            {hasAccess("/admin/holiday") && (
                                <Link
                                    href="/admin/holiday"
                                    className={`${styles.navItem} ${isHolidayActive ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><CalendarIcon width={20} /></span>วันหยุด
                                </Link>
                            )}

                            {hasAccess("/admin/payroll") && <div className={styles.navSection}>รายงาน</div>}

                            {/* ✅ Payroll / OT menu */}
                            {hasAccess("/admin/payroll") && (
                                <Link
                                    href="/admin/payroll"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/payroll") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><BanknotesIcon width={20} /></span>ระบบเงินเดือน
                                </Link>
                            )}
                            {/* ✅ Historical Records */}
                            {hasAccess("/admin/records") && (
                                <Link
                                    href="/admin/records"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/records") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><PresentationChartLineIcon width={20} /></span>สถิติย้อนหลัง
                                </Link>
                            )}

                            {/* ✅ HR Coin System */}
                            {hasAccess("/admin/rewards") && <div className={styles.navSection}>ระบบเหรียญรางวัล</div>}

                            {hasAccess("/admin/rewards") && (
                                <Link
                                    href="/admin/rewards"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/rewards") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><GiftIcon width={20} /></span>จัดการของรางวัล
                                </Link>
                            )}

                            {hasAccess("/admin/redemptions") && (
                                <Link
                                    href="/admin/redemptions"
                                    className={`${styles.navItem} ${pathname.startsWith("/admin/redemptions") ? styles.active : ""}`}
                                >
                                    <span className={styles.navIcon}><ClipboardDocumentListIcon width={20} /></span>อนุมัติการแลกของ
                                </Link>
                            )}




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