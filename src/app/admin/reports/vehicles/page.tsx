"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { 
    ArrowDownTrayIcon, 
    TruckIcon, 
    UserIcon, 
    ClockIcon, 
    ExclamationTriangleIcon,
    ChartBarIcon,
    ArrowPathIcon
} from "@heroicons/react/24/outline";

export default function VehicleReportPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    async function loadReport() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/reports/vehicles");
            const json = await res.json();
            if (json.ok) {
                setData(json.stats);
            }
        } catch (e) {
            console.error("Load report failed", e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadReport();
    }, []);

    if (loading) return (
        <div className={styles.container}>
            <div className={styles.loadingBox}>
                <div className={styles.spinner}></div>
                <p>กำลังรวบรวมข้อมูลรายงาน...</p>
            </div>
        </div>
    );

    if (!data || data.statusDistribution.total === 0) return (
        <div className={styles.container}>
            <div className={styles.emptyStateBox}>
                <TruckIcon width={64} color="#e2e8f0" />
                <h2>ไม่พบข้อมูลยานพาหนะ</h2>
                <p>ยังไม่มีการลงทะเบียนรถยนต์ในระบบ หรือไม่มีข้อมูลการยืมในช่วงนี้</p>
                <button className={styles.exportBtn} style={{ marginTop: 16 }} onClick={loadReport}>
                    <ArrowPathIcon width={18} /> ลองใหม่อีกครั้ง
                </button>
            </div>
        </div>
    );

    const { statusDistribution, topVehicles, topEmployees, borrowingsPerDay, recentBorrowings } = data;

    // Calculate max for chart scaling
    const maxDayCount = Math.max(...borrowingsPerDay.map((d: any) => d.count), 1);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>รายงานสรุปการใช้รถยนต์</h1>
                    <p className={styles.subtitle}>ข้อมูลย้อนหลัง 30 วัน และสถานะปัจจุบันของยานพาหนะทั้งหมด</p>
                </div>
                <button className={styles.exportBtn} onClick={() => window.print()}>
                    <ArrowDownTrayIcon width={18} /> พิมพ์รายงาน (PDF)
                </button>
            </div>

            {/* Status Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>พร้อมใช้งาน</span>
                    <span className={styles.statValue}>{statusDistribution.available}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>กำลังถูกยืม</span>
                    <span className={styles.statValue} style={{ color: "#ea580c" }}>{statusDistribution.borrowed}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>ชำรุด/ซ่อม</span>
                    <span className={styles.statValue} style={{ color: "#dc2626" }}>{statusDistribution.damaged + statusDistribution.maintenance}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>จำนวนรถทั้งหมด</span>
                    <span className={styles.statValue}>{statusDistribution.total}</span>
                </div>
            </div>

            {/* 30-Day Activity Chart */}
            <div className={styles.card} style={{ marginBottom: 32 }}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}><ChartBarIcon width={20} style={{ display: 'inline', marginRight: 8 }} /> ความถี่การใช้รถรายวัน (30 วันล่าสุด)</div>
                </div>
                <div className={styles.chartBarWrapper}>
                    {borrowingsPerDay.length === 0 ? (
                        <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8' }}>ไม่มีข้อมูลการใช้งาน</div>
                    ) : (
                        borrowingsPerDay.map((d: any, idx: number) => (
                            <div 
                                key={idx} 
                                className={styles.chartBar} 
                                style={{ height: `${(d.count / maxDayCount) * 100}%` }}
                                data-value={`${d.date}: ${d.count} ครั้ง`}
                            />
                        ))
                    )}
                </div>
            </div>

            <div className={styles.grid2Col}>
                {/* Top Vehicles Table */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}><TruckIcon width={20} style={{ display: 'inline', marginRight: 8 }} /> ยานพาหนะที่ใช้บ่อยที่สุด</div>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ทะเบียน / ชื่อรถ</th>
                                    <th style={{ textAlign: 'right' }}>จำนวนการใช้ (ครั้ง)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topVehicles.slice(0, 10).map((v: any, idx: number) => (
                                    <tr key={idx}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{v.id}</div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>{v.name}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{v.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Employees Table */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}><UserIcon width={20} style={{ display: 'inline', marginRight: 8 }} /> พนักงานที่ใช้รถบ่อยที่สุด</div>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ชื่อพนักงาน</th>
                                    <th style={{ textAlign: 'right' }}>จำนวนการใช้ (ครั้ง)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topEmployees.slice(0, 10).map((e: any, idx: number) => (
                                    <tr key={idx}>
                                        <td style={{ fontWeight: 600 }}>{e.name}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{e.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Recent Borrowings Log */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}><ClockIcon width={20} style={{ display: 'inline', marginRight: 8 }} /> ประวัติการยืมล่าสุด (50 รายการ)</div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>วันที่</th>
                                <th>พนักงาน</th>
                                <th>รถยนต์</th>
                                <th>ปลายทาง</th>
                                <th>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentBorrowings.map((b: any, idx: number) => (
                                <tr key={idx}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(b.borrow_date).toLocaleDateString('th-TH')}</td>
                                    <td style={{ fontWeight: 500 }}>{b.employee.name}</td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{b.assets.asset_id}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{b.assets.name}</div>
                                    </td>
                                    <td>{b.location || "—"}</td>
                                    <td>
                                        <span className={`${styles.badge} ${styles[b.status]}`}>
                                            {b.status === "borrowed" ? "กำลังยืม" : b.status === "returned" ? "คืนแล้ว" : "เกินกำหนด"}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
