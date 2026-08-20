'use client';

import { useState, useRef, useEffect } from 'react';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import NewRepairModal from './NewRepairModal';

const FAB_SIZE = 56;
const EDGE_PADDING = 16;
const MOB_BAR_H = 88;
const DRAG_THRESHOLD = 6;

function getMobileOffset() {
    return window.innerWidth <= 640 ? MOB_BAR_H + EDGE_PADDING : EDGE_PADDING;
}

function clamp(x: number, y: number) {
    const bottomClearance = getMobileOffset();
    return {
        x: Math.min(Math.max(x, EDGE_PADDING), window.innerWidth - FAB_SIZE - EDGE_PADDING),
        y: Math.min(Math.max(y, EDGE_PADDING + FAB_SIZE + 16), window.innerHeight - FAB_SIZE - bottomClearance),
    };
}

export default function FloatingRepairButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const bottomClearance = getMobileOffset();
        setPos({
            x: window.innerWidth - FAB_SIZE - EDGE_PADDING,
            y: window.innerHeight - FAB_SIZE * 2 - bottomClearance - 16, // Placed slightly above the ticket button
        });

        const handleResize = () => {
            setPos(prev => prev ? clamp(prev.x, prev.y) : null);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const dragStartPos = useRef({ x: 0, y: 0 });
    const dragMoved = useRef(false);

    const resetDrag = () => {
        isDragging.current = false;
        dragMoved.current = false;
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragMoved.current = false;
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        dragOffset.current = {
            x: e.clientX - (pos?.x ?? 0),
            y: e.clientY - (pos?.y ?? 0),
        };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!isDragging.current) return;
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        if (!dragMoved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragMoved.current = true;
        setPos(clamp(
            e.clientX - dragOffset.current.x,
            e.clientY - dragOffset.current.y,
        ));
    };

    const handlePointerUp = () => {
        const wasTap = !dragMoved.current;
        resetDrag();
        if (wasTap) setIsOpen(true);
    };

    if (!pos) return null;

    return (
        <>
            <button
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={resetDrag}
                style={{
                    position: 'fixed',
                    left: pos.x,
                    top: pos.y,
                    width: `${FAB_SIZE}px`,
                    height: `${FAB_SIZE}px`,
                    borderRadius: '50%',
                    backgroundColor: '#ea580c', // Orange for facility repair
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 16px rgba(234, 88, 12, 0.5)',
                    cursor: isDragging.current ? 'grabbing' : 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    touchAction: 'none',
                    userSelect: 'none',
                    transition: 'box-shadow 0.2s, transform 0.15s',
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(234, 88, 12, 0.65)';
                    e.currentTarget.style.transform = 'scale(1.07)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(234, 88, 12, 0.5)';
                    e.currentTarget.style.transform = 'scale(1)';
                }}
                aria-label="Report Facility Repair"
                title="แจ้งซ่อมสาธารณูปโภค (ลากย้ายได้)"
            >
                <WrenchScrewdriverIcon width={28} />
            </button>

            <NewRepairModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}
