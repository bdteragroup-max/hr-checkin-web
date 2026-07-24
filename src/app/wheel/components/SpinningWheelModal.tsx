"use client";

import { useState, useEffect } from "react";
import { XMarkIcon, TrophyIcon, SparklesIcon } from "@heroicons/react/24/outline";

interface Winner {
    emp_id: string;
}

interface SpinningWheelModalProps {
    isOpen: boolean;
    prizeId: number;
    prizeName: string;
    onClose: () => void;
    onSpin: () => Promise<{ success: boolean; winners?: Winner[]; error?: string }>;
}

const WHEEL_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', 
    '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'
];

export default function SpinningWheelModal({ isOpen, prizeId, prizeName, onClose, onSpin }: SpinningWheelModalProps) {
    const [phase, setPhase] = useState<'idle' | 'spinning' | 'celebration'>('idle');
    const [rotation, setRotation] = useState(0);
    const [winners, setWinners] = useState<Winner[]>([]);
    const [error, setError] = useState("");
    const [participants, setParticipants] = useState<string[]>([]);
    const [isLoadingSlices, setIsLoadingSlices] = useState(true);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPhase('idle');
            setRotation(0);
            setWinners([]);
            setError("");
            
            // Fetch participants
            setIsLoadingSlices(true);
            fetch(`/api/wheel/prizes/${prizeId}/participants`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.participants) {
                        setParticipants(data.participants);
                    }
                })
                .catch(err => console.error(err))
                .finally(() => setIsLoadingSlices(false));
        }
    }, [isOpen, prizeId]);

    if (!isOpen) return null;

    const handleSpin = async () => {
        if (phase !== 'idle') return;

        setPhase('spinning');
        setError("");
        
        // Spin animation: Add 10 full rotations plus a random offset so it stops on a random slice visually
        const newRotation = rotation + 3600 + Math.floor(Math.random() * 360);
        setRotation(newRotation);

        try {
            // Call the backend to actually draw the winner securely
            const result = await onSpin();
            
            // Wait for the 4-second CSS spinning animation to finish
            setTimeout(() => {
                if (result.success && result.winners) {
                    setWinners(result.winners);
                    setPhase('celebration');
                } else {
                    setError(result.error || "เกิดข้อผิดพลาดในการสุ่มรางวัล");
                    setPhase('idle');
                }
            }, 4000); 

        } catch (err) {
            setTimeout(() => {
                setError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
                setPhase('idle');
            }, 4000);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative overflow-hidden flex flex-col items-center p-8 text-center" style={{ fontFamily: 'var(--font-th, sans-serif)' }}>
                
                {/* Close Button */}
                {phase !== 'spinning' && (
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                )}

                <h2 className="text-3xl font-bold text-gray-800 mb-2 mt-4 flex items-center gap-3 justify-center" style={{ fontFamily: 'var(--font-display, sans-serif)' }}>
                    <SparklesIcon className="w-8 h-8 text-purple-600" />
                    สุ่มผู้โชคดี
                </h2>
                <p className="text-gray-500 text-lg mb-8 font-medium">รางวัล: {prizeName}</p>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg w-full max-w-md">
                        {error}
                    </div>
                )}

                {/* The Wheel Container */}
                <div className="relative w-72 h-72 sm:w-96 sm:h-96 my-4">
                    {/* The Pointer */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 drop-shadow-md">
                        <div className="w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[32px] border-t-red-600"></div>
                    </div>

                    {/* The Spinning Wheel */}
                    <div 
                        className="w-full h-full rounded-full border-4 border-white shadow-[0_0_20px_rgba(0,0,0,0.15)] relative overflow-hidden"
                        style={{
                            background: participants.length > 0 ? `conic-gradient(${
                                participants.map((_, i) => {
                                    const startAngle = (i * 360) / participants.length;
                                    const endAngle = ((i + 1) * 360) / participants.length;
                                    const color = WHEEL_COLORS[i % WHEEL_COLORS.length];
                                    return `${color} ${startAngle}deg ${endAngle}deg`;
                                }).join(', ')
                            })` : '#ccc',
                            transform: `rotate(${rotation}deg)`,
                            transition: phase === 'spinning' ? 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
                        }}
                    >
                        {/* Text slices */}
                        {participants.map((emp_id, i) => {
                            const angle = (i * 360) / participants.length + (360 / participants.length) / 2;
                            const isLeft = angle > 180;
                            return (
                                <div 
                                    key={i}
                                    className="absolute top-1/2 left-1/2 w-1/2 h-6 -mt-3 origin-left flex items-center pr-8"
                                    style={{
                                        transform: `rotate(${angle - 90}deg)`,
                                        textAlign: isLeft ? 'left' : 'right',
                                        justifyContent: 'flex-end',
                                    }}
                                >
                                    <span 
                                        className="text-white font-bold text-xs sm:text-sm drop-shadow-md truncate w-24 sm:w-32 inline-block"
                                        style={{ 
                                            transform: isLeft ? 'rotate(180deg)' : 'none',
                                            textAlign: isLeft ? 'left' : 'right' 
                                        }}
                                    >
                                        {emp_id}
                                    </span>
                                </div>
                            );
                        })}

                        {!isLoadingSlices && participants.length === 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 z-10">
                                <span className="text-gray-400 font-medium text-lg leading-tight">
                                    ผู้เข้าร่วมทั้งหมดได้รับรางวัลอื่นไปแล้ว
                                </span>
                            </div>
                        )}

                        {/* Inner dots/decorations for the wheel to make it look like a carnival wheel */}
                        <div className="absolute inset-2 border-[4px] border-white/20 rounded-full border-dashed pointer-events-none"></div>
                    </div>

                    {/* Center Button */}
                    <button
                        onClick={handleSpin}
                        disabled={phase !== 'idle' || isLoadingSlices || participants.length === 0}
                        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center font-bold text-xl uppercase transition-transform ${(phase === 'idle' && !isLoadingSlices && participants.length > 0) ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'opacity-80 cursor-not-allowed'}`}
                        style={{ color: 'var(--red, #ef4444)', fontFamily: 'var(--font-display, sans-serif)' }}
                    >
                        {isLoadingSlices ? '...' : (phase === 'spinning' ? '...' : 'SPIN')}
                    </button>
                </div>

                {/* Celebration Overlay */}
                {phase === 'celebration' && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
                        <TrophyIcon className="w-24 h-24 text-yellow-500 mb-6 drop-shadow-lg animate-bounce" />
                        <h2 className="text-4xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'var(--font-display, sans-serif)' }}>ยินดีด้วย! ผู้โชคดีคือ</h2>
                        <div className="flex flex-col gap-3 w-full max-w-sm">
                            {winners.map((w: any, idx: number) => {
                                const empName = w.employee?.name || w.emp_id;
                                const nickname = w.employee?.nickname ? ` (${w.employee.nickname})` : '';
                                return (
                                    <div key={idx} className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 text-orange-700 py-4 px-6 rounded-xl shadow-sm text-center">
                                        <div className="font-bold text-xl sm:text-2xl">{empName}{nickname}</div>
                                        <div className="text-sm text-orange-600 mt-1">รหัส: {w.emp_id}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <button 
                            onClick={onClose}
                            className="mt-10 bg-gray-900 text-white px-8 py-3 rounded-full font-bold shadow hover:bg-gray-800 transition-colors"
                        >
                            ปิดหน้าต่าง
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
