"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface Room {
    id: number;
    name: string;
    floor: number;
    capacity: number | null;
    is_active: boolean;
}

interface Booking {
    id: number;
    room_id: number;
    emp_id: string;
    start_time: string;
    end_time: string;
    purpose: string;
    status: string;
    employee: { name: string; emp_id: string };
    room: { name: string; floor: number };
}

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default function AdminMeetingRoomsPage() {
    const queryClient = useQueryClient();
    const { data, isLoading: loading } = useQuery({
        queryKey: ['admin-meeting-rooms'],
        queryFn: async () => {
            const params = new URLSearchParams({
                start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
            });
            const [roomsRes, bookingsRes] = await Promise.all([
                fetch("/api/meeting-rooms"),
                fetch(`/api/bookings?${params.toString()}`)
            ]);
            const roomsData = await roomsRes.json();
            const bookingsData = await bookingsRes.json();
            return {
                rooms: Array.isArray(roomsData) ? roomsData : [],
                bookings: Array.isArray(bookingsData) ? bookingsData : []
            };
        }
    });

    const rooms = data?.rooms || [];
    const bookings = data?.bookings || [];
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Partial<Room> | null>(null);
    const [activeTab, setActiveTab] = useState<"upcoming" | "history">("history");

    // Filter states
    const [filterDay, setFilterDay] = useState("");
    const [filterMonth, setFilterMonth] = useState("");
    const [filterYear, setFilterYear] = useState("");
    const [filterRoom, setFilterRoom] = useState("");

    const now = new Date();
    const currentYear = now.getFullYear();
    const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);



    const handleSaveRoom = async () => {
        try {
            const method = editingRoom?.id ? "PATCH" : "POST";
            const res = await fetch("/api/meeting-rooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingRoom)
            });
            if (res.ok) { setShowRoomModal(false); queryClient.invalidateQueries({ queryKey: ['admin-meeting-rooms'] }); }
        } catch { alert("Failed to save room"); }
    };

    const handleCancelBooking = async (id: number) => {
        if (!confirm("ยืนยันการยกเลิกการจองนี้?")) return;
        try {
            const res = await fetch(`/api/bookings?id=${id}`, { method: "DELETE" });
            if (res.ok) queryClient.invalidateQueries({ queryKey: ['admin-meeting-rooms'] });
        } catch { alert("Failed to cancel booking"); }
    };

    const nowMs = now.getTime();

    // Apply filters to a list of bookings
    const applyFilters = (list: Booking[]) => list.filter(b => {
        const d = new Date(b.start_time);
        if (filterDay && d.getDate() !== Number(filterDay)) return false;
        if (filterMonth && d.getMonth() + 1 !== Number(filterMonth)) return false;
        if (filterYear && d.getFullYear() !== Number(filterYear)) return false;
        if (filterRoom && b.room_id !== Number(filterRoom)) return false;
        return true;
    });

    const upcomingRaw = bookings.filter(b => new Date(b.end_time).getTime() >= nowMs);
    const historyRaw = bookings.filter(b => new Date(b.end_time).getTime() < nowMs)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    const upcomingBookings = useMemo(() => applyFilters(upcomingRaw), [upcomingRaw, filterDay, filterMonth, filterYear, filterRoom]);
    const pastBookings = useMemo(() => applyFilters(historyRaw), [historyRaw, filterDay, filterMonth, filterYear, filterRoom]);

    const clearFilters = () => { setFilterDay(""); setFilterMonth(""); setFilterYear(""); setFilterRoom(""); };
    const hasFilters = filterDay || filterMonth || filterYear || filterRoom;

    const displayedBookings = activeTab === "upcoming" ? upcomingBookings : pastBookings;

    return (
        <div className={styles.container}>
            {/* ── Header ── */}
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>ห้องประชุม</h1>
                    <p>Meeting Room Management & Booking History</p>
                </div>
                <button className={styles.addBtn} onClick={() => { setEditingRoom({ name: "", floor: 1, capacity: 10 }); setShowRoomModal(true); }}>
                    + เพิ่มห้องประชุม
                </button>
            </header>

            {/* ── Room chips ── */}
            <div className={styles.roomStrip}>
                {rooms.map(room => (
                    <div
                        key={room.id}
                        className={`${styles.roomChip} ${filterRoom === String(room.id) ? styles.roomChipActive : ""}`}
                        onClick={() => setFilterRoom(filterRoom === String(room.id) ? "" : String(room.id))}
                    >
                        <span className={styles.chipDot} data-active={room.is_active} />
                        <span className={styles.chipName}>{room.name}</span>
                        <span className={styles.chipMeta}>ชั้น {room.floor}</span>
                        <button className={styles.chipEdit} onClick={e => { e.stopPropagation(); setEditingRoom(room); setShowRoomModal(true); }}>แก้ไข</button>
                    </div>
                ))}
            </div>

            {/* ── Filter bar ── */}
            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>วัน</label>
                    <input
                        type="number"
                        className={styles.filterInput}
                        placeholder="1–31"
                        min={1} max={31}
                        value={filterDay}
                        onChange={e => setFilterDay(e.target.value)}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>เดือน</label>
                    <select className={styles.filterSelect} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                        <option value="">ทั้งหมด</option>
                        {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>ปี</label>
                    <select className={styles.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                        <option value="">ทั้งหมด</option>
                        {years.map(y => <option key={y} value={y}>{y + 543}</option>)}
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>ห้อง</label>
                    <select className={styles.filterSelect} value={filterRoom} onChange={e => setFilterRoom(e.target.value)}>
                        <option value="">ทั้งหมด</option>
                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
                {hasFilters && (
                    <button className={styles.clearBtn} onClick={clearFilters}>× ล้างตัวกรอง</button>
                )}
                <div className={styles.filterSpacer} />
                <span className={styles.resultCount}>{displayedBookings.length} รายการ</span>
            </div>

            {/* ── Tabs ── */}
            <div className={styles.tabs}>
                <button className={`${styles.tab} ${activeTab === "upcoming" ? styles.tabActive : ""}`} onClick={() => setActiveTab("upcoming")}>
                    การจองที่กำลังจะถึง
                    <span className={styles.tabBadge}>{upcomingBookings.length}</span>
                </button>
                <button className={`${styles.tab} ${activeTab === "history" ? styles.tabActive : ""}`} onClick={() => setActiveTab("history")}>
                    ประวัติการใช้งาน
                    <span className={styles.tabBadge}>{pastBookings.length}</span>
                </button>
            </div>

            {/* ── Table ── */}
            <div className={styles.tableCard}>
                {loading ? (
                    <div className={styles.emptyState}>กำลังโหลด...</div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>วัน / เวลา</th>
                                    <th>ห้องประชุม</th>
                                    <th>ผู้จอง</th>
                                    <th>หัวข้อการประชุม</th>
                                    <th>ระยะเวลา</th>
                                    {activeTab === "upcoming" && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {displayedBookings.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeTab === "upcoming" ? 6 : 5} className={styles.emptyCell}>
                                            ไม่พบรายการ{hasFilters ? "ที่ตรงกับเงื่อนไข" : ""}
                                        </td>
                                    </tr>
                                ) : (
                                    displayedBookings.map(booking => {
                                        const start = new Date(booking.start_time);
                                        const end = new Date(booking.end_time);
                                        const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                                        const hrs = Math.floor(mins / 60);
                                        const rem = mins % 60;
                                        const duration = hrs > 0 ? `${hrs} ชม.${rem > 0 ? ` ${rem} น.` : ""}` : `${rem} น.`;
                                        const isPast = end.getTime() < nowMs;
                                        return (
                                            <tr key={booking.id} className={isPast ? styles.rowPast : ""}>
                                                <td>
                                                    <div className={styles.dateTime}>
                                                        <strong>{format(start, "d MMM yyyy", { locale: th })}</strong>
                                                        <span>{format(start, "HH:mm")} – {format(end, "HH:mm")}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={styles.roomCell}>
                                                        <span className={styles.roomCellName}>{booking.room.name}</span>
                                                        <span className={styles.roomCellFloor}>ชั้น {booking.room.floor}</span>
                                                    </div>
                                                </td>
                                                <td className={styles.nameCell}>{booking.employee.name}</td>
                                                <td className={styles.purposeCell}>{booking.purpose || "—"}</td>
                                                <td className={styles.durationCell}>{duration}</td>
                                                {activeTab === "upcoming" && (
                                                    <td>
                                                        <button className={styles.cancelBtnSmall} onClick={() => handleCancelBooking(booking.id)}>ยกเลิก</button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Room Modal ── */}
            {showRoomModal && (
                <div className={styles.modalOverlay} onClick={() => setShowRoomModal(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h2>{editingRoom?.id ? "แก้ไขห้องประชุม" : "เพิ่มห้องประชุมใหม่"}</h2>
                        <div className={styles.formGroup}>
                            <label>ชื่อห้องประชุม</label>
                            <input value={editingRoom?.name || ""} onChange={e => setEditingRoom({ ...editingRoom, name: e.target.value })} />
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>ชั้น</label>
                                <input type="number" value={editingRoom?.floor || 1} onChange={e => setEditingRoom({ ...editingRoom, floor: parseInt(e.target.value) })} />
                            </div>
                            <div className={styles.formGroup}>
                                <label>ความจุ (คน)</label>
                                <input type="number" value={editingRoom?.capacity || ""} onChange={e => setEditingRoom({ ...editingRoom, capacity: parseInt(e.target.value) })} />
                            </div>
                        </div>
                        <label className={styles.checkLabel}>
                            <input type="checkbox" checked={editingRoom?.is_active ?? true} onChange={e => setEditingRoom({ ...editingRoom, is_active: e.target.checked })} />
                            เปิดใช้งาน
                        </label>
                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setShowRoomModal(false)}>ยกเลิก</button>
                            <button className={styles.submitBtn} onClick={handleSaveRoom}>บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
