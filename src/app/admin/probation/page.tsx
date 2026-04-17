"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { 
    DocumentArrowDownIcon, 
    PaperAirplaneIcon,
    CheckCircleIcon,
    MagnifyingGlassIcon,
    DocumentCheckIcon,
    ArrowPathIcon,
    UserIcon
} from "@heroicons/react/24/outline";

export default function AdminProbationPage() {
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sendingId, setSendingId] = useState<number | null>(null);

    const refresh = () => {
        setLoading(true);
        fetch("/api/admin/probation/evaluations")
            .then(r => r.json())
            .then(data => {
                if (data.ok) setList(data.list);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refresh();
    }, []);

    const filtered = list.filter(item => 
        item.employee.name.toLowerCase().includes(search.toLowerCase()) ||
        item.employee.emp_id.toLowerCase().includes(search.toLowerCase())
    );

    async function sendToManagement(id: number) {
        if (!confirm("ต้องการส่งสรุปผลการประเมินนี้ไปยัง LINE ฝ่ายบริหารใช่หรือไม่?")) return;
        setSendingId(id);
        try {
            const res = await fetch(`/api/admin/probation/evaluations/${id}/send-summary`, { method: "POST" });
            if (res.ok) {
                alert("ส่งเรียบร้อยแล้ว");
                refresh();
            } else {
                alert("เกิดข้อผิดพลาดในการส่ง");
            }
        } catch (e) {
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setSendingId(null);
        }
    }

    const decisionMap: any = {
        pass: { label: "ผ่านทดลองงาน", color: "#16a34a" },
        fail: { label: "ไม่ผ่านทดลองงาน", color: "#dc2626" },
        extend: { label: "ขยายเวลา", color: "#d97706" },
        salary_adjust: { label: "ปรับเงินเดือน", color: "#2563eb" }
    };

    return (
        <div className={styles.wrap}>
            {/* ── HEADER ── */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>ประเมินผลพนักงานทดลองงาน</h1>
                    <div className={styles.subtitle}>รายการประเมินทั้งหมดที่หัวหน้างานส่งเข้ามาเพื่อขออนุมัติ</div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.btnRefresh} onClick={refresh} disabled={loading}>
                        <ArrowPathIcon width={16} className={loading ? "animate-spin" : ""} /> รีเฟรช
                    </button>
                </div>
            </div>

            {/* ── CONTENT CARD ── */}
            <div className={styles.card}>
                <div className={styles.cardTopAccent} />
                
                {/* Table Top Bar */}
                <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderTitle}>
                        <DocumentCheckIcon width={20} /> รายการส่งประเมิน
                    </div>
                    <div>
                        <span className={styles.rowCount}>{list.length} ทั้งหมด</span>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className={styles.filterBar}>
                    <div className={styles.searchWrap}>
                        <MagnifyingGlassIcon width={18} className={styles.searchIcon} />
                        <input 
                            className={styles.searchInput}
                            placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>พนักงาน</th>
                                <th>ผู้ประเมิน</th>
                                <th>ครั้งที่</th>
                                <th>ช่วงวันที่ประเมิน</th>
                                <th>คะแนน / เกรด</th>
                                <th>ผลสรุป</th>
                                <th>สถานะ LINE</th>
                                <th style={{ textAlign: "right" }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className={styles.tdLoading}>
                                        <div className={styles.spinner} style={{ marginRight: 8 }} />
                                        กำลังโหลดข้อมูล...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className={styles.tdEmpty}>ไม่พบรายการที่ตรงกับเงื่อนไข</td>
                                </tr>
                            ) : filtered.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <UserIcon width={18} />
                                            </div>
                                            <div className={styles.empInfo}>
                                                <div className={styles.empName}>{item.employee.name}</div>
                                                <div className={styles.empId}>{item.employee.emp_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.supervisorName}>{item.supervisor.name}</div>
                                    </td>
                                    <td>
                                        <span className={styles.evalNo}>{item.evaluation_no}</span>
                                    </td>
                                    <td>
                                        <div className={styles.period}>
                                            {new Date(item.period_start).toLocaleDateString("th-TH")}
                                            <span style={{ margin: '0 4px', color: '#cbd5e1' }}>—</span>
                                            {new Date(item.period_end).toLocaleDateString("th-TH")}
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.scoreRow}>
                                            <span className={styles.scoreVal}>{item.total_score}</span>
                                            <span className={styles.gradeVal}>{item.grade}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span 
                                            className={styles.badge} 
                                            style={{ 
                                                background: (decisionMap[item.decision]?.color || "#94a3b8") + "15", 
                                                color: decisionMap[item.decision]?.color || "#94a3b8" 
                                            }}
                                        >
                                            {decisionMap[item.decision]?.label || item.decision}
                                        </span>
                                    </td>
                                    <td>
                                        {item.is_sent_to_management ? (
                                            <span className={styles.sentStatus}><CheckCircleIcon width={14} /> ส่งแล้ว</span>
                                        ) : (
                                            <span className={styles.pendingStatus}>ยังไม่ส่ง</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        <div className={styles.actions}>
                                            <a 
                                                href={`/api/admin/probation/evaluations/${item.id}/pdf`}
                                                className={styles.btnAction}
                                                style={{ color: '#0369a1' }}
                                                title="ดาวน์โหลด PDF"
                                                target="_blank"
                                            >
                                                <DocumentArrowDownIcon width={18} />
                                            </a>
                                            <button 
                                                className={styles.btnAction}
                                                title="ส่งให้ LINE ฝ่ายบริหาร"
                                                style={{ color: '#D93025' }}
                                                onClick={() => sendToManagement(item.id)}
                                                disabled={sendingId === item.id}
                                            >
                                                {sendingId === item.id ? (
                                                    <div className={styles.spinner} style={{ width: 14, height: 14 }} />
                                                ) : (
                                                    <PaperAirplaneIcon width={18} />
                                                )}
                                            </button>
                                        </div>
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
