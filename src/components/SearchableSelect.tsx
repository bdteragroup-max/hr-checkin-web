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
        <div ref={ref} style={{ position: "relative", width: "100%" }}>
             <div 
                 className={className}
                 style={{ 
                     cursor: disabled ? "not-allowed" : "pointer", 
                     display: "flex", 
                     justifyContent: "space-between", 
                     alignItems: "center",
                     opacity: disabled ? 0.6 : 1,
                     background: "var(--surface)",
                     border: "1px solid var(--line)",
                     padding: "0 12px",
                     borderRadius: "8px",
                     fontSize: "14px",
                     height: "42px",
                     minHeight: "42px",
                     userSelect: "none"
                 }}
                 onClick={() => { if (!disabled) setOpen(!open); }}
             >
                 <span style={{ color: selected ? "var(--text)" : "var(--text4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                     {selected ? selected.label : placeholder}
                 </span>
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <polyline points="6 9 12 15 18 9"></polyline>
                 </svg>
             </div>
             
             {open && (
                 <div style={{ 
                     position: "absolute", 
                     top: "calc(100% + 4px)", 
                     left: 0, 
                     right: 0, 
                     zIndex: 50, 
                     background: "var(--surface)", 
                     border: "1px solid var(--line)", 
                     borderRadius: "8px", 
                     maxHeight: "260px", 
                     overflowY: "auto", 
                     boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                     display: "flex",
                     flexDirection: "column"
                 }}>
                     <div style={{ padding: "8px", position: "sticky", top: 0, background: "var(--surface)", borderBottom: "1px solid var(--line)", zIndex: 2 }}>
                         <input 
                             autoFocus
                             type="text" 
                             style={{
                                 width: "100%",
                                 padding: "8px 12px",
                                 border: "1px solid var(--line)",
                                 borderRadius: "6px",
                                 fontSize: "13px",
                                 outline: "none",
                                 background: "var(--bg)",
                                 color: "var(--text)"
                             }}
                             placeholder="ค้นหา (ชื่อ / รหัส)..." 
                             value={search} 
                             onChange={e => setSearch(e.target.value)} 
                         />
                     </div>
                     <div style={{ flex: 1, padding: "4px" }}>
                         <div 
                             style={{ 
                                 padding: "8px 12px", 
                                 cursor: "pointer", 
                                 fontSize: "13.5px",
                                 color: "var(--text3)",
                                 borderRadius: "6px",
                                 background: !value ? "var(--surface-2)" : "transparent",
                                 fontWeight: !value ? 600 : 400
                             }}
                             onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
                             onMouseEnter={e => { if (value) e.currentTarget.style.background = "var(--surface-2)" }}
                             onMouseLeave={e => { if (value) e.currentTarget.style.background = "transparent" }}
                         >
                             — ไม่มี / ไม่ระบุ —
                         </div>
                         {filtered.length === 0 ? (
                             <div style={{ padding: "12px", fontSize: "13px", color: "var(--text4)", textAlign: "center" }}>
                                 ไม่พบข้อมูล
                             </div>
                         ) : (
                             filtered.map(o => {
                                 const isSelected = String(o.value) === String(value);
                                 return (
                                     <div 
                                         key={o.value} 
                                         style={{ 
                                             padding: "8px 12px", 
                                             cursor: "pointer", 
                                             fontSize: "13.5px",
                                             borderRadius: "6px",
                                             marginTop: "2px",
                                             background: isSelected ? "var(--ok-bg)" : "transparent",
                                             color: isSelected ? "var(--ok)" : "var(--text)",
                                             fontWeight: isSelected ? 600 : 400
                                         }}
                                         onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                                         onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface-2)" }}
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
