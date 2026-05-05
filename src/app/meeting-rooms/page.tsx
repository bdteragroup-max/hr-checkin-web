"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import styles from "./page.module.css";
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfDay, addHours, getDay } from "date-fns";
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
    minutes: string | null;
    employee: { name: string; emp_id: string; nickname?: string | null };
    room: { name: string; floor: number };
    attendees: { employee: { name: string; emp_id: string; nickname?: string | null } }[];
}

interface Employee {
    emp_id: string;
    name: string;
    nickname?: string | null;
}

export default function MeetingRoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [me, setMe] = useState<any>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const currentTimePos = useMemo(() => {
        const hour = now.getHours() + now.getMinutes() / 60;
        if (hour < 8 || hour > 20) return null;
        return (hour - 8) * (100 / 13);
    }, [now]);
    
    // Booking Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    const isOwner = useMemo(() => {
        if (!selectedBooking) return true;
        return me?.emp_id === selectedBooking.emp_id;
    }, [selectedBooking, me]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newBooking, setNewBooking] = useState({
        room_id: "",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "10:00",
        purpose: "",
        attendee_ids: [] as string[],
        minutes: ""
    });

    const weekDays = useMemo(() => {
        return [...Array(7)]
            .map((_, i) => addDays(currentDate, i))
            .filter(day => getDay(day) !== 0); // 0 = Sunday
    }, [currentDate]);

    const isRoomInUse = (roomId: number) => {
        const now = new Date();
        // Since we are checking "current" state, we should only check if 'now' is on the 'day' we are currently rendering if we want per-day logic, 
        // but usually "Currently In Use" means right now (today).
        return bookings.some(b => 
            b.room_id === roomId && 
            new Date(b.start_time) <= now && 
            new Date(b.end_time) > now
        );
    };

    const timeSlots = useMemo(() => {
        return [...Array(13)].map((_, i) => 8 + i); // 8:00 to 20:00
    }, []);

    const floorRooms = useMemo(() => {
        return rooms.filter(r => r.floor === selectedFloor);
    }, [rooms, selectedFloor]);

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const startDay = startOfDay(weekDays[0]);
            const endDay = new Date(startOfDay(weekDays[weekDays.length - 1]).getTime() + 24 * 60 * 60 * 1000 - 1);
            
            const params = new URLSearchParams({
                start: startDay.toISOString(),
                end: endDay.toISOString()
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
        fetch("/api/employees").then(r => r.json()).then(data => setEmployees(Array.isArray(data) ? data : [])).catch(() => {});
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

    const handleOpenBooking = (day: Date, hour: number, existingBooking?: Booking) => {
        if (existingBooking) {
            setSelectedBooking(existingBooking);
            setNewBooking({
                room_id: existingBooking.room_id.toString(),
                date: format(parseISO(existingBooking.start_time), "yyyy-MM-dd"),
                startTime: format(parseISO(existingBooking.start_time), "HH:mm"),
                endTime: format(parseISO(existingBooking.end_time), "HH:mm"),
                purpose: existingBooking.purpose || "",
                attendee_ids: existingBooking.attendees.map(a => a.employee.emp_id),
                minutes: existingBooking.minutes || ""
            });
        } else {
            setSelectedBooking(null);
            setNewBooking({
                room_id: rooms.find(r => r.floor === selectedFloor)?.id.toString() || "",
                date: format(day, "yyyy-MM-dd"),
                startTime: `${hour.toString().padStart(2, "0")}:00`,
                endTime: `${(hour + 1).toString().padStart(2, "0")}:00`,
                purpose: "",
                attendee_ids: [],
                minutes: ""
            });
        }
        setIsModalOpen(true);
    };

    const submitBooking = async () => {
        try {
            setIsSubmitting(true);
            const url = "/api/bookings";
            const method = selectedBooking ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedBooking?.id,
                    room_id: newBooking.room_id,
                    start_time: `${newBooking.date}T${newBooking.startTime}:00`,
                    end_time: `${newBooking.date}T${newBooking.endTime}:00`,
                    purpose: newBooking.purpose,
                    attendee_ids: newBooking.attendee_ids,
                    minutes: newBooking.minutes
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
        } finally {
            setIsSubmitting(false);
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
                <div 
                    className={styles.calendarHeader}
                    style={{ gridTemplateColumns: `200px repeat(${timeSlots.length}, 1fr)` }}
                >
                    <div className={styles.dayLabel}>วันที่ / ห้อง</div>
                    {timeSlots.map(hour => (
                        <div key={hour} className={styles.timeHeaderLabel}>
                            {hour}:00
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className={styles.loading}>กำลังโหลดข้อมูล...</div>
                ) : (
                    <div 
                        className={styles.grid}
                        style={{ gridTemplateColumns: `200px repeat(${timeSlots.length}, 1fr)` }}
                    >
                        {weekDays.map(day => (
                            <React.Fragment key={day.toISOString()}>
                                {floorRooms.length > 0 ? (
                                    floorRooms.map((room, rIdx) => (
                                        <React.Fragment key={room.id}>
                                            <div className={styles.dateCol}>
                                                {rIdx === 0 && (
                                                    <div className={styles.dateText}>
                                                        {format(day, "EEE d MMM", { locale: th })}
                                                    </div>
                                                )}
                                                <div className={styles.roomNameContainer}>
                                                    <div className={styles.roomNameText}>{room.name}</div>
                                                    {isRoomInUse(room.id) && (
                                                        <span className={styles.inUseBadge}>กำลังใช้งาน</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className={styles.timeRow} style={{ gridColumn: `span ${timeSlots.length}` }}>
                                                {timeSlots.map(hour => (
                                                    <div 
                                                        key={hour} 
                                                        className={styles.timeSlotCell}
                                                        onClick={() => handleOpenBooking(day, hour)}
                                                    ></div>
                                                ))}
                                                
                                                {isSameDay(day, now) && currentTimePos !== null && (
                                                    <div className={styles.currentTimeLine} style={{ left: `${currentTimePos}%` }}>
                                                        <div className={styles.timeDot} />
                                                    </div>
                                                )}

                                                {bookings
                                                    .filter(b => {
                                                        if (!b.room || !b.start_time) return false;
                                                        return b.room_id === room.id && isSameDay(parseISO(b.start_time), day);
                                                    })
                                                    .map(booking => {
                                                        const start = parseISO(booking.start_time);
                                                        const end = parseISO(booking.end_time);
                                                        
                                                        const startHour = start.getHours() + start.getMinutes() / 60;
                                                        const endHour = end.getHours() + end.getMinutes() / 60;
                                                        
                                                        // Clip to visible range (8:00 - 20:00)
                                                        const visibleStart = Math.max(8, startHour);
                                                        const visibleEnd = Math.min(20, endHour);
                                                        
                                                        if (visibleStart >= visibleEnd) return null;

                                                        const duration = visibleEnd - visibleStart;
                                                        
                                                        // X positioning
                                                        const left = (visibleStart - 8) * (100 / timeSlots.length);
                                                        const width = duration * (100 / timeSlots.length);

                                                        return (
                                                            <div 
                                                                key={booking.id}
                                                                className={`${styles.bookingCardHoriz} ${getFloorClass(booking.room.floor)}`}
                                                                style={{ left: `${left}%`, width: `${width}%` }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenBooking(day, 0, booking);
                                                                }}
                                                                title={`${booking.employee.name}: ${booking.purpose} (${format(start, "HH:mm")} - ${format(end, "HH:mm")})`}
                                                            >
                                                                <div className={styles.bookingHeaderHoriz}>
                                                                    <div className={styles.bookingNameHoriz}>
                                                                        {booking.employee.name.split(" ")[0]}
                                                                    </div>
                                                                    {me?.emp_id === booking.emp_id && (
                                                                        <button 
                                                                            className={styles.cancelBookingBtnSmall}
                                                                            onClick={(e) => handleCancelBooking(e, booking.id)}
                                                                        >
                                                                            &times;
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className={styles.bookingPurposeHoriz}>{booking.purpose}</div>
                                                            </div>
                                                        );
                                                    })
                                                }
                                            </div>
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <React.Fragment key={day.toISOString()}>
                                        <div className={styles.dateCol}>
                                            <div className={styles.dateText}>
                                                {format(day, "EEE d MMM", { locale: th })}
                                            </div>
                                        </div>
                                        <div className={styles.noRooms} style={{ gridColumn: `span ${timeSlots.length}` }}>
                                            ไม่มีห้องประชุมในชั้นนี้
                                        </div>
                                    </React.Fragment>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2>{selectedBooking ? (isOwner ? "บันทึกการประชุม" : "รายละเอียดการจอง") : "จองห้องประชุม"}</h2>
                            <button className={styles.closeModalBtn} onClick={() => setIsModalOpen(false)}>&times;</button>
                        </div>
                        
                        <div className={styles.modalBody}>
                        <div className={styles.formGroup}>
                            <label>เลือกห้องประชุม</label>
                            <select 
                                value={newBooking.room_id} 
                                onChange={e => setNewBooking({...newBooking, room_id: e.target.value})}
                                disabled={!isOwner}
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
                                disabled={!isOwner}
                            />
                        </div>

                        <div className={styles.timeGrid}>
                            <div className={styles.formGroup}>
                                <label>เริ่มเวลา (24h)</label>
                                <select 
                                    value={newBooking.startTime}
                                    onChange={e => setNewBooking({...newBooking, startTime: e.target.value})}
                                    disabled={!isOwner}
                                >
                                    {timeSlots.map(h => {
                                        return [0, 15, 30, 45].map(m => {
                                            const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                            return <option key={time} value={time}>{time}</option>;
                                        });
                                    })}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>สิ้นสุดเวลา (24h)</label>
                                <select 
                                    value={newBooking.endTime}
                                    onChange={e => setNewBooking({...newBooking, endTime: e.target.value})}
                                    disabled={!isOwner}
                                >
                                    {timeSlots.map(h => {
                                        return [0, 15, 30, 45].map(m => {
                                            const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                            return <option key={time} value={time}>{time}</option>;
                                        });
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
                                disabled={!isOwner}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>ผู้เข้าร่วมประชุม</label>
                            <div className={styles.dropdownContainer} ref={dropdownRef}>
                                <div 
                                    className={`${styles.dropdownHeader} ${!isOwner ? styles.disabled : ""}`}
                                    onClick={() => isOwner && setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    {newBooking.attendee_ids.length > 0 
                                        ? `เลือกแล้ว ${newBooking.attendee_ids.length} คน`
                                        : "เลือกผู้เข้าร่วม..."}
                                    <span className={styles.chevron}>{isDropdownOpen ? "▲" : "▼"}</span>
                                </div>
                                
                                {isDropdownOpen && (
                                    <div className={styles.dropdownMenu}>
                                        <input 
                                            type="text" 
                                            className={styles.searchInput}
                                            placeholder="ค้นหาชื่อ..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            onClick={e => e.stopPropagation()}
                                            autoFocus
                                        />
                                        <div className={styles.optionsList}>
                                            {employees
                                            .filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map(emp => (
                                                <div 
                                                    key={emp.emp_id} 
                                                    className={`${styles.optionItem} ${newBooking.attendee_ids.includes(emp.emp_id) ? styles.selected : ""}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const ids = newBooking.attendee_ids.includes(emp.emp_id)
                                                            ? newBooking.attendee_ids.filter(id => id !== emp.emp_id)
                                                            : [...newBooking.attendee_ids, emp.emp_id];
                                                        setNewBooking({...newBooking, attendee_ids: ids});
                                                    }}
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={newBooking.attendee_ids.includes(emp.emp_id)}
                                                        readOnly
                                                    />
                                                    <span>{emp.name}{emp.nickname ? ` (${emp.nickname})` : ""}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {newBooking.attendee_ids.length > 0 && (
                                <div className={styles.selectedBadges}>
                                    {newBooking.attendee_ids.map(id => {
                                        const emp = employees.find(e => e.emp_id === id);
                                        return emp ? (
                                            <span key={id} className={styles.badge}>
                                                {emp.name.split(" ")[0]}{emp.nickname ? ` (${emp.nickname})` : ""}
                                                {isOwner && <button onClick={() => setNewBooking({...newBooking, attendee_ids: newBooking.attendee_ids.filter(i => i !== id)})}>&times;</button>}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            )}
                        </div>

                        {selectedBooking && (() => {
                            let agendas: { person: string, details: string }[] = [];
                            try {
                                if (newBooking.minutes && newBooking.minutes.startsWith('[')) {
                                    agendas = JSON.parse(newBooking.minutes);
                                } else if (newBooking.minutes) {
                                    agendas = [{ person: "", details: newBooking.minutes }];
                                } else {
                                    agendas = [{ person: "", details: "" }];
                                }
                            } catch (e) {
                                agendas = [{ person: "", details: newBooking.minutes || "" }];
                            }

                            const updateAgenda = (index: number, field: 'person'|'details', value: string) => {
                                const newAgendas = [...agendas];
                                newAgendas[index][field] = value;
                                setNewBooking({ ...newBooking, minutes: JSON.stringify(newAgendas) });
                            };

                            const addAgenda = () => {
                                const newAgendas = [...agendas, { person: "", details: "" }];
                                setNewBooking({ ...newBooking, minutes: JSON.stringify(newAgendas) });
                            };

                            const removeAgenda = (index: number) => {
                                const newAgendas = agendas.filter((_, i) => i !== index);
                                setNewBooking({ ...newBooking, minutes: JSON.stringify(newAgendas) });
                            };

                            return (
                                <div className={styles.formGroup} style={{ marginTop: 20 }}>
                                    <label style={{ fontSize: '1.1em', borderBottom: '1px solid #ccc', paddingBottom: 8, marginBottom: 12 }}>
                                        วาระการประชุม (Meeting Agendas)
                                    </label>
                                    
                                    {agendas.map((agenda, i) => (
                                        <div key={i} style={{ padding: '12px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '12px', background: '#fafafa' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <strong>วาระที่ {i + 1}</strong>
                                                {isOwner && (
                                                    <button 
                                                        onClick={() => removeAgenda(i)}
                                                        style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '18px' }}
                                                    >&times;</button>
                                                )}
                                            </div>
                                            
                                            <div style={{ marginBottom: 8 }}>
                                                <input 
                                                    type="text" 
                                                    placeholder="ผู้รับผิดชอบ (Person in Charge) เช่น นายเอกชัย (คุณเอก)" 
                                                    value={agenda.person}
                                                    onChange={e => updateAgenda(i, 'person', e.target.value)}
                                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                                                    disabled={!isOwner}
                                                />
                                            </div>
                                            <div>
                                                <textarea 
                                                    placeholder="รายละเอียดงาน / ข้อสรุป..."
                                                    rows={3}
                                                    value={agenda.details}
                                                    onChange={e => updateAgenda(i, 'details', e.target.value)}
                                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                                                    disabled={!isOwner}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {isOwner && (
                                        <button 
                                            onClick={addAgenda}
                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px dashed #ccc', background: 'transparent', cursor: 'pointer', color: '#666' }}
                                        >
                                            + เพิ่มวาระการประชุม
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                            {selectedBooking && (
                                <button 
                                    className={styles.pdfBtn}
                                    onClick={() => window.open(`/api/bookings/export-pdf?id=${selectedBooking.id}`, '_blank')}
                                >
                                    ดาวน์โหลด PDF
                                </button>
                            )}
                            {(isOwner || !selectedBooking) && (
                                <button className={styles.submitBtn} onClick={submitBooking}>
                                    {selectedBooking ? "บันทึกการเปลี่ยนแปลง" : "ยืนยันการจอง"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isSubmitting && (
                <div className={styles.submittingOverlay}>
                    <div className={styles.spinner}></div>
                    <div>กำลังบันทึกข้อมูล...</div>
                </div>
            )}
        </div>
    );
}
