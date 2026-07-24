"use client";

import { useState, useEffect } from "react";
import { GiftIcon, CheckIcon, StarIcon } from "@heroicons/react/24/outline";

const COIN_OPTIONS = [
    { type: "BRONZE", label: "Bronze", coinsRequired: 20, ticketsPerUnit: 1 },
    { type: "SILVER", label: "Silver", coinsRequired: 1, ticketsPerUnit: 2 },
    { type: "TASK", label: "Task", coinsRequired: 1, ticketsPerUnit: 3 },
    { type: "EVENT", label: "Event", coinsRequired: 1, ticketsPerUnit: 5 },
    { type: "GOLD", label: "Gold", coinsRequired: 1, ticketsPerUnit: 25 },
    { type: "KPI", label: "KPI", coinsRequired: 1, ticketsPerUnit: 40 },
];

export default function WheelRedeemSection() {
    const [event, setEvent] = useState<any>(null);
    const [prizes, setPrizes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [coinType, setCoinType] = useState("BRONZE");
    const [coinAmount, setCoinAmount] = useState(20);
    const [selectedPrizeId, setSelectedPrizeId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    
    // Modal states
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        fetchEvent();
    }, []);

    const fetchEvent = async () => {
        try {
            const res = await fetch("/api/wheel/events/active");
            const data = await res.json();
            if (data.event) {
                setEvent(data.event);
                setPrizes(data.prizes);
                if (data.prizes.length > 0) {
                    setSelectedPrizeId(data.prizes[0].id.toString());
                }
            }
        } catch (error) {
            console.error("Failed to fetch wheel event", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRedeem = async () => {
        if (!selectedPrizeId || coinAmount <= 0) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/wheel/prizes/${selectedPrizeId}/redeem`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ coinType, coinAmount: Number(coinAmount) })
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMessage(`แลกสิทธิ์สำเร็จจำนวน ${data.tickets} สิทธิ์!`);
                fetchEvent(); // refresh pool stats
            } else {
                setErrorMessage(data.error || "ไม่สามารถแลกสิทธิ์ได้");
            }
        } catch (error) {
            setErrorMessage("เกิดข้อผิดพลาดในการแลกสิทธิ์");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-4 border rounded shadow mt-6 animate-pulse bg-gray-50 h-64"></div>;
    if (!event) return null; // No active event

    const rate = COIN_OPTIONS.find(c => c.type === coinType) || COIN_OPTIONS[0];
    const tickets = Math.floor(coinAmount / rate.coinsRequired) * rate.ticketsPerUnit;
    const selectedPrize = prizes.find(p => p.id.toString() === selectedPrizeId);
    const isExpired = event.end_date ? new Date(event.end_date) < new Date() : false;
    const btnDisabled = tickets <= 0 || submitting || isExpired;

    return (
        <div className="mt-12 p-6 sm:p-8 bg-white border border-gray-200 rounded-2xl shadow-sm transition-shadow hover:shadow-md relative overflow-hidden" style={{ fontFamily: 'var(--font-th)' }}>
            <div className="border-b pb-5 mb-6 border-gray-100">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
                    <GiftIcon className="w-7 h-7" style={{ color: 'var(--red)' }} />
                    แลกสิทธิ์ลุ้นรับของรางวัล
                </h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                    <p className="text-gray-500 text-sm font-medium">กิจกรรม: {event.name}</p>
                    {event.end_date && (
                        <p className="text-sm font-medium" style={{ color: isExpired ? 'var(--red)' : 'var(--orange)' }}>
                            {isExpired ? 'หมดเขตแล้ว' : `หมดเขต: ${new Date(event.end_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} เวลา ${new Date(event.end_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`}
                        </p>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                <div className="p-5 sm:p-6 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full inline-block" style={{ backgroundColor: 'var(--red)' }}></span>
                        ใช้เหรียญ
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:gap-6 gap-4 items-start sm:items-center">
                        <div className="w-full sm:w-auto">
                            <label className="block text-sm text-gray-500 mb-1.5">ประเภทเหรียญ</label>
                            <select 
                                value={coinType} 
                                onChange={(e) => {
                                    const newType = e.target.value;
                                    setCoinType(newType);
                                    const newRate = COIN_OPTIONS.find(c => c.type === newType) || COIN_OPTIONS[0];
                                    setCoinAmount(newRate.coinsRequired);
                                }}
                                className="w-full sm:w-40 border border-gray-300 rounded-lg p-2.5 focus:ring-2 outline-none transition-all disabled:opacity-50"
                                style={{ outlineColor: 'var(--red-border)' }}
                                disabled={isExpired}
                            >
                                {COIN_OPTIONS.map(opt => (
                                    <option key={opt.type} value={opt.type}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="block text-sm text-gray-500 mb-1.5">จำนวนเหรียญ</label>
                            <input 
                                type="number" 
                                min={rate.coinsRequired} 
                                step={rate.coinsRequired}
                                value={coinAmount}
                                onChange={(e) => setCoinAmount(parseInt(e.target.value) || 0)}
                                className="w-full sm:w-32 border border-gray-300 rounded-lg p-2.5 focus:ring-2 outline-none transition-all disabled:opacity-50"
                                style={{ outlineColor: 'var(--red-border)' }}
                                disabled={isExpired}
                            />
                        </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-gray-200">
                        <p className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--ok)' }}>
                            <CheckIcon className="w-5 h-5" />
                            คุณจะได้รับ: <span className="text-xl font-bold">{tickets}</span> สิทธิ์
                        </p>
                    </div>
                </div>

                <div className="p-5 sm:p-6 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full inline-block" style={{ backgroundColor: 'var(--orange)' }}></span>
                        เลือกลุ้นรางวัล
                    </h3>
                    <select
                        value={selectedPrizeId}
                        onChange={(e) => setSelectedPrizeId(e.target.value)}
                        className="w-full sm:max-w-md border border-gray-300 rounded-lg p-2.5 focus:ring-2 outline-none transition-all disabled:opacity-50"
                        style={{ outlineColor: 'var(--red-border)' }}
                        disabled={isExpired}
                    >
                        {prizes.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name} — {p.bonusAmount > 0 ? `${p.bonusAmount.toLocaleString()} บาท ` : ''}({p.quantity} รางวัล)
                            </option>
                        ))}
                    </select>

                    {selectedPrize && (
                        <div className="mt-5 flex flex-col sm:flex-row gap-4 sm:gap-6">
                            <div className="flex-1 bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center">
                                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">สิทธิ์ทั้งหมดในระบบ</span>
                                <div className="text-gray-800 font-semibold flex items-baseline gap-1">
                                    <span className="text-2xl">{selectedPrize.totalTickets}</span> <span className="text-sm text-gray-500 font-normal">สิทธิ์</span>
                                    <span className="text-gray-300 mx-2 font-normal">/</span>
                                    <span className="text-lg">{selectedPrize.uniqueParticipants}</span> <span className="text-sm text-gray-500 font-normal">คน</span>
                                </div>
                            </div>
                            <div className="flex-1 bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center">
                                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">สิทธิ์ของคุณ</span>
                                <div className="text-gray-800 font-semibold flex items-baseline gap-1">
                                    <span className="text-2xl" style={{ color: 'var(--red)' }}>{selectedPrize.myTickets}</span> <span className="text-sm text-gray-500 font-normal">สิทธิ์</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-2 flex justify-end">
                    <button 
                        onClick={handleRedeem}
                        disabled={btnDisabled}
                        className="text-white font-semibold py-3 px-8 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{ 
                            backgroundColor: btnDisabled ? 'var(--gray-400)' : 'var(--red)',
                            boxShadow: btnDisabled ? 'none' : 'var(--shadow-red)'
                        }}
                    >
                        {!submitting && <CheckIcon className="w-5 h-5" />}
                        {submitting ? "กำลังดำเนินการ..." : (isExpired ? "หมดเขตการแลกสิทธิ์แล้ว" : "ยืนยันการแลกสิทธิ์")}
                    </button>
                </div>
            </div>

            {/* Success Modal */}
            {successMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckIcon className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>สำเร็จ!</h3>
                        <p className="text-gray-600 mb-8 font-medium">{successMessage}</p>
                        <button 
                            onClick={() => setSuccessMessage("")}
                            className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors"
                        >
                            ตกลง
                        </button>
                    </div>
                </div>
            )}

            {/* Error Modal */}
            {errorMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>ผิดพลาด</h3>
                        <p className="text-gray-600 mb-8 font-medium">{errorMessage}</p>
                        <button 
                            onClick={() => setErrorMessage("")}
                            className="w-full bg-red-600 text-white font-semibold py-3 rounded-xl hover:bg-red-700 transition-colors"
                        >
                            ตกลง
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
