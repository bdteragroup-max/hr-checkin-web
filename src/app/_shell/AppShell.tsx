"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import styles from "./layout.module.css";
import FloatingTicketButton from "@/components/tickets/FloatingTicketButton";
import FloatingRepairButton from "@/components/tickets/FloatingRepairButton";
import {
    ClockIcon,
    BuildingOfficeIcon,
    ClipboardDocumentListIcon,
    TruckIcon,
    FireIcon,
    CakeIcon,
    LockClosedIcon,
    ClipboardDocumentCheckIcon,
    UserGroupIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CalendarDaysIcon,
    GlobeAltIcon,
    MapPinIcon,
    CubeIcon,
    DocumentTextIcon,
    BuildingOffice2Icon,
    PresentationChartLineIcon,
    BanknotesIcon,
    SparklesIcon,
    GiftIcon
} from "@heroicons/react/24/outline";

const NAV_MAIN_BASE = [
    { id: "checkin", href: "/app", icon: ClockIcon, label: "เช็คอิน", sub: "Check-in" },
    { id: "directory", href: "/directory", icon: UserGroupIcon, label: "รายชื่อพนักงาน", sub: "Directory" },
    { id: "project-checkin", href: "/project-checkin", icon: BuildingOfficeIcon, label: "เช็คอินโครงการ", sub: "Project Check-in", isProject: true },
    { id: "offsite-checkin", href: "/offsite-checkin", icon: GlobeAltIcon, label: "เช็คอินนอกสถานที่", sub: "Offsite Check-in" },
    { id: "trip-log", href: "/trip-log", icon: MapPinIcon, label: "เดินทางต่างจังหวัด", sub: "Trip Mode" },
    { id: "leave", href: "/leave", icon: ClipboardDocumentListIcon, label: "ลางาน", sub: "Leave" },
    { id: "travel", href: "/travel-allowance", icon: TruckIcon, label: "เบี้ยเลี้ยง", sub: "Travel" },
    { id: "ot", href: "/ot-request", icon: FireIcon, label: "ขอ OT", sub: "OT Request" },
    { id: "car-borrow", href: "/car-borrow", icon: TruckIcon, label: "จองรถยนต์", sub: "Car Booking" },
    { id: "equipment", href: "/assets/borrow?type=equipment", icon: CubeIcon, label: "ยืมอุปกรณ์", sub: "Borrow Equipment" },
    { id: "items", href: "/assets/borrow?type=item", icon: ClipboardDocumentListIcon, label: "ยืมสินค้า/สิ่งของ", sub: "Borrow Item" },
    { id: "payslip", href: "/payslip", icon: DocumentTextIcon, label: "สลิปเงินเดือน", sub: "My Payslips" },
    { id: "meeting-rooms", href: "/meeting-rooms", icon: BuildingOffice2Icon, label: "จองห้องประชุม", sub: "Meeting Rooms" },
    { id: "my-tasks", href: "/my-tasks", icon: ClipboardDocumentCheckIcon, label: "งานของฉัน", sub: "My Tasks" },
    { id: "kpi", href: "/kpi", icon: PresentationChartLineIcon, label: "KPI ของฉัน", sub: "My KPIs" },
    { id: "commission", href: "/commission-claims", icon: BanknotesIcon, label: "เบิกค่าคอม", sub: "Commission" },
    { id: "welfare", href: "/welfare", icon: BanknotesIcon, label: "สวัสดิการและเงินช่วยเหลือ", sub: "Welfare" },
    { id: "clothing", href: "/clothing", icon: CubeIcon, label: "เบิกชุดยูนิฟอร์ม", sub: "Request Uniform" },
    { id: "coins", href: "/coins", icon: SparklesIcon, label: "คลังเหรียญ", sub: "My Coins" },
    { id: "rewards", href: "/rewards", icon: GiftIcon, label: "แลกของรางวัล", sub: "Redeem Rewards" },
    { id: "birthday", href: "/birthday-benefit", icon: CakeIcon, label: "รางวัลวันเกิด", sub: "Birthday" },
    { id: "tickets", href: "/tickets", icon: ClipboardDocumentListIcon, label: "ติดตามปัญหา", sub: "Reported Issues" },
    { id: "training-history", href: "/training-history", icon: ClipboardDocumentCheckIcon, label: "ประวัติการอบรม", sub: "Training History" },
];

