"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GiftIcon, TrophyIcon } from "@heroicons/react/24/outline";
import SpinningWheelModal from "./components/SpinningWheelModal";

export default function AdminWheelPage() {
    const router = useRouter();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [spinState, setSpinState] = useState<Record<number, { spinning: boolean, winners: any[] }>>({});
    const [activeWheelPrize, setActiveWheelPrize] = useState<any>(null);

    useEffect(() => {
        checkAdmin();
    }, []);

    const checkAdmin = async () => {
        try {
            const res = await fetch("/api/admin/me");
            const data = await res.json();
            if (!data.ok) {
                router.push("/");
            } else {
                fetchEvents();
            }
        } catch {
            router.push("/");
        }
    };

    const fetchEvents = async () => {
        try {
            // We can reuse the same endpoint for active events, but we might want all events or just the active one
            const res = await fetch("/api/wheel/events/active");
            const data = await res.json();
            if (data.event) {
                setEvents([{ ...data.event, prizes: data.prizes }]);
            }
        } catch (error) {
            console.error("Failed to fetch events", error);
        } finally {
            setLoading(false);
        }
    };

    const executeSpin = async (prizeId: number) => {
        try {
            const res = await fetch(`/api/wheel/prizes/${prizeId}/spin`, {
                method: "POST"
            });
            const data = await res.json();
            if (data.success) {
                setSpinState(prev => ({ 
                    ...prev, 
                    [prizeId]: { spinning: false, winners: data.winners } 
                }));
                fetchEvents(); // Refresh data
                return { success: true, winners: data.winners };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์" };
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">กำลังโหลดหน้าสุ่มรางวัลผู้ดูแลระบบ...</div>;

    if (events.length === 0) return <div className="p-8 text-center text-gray-500">ไม่พบกิจกรรมลุ้นรางวัลที่เปิดใช้งานอยู่</div>;

    return (
        <>
        <div className="p-8 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <GiftIcon className="w-8 h-8 text-purple-600" />
                ระบบสุ่มรางวัลผู้ดูแลระบบ
            </h1>

            {events.map(event => (
                <div key={event.id} className="bg-white border rounded-lg shadow-sm p-6 mb-8">
                    <div className="mb-6 pb-4 border-b">
                        <h2 className="text-2xl font-bold">{event.name}</h2>
                        <p className="text-gray-500 mt-1">{event.description}</p>
                    </div>

                    <div className="space-y-6">
                        {event.prizes.map((prize: any) => {
                            const state = spinState[prize.id] || { spinning: false, winners: prize.winners || [] };
                            const canDraw = prize.totalTickets > 0 && prize.uniqueParticipants > 0;
                            // Checking if winners were already drawn would require backend to return winner count.
                            // Assuming backend blocks a second draw anyway.

                            return (
                                <div key={prize.id} className="border rounded-md p-4 bg-gray-50 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                            <TrophyIcon className="w-5 h-5 text-yellow-500" />
                                            {prize.name} {prize.bonusAmount > 0 ? `(${prize.bonusAmount.toLocaleString()} บาท)` : ''}
                                        </h3>
                                        <div className="text-sm text-gray-600 mt-1 flex gap-4">
                                            <span>จำนวนรางวัล: <strong className="text-gray-900">{prize.quantity}</strong></span>
                                            <span>สิทธิ์ทั้งหมด: <strong className="text-gray-900">{prize.totalTickets}</strong></span>
                                            <span>จำนวนผู้เข้าร่วม: <strong className="text-gray-900">{prize.uniqueParticipants}</strong></span>
                                        </div>
                                        
                                        {state.winners.length > 0 && (
                                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
                                                <strong>รายชื่อผู้โชคดี:</strong> 
                                                <ul className="list-disc pl-5 mt-1">
                                                    {state.winners.map((w: any, idx: number) => {
                                                        const empName = w.employee?.name || w.emp_id;
                                                        const nickname = w.employee?.nickname ? ` (${w.employee.nickname})` : '';
                                                        return (
                                                            <li key={idx}>
                                                                {empName}{nickname} <span className="text-gray-500 text-xs ml-1">(รหัส: {w.emp_id})</span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-col items-end">
                                        <button 
                                            onClick={() => setActiveWheelPrize(prize)}
                                            disabled={!canDraw || state.winners.length > 0}
                                            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded shadow disabled:opacity-50 transition-colors"
                                        >
                                            {state.winners.length > 0 ? "สุ่มรางวัลแล้ว" : "วงล้อสุ่มผู้โชคดี"}
                                        </button>
                                        {!canDraw && <span className="text-xs text-gray-400 mt-2">ยังไม่มีสิทธิ์เข้าลุ้น</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>

            {activeWheelPrize && (
                <SpinningWheelModal
                    isOpen={true}
                    prizeId={activeWheelPrize.id}
                    prizeName={`${activeWheelPrize.name} ${activeWheelPrize.bonusAmount > 0 ? `(${activeWheelPrize.bonusAmount.toLocaleString()} บาท)` : ''}`}
                    onClose={() => setActiveWheelPrize(null)}
                    onSpin={() => executeSpin(activeWheelPrize.id)}
                />
            )}
        </>
    );
}
