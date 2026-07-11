"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./holiday.module.css";
import { CalendarDaysIcon, PlusIcon, CakeIcon } from "@heroicons/react/24/outline";

type HolidayRow = {
    date: string;       // ISO จาก API
    name: string;
    created_at: string; // ISO
};

type EmpSmall = {
    name: string;
    birth_date: string | null;
};

const TH_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const TH_WEEKDAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function todayISO_BKK() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
}

function isoToYMD(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dt = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dt}`;
}

function fmtTH(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    // ใช้ manual format เพื่อกัน hydration mismatch (บางที่คืน พ.ศ. บางที่คืน ค.ศ. บางที่สั้นบางที่ยาว)
    return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function AdminHolidayPage() {
    const queryClient = useQueryClient();
    const [err, setErr] = useState("");
    const [actionSaving, setActionSaving] = useState(false);

    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth());

    const { data: holidayData, isLoading: holidaysLoading, isFetching: holidaysFetching } = useQuery({
        queryKey: ['admin-holidays', year],
        queryFn: async () => {
            const res = await fetch(`/api/admin/holidays?year=${year}`);
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || `HTTP_${res.status}`);
            }
            return res.json();
        }
    });

    const { data: empData, isLoading: empsLoading } = useQuery({
        queryKey: ['admin-employees-minimal'],
        queryFn: async () => {
            const res = await fetch("/api/admin/employees?minimal=1");
            return res.json();
        }
    });

    const list: HolidayRow[] = holidayData?.list || [];
    const emps: EmpSmall[] = empData?.list || [];
    const loading = holidaysLoading || empsLoading || actionSaving;
    const isFetching = holidaysFetching;

    const [newDate, setNewDate] = useState(todayISO_BKK());
    const [newName, setNewName] = useState("");

    const stats = useMemo(() => {
        const total = list.length;

        const now = new Date();
        const upcoming = list
            .map((x) => ({ ...x, d: new Date(x.date) }))
            .filter((x) => !Number.isNaN(x.d.getTime()) && x.d >= new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z"))
            .sort((a, b) => a.d.getTime() - b.d.getTime())[0];

        return {
            total,
            upcomingName: upcoming?.name || "-",
            upcomingDate: upcoming ? fmtTH(upcoming.date) : "-",
        };
    }, [list]);



    const holidayMap = useMemo(() => {
        const m = new Map<string, HolidayRow>();
        for (const h of list) m.set(isoToYMD(h.date), h);
        return m;
    }, [list]);

    const bdayMap = useMemo(() => {
        const m = new Map<string, string[]>();
        for (const e of emps) {
            if (!e.birth_date) continue;
            const d = new Date(e.birth_date);
            const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const arr = m.get(mmdd) || [];
            arr.push(e.name);
            m.set(mmdd, arr);
        }
        return m;
    }, [emps]);

    function changeMonth(delta: number) {
        let m = month + delta;
        let y = year;
        if (m < 0) { m = 11; y -= 1; }
        if (m > 11) { m = 0; y += 1; }
        setMonth(m); setYear(y);
    }

    function buildMonthMatrix(y: number, m: number) {
        const first = new Date(y, m, 1);
        const start = new Date(first);
        // start from Sunday (0)
        start.setDate(first.getDate() - first.getDay());

        const weeks: (Date | null)[][] = [];
        let cur = new Date(start);
        for (let wk = 0; wk < 6; wk++) {
            const row: (Date | null)[] = [];
            for (let d = 0; d < 7; d++) {
                row.push(new Date(cur));
                cur.setDate(cur.getDate() + 1);
            }
            weeks.push(row);
        }
        return weeks;
    }

    async function addHoliday() {
        setErr("");
        const dateStr = newDate;
        const name = newName.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            setErr("กรุณาเลือกวันที่ให้ถูกต้อง");
            return;
        }
        if (!name) {
            setErr("กรุณากรอกชื่อวันหยุด");
            return;
        }

        setActionSaving(true);
        try {
            const res = await fetch("/api/admin/holidays", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: dateStr, name }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                setErr(data?.error || `HTTP_${res.status}`);
                return;
            }

            setNewName("");
            queryClient.invalidateQueries({ queryKey: ['admin-holidays', year] });
        } catch (e: any) {
            setErr(e?.message || "ADD_FAILED");
        } finally {
            setActionSaving(false);
        }
    }

    async function deleteHoliday(dateIso: string) {
        const ymd = isoToYMD(dateIso);
        if (!confirm(`ลบวันหยุดวันที่ ${ymd} ใช่ไหม?`)) return;

        setActionSaving(true);
        setErr("");
        try {
            const res = await fetch(`/api/admin/holidays/${ymd}`, { method: "DELETE" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setErr(data?.error || `HTTP_${res.status}`);
                return;
            }
            queryClient.invalidateQueries({ queryKey: ['admin-holidays', year] });
        } catch (e: any) {
            setErr(e?.message || "DELETE_FAILED");
        } finally {
            setActionSaving(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <div className={styles.title}>วันหยุด</div>
                    <div className={styles.subtitle}>TERA GROUP · HR Admin System</div>
                </div>

                <div className={styles.headerRight}>
                    <select className={styles.input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                        {Array.from({ length: 6 }).map((_, i) => {
                            const y = new Date().getFullYear() - 2 + i;
                            return (
                                <option key={y} value={y}>
                                    ปี {y}
                                </option>
                            );
                        })}
                    </select>

                    <button className={styles.btnGhost} onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-holidays', year] })} disabled={isFetching}>
                        {isFetching ? "Loading..." : "Refresh"}
                    </button>
                </div>
            </div>

            {err ? <div className={styles.error}>Error: {err}</div> : null}

            {/* Cards */}
            <div className={styles.grid}>
                <div className={styles.card}>
                    <div className={styles.cardTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}><CalendarDaysIcon width={20} /> สรุปวันหยุด (ปี {year})</div>
                    <div className={styles.kpiRow}>
                        <div className={styles.kpiBox}>
                            <div className={styles.kpiLabel}>จำนวนวันหยุด</div>
                            <div className={styles.kpiValue}>{stats.total}</div>
                        </div>
                        <div className={styles.kpiBox}>
                            <div className={styles.kpiLabel}>วันหยุดถัดไป</div>
                            <div className={styles.kpiValueSmall}>{stats.upcomingName}</div>
                            <div className={styles.kpiHint}>{stats.upcomingDate}</div>
                        </div>
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}><PlusIcon width={20} /> เพิ่มวันหยุด</div>
                    <div className={styles.formRow}>
                        <input className={styles.input} type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                        <input
                            className={styles.input}
                            placeholder="ชื่อวันหยุด (เช่น วันสงกรานต์)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <button className={styles.btnPrimary} onClick={addHoliday} disabled={loading}>
                            เพิ่ม
                        </button>
                    </div>
                    <div className={styles.hint}>หมายเหตุ: วันที่เป็น PK ห้ามซ้ำ (ถ้าซ้ำระบบจะ error)</div>
                </div>
            </div>

            {/* Calendar view */}
            <div className={styles.calendarWrap}>
                <div className={styles.calendarHeader}>
                    <div className={styles.calendarNav}>
                        <button className={styles.btnGhost} onClick={() => changeMonth(-1)}>&larr;</button>
                        <div className={styles.calendarTitle}>
                            {TH_MONTHS[month]} {year + 543}
                        </div>
                        <button className={styles.btnGhost} onClick={() => changeMonth(1)}>&rarr;</button>
                    </div>
                    <div className={styles.rowCount}>{list.length} รายการ</div>
                </div>

                <div className={styles.calendarGridWrap}>
                    <div className={styles.weekHead}>
                        {TH_WEEKDAYS_SHORT.map((label, i) => (
                            <div key={i} className={styles.weekDay}>{label}</div>
                        ))}
                    </div>

                    <div className={styles.calendarGrid}>
                        {buildMonthMatrix(year, month).map((week, wi) => (
                            <div key={wi} className={styles.weekRow}>
                                {week.map((dt, di) => {
                                    const ymd = dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` : "";
                                    const inMonth = dt && dt.getMonth() === month;
                                    const holiday = dt ? holidayMap.get(ymd) : undefined;
                                    const isToday = dt && (`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` === ymd);
                                    return (
                                        <div key={di} className={`${styles.calendarCell} ${inMonth ? '' : styles.outside}`}>
                                            {dt ? (
                                                <div className={styles.cellInner}>
                                                    <div className={styles.cellDateRow}>
                                                        <div className={`${styles.cellDate} ${isToday ? styles.today : ''}`}>{dt.getDate()}</div>
                                                    </div>
                                                    {holiday ? <div className={styles.holidayBadge}>{holiday.name}</div> : null}
                                                    {dt && bdayMap.get(`${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`)?.map(name => (
                                                        <div key={name} className={styles.bdayBadge} style={{ display: "flex", alignItems: "center", gap: 4 }}><CakeIcon width={12} /> {name}</div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}