const NAV_BOTTOM = [{ href: "/api/auth/logout", icon: LockClosedIcon, label: "ออกจากระบบ", sub: "Logout" }];

export default function AppShell({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [isSupervisor, setIsSupervisor] = useState(false);
    const [baseSalary, setBaseSalary] = useState(0);
    const [hasPayslip, setHasPayslip] = useState(false);
    const [birthMonth, setBirthMonth] = useState<number | null>(null);
    const [kpiStats, setKpiStats] = useState({ myKpiAlerts: 0, teamKpiAlerts: 0, teamProbationAlerts: 0 });
    const pathname = usePathname();

    useEffect(() => {
        if (pathname === "/" || pathname?.startsWith("/admin") || pathname === "/reset-pin") return;
        fetch("/api/me")
            .then(r => r.json())
            .then(d => {
                setIsSupervisor(!!d?.is_supervisor);
                setBaseSalary(Number(d?.base_salary) || 0);
                setHasPayslip(!!d?.has_published_payslips);
                if (d?.birth_date) {
                    const bDate = new Date(d.birth_date);
                    setBirthMonth(bDate.getMonth());
                }
            })
            .catch(() => { });

        // Fetch KPI stats
        fetch("/api/kpi/stats")
            .then(r => r.json())
            .then(d => {
                if (d.ok) {
                    setKpiStats({
                        myKpiAlerts: d.myKpiAlerts || 0,
                        teamKpiAlerts: d.teamKpiAlerts || 0,
                        teamProbationAlerts: d.teamProbationAlerts || 0
                    });
                }
            })
            .catch(() => { });
    }, [pathname]);

    const navMain = NAV_MAIN_BASE.filter(item => {
        // Hide OT for salary > 20000
        if (item.id === "ot" && baseSalary > 20000) return false;

        // Hide Payslip if no published payslips
        if (item.id === "payslip" && !hasPayslip) return false;

        // Hide Birthday if not birth month
        if (item.id === "birthday") {
            if (birthMonth === null) return false; // Hide until loaded
            const currentMonth = new Date().getMonth();
            if (birthMonth !== currentMonth) return false;
        }

        return true;
    });

    if (isSupervisor) {
        navMain.push({ id: "team-leaves", href: "/team-leaves", icon: ClipboardDocumentCheckIcon, label: "อนุมัติลา", sub: "Team Leaves" });
        navMain.push({ id: "team-ot", href: "/team-ot", icon: CalendarDaysIcon, label: "อนุมัติ OT", sub: "Team OT" });
        navMain.push({ id: "team-travel", href: "/team/travel-claims", icon: UserGroupIcon, label: "อนุมัติเบี้ยเลี้ยงทีม", sub: "Team Travel" });
        navMain.push({ id: "team-commission", href: "/team/commission-claims", icon: BanknotesIcon, label: "อนุมัติค่าคอมทีม", sub: "Team Commission" });
        navMain.push({ id: "team-probation", href: "/team/probation", icon: ClipboardDocumentListIcon, label: "ประเมินพนักงาน", sub: "Assessment" });
        navMain.push({ id: "team-kpi", href: "/team/kpi", icon: PresentationChartLineIcon, label: "จัดการ KPI ทีม", sub: "KPI Management" });
        navMain.push({ id: "team-welfare", href: "/team/welfare", icon: BanknotesIcon, label: "อนุมัติสวัสดิการทีม", sub: "Team Welfare" });
        navMain.push({ id: "team-tasks", href: "/team/tasks", icon: ClipboardDocumentListIcon, label: "จัดการ Task ทีม", sub: "Team Tasks" });
        navMain.push({ id: "team-records", href: "/team/records", icon: ClipboardDocumentListIcon, label: "ประวัติการเช็คอินทีม", sub: "Team Records" });
    }

    // NOTE: Do not show Sidebar on Login or Admin pages
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
                        <Image src="/icon.jpg" width={28} height={28} alt="Logo" className={styles.logoImage} />
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
                            <div key={item.href}>
                                <Link
                                    href={item.href}
                                    data-label={item.label}
                                    className={`${styles.navItem} ${active ? styles.navActive : ""}`}
                                    style={{ animationDelay: `${i * 0.05}s` }}
                                >
                                    {active && <span className={styles.activeBg} />}
                                    <span className={styles.navIcon}><item.icon width={22} /></span>
                                    <span className={styles.navText}>
                                        <span className={styles.navLabel}>{item.label}</span>
                                        <span className={styles.navSub}>{item.sub}</span>
                                    </span>
                                    {item.id === "kpi" && kpiStats.myKpiAlerts > 0 && (
                                        <span className={styles.alertBadge}>{kpiStats.myKpiAlerts}</span>
                                    )}
                                    {item.id === "team-kpi" && kpiStats.teamKpiAlerts > 0 && (
                                        <span className={styles.alertBadge}>{kpiStats.teamKpiAlerts}</span>
                                    )}
                                    {item.id === "team-probation" && kpiStats.teamProbationAlerts > 0 && (
                                        <span className={styles.alertBadge}>{kpiStats.teamProbationAlerts}</span>
                                    )}
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
                            <a
                                key={item.href}
                                href={item.href}
                                data-label={item.label}
                                className={`${styles.navItem} ${active ? styles.navActive : ""}`}
                            >
                                {active && <span className={styles.activeBg} />}
                                <span className={styles.navIcon}><item.icon width={22} /></span>
                                <span className={styles.navText}>
                                    <span className={styles.navLabel}>{item.label}</span>
                                    <span className={styles.navSub}>{item.sub}</span>
                                </span>
                            </a>
                        );
                    })}
                </div>

                <button
                    className={styles.collapseBtn}
                    onClick={() => setCollapsed((c) => !c)}
                    aria-label="Toggle sidebar"
                >
                    <span className={styles.collapseBtnIcon}>{collapsed ? <ChevronRightIcon width={20} /> : <ChevronLeftIcon width={20} />}</span>
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
                            <span className={styles.mobileIcon}>
                                <item.icon width={24} />
                                {item.id === "kpi" && kpiStats.myKpiAlerts > 0 && (
                                    <span className={styles.mobileAlertBadge}>{kpiStats.myKpiAlerts}</span>
                                )}
                                {item.id === "team-kpi" && kpiStats.teamKpiAlerts > 0 && (
                                    <span className={styles.mobileAlertBadge}>{kpiStats.teamKpiAlerts}</span>
                                )}
                                {item.id === "team-probation" && kpiStats.teamProbationAlerts > 0 && (
                                    <span className={styles.mobileAlertBadge}>{kpiStats.teamProbationAlerts}</span>
                                )}
                            </span>
                            <span className={styles.mobileLabel}>{item.label}</span>
                        </Link>
                    );
                })}
                {/* Mobile Logout functionality */}
                <a href="/api/auth/logout" className={styles.mobileItem} style={{ color: 'var(--red)' }}>
                    <span className={styles.mobileIcon}><LockClosedIcon width={24} /></span>
                    <span className={styles.mobileLabel}>Logout</span>
                </a>
            </nav>

            {/* Floating Ticket Button */}
            <FloatingTicketButton />
            <FloatingRepairButton />
        </div>
    );
}
