"use client";

import React, { useState, useRef, useEffect } from "react";

type Option = {
    value: string | number;
    label: string;
};

type Props = {
    options: Option[];
    value: string | number;
    onChange: (val: any) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
};

export default function SearchableSelect({ options, value, onChange, placeholder = "เลือก...", disabled = false, className }: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    const selected = options.find(o => String(o.value) === String(value));

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
                setSearch("");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = options.filter(o => 
        o.label.toLowerCase().includes(search.toLowerCase()) || 
        String(o.value).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} style={{ position: "relative", width: "100%", zIndex: open ? 100 : 1 }}>
             <div 
                 className={className}
                 style={{ 
                     cursor: disabled ? "not-allowed" : "pointer", 
                     display: "flex", 
                     justifyContent: "space-between", 
                     alignItems: "center",
                     opacity: disabled ? 0.6 : 1,
                     background: "#ffffff",
                     border: "1.5px solid var(--gray-300, #d1d5dc)",
                     padding: "0 16px",
                     borderRadius: "10px",
                     fontSize: "16px",
                     height: "50px",
                     minHeight: "50px",
                     userSelect: "none",
                     transition: "all 0.2s",
                     boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                 }}
                 onClick={() => { if (!disabled) setOpen(!open); }}
             >
                 <span style={{ color: selected ? "#111827" : "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                     {selected ? selected.label : placeholder}
                 </span>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                     <polyline points="6 9 12 15 18 9"></polyline>
                 </svg>
             </div>
             
             {open && (
                 <div style={{ 
                     position: "absolute", 
                     top: "calc(100% + 8px)", 
                     left: 0, 
                     right: 0, 
                     zIndex: 1000, 
                     background: "#ffffff", 
                     border: "1px solid #e5e8ef", 
                     borderRadius: "12px", 
                     maxHeight: "300px", 
                     overflowY: "auto", 
                     boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                     display: "flex",
                     flexDirection: "column"
                 }}>
                     <div style={{ padding: "12px", position: "sticky", top: 0, background: "#ffffff", borderBottom: "1px solid #f3f4f6", zIndex: 2 }}>
                         <input 
                             autoFocus
                             type="text" 
                             style={{
                                 width: "100%",
                                 padding: "10px 14px",
                                 border: "1.5px solid #e5e8ef",
                                 borderRadius: "8px",
                                 fontSize: "14px",
                                 outline: "none",
                                 background: "#f9fafb",
                                 color: "#111827"
                             }}
                             placeholder="ค้นหา (ชื่อ / รหัส)..." 
                             value={search} 
                             onChange={e => setSearch(e.target.value)} 
                         />
                     </div>
                     <div style={{ flex: 1, padding: "6px" }}>
                         <div 
                             style={{ 
                                 padding: "10px 14px", 
                                 cursor: "pointer", 
                                 fontSize: "14px",
                                 color: "#9ca3af",
                                 borderRadius: "8px",
                                 background: !value ? "#f3f4f6" : "transparent",
                                 fontWeight: !value ? 600 : 400,
                                 marginBottom: "4px"
                             }}
                             onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
                             onMouseEnter={e => { if (value) e.currentTarget.style.background = "#f9fafb" }}
                             onMouseLeave={e => { if (value) e.currentTarget.style.background = "transparent" }}
                         >
                             — ไม่มี / ไม่ระบุ —
                         </div>
                         {filtered.length === 0 ? (
                             <div style={{ padding: "20px", fontSize: "14px", color: "#9ca3af", textAlign: "center" }}>
                                 ไม่พบข้อมูล
                             </div>
                         ) : (
                             filtered.map(o => {
                                 const isSelected = String(o.value) === String(value);
                                 return (
                                     <div 
                                         key={o.value} 
                                         style={{ 
                                             padding: "10px 14px", 
                                             cursor: "pointer", 
                                             fontSize: "14px",
                                             borderRadius: "8px",
                                             marginBottom: "2px",
                                             background: isSelected ? "rgba(217, 48, 37, 0.08)" : "transparent",
                                             color: isSelected ? "#d93025" : "#374151",
                                             fontWeight: isSelected ? 600 : 400
                                         }}
                                         onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                                         onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f9fafb" }}
                                         onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                                     >
                                         {o.label}
                                     </div>
                                 );
                             })
                         )}
                     </div>
                 </div>
             )}
        </div>
    );
}
