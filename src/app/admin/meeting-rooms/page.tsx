"use client";

import React, { useState, useEffect } from "react";
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

export default function AdminMeetingRoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Partial<Room> | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                start: new Date().toISOString(),
                end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            });
            const [roomsRes, bookingsRes] = await Promise.all([
                fetch("/api/meeting-rooms"),
                fetch(`/api/bookings?${params.toString()}`)
            ]);
            
            const roomsData = await roomsRes.json();
            const bookingsData = await bookingsRes.json();
            
            setRooms(Array.isArray(roomsData) ? roomsData : []);
            setBookings(Array.isArray(bookingsData) ? bookingsData : []);
        } catch (error) {
            console.error("Failed to fetch admin data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRoom = async () => {
        try {
            const res = await fetch("/api/meeting-rooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingRoom)
            });
            
            if (res.ok) {
                setShowRoomModal(false);
                fetchData();
            }
        } catch (error) {
            alert("Failed to save room");
        }
    };

    const handleCancelBooking = async (id: number) => {
        if (!confirm("Are you sure you want to cancel this booking?")) return;
        
        try {
            const res = await fetch(`/api/bookings?id=${id}`, { method: "DELETE" });
            if (res.ok) fetchData();
        } catch (error) {
            alert("Failed to cancel booking");
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>จัดการห้องประชุม (Admin)</h1>
                    <p>Meeting Room Management & Oversight</p>
                </div>
                <button className={styles.addBtn} onClick={() => { setEditingRoom({ name: "", floor: 1, capacity: 10 }); setShowRoomModal(true); }}>
                    + เพิ่มห้องประชุม
                </button>
            </header>

            <div className={styles.adminGrid}>
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>รายการห้องประชุมทั้งหมด</h2>
                    <div className={styles.roomList}>
                        {rooms.map(room => (
                            <div key={room.id} className={styles.roomCard}>
                                <div className={styles.roomInfo}>
                                    <span className={styles.roomName}>{room.name}</span>
                                    <span className={styles.roomMeta}>ชั้น {room.floor} • ความจุ {room.capacity || "-"} คน</span>
                                </div>
                                <div className={styles.roomActions}>
                                    <button onClick={() => { setEditingRoom(room); setShowRoomModal(true); }}>แก้ไข</button>
                                    <div className={styles.statusBadge} data-active={room.is_active}>
                                        {room.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>รายการจองที่กำลังจะถึง</h2>
                    <div className={styles.bookingTableWrapper}>
                        <table className={styles.bookingTable}>
                            <thead>
                                <tr>
                                    <th>วัน/เวลา</th>
                                    <th>ห้อง</th>
                                    <th>ผู้จอง</th>
                                    <th>หัวข้อ</th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map(booking => (
                                    <tr key={booking.id}>
                                        <td>
                                            <div className={styles.dateTime}>
                                                <strong>{format(new Date(booking.start_time), "d MMM yyyy", { locale: th })}</strong>
                                                <span>{format(new Date(booking.start_time), "HH:mm")} - {format(new Date(booking.end_time), "HH:mm")}</span>
                                            </div>
                                        </td>
                                        <td>{booking.room.name} (ชั้น {booking.room.floor})</td>
                                        <td>{booking.employee.name}</td>
                                        <td>{booking.purpose}</td>
                                        <td>
                                            <button 
                                                className={styles.cancelBtnSmall}
                                                onClick={() => handleCancelBooking(booking.id)}
                                            >
                                                ยกเลิก
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {showRoomModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <h2>{editingRoom?.id ? "แก้ไขห้องประชุม" : "เพิ่มห้องประชุมใหม่"}</h2>
                        <div className={styles.formGroup}>
                            <label>ชื่อห้องประชุม</label>
                            <input 
                                value={editingRoom?.name || ""} 
                                onChange={e => setEditingRoom({...editingRoom, name: e.target.value})}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>ชั้น</label>
                            <input 
                                type="number"
                                value={editingRoom?.floor || 1} 
                                onChange={e => setEditingRoom({...editingRoom, floor: parseInt(e.target.value)})}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>ความจุ (คน)</label>
                            <input 
                                type="number"
                                value={editingRoom?.capacity || ""} 
                                onChange={e => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value)})}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={editingRoom?.is_active ?? true}
                                    onChange={e => setEditingRoom({...editingRoom, is_active: e.target.checked})}
                                />
                                เปิดใช้งาน
                            </label>
                        </div>
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
