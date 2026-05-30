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
    ArrowPathIcon,
    TableCellsIcon
} from "@heroicons/react/24/outline";

export default function VehicleReportPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    async function loadReport() {
        setLoading(true);
        try {
            const params = new URLSearchParams({ start: startDate, end: endDate });
            const res = await fetch(`/api/admin/reports/vehicles?${params.toString()}`);
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

    async function handleDelete() {
        if (!confirm(`⚠️ คำเตือน: คุณแน่ใจหรือไม่ที่จะลบข้อมูลการยืมรถทั้งหมดในช่วงวันที่ ${startDate} ถึง ${endDate}?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้!`)) return;

        try {
            const params = new URLSearchParams({ start: startDate, end: endDate });
            const res = await fetch(`/api/admin/reports/vehicles?${params.toString()}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) {
                alert(`ลบข้อมูลเรียบร้อยแล้ว (${json.deletedCount} รายการ)`);
                loadReport();
            } else {
                alert("เกิดข้อผิดพลาด: " + json.error);
            }
        } catch (e) {
            alert("Delete failed");
        }
    }

    async function handleTriggerSummary() {
        if (!confirm("ต้องการส่งสรุปสถานะรถยนต์ประจำวันไปยัง LINE Management หรือไม่?")) return;
        
        try {
            // Using the existing cron endpoint - requires secret
            const res = await fetch("/api/cron/vehicle-status-summary?secret=hr-checkin-secret-123");
            const json = await res.json();
            if (json.ok) {
                alert("ส่งรายงานสรุปเรียบร้อยแล้ว!");
            } else {
                alert("ไม่สามารถส่งรายงานได้: " + json.error);
            }
        } catch (e) {
            alert("Trigger summary failed");
        }
    }

    useEffect(() => {
        loadReport();
    }, []);

    const isFiltered = startDate !== "" || endDate !== "";

    if (loading) return (
        <div className={styles.container}>
            <div className={styles.loadingBox}>
                <div className={styles.spinner}></div>
                <p>กำลังรวบรวมข้อมูลรายงาน...</p>
            </div>
        </div>
    );

    const { statusDistribution, topVehicles, topEmployees, borrowingsPerDay, recentBorrowings } = data || { 
        statusDistribution: { available: 0, borrowed: 0, damaged: 0, maintenance: 0, total: 0 },
        topVehicles: [],
        topEmployees: [],
        borrowingsPerDay: [],
        recentBorrowings: []
    };

    // Calculate max for chart scaling
    const maxDayCount = Math.max(...borrowingsPerDay.map((d: any) => d.count), 1);

    async function exportToExcel() {
        if (!data) return;
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            
            // Sheet 1: Recent Borrowings
            const wsBorrowings = workbook.addWorksheet('ประวัติการยืม');
            wsBorrowings.columns = [
                { header: 'วันที่ยืม', key: 'date', width: 20 },
                { header: 'พนักงาน', key: 'employee', width: 25 },
                { header: 'ทะเบียนรถ', key: 'asset_id', width: 15 },
                { header: 'ชื่อรถ', key: 'asset_name', width: 25 },
                { header: 'ปลายทาง', key: 'location', width: 30 },
                { header: 'สถานะ', key: 'status', width: 15 }
            ];
            wsBorrowings.getRow(1).font = { bold: true };
            data.recentBorrowings.forEach((b: any) => {
                wsBorrowings.addRow({
                    date: new Date(b.borrow_date).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    employee: b.employee?.name || "-",
                    asset_id: b.assets?.asset_id || "-",
                    asset_name: b.assets?.name || "-",
                    location: b.location || "-",
                    status: b.status === "borrowed" ? "กำลังยืม" : b.status === "returned" ? "คืนแล้ว" : "เกินกำหนด"
                });
            });

            // Sheet 2: Top Vehicles
            const wsVehicles = workbook.addWorksheet('รถที่ใช้บ่อย');
            wsVehicles.columns = [
                { header: 'ทะเบียน', key: 'id', width: 15 },
                { header: 'ชื่อรถ', key: 'name', width: 25 },
                { header: 'จำนวนการใช้ (ครั้ง)', key: 'count', width: 20 }
            ];
            wsVehicles.getRow(1).font = { bold: true };
            data.topVehicles.forEach((v: any) => {
                wsVehicles.addRow(v);
            });

            // Sheet 3: Top Employees
            const wsEmployees = workbook.addWorksheet('พนักงานที่ใช้บ่อย');
            wsEmployees.columns = [
                { header: 'ชื่อพนักงาน', key: 'name', width: 25 },
                { header: 'จำนวนการใช้ (ครั้ง)', key: 'count', width: 20 }
            ];
            wsEmployees.getRow(1).font = { bold: true };
            data.topEmployees.forEach((e: any) => {
                wsEmployees.addRow(e);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `vehicles_report_${startDate}_to_${endDate}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
            alert("เกิดข้อผิดพลาดในการส่งออกไฟล์");
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>รายงานสรุปการใช้รถยนต์</h1>
                    <p className={styles.subtitle}>
                        {isFiltered ? `ข้อมูลระหว่างวันที่ ${startDate} ถึง ${endDate}` : "ข้อมูลย้อนหลัง 30 วัน และสถานะปัจจุบันของยานพาหนะทั้งหมด"}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className={styles.actionBtn} onClick={handleTriggerSummary}>
                        <ArrowPathIcon width={18} /> ส่งสรุปรายวัน (LINE)
                    </button>
                    <button className={styles.excelBtn} onClick={exportToExcel}>
                        <TableCellsIcon width={18} /> ส่งออก Excel
                    </button>
                    <button className={styles.exportBtn} onClick={() => window.print()}>
                        <ArrowDownTrayIcon width={18} /> พิมพ์รายงาน (PDF)
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>ตั้งแต่วันที่</label>
                    <input 
                        type="date" 
                        className={styles.dateInput} 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>ถึงวันที่</label>
                    <input 
                        type="date" 
                        className={styles.dateInput} 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                    />
                </div>
                <button className={styles.actionBtn} onClick={loadReport}>
                    ค้นหาข้อมูล
                </button>
                <div style={{ flex: 1 }}></div>
                <button className={`${styles.actionBtn} ${styles.danger}`} onClick={handleDelete}>
                    <ExclamationTriangleIcon width={18} /> ล้างข้อมูลช่วงนี้
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
