"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { 
    PlusIcon, PencilIcon, TrashIcon, 
    ChartBarIcon, ListBulletIcon,
    BriefcaseIcon, UserGroupIcon, BuildingOffice2Icon,
    CheckCircleIcon, XCircleIcon, XMarkIcon,
    MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, 
    ArrowsPointingOutIcon, ArrowDownTrayIcon,
    ArrowLeftIcon
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
    employees: { 
        name: string; 
        emp_id: string;
        supervisor_id?: string | null;
        is_on_trial?: boolean;
        salary_type?: string | null;
        branches?: { name: string } | null;
    }[];
};

export default function OrganizationPage() {
    const [deptLayers, setDeptLayers] = useState<DeptLayer[]>([]); 
    const [secLayers, setSecLayers] = useState<SectionLayer[]>([]);
    const [positions, setPositions] = useState<JobPosition[]>([]);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"table" | "flowchart">("table");

    // Charts & Viewport State
    const [zoom, setZoom] = useState(1);
    const [offsets, setOffsets] = useState<{ [key: string]: { x: number, y: number } }>({});
    const chartRef = useRef<HTMLDivElement>(null);

    // INFOGRAPHIC FILTERING
    const boardNodes = useMemo(() => {
        return positions.filter(p => p.node_type === 'executive' && !p.parent_id)
            .flatMap(p => p.employees.map(e => ({ ...p, employee: e })));
    }, [positions]);

    const ceoNode = useMemo(() => {
        // Find executive who reports to board, or top executive if no board
        const execs = positions.filter(p => p.node_type === 'executive' && p.parent_id);
        if (execs.length === 0) return null;
        const p = execs[0];
        return p.employees.map(e => ({ ...p, employee: e }))[0];
    }, [positions]);

    const staffPositions = useMemo(() => positions.filter(p => p.node_type !== 'executive'), [positions]);
    
    // Assign colors to departments
    const getDeptColor = (index: number) => {
        const colors = ['#0d9488', '#7c3aed', '#059669', '#ea580c', '#2563eb', '#e11d48'];
        return colors[index % colors.length];
    };

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
            const [divRes, deptRes, posRes, branchRes] = await Promise.all([
                fetch("/api/admin/organization/divisions"),
                fetch("/api/admin/organization/departments"),
                fetch("/api/admin/organization/positions"),
                fetch("/api/admin/branches")
            ]);
            const [divData, deptData, posData, branchData] = await Promise.all([
                divRes.json(), deptRes.json(), posRes.json(), branchRes.json()
            ]);
            setDeptLayers(divData.list || []);
            setSecLayers(deptData.list || []);
            setPositions(posData.list || []);
            setBranches(branchData.list || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    useEffect(() => { loadData(); }, []);

    // COORDINATE CALCULATION
    const refreshCoordinates = useCallback(() => {
        if (!chartRef.current) return;
        const nodes = chartRef.current.querySelectorAll('[data-node-id]');
        const containerRect = chartRef.current.getBoundingClientRect();
        const newOffsets: { [key: string]: { x: number, y: number } } = {};
        
        nodes.forEach((node) => {
            const id = node.getAttribute('data-node-id');
            if (!id) return;
            const rect = node.getBoundingClientRect();
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
                                            <td>
                                                <div>{p.employees[0]?.name || "ว่าง"}</div>
                                                {p.employees[0]?.branches?.name && (
                                                    <div className={styles.miniLocation}>{p.employees[0].branches.name}</div>
                                                )}
                                            </td>
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
                            {/* SVG LAYER FOR COMMAND HIERARCHY LINES */}
                            <svg className={styles.svgOverlay}>
                                {positions.flatMap(p => p.employees).map(emp => {
                                    if (!emp?.supervisor_id) return null;
                                    
                                    // Find node ID of supervisor (could be anywhere in the chart)
                                    const supervisorNodeId = `emp-${emp.supervisor_id}`;
                                    const subordinateNodeId = `emp-${emp.emp_id}`;
                                    
                                    if (!offsets[supervisorNodeId] || !offsets[subordinateNodeId]) return null;
                                    const start = offsets[supervisorNodeId];
                                    const end = offsets[subordinateNodeId];
                                    
                                    // Calculate Orthogonal elbow path
                                    const midY = start.y + (end.y - start.y) * 0.5;
                                    const path = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
                                    
                                    return (
                                        <g key={`link-${emp.emp_id}`}>
                                            <path 
                                                d={path} 
                                                className={styles.connectorLine} 
                                                fill="none" 
                                            />
                                            <circle cx={end.x} cy={midY} r="3" fill="#cbd5e1" />
                                        </g>
                                    );
                                })}
                            </svg>

                            {/* NODES LAYER: TERA ORG CHART TREE */}
                            <div className={styles.infoTree}>
                                
                                {/* 1. EXECUTIVE CHAIN: MD → Asst MD → Side Roles */}
                                {(() => {
                                    // All executive positions
                                    const allExecs = positions.filter(p => p.node_type === 'executive');
                                    // Top exec: no parent_id (MD)
                                    const topExecs = allExecs.filter(p => !p.parent_id);
                                    // Sub execs: have parent_id  
                                    const subExecs = allExecs.filter(p => p.parent_id);

                                    // Administrative positions (Dept 8) that are NOT already in topExecs/subExecs
                                    const adminNodes = positions.filter(p => p.department_id === 8)
                                        .flatMap(p => {
                                            if (p.employees.length === 0) return [{ pos: p, emp: null as any }];
                                            return p.employees.map(e => ({ pos: p, emp: e }));
                                        });

                                    // Secretary specific nodes for side-branching
                                    const secretaryNodes = adminNodes.filter(n => 
                                        n.pos.title.toLowerCase().includes('เลขา') || 
                                        n.pos.title.toLowerCase().includes('secretary')
                                    );

                                    return (
                                        <div className={styles.execChain}>
                                            {/* TOP: MD */}
                                            {topExecs.map(pos => pos.employees.map(emp => (
                                                <div key={emp.emp_id} className={styles.execNode} data-node-id={`emp-${emp.emp_id}`}>
                                                    <div className={styles.execCard} style={{background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'}}>
                                                        <div className={styles.execTitle}>{pos.title}</div>
                                                        <div className={styles.execName}>{emp.name}</div>
                                                    </div>
                                                </div>
                                            )))}

                                            {/* VERTICAL LINE */}
                                            <div className={styles.vLine}>
                                                {/* SECRETARY SIDE BRANCH */}
                                                {secretaryNodes.map((n, i) => (
                                                    <div key={n.emp?.emp_id || i} className={styles.sideBranchContainer}>
                                                        <div className={styles.sideBranchItem}>
                                                            <div className={styles.sideBranchLine} />
                                                            <div className={styles.secretaryCard}>
                                                                <div className={styles.secretaryTitle}>{n.pos.title}</div>
                                                                <div className={styles.secretaryName}>{n.emp?.name || 'ตำแหน่งว่าง'}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* SUB: Asst MD and other sub-executives */}
                                            {subExecs.map(pos => pos.employees.map(emp => (
                                                <div key={emp.emp_id} className={styles.execNode} data-node-id={`emp-${emp.emp_id}`}>
                                                    <div className={styles.execCard} style={{background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)'}}>
                                                        <div className={styles.execTitle}>{pos.title}</div>
                                                        <div className={styles.execName}>{emp.name}</div>
                                                    </div>
                                                </div>
                                            )))}
                                        </div>
                                    );
                                })()}

                                {/* 2. HORIZONTAL BUS LINE → DIVISION COLUMNS */}
                                <div className={styles.hBusLine} />
                                <div className={styles.divisionRow}>
                                    {deptLayers.map((div, dIdx) => {
                                        // All positions in this division, excluding Dept 8 which is now at the top
                                        const allDivPositions = staffPositions.filter(p => 
                                            p.departments?.division_id === div.id && p.department_id !== 8
                                        );
                                        if (allDivPositions.length === 0) return null;
                                        const accent = getDeptColor(dIdx);

                                        // Nodes representing either an employee in a position or a vacant position
                                        const allDivNodes = allDivPositions.flatMap(p => {
                                            if (p.employees.length === 0) {
                                                return [{ pos: p, emp: null as any }];
                                            }
                                            return p.employees.map(e => ({ pos: p, emp: e }));
                                        });
                                        
                                        // Division head = someone whose emp_id is referenced as supervisor_id by others in this division
                                        const divHead = allDivNodes.find(({ emp }) => 
                                            emp && allDivNodes.some(other => other.emp?.supervisor_id === emp.emp_id)
                                        );

                                        // Remaining nodes (exclude div head)
                                        const remainingNodes = allDivNodes.filter(({ emp }) => 
                                            !emp || emp.emp_id !== divHead?.emp?.emp_id
                                        );

                                        // Group remaining by department (secLayers)
                                        const departments = secLayers
                                            .filter(s => s.division_id === div.id && s.id !== 8)
                                            .map(dept => {
                                                const deptNodes = remainingNodes.filter(({ pos }) => pos.department_id === dept.id);
                                                if (deptNodes.length === 0) return null;

                                                // Sort: department head first
                                                const sorted = [...deptNodes].sort((a, b) => {
                                                    const isASup = a.emp && deptNodes.some(other => other.emp?.supervisor_id === a.emp.emp_id);
                                                    const isBSup = b.emp && deptNodes.some(other => other.emp?.supervisor_id === b.emp.emp_id);
                                                    return (isBSup ? 1 : 0) - (isASup ? 1 : 0);
                                                });

                                                return { dept, nodes: sorted };
                                            })
                                            .filter(Boolean) as { dept: SectionLayer; nodes: { pos: JobPosition; emp: any | null }[] }[];

                                        return (
                                            <div key={div.id} className={styles.divColumn}>
                                                {/* Division Header */}
                                                <div className={styles.divHeader} style={{background: accent}}>
                                                    <div className={styles.divHeaderTitle}>{div.name}</div>
                                                </div>

                                                {/* Division Head Employee */}
                                                {divHead && (
                                                    <div className={styles.divHeadCard} data-node-id={`emp-${divHead.emp.emp_id}`}>
                                                        <div className={styles.divHeadContent} style={{borderColor: accent}}>
                                                            <div className={styles.glossyIcon} style={{background: accent}}>
                                                                {divHead.emp.name?.charAt(0)}
                                                            </div>
                                                            <div className={styles.glossyText}>
                                                                <div className={styles.glossyTitle}>{divHead.pos.title}</div>
                                                                <div className={styles.glossyName}>{divHead.emp.name}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Vertical bus line */}
                                                <div className={styles.divBusV} style={{background: accent}} />

                                                {/* Department Groups */}
                                                <div className={styles.deptColumns}>
                                                    {departments.map(({ dept, nodes }) => {
                                                        // Group nodes by branch
                                                        const branchGroups = branches.map(branch => {
                                                            const branchNodes = nodes.filter(({ emp }) => emp?.branches?.name === branch.name);
                                                            if (branchNodes.length === 0) return null;

                                                            return { branch, nodes: branchNodes };
                                                        }).filter(Boolean) as { branch: { id: string; name: string }; nodes: { pos: JobPosition; emp: any | null }[] }[];

                                                        // Also nodes without a branch (includes vacant ones)
                                                        const noBranchNodes = nodes.filter(({ emp }) => !emp || !emp.branches?.name);

                                                        return (
                                                            <div key={dept.id} className={styles.deptColumn}>
                                                                <div className={styles.deptTag} style={{color: accent, borderColor: accent}}>
                                                                    {dept.name}
                                                                </div>
                                                                
                                                                {/* Branch roots spread horizontally */}
                                                                <div className={styles.branchRoots}>
                                                                    {branchGroups.map(({ branch, nodes: brNodes }) => (
                                                                        <div key={branch.id} className={styles.branchRoot}>
                                                                            <div className={styles.branchBadge}>{branch.name}</div>
                                                                            <div className={styles.deptNodeStack}>
                                                                                {brNodes.map(({ pos, emp }, i) => {
                                                                                    const isSupervisor = emp && nodes.some(other => other.emp?.supervisor_id === emp.emp_id);
                                                                                    
                                                                                    if (!emp) {
                                                                                        return (
                                                                                            <div key={`vacant-${pos.id}-${i}`} className={`${styles.staffCard} ${styles.vacantCard}`}>
                                                                                                <div className={styles.vacantIcon}></div>
                                                                                                <div className={styles.staffInfo}>
                                                                                                    <div className={styles.staffPosition}>{pos.title}</div>
                                                                                                    <div className={styles.staffName}>&nbsp;</div>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    }

                                                                                    return (
                                                                                        <div 
                                                                                            key={emp.emp_id} 
                                                                                            className={`${styles.staffCard} ${isSupervisor ? styles.staffCardHead : ''}`}
                                                                                            data-node-id={`emp-${emp.emp_id}`}
                                                                                            style={{'--accent': accent} as any}
                                                                                        >
                                                                                            <div className={styles.staffIcon} style={{background: isSupervisor ? accent : '#f1f5f9', color: isSupervisor ? 'white' : accent}}>
                                                                                                {emp.name?.charAt(0)}
                                                                                            </div>
                                                                                            <div className={styles.staffInfo}>
                                                                                                <div className={styles.staffPosition}>{pos.title}</div>
                                                                                                <div className={styles.staffName}>
                                                                                                    {emp.name}
                                                                                                    {emp.salary_type === 'daily' && <span className={styles.internBadge}>ฝึกงาน</span>}
                                                                                                    {emp.is_on_trial && <span className={styles.trialBadge}>ทดลองงาน</span>}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    ))}

                                                                    {/* Nodes without branch */}
                                                                    {noBranchNodes.length > 0 && (
                                                                        <div className={styles.branchRoot}>
                                                                            <div className={styles.branchBadge}>ส่วนกลาง</div>
                                                                            <div className={styles.deptNodeStack}>
                                                                                {noBranchNodes.map(({ pos, emp }, i) => {
                                                                                    if (!emp) {
                                                                                        return (
                                                                                            <div key={`vacant-nobr-${pos.id}-${i}`} className={`${styles.staffCard} ${styles.vacantCard}`}>
                                                                                                <div className={styles.vacantIcon}></div>
                                                                                                <div className={styles.staffInfo}>
                                                                                                    <div className={styles.staffPosition}>{pos.title}</div>
                                                                                                    <div className={styles.staffName}>&nbsp;</div>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    }
                                                                                    return (
                                                                                        <div 
                                                                                            key={emp.emp_id} 
                                                                                            className={styles.staffCard}
                                                                                            data-node-id={`emp-${emp.emp_id}`}
                                                                                            style={{'--accent': accent} as any}
                                                                                        >
                                                                                            <div className={styles.staffIcon} style={{background: '#f1f5f9', color: accent}}>
                                                                                                {emp.name?.charAt(0)}
                                                                                            </div>
                                                                                            <div className={styles.staffInfo}>
                                                                                                <div className={styles.staffPosition}>{pos.title}</div>
                                                                                                <div className={styles.staffName}>
                                                                                                    {emp.name}
                                                                                                    {emp.salary_type === 'daily' && <span className={styles.internBadge}>ฝึกงาน</span>}
                                                                                                    {emp.is_on_trial && <span className={styles.trialBadge}>ทดลองงาน</span>}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}
            {deptModal.open && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>{deptModal.isEdit ? 'แก้ไขฝ่าย' : 'เพิ่มฝ่ายใหม่'}</h3>
                            <button onClick={() => setDeptModal({...deptModal, open: false})}><XMarkIcon style={{width: 20}}/></button>
                        </div>
                        <form onSubmit={saveDept}>
                            <div className={styles.formGroup}>
                                <label>ชื่อฝ่าย (Division Name)</label>
                                <input 
                                    className={styles.input} 
                                    required 
                                    value={deptModal.name} 
                                    onChange={e => setDeptModal({...deptModal, name: e.target.value})} 
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btnGhost} onClick={() => setDeptModal({...deptModal, open: false})}>ยกเลิก</button>
                                <button type="submit" className={styles.btnBlue}>บันทึกข้อมูล</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {secModal.open && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>{secModal.isEdit ? 'แก้ไขแผนก' : 'เพิ่มแผนกใหม่'}</h3>
                            <button onClick={() => setSecModal({...secModal, open: false})}><XMarkIcon style={{width: 20}}/></button>
                        </div>
                        <form onSubmit={saveSec}>
                            <div className={styles.formGroup}>
                                <label>ภายใต้ฝ่าย (Parent Division)</label>
                                <select 
                                    className={styles.input} 
                                    required 
                                    value={secModal.division_id} 
                                    onChange={e => setSecModal({...secModal, division_id: Number(e.target.value)})}
                                >
                                    <option value="">เลือกฝ่าย...</option>
                                    {deptLayers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>ชื่อแผนก (Department Name)</label>
                                <input 
                                    className={styles.input} 
                                    required 
                                    value={secModal.name} 
                                    onChange={e => setSecModal({...secModal, name: e.target.value})} 
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btnGhost} onClick={() => setSecModal({...secModal, open: false})}>ยกเลิก</button>
                                <button type="submit" className={styles.btnBlue}>บันทึกข้อมูล</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {posModal.open && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>{posModal.isEdit ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่งงานใหม่'}</h3>
                            <button onClick={() => setPosModal({...posModal, open: false})}><XMarkIcon style={{width: 20}}/></button>
                        </div>
                        <form onSubmit={savePos}>
                            <div className={styles.formGroup}>
                                <label>ชื่อตำแหน่ง (Job Title)</label>
                                <input 
                                    className={styles.input} 
                                    required 
                                    value={posModal.title} 
                                    onChange={e => setPosModal({...posModal, title: e.target.value})} 
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>แผนก (Department)</label>
                                <select 
                                    className={styles.input} 
                                    required 
                                    value={posModal.department_id} 
                                    onChange={e => setPosModal({...posModal, department_id: Number(e.target.value)})}
                                >
                                    <option value="0">Executive (No Dept)</option>
                                    {secLayers.map(s => <option key={s.id} value={s.id}>{s.name} ({deptLayers.find(d => d.id === s.division_id)?.name})</option>)}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>ประเภทโหนด (Node Type)</label>
                                <select 
                                    className={styles.input} 
                                    value={posModal.node_type || "staff"} 
                                    onChange={e => setPosModal({...posModal, node_type: e.target.value})}
                                >
                                    <option value="staff">Staff (General)</option>
                                    <option value="executive">Executive (Leadership)</option>
                                </select>
                            </div>
                            <div className={styles.formGroup} style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                <input 
                                    type="checkbox" 
                                    checked={posModal.is_ot_eligible} 
                                    onChange={e => setPosModal({...posModal, is_ot_eligible: e.target.checked})} 
                                />
                                <label>มีสิทธิ์ได้รับ OT (OT Eligible)</label>
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btnGhost} onClick={() => setPosModal({...posModal, open: false})}>ยกเลิก</button>
                                <button type="submit" className={styles.btnBlue}>บันทึกข้อมูล</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
