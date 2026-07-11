"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MagnifyingGlassIcon, UserGroupIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";

interface DirectoryEmp {
    id: string;
    name: string;
    nickname: string | null;
    phone_number: string | null;
    email: string | null;
    branch: string;
    department: string;
    division: string;
    position: string;
}

export default function DirectoryPage() {
    const [search, setSearch] = useState("");

    const { data: employees = [], isLoading: loading } = useQuery({
        queryKey: ["directory"],
        queryFn: async () => {
            const res = await fetch("/api/directory");
            const data = await res.json();
            if (!data.ok) throw new Error("Failed to fetch directory");
            return data.list as DirectoryEmp[];
        }
    });

    const filtered = employees.filter(e => {
        const query = search.toLowerCase();
        return (
            e.name.toLowerCase().includes(query) ||
            (e.nickname && e.nickname.toLowerCase().includes(query)) ||
            e.branch.toLowerCase().includes(query) ||
            e.department.toLowerCase().includes(query) ||
            e.position.toLowerCase().includes(query) ||
            (e.phone_number && e.phone_number.includes(query)) ||
            (e.email && e.email.toLowerCase().includes(query))
        );
    });

    return (
        <div style={{ padding: "24px 20px", maxWidth: 800, margin: "0 auto", paddingBottom: 100 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--red, #d93025)", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                    <UserGroupIcon width={32} />
                    รายชื่อพนักงาน
                </h1>
                <p style={{ color: "var(--text-3, #6b7280)", fontSize: 14, marginTop: 6, margin: "6px 0 0 0" }}>
                    ค้นหาและดูข้อมูลติดต่อของพนักงานทั้งหมดในระบบ
                </p>
            </div>

            {/* Search */}
            <div style={{ position: "relative", marginBottom: 30 }}>
                <MagnifyingGlassIcon width={20} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-4, #9ca3af)" }} />
                <input
                    type="text"
                    placeholder="ค้นหาชื่อ, แผนก, ตำแหน่ง, เบอร์โทร..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: "100%", padding: "16px 16px 16px 48px",
                        borderRadius: 14, border: "1px solid var(--line, #e5e7eb)",
                        fontSize: 16, background: "var(--surface, #ffffff)",
                        color: "var(--text, #1f2937)", outline: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
                    }}
                />
            </div>

            {/* List */}
            {loading ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-4, #9ca3af)", fontSize: 15 }}>
                    <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid #f3f3f3", borderTop: "3px solid #d93025", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 12 }} />
                    <br />
                    กำลังโหลดข้อมูลพนักงาน...
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--text-4, #9ca3af)", background: "var(--surface, #ffffff)", borderRadius: 16, border: "1px dashed var(--line, #e5e7eb)" }}>
                    <UserGroupIcon width={48} style={{ margin: "0 auto", opacity: 0.2, marginBottom: 16 }} />
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-3, #6b7280)" }}>ไม่พบรายชื่อที่ค้นหา</div>
                    <div style={{ fontSize: 14, marginTop: 4 }}>ลองใช้คำค้นหาอื่น เช่น ชื่อเล่น, แผนก หรือตำแหน่ง</div>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                    {filtered.map(emp => (
                        <div key={emp.id} style={{
                            background: "var(--surface, #ffffff)", borderRadius: 14, padding: "20px 20px",
                            border: "1px solid var(--line, #f3f4f6)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                            borderLeft: "5px solid var(--red, #d93025)", position: "relative", overflow: "hidden"
                        }}>
                            <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: "radial-gradient(circle at top right, rgba(212,175,55,0.1), transparent)", pointerEvents: "none" }} />
                            
                            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: "50%",
                                    background: "rgba(217,48,37,0.08)", color: "#d93025",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 18, fontWeight: 700, flexShrink: 0,
                                    border: "1px solid rgba(217,48,37,0.15)"
                                }}>
                                    {emp.name.charAt(0)}
                                </div>
                                <div>
                                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text, #111827)" }}>
                                        {emp.name} {emp.nickname ? <span style={{ color: "var(--text-3, #6b7280)", fontWeight: 500, fontSize: 15 }}>({emp.nickname})</span> : ""}
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--text-2, #4b5563)", marginTop: 4 }}>
                                        <span style={{ fontWeight: 600, color: "var(--gold, #d4af37)" }}>{emp.position}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ fontSize: 13, color: "var(--text-3, #6b7280)", background: "#f9fafb", padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>
                                <div><b>สาขา:</b> {emp.branch}</div>
                                <div style={{ marginTop: 4 }}><b>แผนก:</b> {emp.department} {emp.division !== "—" ? `(${emp.division})` : ""}</div>
                            </div>
                            
                            <div style={{ paddingTop: 16, borderTop: "1px dashed var(--line, #e5e7eb)", display: "flex", flexDirection: "column", gap: 10 }}>
                                {emp.phone_number && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-2, #374151)", fontWeight: 500 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(59,130,246,0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <PhoneIcon width={14} />
                                        </div>
                                        <a href={`tel:${emp.phone_number}`} style={{ color: "inherit", textDecoration: "none", flex: 1 }}>{emp.phone_number}</a>
                                    </div>
                                )}
                                {emp.email && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-2, #374151)", fontWeight: 500 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(234,179,8,0.1)", color: "#eab308", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <EnvelopeIcon width={14} />
                                        </div>
                                        <a href={`mailto:${emp.email}`} style={{ color: "inherit", textDecoration: "none", flex: 1 }}>{emp.email}</a>
                                    </div>
                                )}
                                {!emp.phone_number && !emp.email && (
                                    <div style={{ fontSize: 13, color: "var(--text-4, #9ca3af)", fontStyle: "italic", padding: "4px 0" }}>
                                        — ไม่มีข้อมูลติดต่อ —
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
}
