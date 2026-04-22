"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "./page.module.css";
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfDay, addHours } from "date-fns";
import { th } from "date-fns/locale";

interface Room {
    id: number;
    name: string;
    floor: number;
    capacity: number | null;
}

interface Booking {
    id: number;
    room_id: number;
    emp_id: string;
    start_time: string;
    end_time: string;
    purpose: string;
    employee: { name: string; emp_id: string };
    room: { name: string; floor: number };
}

export default function MeetingRoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [me, setMe] = useState<any>(null);
    
    // Booking Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newBooking, setNewBooking] = useState({
        room_id: "",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "10:00",
        purpose: ""
    });

    const weekDays = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        return [...Array(7)].map((_, i) => addDays(start, i));
    }, [currentDate]);

    const timeSlots = useMemo(() => {
        return [...Array(13)].map((_, i) => 8 + i); // 8:00 to 20:00
    }, []);

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                start: weekDays[0].toISOString(),
                end: weekDays[6].toISOString()
            });
            const [roomsRes, bookingsRes] = await Promise.all([
                fetch("/api/meeting-rooms"),
                fetch(`/api/bookings?${params.toString()}`)
            ]);
            
            const roomsData = await roomsRes.json();
            const bookingsData = await bookingsRes.json();
            
            setRooms(Array.isArray(roomsData) ? roomsData : []);
            setBookings(Array.isArray(bookingsData) ? bookingsData : []);
            
            if (roomsData.length > 0 && selectedFloor === null) {
                setSelectedFloor(roomsData[0].floor);
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetch("/api/me").then(r => r.json()).then(setMe).catch(() => {});
    }, []);

    const changeWeek = (offset: number) => {
        setCurrentDate(prev => addDays(prev, offset * 7));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const handleCancelBooking = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!confirm("ยกเลิกการจองนี้ใช่หรือไม่?")) return;
        
        try {
            const res = await fetch(`/api/bookings?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchData();
            } else {
                const err = await res.json();
                alert(err.message || "Failed to cancel");
            }
        } catch (error) {
            alert("An error occurred");
        }
    };

    const handleOpenBooking = (day: Date, hour: number) => {
        setNewBooking({
            ...newBooking,
            date: format(day, "yyyy-MM-dd"),
            startTime: `${hour.toString().padStart(2, '0')}:00`,
            endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
            room_id: rooms.find(r => r.floor === selectedFloor)?.id.toString() || ""
        });
        setIsModalOpen(true);
    };

    const submitBooking = async () => {
        try {
            // Combine date and time
            const start = new Date(`${newBooking.date}T${newBooking.startTime}:00`);
            const end = new Date(`${newBooking.date}T${newBooking.endTime}:00`);

            const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...newBooking,
                    start_time: start.toISOString(),
                    end_time: end.toISOString()
                })
            });
            
            if (!res.ok) {
                const err = await res.json();
                alert(err.message || err.error || "Booking failed");
                return;
            }
            
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            alert("An error occurred");
        }
    };

    const getFloorClass = (floor: number) => {
        switch(floor) {
            case 1: return styles.floor1;
            case 2: return styles.floor2;
            case 3: return styles.floor3;
            case 4: return styles.floor4;
            default: return "";
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>ระบบจองห้องประชุม</h1>
                    <p>Meeting Room Reservation System</p>
                </div>
                
                <div className={styles.controls}>
                    <div className={styles.floorFilter}>
                        {[1, 2, 3, 4].map(f => (
                            <button 
                                key={f}
                                className={`${styles.floorBtn} ${selectedFloor === f ? styles.active : ""}`}
                                onClick={() => setSelectedFloor(f)}
                            >
                                ชั้น {f}
                            </button>
                        ))}
                    </div>
                    <div className={styles.dateNav}>
                        <button onClick={() => changeWeek(-1)}>สัปดาห์ก่อน</button>
                        <button onClick={goToToday} className={styles.todayBtn}>วันนี้</button>
                        <button onClick={() => changeWeek(1)}>สัปดาห์หน้า</button>
                    </div>
                    <button className={styles.submitBtn} onClick={() => setIsModalOpen(true)}>จองห้องประชุม</button>
                </div>
            </header>

            <div className={styles.calendarContainer}>
                <div className={styles.calendarHeader}>
                    <div className={styles.dayLabel}>เวลา</div>
                    {weekDays.map((day, idx) => (
                        <div key={idx} className={styles.dayLabel}>
                            {format(day, "EEE d MMM", { locale: th })}
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className={styles.loading}>กำลังโหลดข้อมูล...</div>
                ) : (
                    <div className={styles.grid}>
                        <div className={styles.timeCol}>
                            {timeSlots.map(hour => (
                                <div key={hour} className={styles.timeLabel}>
                                    {hour}:00
                                </div>
                            ))}
                        </div>

                        {weekDays.map(day => (
                            <div key={day.toISOString()} className={styles.dayCol}>
                                {timeSlots.map(hour => (
                                    <div 
                                        key={hour} 
                                        className={styles.slot}
                                        onClick={() => handleOpenBooking(day, hour)}
                                    ></div>
                                ))}

                                {bookings
                                .filter(b => {
                                    if (!b.room || !b.start_time) return false;
                                    return b.room.floor === selectedFloor && isSameDay(parseISO(b.start_time), day);
                                })
                                    .map(booking => {
                                        const start = parseISO(booking.start_time);
                                        const end = parseISO(booking.end_time);
                                        const startHour = start.getHours() + start.getMinutes() / 60;
                                        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                        const top = (startHour - 8) * 60;
                                        const height = duration * 60;

                                        return (
                                            <div 
                                                key={booking.id}
                                                className={`${styles.bookingCard} ${getFloorClass(booking.room.floor)}`}
                                                style={{ top: `${top}px`, height: `${height}px` }}
                                                title={`${booking.employee.name}: ${booking.purpose}`}
                                            >
                                                <div className={styles.bookingHeader}>
                                                    <img 
                                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(booking.employee.name)}&background=random&color=fff`} 
                                                        alt="" 
                                                        className={styles.avatar} 
                                                    />
                                                    <div className={styles.bookingName}>{booking.employee.name}</div>
                                                    {me?.emp_id === booking.emp_id && (
                                                        <button 
                                                            className={styles.cancelBookingBtn}
                                                            onClick={(e) => handleCancelBooking(e, booking.id)}
                                                            title="ยกเลิกการจอง"
                                                        >
                                                            &times;
                                                        </button>
                                                    )}
                                                </div>
                                                <div className={styles.bookingPurpose}>{booking.purpose}</div>
                                            </div>
                                        );
                                    })
                                }

                                {isSameDay(day, new Date()) && (
                                    <div 
                                        className={styles.currentTimeLine}
                                        style={{ top: `${(new Date().getHours() + new Date().getMinutes() / 60 - 8) * 60}px` }}
                                    >
                                        <div className={styles.timeDot} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2>จองห้องประชุม</h2>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>เลือกห้องประชุม</label>
                            <select 
                                value={newBooking.room_id} 
                                onChange={e => setNewBooking({...newBooking, room_id: e.target.value})}
                            >
                                <option value="">-- เลือกห้อง --</option>
                                {[1, 2, 3, 4].map(f => {
                                    const floorRooms = rooms.filter(r => r.floor === f);
                                    if (floorRooms.length === 0) return null;
                                    return (
                                        <optgroup key={f} label={`ชั้น ${f}`}>
                                            {floorRooms.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </optgroup>
                                    );
                                })}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label>วันที่</label>
                            <input 
                                type="date" 
                                value={newBooking.date}
                                onChange={e => setNewBooking({...newBooking, date: e.target.value})}
                            />
                        </div>

                        <div className={styles.timeGrid}>
                            <div className={styles.formGroup}>
                                <label>เริ่มเวลา (24h)</label>
                                <select 
                                    value={newBooking.startTime}
                                    onChange={e => setNewBooking({...newBooking, startTime: e.target.value})}
                                >
                                    {timeSlots.map(h => {
                                        const time = `${h.toString().padStart(2, '0')}:00`;
                                        return <option key={time} value={time}>{time}</option>;
                                    })}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>สิ้นสุดเวลา (24h)</label>
                                <select 
                                    value={newBooking.endTime}
                                    onChange={e => setNewBooking({...newBooking, endTime: e.target.value})}
                                >
                                    {timeSlots.map(h => {
                                        const time = `${h.toString().padStart(2, '0')}:00`;
                                        return <option key={time} value={time}>{time}</option>;
                                    })}
                                    <option value="21:00">21:00</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>วัตถุประสงค์ / หัวข้อการประชุม</label>
                            <textarea 
                                rows={3}
                                value={newBooking.purpose}
                                onChange={e => setNewBooking({...newBooking, purpose: e.target.value})}
                                placeholder="เช่น ประชุมฝ่ายบริหารประจำสัปดาห์"
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                            <button className={styles.submitBtn} onClick={submitBooking}>ยืนยันการจอง</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
