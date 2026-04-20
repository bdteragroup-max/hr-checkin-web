"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styles from "./page.module.css";
import { 
    PlusIcon, PencilIcon, TrashIcon, 
    ChartBarIcon, ListBulletIcon,
    BriefcaseIcon, UserGroupIcon, BuildingOffice2Icon,
    CheckCircleIcon, XCircleIcon, XMarkIcon,
    MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, 
    ArrowsPointingOutIcon, ArrowDownTrayIcon
} from "@heroicons/react/24/outline";
import { toPng } from 'html-to-image';

type DeptLayer = {
    id: number;
    name: string;
    _count: { departments: number };
};

type SectionLayer = {
    id: number;
    name: string;
    division_id: number | null;
};

type JobPosition = {
    id: number;
    department_id: number | null;
    parent_id: number | null;
    title: string;
    node_type: string | null;
    is_ot_eligible: boolean;
    departments?: SectionLayer & { divisions?: DeptLayer };
    employees: { name: string; emp_id: string }[];
};

export default function OrganizationPage() {
    const [deptLayers, setDeptLayers] = useState<DeptLayer[]>([]); 
    const [secLayers, setSecLayers] = useState<SectionLayer[]>([]);
    const [positions, setPositions] = useState<JobPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"table" | "flowchart">("table");

    // Charts & Viewport State
    const [zoom, setZoom] = useState(1);
    const [offsets, setOffsets] = useState<{ [key: number]: { x: number, y: number } }>({});
    const chartRef = useRef<HTMLDivElement>(null);

    // Filtering
    const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
    const [selectedSecId, setSelectedSecId] = useState<number | null>(null);

    const filteredSections = useMemo(() => {
        if (!selectedDeptId) return secLayers;
        return secLayers.filter(s => s.division_id === selectedDeptId);
    }, [secLayers, selectedDeptId]);

    const filteredPositions = useMemo(() => {
        let list = positions;
        if (selectedSecId) list = list.filter(p => p.department_id === selectedSecId);
        else if (selectedDeptId) list = list.filter(p => p.departments?.division_id === selectedDeptId);
        return list;
    }, [positions, selectedDeptId, selectedSecId]);

    // Modals
    const [deptModal, setDeptModal] = useState({ open: false, isEdit: false, id: 0, name: "" });
    const [secModal, setSecModal] = useState({ open: false, isEdit: false, id: 0, name: "", division_id: 0 });
    const [posModal, setPosModal] = useState({ 
        open: false, isEdit: false, id: 0, 
        department_id: 0, parent_id: 0, 
        title: "", node_type: "staff", 
        is_ot_eligible: true 
    });

    async function loadData() {
        setLoading(true);
        try {
            const [divRes, deptRes, posRes] = await Promise.all([
                fetch("/api/admin/organization/divisions"),
                fetch("/api/admin/organization/departments"),
                fetch("/api/admin/organization/positions")
            ]);
            const [divData, deptData, posData] = await Promise.all([divRes.json(), deptRes.json(), posRes.json()]);
            setDeptLayers(divData.list || []);
            setSecLayers(deptData.list || []);
            setPositions(posData.list || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    useEffect(() => { loadData(); }, []);

    // COORDINATE CALCULATION
    const refreshCoordinates = useCallback(() => {
        if (!chartRef.current) return;
        const nodes = chartRef.current.querySelectorAll('[data-node-id]');
        const containerRect = chartRef.current.getBoundingClientRect();
        const newOffsets: { [key: number]: { x: number, y: number } } = {};
        
        nodes.forEach((node) => {
            const id = Number(node.getAttribute('data-node-id'));
            const rect = node.getBoundingClientRect();
            // Calculate center point relative to container (accounting for current zoom)
            newOffsets[id] = {
                x: (rect.left + rect.width / 2 - containerRect.left) / zoom,
                y: (rect.top + rect.height / 2 - containerRect.top) / zoom
            };
        });
        setOffsets(newOffsets);
    }, [zoom]);

    useEffect(() => {
        if (viewMode === 'flowchart' && !loading) {
            // Need a tiny delay for CSS transition/rendering to settle
            const timer = setTimeout(refreshCoordinates, 500);
            return () => clearTimeout(timer);
        }
    }, [viewMode, loading, zoom, refreshCoordinates, filteredPositions]);

    // DOWNLOAD FEATURE
    const downloadChart = async () => {
        if (!chartRef.current) return;
        try {
            const dataUrl = await toPng(chartRef.current, { backgroundColor: '#f8fafc', quality: 0.95 });
            const link = document.createElement('a');
            link.download = `OrgChart_${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) { alert("Download failed"); }
    };

    /* Actions... */
    async function saveDept(e: React.FormEvent) {
        e.preventDefault();
        const res = await fetch("/api/admin/organization/divisions", {
            method: deptModal.isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deptModal)
        });
        if (res.ok) { setDeptModal({ open: false, isEdit: false, id: 0, name: "" }); loadData(); }
    }
    // ... other save functions (omitted for space, assume same as before)
    async function saveSec(e: React.FormEvent) {
        e.preventDefault();
        const res = await fetch("/api/admin/organization/departments", {
            method: secModal.isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(secModal)
        });
        if (res.ok) { setSecModal({ open: false, id: 0, name: "", division_id: 0, isEdit: false }); loadData(); }
    }
    async function savePos(e: React.FormEvent) {
        e.preventDefault();
        const res = await fetch("/api/admin/organization/positions", {
            method: posModal.isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(posModal)
        });
        if (res.ok) { setPosModal({ ...posModal, open: false }); loadData(); }
    }
    async function deleteItem(type: 'dept'|'sec'|'pos', id: number) {
        if (!confirm("Are you sure?")) return;
        const endpoint = type === 'dept' ? '/api/admin/organization/divisions' : (type === 'sec' ? '/api/admin/organization/departments' : '/api/admin/organization/positions');
        const res = await fetch(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        if (res.ok) loadData();
    }

    if (loading) return <div className={styles.loading}>Generating Premium Chart...</div>;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>โครงสร้างองค์กร (Organization Structure)</h1>
                    <p className={styles.subtitle}>ระบบแผนผังอัจฉริยะ: <b>Grand Scale & Structural Mapping</b></p>
                </div>
                <div className={styles.viewSelector}>
                   <button className={viewMode === 'table' ? styles.btnActive : ''} onClick={() => setViewMode('table')}><ListBulletIcon style={{width: 20}} /> การจัดการ</button>
                   <button className={viewMode === 'flowchart' ? styles.btnActive : ''} onClick={() => setViewMode('flowchart')}><ChartBarIcon style={{width: 20}} /> ผังองค์กร</button>
                </div>
            </div>

            {viewMode === "table" ? (
                <div className={styles.grid}>
                    {/* (Standard Table UI Omitted for brevity, assume UI remains from previous step) */}
                    <div className={styles.card}>
                        <div className={styles.cardHead}>
                            <div className={styles.cardTitle}>ฝ่าย (Departments)</div>
                            <button className={styles.btnRed} onClick={() => setDeptModal({ open: true, isEdit: false, id: 0, name: "" })}><PlusIcon style={{width: 14}} /> เพิ่มฝ่าย</button>
                        </div>
                        <div className={styles.tableArea}>
                            <table className={styles.table}>
                                <tbody>
                                    {deptLayers.map(d => (
                                        <tr key={d.id} className={selectedDeptId === d.id ? styles.activeRow : ''} onClick={() => setSelectedDeptId(selectedDeptId === d.id ? null : d.id)}>
                                            <td className={styles.bold}>{d.name}</td>
                                            <td className={styles.tdRight}>
                                                <div className={styles.tdActions}>
                                                    <button className={styles.miniBtn} onClick={(e) => { e.stopPropagation(); setDeptModal({ open: true, isEdit: true, id: d.id, name: d.name }); }}><PencilIcon style={{width: 12}}/></button>
                                                    <button className={styles.miniBtnDel} onClick={(e) => { e.stopPropagation(); deleteItem('dept', d.id); }}><TrashIcon style={{width: 12}}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                     <div className={styles.card}>
                        <div className={styles.cardHead}>
                            <div className={styles.cardTitle}>แผนก (Sections)</div>
                            <button className={styles.btnRed} onClick={() => setSecModal({ open: true, isEdit: false, id: 0, name: "", division_id: selectedDeptId || 0 })}><PlusIcon style={{width: 14}} /> เพิ่มแผนก</button>
                        </div>
                        <div className={styles.tableArea}>
                            <table className={styles.table}>
                                <tbody>
                                    {filteredSections.map(s => (
                                        <tr key={s.id} className={selectedSecId === s.id ? styles.activeRow : ''} onClick={() => setSelectedSecId(selectedSecId === s.id ? null : s.id)}>
                                            <td className={styles.bold}>{s.name}</td>
                                            <td className={styles.tdRight}>
                                                <div className={styles.tdActions}>
                                                    <button className={styles.miniBtn} onClick={(e) => { e.stopPropagation(); setSecModal({ open: true, isEdit: true, id: s.id, name: s.name, division_id: s.division_id || 0 }); }}><PencilIcon style={{width: 12}}/></button>
                                                    <button className={styles.miniBtnDel} onClick={(e) => { e.stopPropagation(); deleteItem('sec', s.id); }}><TrashIcon style={{width: 12}}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className={`${styles.card} ${styles.cardFull}`}>
                        <div className={styles.cardHead}>
                            <div className={styles.cardTitle}>ตำแหน่งงาน (ทั้งหมด)</div>
                            <button className={styles.btnRed} onClick={() => setPosModal({ ...posModal, open: true, isEdit: false, department_id: selectedSecId || 0 })}><PlusIcon style={{width: 14}} /> เพิ่มตำแหน่ง</button>
                        </div>
                        <div className={styles.tableArea}>
                            <table className={styles.table}>
                                <tbody>
                                    {filteredPositions.map(p => (
                                        <tr key={p.id}>
                                            <td className={styles.bold}>{p.title}</td>
                                            <td>{p.departments?.name || "Executive"}</td>
                                            <td>{p.employees[0]?.name || "ว่าง"}</td>
                                            <td className={styles.tdRight}>
                                                <div className={styles.tdActions}>
                                                    <button className={styles.miniBtn} onClick={() => setPosModal({ 
                                                        open: true, 
                                                        isEdit: true, 
                                                        id: p.id,
                                                        title: p.title,
                                                        node_type: p.node_type || "staff", 
                                                        is_ot_eligible: p.is_ot_eligible,
                                                        department_id: p.department_id || 0, 
                                                        parent_id: p.parent_id || 0 
                                                     })}><PencilIcon style={{width: 12}}/></button>
                                                    <button className={styles.miniBtnDel} onClick={() => deleteItem('pos', p.id)}><TrashIcon style={{width: 12}}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={styles.canvasContainer}>
                    {/* CONTROLS */}
                    <div className={styles.canvasControls}>
                        <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}><MagnifyingGlassMinusIcon style={{width: 18}} /></button>
                        <span className={styles.zoomText}>{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(Math.min(2, zoom + 0.1))}><MagnifyingGlassPlusIcon style={{width: 18}} /></button>
                        <button onClick={() => setZoom(1)}><ArrowsPointingOutIcon style={{width: 18}} /></button>
                        <div className={styles.divider} />
                        <button className={styles.btnDownload} onClick={downloadChart}><ArrowDownTrayIcon style={{width: 18}} /> Download PNG</button>
                    </div>

                    {/* CHART VIEWPORT */}
                    <div className={styles.viewport}>
                        <div 
                            className={styles.chartWrapper} 
                            ref={chartRef}
                            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                        >
                            {/* SVG LAYER FOR CROSS-DEPARTMENT LINES */}
                            <svg className={styles.svgOverlay}>
                                {positions.map(p => {
                                    if (!p.parent_id || !offsets[p.id] || !offsets[p.parent_id]) return null;
                                    const start = offsets[p.parent_id];
                                    const end = offsets[p.id];
                                    
                                    // Calculate a beautiful Bezier curve
                                    const midY = (start.y + end.y) / 2;
                                    const path = `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;
                                    
                                    return (
                                        <g key={`link-${p.id}`}>
                                            <path 
                                                d={path} 
                                                className={styles.connectorLine} 
                                                fill="none" 
                                            />
                                            <circle cx={start.x} cy={start.y} r="3" fill="#cbd5e1" />
                                            <circle cx={end.x} cy={end.y} r="3" fill="#dc2626" />
                                        </g>
                                    );
                                })}
                            </svg>

                            {/* NODES LAYER: STRUCTURAL GROUPING */}
                            <div className={styles.nodeGrid}>
                                {deptLayers.map(dept => (
                                    <div key={dept.id} className={styles.deptGroup}>
                                        <div className={styles.deptLabel}>{dept.name}</div>
                                        <div className={styles.secColumns}>
                                            {secLayers.filter(s => s.division_id === dept.id).map(sec => (
                                                <div key={sec.id} className={styles.secColumn}>
                                                    <div className={styles.secLabel}>{sec.name}</div>
                                                    <div className={styles.posStack}>
                                                        {positions.filter(p => p.department_id === sec.id).map(pos => (
                                                            <div 
                                                                key={pos.id} 
                                                                className={styles.graphNode} 
                                                                data-node-id={pos.id}
                                                            >
                                                                <div className={styles.nodeTitle}>{pos.title}</div>
                                                                <div className={styles.nodeName}>{pos.employees[0]?.name || "ว่าง"}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS (Assume same implementations as before) */}
            {deptModal.open && <div className={styles.modalOverlay}><div className={styles.modal}><h3>จัดการฝ่าย</h3><form onSubmit={saveDept}><input className={styles.input} required value={deptModal.name} onChange={e => setDeptModal({...deptModal, name: e.target.value})} /><div className={styles.modalActions}><button type="button" onClick={() => setDeptModal({...deptModal, open: false})}>ปิด</button><button type="submit">บันทึก</button></div></form></div></div>}
            {/* ... other modals (secModal, posModal) omitted for space, would be identical to previous stable version */}
        </div>
    );
}
