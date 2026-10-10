"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import styles from "./page.module.css";
import {
    TableCellsIcon,
    ArrowDownTrayIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    UserGroupIcon,
    BanknotesIcon,
    SparklesIcon,
    ChevronLeftIcon,
    CheckIcon,
    MinusIcon,
    XMarkIcon,
    BriefcaseIcon,
    BuildingOffice2Icon
} from "@heroicons/react/24/outline";

type MonthlyPayrollItem = {
    emp_id: string;
    name: string;
    position: string;
    department: string;
    education: string;
    level: string;
    hire_date_thai: string;
    work_ages: string;
    base_salary: number;
    housing_allowance: number;
    meal_allowance: number;
    travel_allowance: number;
    phone_allowance: number;
    position_allowance: number;
    per_diem_allowance: number;
    has_commission: boolean;
    total_income: number;
};

export default function MonthlyPayrollSummaryPage() {
    const [company, setCompany] = useState<string>("TG");
    const [search, setSearch] = useState<string>("");
    const [levelFilter, setLevelFilter] = useState<"ALL" | "Manager" | "Staff">("ALL");
    const [isDownloading, setIsDownloading] = useState<boolean>(false);

    // Fetch live summary data with caching
    const { data, isLoading, refetch, isFetching } = useQuery<{
        ok: boolean;
        company: string;
        count: number;
        data: MonthlyPayrollItem[];
    }>({
        queryKey: ["monthly-payroll-summary", company],
        queryFn: async () => {
            const res = await fetch(`/api/admin/payroll/monthly-summary?company=${company}&format=json`);
            if (!res.ok) throw new Error("Failed to load payroll summary");
            return res.json();
        }
    });

    const items = useMemo(() => data?.data || [], [data]);

    // Force refresh from HumanSoft Open API
    const handleForceRefresh = async () => {
        try {
            await fetch(`/api/admin/payroll/monthly-summary?company=${company}&format=json&refresh=true`);
            refetch();
        } catch (err) {
            console.error(err);
            refetch();
        }
    };

    // Filter items by search & level
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (levelFilter !== "ALL" && item.level !== levelFilter) {
                return false;
            }
            if (!search.trim()) return true;
            const q = search.toLowerCase().trim();
            return (
                item.emp_id.toLowerCase().includes(q) ||
                item.name.toLowerCase().includes(q) ||
                item.position.toLowerCase().includes(q) ||
                item.department.toLowerCase().includes(q)
            );
        });
    }, [items, search, levelFilter]);

    // Summary Statistics
    const stats = useMemo(() => {
        const totalEmployees = items.length;
        const managers = items.filter(i => i.level === "Manager").length;
        const staff = items.filter(i => i.level !== "Manager").length;
        const totalBase = items.reduce((acc, curr) => acc + (curr.base_salary || 0), 0);
        const totalAllowances = items.reduce(
            (acc, curr) =>
                acc +
                curr.housing_allowance +
                curr.meal_allowance +
                curr.travel_allowance +
                curr.phone_allowance +
                curr.position_allowance +
                curr.per_diem_allowance,
            0
        );
        const totalIncome = items.reduce((acc, curr) => acc + (curr.total_income || 0), 0);
        const avgBase = totalEmployees > 0 ? totalBase / totalEmployees : 0;

        return { totalEmployees, managers, staff, totalBase, totalAllowances, totalIncome, avgBase };
    }, [items]);

    // Column Totals for Table Footer
    const totals = useMemo(() => {
        return filteredItems.reduce(
            (acc, item) => ({
                base: acc.base + item.base_salary,
                housing: acc.housing + item.housing_allowance,
                meal: acc.meal + item.meal_allowance,
                travel: acc.travel + item.travel_allowance,
                phone: acc.phone + item.phone_allowance,
                position: acc.position + item.position_allowance,
                perDiem: acc.perDiem + item.per_diem_allowance,
                total: acc.total + item.total_income
            }),
            { base: 0, housing: 0, meal: 0, travel: 0, phone: 0, position: 0, perDiem: 0, total: 0 }
        );
    }, [filteredItems]);

    // Download Excel Handler
    const handleDownloadExcel = async () => {
        try {
            setIsDownloading(true);
            const res = await fetch(`/api/admin/payroll/monthly-summary?company=${company}&format=excel`);
            if (!res.ok) throw new Error("Excel download failed");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Monthly_Payroll_${company}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e: any) {
            console.error(e);
            alert("ไม่สามารถดาวน์โหลดไฟล์ Excel ได้ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsDownloading(false);
        }
    };

    const formatNum = (n: number) => {
        if (!n || n === 0) return "-";
        return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className={styles.container}>
            {/* Symmetrical Hero Header Card */}
            <div className={styles.headerCard}>
                <div className={styles.headerTop}>
                    <div className={styles.breadcrumb}>
                        <Link href="/admin/payroll" className={styles.breadcrumbLink}>
                            <ChevronLeftIcon width={14} height={14} />
                            <span>กลับหน้าระบบเงินเดือน</span>
                        </Link>
                        <span className={styles.breadcrumbSep}>/</span>
                        <span className={styles.breadcrumbCurrent}>สรุปโครงสร้างรายเดือน (HumanSoft)</span>
                    </div>

                    <div className={styles.apiBadge}>
                        <span className={styles.apiDot}></span>
                        <span>HumanSoft Open API Live</span>
                    </div>
                </div>

                <div className={styles.headerMain}>
                    <div className={styles.titleGroup}>
                        <div className={styles.titleIconBox}>
                            <TableCellsIcon width={26} height={26} strokeWidth={2} />
                        </div>
                        <div className={styles.titleContent}>
                            <h1 className={styles.title}>สรุปโครงสร้างเงินเดือนและสวัสดิการรายเดือน</h1>
                            <p className={styles.subtitle}>
                                รายงานสรุปรายได้ ฐานเงินเดือนจริง และสวัสดิการค่าครองชีพ เชื่อมโยงข้อมูลสดจากระบบ HumanSoft
                            </p>
                        </div>
                    </div>

                    <div className={styles.headerActions}>
                        {/* Symmetrical Company Selector */}
                        <div className={styles.companyTabs}>
                            {(["TG", "TP", "TE"] as const).map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    className={`${styles.companyTab} ${company === c ? styles.companyTabActive : ""}`}
                                    onClick={() => setCompany(c)}
                                >
                                    {c === "TG" ? "เทอรา กรุ้ป (TG)" : c === "TP" ? "เทอรา พาวเวอร์ (TP)" : "เทอรา เอ็นจิเนียริ่ง (TE)"}
                                </button>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className={styles.btnGroup}>
                            <button
                                type="button"
                                className={styles.btnRefresh}
                                onClick={handleForceRefresh}
                                disabled={isFetching}
                                title="ดึงข้อมูลล่าสุดจาก HumanSoft API"
                            >
                                <ArrowPathIcon width={15} height={15} className={isFetching ? "animate-spin" : ""} />
                                <span>{isFetching ? "กำลังดึงข้อมูล..." : "รีเฟรช API"}</span>
                            </button>

                            <button
                                type="button"
                                className={styles.btnDownload}
                                onClick={handleDownloadExcel}
                                disabled={isDownloading || isLoading}
                                title="ส่งออกไฟล์ Excel ตาม Template สรุปเงินเดือน"
                            >
                                <ArrowDownTrayIcon width={16} height={16} />
                                <span>{isDownloading ? "กำลังสร้างไฟล์..." : "ดาวน์โหลด Excel"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Symmetrical 4-Card Statistics Grid */}
            <div className={styles.statsGrid}>
                {/* Card 1: Total Employees */}
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>
                            พนักงานทั้งหมด ({company})
                        </span>
                        <div className={`${styles.statIconBox} ${styles.statIconBoxRed}`}>
                            <UserGroupIcon width={18} height={18} />
                        </div>
                    </div>
                    <div className={styles.statValue}>
                        {stats.totalEmployees} <span className={styles.statUnit}>คน</span>
                    </div>
                    <div className={styles.statFooter}>
                        <span>กำลังพลที่ปฏิบัติงานอยู่ในระบบปัจจุบัน</span>
                    </div>
                </div>

                {/* Card 2: Position Levels */}
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>
                            สัดส่วนระดับตำแหน่ง
                        </span>
                        <div className={styles.statIconBox}>
                            <SparklesIcon width={18} height={18} />
                        </div>
                    </div>
                    <div className={styles.statBadgeRow}>
                        <span className={styles.statBadgeDark}>
                            <BriefcaseIcon width={13} height={13} />
                            <span>Manager {stats.managers}</span>
                        </span>
                        <span className={styles.statBadgeLight}>
                            <span>Staff {stats.staff}</span>
                        </span>
                    </div>
                    <div className={styles.statFooter}>
                        <span>ผู้บริหาร {stats.managers} คน / พนักงานทั่วไป {stats.staff} คน</span>
                    </div>
                </div>

                {/* Card 3: Total Base Salary */}
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>
                            ฐานเงินเดือนรวม
                        </span>
                        <div className={styles.statIconBox}>
                            <BanknotesIcon width={18} height={18} />
                        </div>
                    </div>
                    <div className={styles.statValue}>
                        ฿{stats.totalBase.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={styles.statFooter}>
                        <span>เฉลี่ย ฿{stats.avgBase.toLocaleString("en-US", { maximumFractionDigits: 0 })} / คน</span>
                    </div>
                </div>

                {/* Card 4: Total Overall Income (Highlighted) */}
                <div className={`${styles.statCard} ${styles.statCardHighlight}`}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>
                            รายได้รวมทั้งสิ้น ({company})
                        </span>
                        <div className={`${styles.statIconBox} ${styles.statIconBoxRed}`}>
                            <BuildingOffice2Icon width={18} height={18} />
                        </div>
                    </div>
                    <div className={`${styles.statValue} ${styles.statValueRed}`}>
                        ฿{stats.totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={styles.statFooter}>
                        <span>รวมฐานเงินเดือนและสวัสดิการทุกรายการ</span>
                    </div>
                </div>
            </div>

            {/* Symmetrical Toolbar (Search & Filter) */}
            <div className={styles.toolbarCard}>
                <div className={styles.searchBox}>
                    <MagnifyingGlassIcon width={16} height={16} className={styles.searchIcon} />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="ค้นหาด้วย รหัสพนักงาน, ชื่อ-นามสกุล, ตำแหน่ง, ฝ่าย..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            type="button"
                            className={styles.searchClearBtn}
                            onClick={() => setSearch("")}
                            title="ล้างข้อความค้นหา"
                        >
                            <XMarkIcon width={15} height={15} />
                        </button>
                    )}
                </div>

                <div className={styles.filterControls}>
                    {/* Level Filter Segment */}
                    <div className={styles.levelFilterGroup}>
                        <button
                            type="button"
                            className={`${styles.levelFilterBtn} ${levelFilter === "ALL" ? styles.levelFilterBtnActive : ""}`}
                            onClick={() => setLevelFilter("ALL")}
                        >
                            ทั้งหมด ({items.length})
                        </button>
                        <button
                            type="button"
                            className={`${styles.levelFilterBtn} ${levelFilter === "Manager" ? styles.levelFilterBtnActive : ""}`}
                            onClick={() => setLevelFilter("Manager")}
                        >
                            Manager ({stats.managers})
                        </button>
                        <button
                            type="button"
                            className={`${styles.levelFilterBtn} ${levelFilter === "Staff" ? styles.levelFilterBtnActive : ""}`}
                            onClick={() => setLevelFilter("Staff")}
                        >
                            Staff ({stats.staff})
                        </button>
                    </div>

                    <div className={styles.countChip}>
                        แสดง <span className={styles.countHighlight}>{filteredItems.length}</span> จาก {items.length} รายการ
                    </div>
                </div>
            </div>

            {/* Executive Data Table in Red / White / Gray */}
            <div className={styles.tableContainer}>
                {isLoading ? (
                    <div className={styles.stateBox}>
                        <ArrowPathIcon className={styles.spinner} />
                        <h3 className={styles.stateTitle}>กำลังดึงข้อมูลจาก HumanSoft Open API...</h3>
                        <p className={styles.stateSubtitle}>กรุณารอสักครู่ ระบบกำลังประมวลผลโครงสร้างเงินเดือนและสวัสดิการของบริษัท {company}</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className={styles.stateBox}>
                        <UserGroupIcon width={40} height={40} color="#94a3b8" />
                        <h3 className={styles.stateTitle}>ไม่พบข้อมูลพนักงาน</h3>
                        <p className={styles.stateSubtitle}>ไม่พบข้อมูลตามเงื่อนไขการค้นหาหรือตัวกรองที่เลือก</p>
                    </div>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>รหัสพนักงาน</th>
                                    <th>ชื่อ - นามสกุล</th>
                                    <th>ตำแหน่ง</th>
                                    <th>ฝ่าย</th>
                                    <th>วุฒิการศึกษา</th>
                                    <th>ระดับ</th>
                                    <th>วันที่เริ่มงาน</th>
                                    <th>อายุงาน</th>
                                    <th className={styles.thSalary}>ฐานเงินเดือน</th>
                                    <th>ค่าที่พัก</th>
                                    <th>ค่าอาหาร</th>
                                    <th>ค่าเดินทาง</th>
                                    <th>ค่าโทรศัพท์</th>
                                    <th>ค่าตำแหน่ง</th>
                                    <th>ค่าเบี้ยเลี้ยง</th>
                                    <th>ค่าคอม</th>
                                    <th className={styles.thTotal}>รายได้รวม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map(item => (
                                    <tr key={item.emp_id}>
                                        <td className={styles.textCenter}>
                                            <span className={styles.empIdPill}>{item.emp_id}</span>
                                        </td>
                                        <td className={styles.textLeft} style={{ fontWeight: 600 }}>
                                            {item.name}
                                        </td>
                                        <td className={styles.textLeft} style={{ color: "#475569" }}>
                                            {item.position}
                                        </td>
                                        <td className={styles.textLeft} style={{ color: "#475569" }}>
                                            {item.department}
                                        </td>
                                        <td className={styles.textCenter} style={{ color: "#64748b" }}>
                                            {item.education}
                                        </td>
                                        <td className={styles.textCenter}>
                                            <span className={item.level === "Manager" ? styles.badgeManager : styles.badgeStaff}>
                                                {item.level}
                                            </span>
                                        </td>
                                        <td className={styles.textCenter} style={{ color: "#64748b" }}>
                                            {item.hire_date_thai}
                                        </td>
                                        <td className={styles.textCenter} style={{ color: "#64748b" }}>
                                            {item.work_ages}
                                        </td>
                                        <td className={`${styles.textRight} ${styles.tdSalary}`}>
                                            {formatNum(item.base_salary)}
                                        </td>
                                        <td className={styles.textRight}>{formatNum(item.housing_allowance)}</td>
                                        <td className={styles.textRight}>{formatNum(item.meal_allowance)}</td>
                                        <td className={styles.textRight}>{formatNum(item.travel_allowance)}</td>
                                        <td className={styles.textRight}>{formatNum(item.phone_allowance)}</td>
                                        <td className={styles.textRight}>{formatNum(item.position_allowance)}</td>
                                        <td className={styles.textRight}>{formatNum(item.per_diem_allowance)}</td>
                                        <td className={styles.textCenter}>
                                            {item.has_commission ? (
                                                <span className={styles.commissionYes} title="มีค่าคอมมิชชั่น">
                                                    <CheckIcon width={13} height={13} strokeWidth={2.5} />
                                                </span>
                                            ) : (
                                                <span className={styles.commissionNo} title="ไม่มีค่าคอมมิชชั่น">
                                                    <MinusIcon width={13} height={13} strokeWidth={2} />
                                                </span>
                                            )}
                                        </td>
                                        <td className={`${styles.textRight} ${styles.tdTotal}`}>
                                            {formatNum(item.total_income)}
                                        </td>
                                    </tr>
                                ))}

                                {/* Summary Total Row */}
                                <tr className={styles.totalRow}>
                                    <td colSpan={8} className={styles.textCenter}>
                                        รวมทั้งสิ้น ({filteredItems.length} คน)
                                    </td>
                                    <td className={`${styles.textRight} ${styles.tdSalary}`}>
                                        {formatNum(totals.base)}
                                    </td>
                                    <td className={styles.textRight}>{formatNum(totals.housing)}</td>
                                    <td className={styles.textRight}>{formatNum(totals.meal)}</td>
                                    <td className={styles.textRight}>{formatNum(totals.travel)}</td>
                                    <td className={styles.textRight}>{formatNum(totals.phone)}</td>
                                    <td className={styles.textRight}>{formatNum(totals.position)}</td>
                                    <td className={styles.textRight}>{formatNum(totals.perDiem)}</td>
                                    <td className={styles.textCenter}>-</td>
                                    <td className={`${styles.textRight} ${styles.tdTotal}`}>
                                        {formatNum(totals.total)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
