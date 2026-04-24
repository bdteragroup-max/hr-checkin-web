"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import { BanknotesIcon, PlusCircleIcon, ClockIcon, CheckCircleIcon, XCircleIcon, UserGroupIcon, IdentificationIcon, BuildingStorefrontIcon, CalendarDaysIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

type Employee = {
    emp_id: string;
    name: string;
};

type CommissionClaim = {
    id: string;
    date: string;
    customer_name: string;
    selling_price?: number;
    total_commission?: number;
    per_person_commission?: number;
    status: string;
    created_at: string;
};

export default function CommissionClaimsPage() {
    const [claims, setClaims] = useState<CommissionClaim[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [customerName, setCustomerName] = useState("");
    const [selectedCompanions, setSelectedCompanions] = useState<string[]>([]);
    const [companionSearch, setCompanionSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [claimsRes, empsRes] = await Promise.all([
                fetch("/api/commission-claims"),
                fetch("/api/employees")
            ]);
            const claimsData = await claimsRes.json();
            const empsData = await empsRes.json();

            if (claimsData.ok) setClaims(claimsData.list);
            setEmployees(empsData);
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !customerName) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");

        setSubmitting(true);
        try {
            const res = await fetch("/api/commission-claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date,
                    customer_name: customerName,
                    companion_ids: selectedCompanions
                })
            });
            const data = await res.json();
            if (data.ok) {
                alert("ส่งคำขอเรียบร้อยแล้ว");
                setCustomerName("");
                setSelectedCompanions([]);
                fetchData();
            } else {
                alert("เกิดข้อผิดพลาด: " + data.error);
            }
        } catch (error) {
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleCompanion = (id: string) => {
        setSelectedCompanions(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "pending_supervisor": return "รอหัวหน้าอนุมัติ";
            case "pending_admin": return "รอ HR อนุมัติ";
            case "completed": return "อนุมัติแล้ว";
            case "rejected": return "ไม่อนุมัติ";
            default: return status;
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* ── HERO TITLE ── */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>เบิกค่าคอมมิชชั่น</h1>
                    <div className={styles.heroMeta}>

                    </div>
                </div>

                {/* Submission Form */}
                <section className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span>ส่งคำขอใหม่ / NEW CLAIM</span>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>วันที่ปฏิบัติงาน</label>
                            <input className={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>ชื่อลูกค้า</label>
                            <input className={styles.input} type="text" placeholder="ชื่อบริษัทลูกค้า" value={customerName} onChange={e => setCustomerName(e.target.value)} required />
                        </div>

                        <div className={styles.companionSection}>
                            <label className={styles.label}>เพิ่มผู้ร่วมเดินทาง</label>
                            
                            <div className={styles.searchWrapper} ref={dropdownRef}>
                                <input 
                                    className={styles.input} 
                                    type="text" 
                                    placeholder="พิมพ์เพื่อค้นหาชื่อพนักงาน..." 
                                    value={companionSearch} 
                                    onChange={(e) => {
                                        setCompanionSearch(e.target.value);
                                        setShowDropdown(true);
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                />
                                
                                {showDropdown && (
                                    <div className={styles.dropdownList}>
                                        {employees
                                            .filter(emp => !selectedCompanions.includes(emp.emp_id))
                                            .filter(emp => emp.name.toLowerCase().includes(companionSearch.toLowerCase()))
                                            .length === 0 ? (
                                                <div className={styles.dropdownNoResult}>ไม่พบพนักงาน</div>
                                            ) : (
                                                employees
                                                    .filter(emp => !selectedCompanions.includes(emp.emp_id))
                                                    .filter(emp => emp.name.toLowerCase().includes(companionSearch.toLowerCase()))
                                                    .map(emp => (
                                                        <div 
                                                            key={emp.emp_id} 
                                                            className={styles.dropdownItem}
                                                            onClick={() => {
                                                                toggleCompanion(emp.emp_id);
                                                                setCompanionSearch("");
                                                                setShowDropdown(false);
                                                            }}
                                                        >
                                                            {emp.name}
                                                        </div>
                                                    ))
                                            )
                                        }
                                    </div>
                                )}
                            </div>

                            {selectedCompanions.length > 0 && (
                                <div className={styles.selectedList}>
                                    {selectedCompanions.map(id => {
                                        const emp = employees.find(e => e.emp_id === id);
                                        return (
                                            <div key={id} className={styles.companionChip}>
                                                <span>{emp?.name}</span>
                                                <button type="button" onClick={() => toggleCompanion(id)}>×</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <p className={styles.hint}>* ระบบจะคำนวณส่วนแบ่งให้อัตโนมัติหลังจากหัวหน้าอนุมัติ ({selectedCompanions.length + 1} คน)</p>
                        </div>

                        <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                            {submitting ? "กำลังส่ง..." : "ส่งคำขออนุมัติ / SUBMIT"}
                        </button>
                    </form>
                </section>

                {/* History List */}
                <section className={styles.card}>
                    <div className={styles.sectionLabel}>
                        <div className={styles.dot} />
                        <span>ประวัติการเบิก / HISTORY</span>
                    </div>

                    <div className={styles.historyList}>
                        {loading ? (
                            <div className={styles.historyEmpty}>
                                <ArrowPathIcon width={24} className="animate-spin" />
                                <p>กำลังโหลดข้อมูล...</p>
                            </div>
                        ) : claims.length === 0 ? (
                            <div className={styles.historyEmpty}>ยังไม่มีประวัติการเบิก</div>
                        ) : (
                            claims.map(claim => {
                                const statusCls = claim.status === "completed" ? styles.tagOntime :
                                    claim.status === "rejected" ? styles.tagLate : styles.tagPending;
                                return (
                                    <div key={claim.id} className={styles.historyItem}>
                                        <div className={styles.historyIcon}>
                                            <BanknotesIcon width={16} />
                                        </div>
                                        <div className={styles.historyInfo}>
                                            <div className={styles.historyType}>{claim.customer_name}</div>
                                            <div className={styles.historyMeta}>
                                                {new Date(claim.date).toLocaleDateString("th-TH")} · {claim.total_commission?.toLocaleString() || "รอคำนวณ"} THB
                                            </div>
                                            <div className={styles.historyAmount}>
                                                ส่วนแบ่ง: <b>{claim.per_person_commission?.toLocaleString() || "รอคำนวณ"} THB</b>
                                            </div>
                                        </div>
                                        <span className={`${styles.historyTag} ${statusCls}`}>
                                            {getStatusLabel(claim.status)}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
