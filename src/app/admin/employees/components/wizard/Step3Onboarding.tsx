"use client";

import { useState, useMemo, useEffect } from "react";
import SearchableCombobox, { ComboboxOption } from "./SearchableCombobox";

export default function Step3Onboarding({
    empId,
    employeeData,
    employees = [],
    mode = "create",
    onComplete,
    onBack,
    onClose
}: {
    empId: string;
    employeeData?: any;
    employees?: any[];
    mode?: "create" | "edit";
    onComplete: () => void;
    onBack: () => void;
    onClose?: () => void;
}) {
    const isEdit = mode === "edit" || Boolean(employeeData?.isExistingInDb || employeeData?.emp_id);
    const [formData, setFormData] = useState({
        phone_number: employeeData?.phone_number || "",
        email: employeeData?.email || "",
        line_user_id: employeeData?.line_user_id || "",
        supervisor_id: employeeData?.supervisor_id || "",
        pin: "",
        company_accommodation: Boolean(employeeData?.company_accommodation),
        company_car: Boolean(employeeData?.company_car)
    });

    // Up to 5 co-evaluators
    const [coEvaluators, setCoEvaluators] = useState<string[]>(() => {
        if (Array.isArray(employeeData?.co_evaluator_ids) && employeeData.co_evaluator_ids.length > 0) {
            return employeeData.co_evaluator_ids.slice(0, 5);
        }
        if (employeeData?.secondary_supervisor_id) {
            return [employeeData.secondary_supervisor_id];
        }
        return [];
    });

    // Sync state whenever employeeData updates
    useEffect(() => {
        if (employeeData) {
            setFormData(prev => ({
                ...prev,
                phone_number: employeeData.phone_number ?? prev.phone_number,
                email: employeeData.email ?? prev.email,
                line_user_id: employeeData.line_user_id ?? prev.line_user_id,
                supervisor_id: employeeData.supervisor_id ?? prev.supervisor_id,
                company_accommodation: employeeData.company_accommodation !== undefined ? Boolean(employeeData.company_accommodation) : prev.company_accommodation,
                company_car: employeeData.company_car !== undefined ? Boolean(employeeData.company_car) : prev.company_car,
            }));

            if (Array.isArray(employeeData.co_evaluator_ids) && employeeData.co_evaluator_ids.length > 0) {
                setCoEvaluators(employeeData.co_evaluator_ids.slice(0, 5));
            } else if (employeeData.secondary_supervisor_id) {
                setCoEvaluators([employeeData.secondary_supervisor_id]);
            }
        }
    }, [employeeData]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Transform employees into searchable options with name, nickname, emp_id, department, position
    const employeeOptions: ComboboxOption[] = useMemo(() => {
        return (employees || [])
            .filter(e => e.emp_id !== empId)
            .map(e => ({
                value: e.emp_id,
                label: `${e.name}${e.nickname ? ` (${e.nickname})` : ''} - ${e.emp_id}`,
                subLabel: [e.departments?.name, e.job_positions?.title].filter(Boolean).join(" • ")
            }));
    }, [employees, empId]);

    const handleAddCoEvaluator = () => {
        if (coEvaluators.length >= 5) return;
        setCoEvaluators([...coEvaluators, ""]);
    };

    const handleUpdateCoEvaluator = (index: number, val: string) => {
        const updated = [...coEvaluators];
        updated[index] = val;
        setCoEvaluators(updated);
    };

    const handleRemoveCoEvaluator = (index: number) => {
        const updated = coEvaluators.filter((_, i) => i !== index);
        setCoEvaluators(updated);
    };

    // Filter options for each co-evaluator slot to exclude supervisor & already-selected co-evaluators
    const getCoEvaluatorOptions = (currentIndex: number) => {
        const otherSelected = new Set(
            coEvaluators.filter((val, idx) => idx !== currentIndex && Boolean(val))
        );
        return employeeOptions.filter(o => {
            if (formData.supervisor_id && String(o.value) === String(formData.supervisor_id)) return false;
            if (otherSelected.has(String(o.value))) return false;
            return true;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (formData.pin && formData.pin.length < 4) {
            return setError("รหัส PIN ต้องมีอย่างน้อย 4 หลัก");
        }
        if (!formData.pin && !isEdit) {
            return setError("จำเป็นต้องกำหนด PIN พนักงานไม่สามารถเข้าสู่ระบบลงเวลาได้หากไม่มีรหัส PIN");
        }

        // Clean and prepare co-evaluator IDs
        const cleanCoEvaluators = coEvaluators
            .map(id => id ? id.trim() : "")
            .filter((id): id is string => Boolean(id && id !== formData.supervisor_id && id !== empId));
        const uniqueCoEvaluators = Array.from(new Set(cleanCoEvaluators)).slice(0, 5);

        setLoading(true);
        try {
            const payload = {
                step: 3,
                mode: isEdit ? "edit" : "create",
                ...formData,
                co_evaluator_ids: uniqueCoEvaluators,
                secondary_supervisor_id: uniqueCoEvaluators[0] || null
            };

            const res = await fetch(`/api/admin/employees/${empId}/wizard`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.ok) {
                onComplete();
            } else {
                setError(data.error || "บันทึกข้อมูลพนักงานไม่สำเร็จ");
            }
        } catch (err: any) {
            setError(err.message || "เกิดข้อผิดพลาด");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 px-7 py-3 space-y-4 pr-6">
                {/* Employee Badge */}
                <div className="bg-red-50/70 text-red-800 text-sm p-3 rounded-xl border border-red-200 flex items-center justify-between">
                    <div>
                        กำลังตั้งค่าสำหรับรหัสพนักงาน: <strong className="font-mono font-bold text-red-900">{empId}</strong>
                        {employeeData?.name && (
                            <span className="text-gray-700 ml-2">({employeeData.name})</span>
                        )}
                    </div>
                    <span className="text-xs bg-red-600 text-white px-2.5 py-0.5 rounded-full font-medium">
                        ขั้นตอนสุดท้าย 3 / 3
                    </span>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-sm font-bold border border-red-200">
                        {error}
                    </div>
                )}

                {/* Section 1: Contact & Notifications */}
                <div className="border border-gray-200 rounded-2xl p-4.5 bg-white shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 text-gray-800 font-bold text-base border-b border-gray-100 pb-3">
                        <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>ข้อมูลติดต่อ &amp; การแจ้งเตือน (Contact &amp; Notifications)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Phone Number */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                                เบอร์โทรศัพท์
                            </label>
                            <div className="relative">
                                <input
                                    type="tel"
                                    className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                                    placeholder="เช่น 0812345678"
                                    value={formData.phone_number}
                                    onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                                อีเมล
                            </label>
                            <input
                                type="email"
                                className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                                placeholder="เช่น employee@teragroup.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        {/* LINE User ID */}
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-gray-800 mb-1.5 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                    LINE User ID (สำหรับการแจ้งเตือน)
                                </span>
                                <span className="text-[11px] text-gray-400 font-normal">ไม่บังคับ</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-800 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                                    placeholder="เช่น U1234567890abcdef1234567890abcdef (33 หลัก)"
                                    value={formData.line_user_id}
                                    onChange={e => setFormData({ ...formData, line_user_id: e.target.value.trim() })}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>ใช้สำหรับส่งข้อความแจ้งเตือนผลการลงเวลาทำงาน, แจ้งเตือนการอนุมัติใบลา/โอที และสลิปเงินเดือนอัตโนมัติผ่าน LINE</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 2: Security, Hierarchy & Evaluators */}
                <div className="border border-gray-200 rounded-2xl p-4.5 bg-white shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 text-gray-800 font-bold text-base border-b border-gray-100 pb-3">
                        <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>สิทธิ์การเข้าสู่ระบบ &amp; สายการบังคับบัญชา (Access &amp; Hierarchy)</span>
                    </div>

                    {/* 2.1 PIN Code Card (Full-width & Symmetrical, matching Supervisor Card) */}
                    <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-red-900 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                </span>
                                <span>รหัส PIN สำหรับเข้าสู่ระบบ</span>
                                <span className="text-[11px] font-medium text-red-700 bg-white border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {isEdit ? "เว้นว่างหากใช้รหัสเดิม" : "เฉพาะตัวเลข 4-10 หลัก"}
                                </span>
                            </label>
                            <span className={`text-xs font-bold whitespace-nowrap ${isEdit ? "text-gray-400 font-normal" : "text-red-600"}`}>
                                {isEdit ? "ไม่บังคับ" : "จำเป็น *"}
                            </span>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full h-11 px-4 rounded-xl border border-red-300 font-mono text-base tracking-widest text-red-900 bg-white placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500 transition-all shadow-2xs"
                                placeholder={isEdit ? "•••• (เว้นว่างไว้เพื่อคงรหัส PIN เดิม)" : "เช่น 1234"}
                                maxLength={10}
                                value={formData.pin}
                                onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/[^0-9]/g, '') })}
                                required={!isEdit}
                            />
                        </div>
                        <p className="text-xs text-red-700/80 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>
                                {isEdit
                                    ? "ระบุเฉพาะเมื่อต้องการเปลี่ยนรหัส PIN ใหม่สำหรับลงเวลาทำงาน หากไม่ต้องการเปลี่ยนให้เว้นว่างไว้"
                                    : "พนักงานจำเป็นต้องใช้รหัส PIN นี้ในการลงชื่อเข้าใช้งานระบบลงเวลาทำงาน"}
                            </span>
                        </p>
                    </div>

                    {/* 2.2 Hierarchy & Evaluation Team: Symmetrical Full-Width Cards */}
                    <div className="pt-2 space-y-4">
                        {/* Primary Supervisor Card (Full width, symmetrical) */}
                        <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-gray-800 text-white text-xs font-bold flex items-center justify-center">
                                        ★
                                    </span>
                                    <span>หัวหน้างานหลัก (Primary Supervisor)</span>
                                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        อนุมัติการลา &amp; OT
                                    </span>
                                </label>
                                <span className="text-[11px] text-gray-400 font-normal">ไม่บังคับ</span>
                            </div>
                            <SearchableCombobox
                                options={employeeOptions}
                                value={formData.supervisor_id}
                                onChange={val => setFormData({ ...formData, supervisor_id: val })}
                                placeholder="— ค้นหาด้วยชื่อ หรือรหัสพนักงานของหัวหน้างาน —"
                            />
                            <p className="text-xs text-gray-500">
                                ค้นหาตามชื่อ-นามสกุล, ชื่อเล่น หรือรหัสพนักงาน สำหรับการอนุมัติการลา, ขอ OT และเป็นผู้ประเมินผลทดลองงานหลัก
                            </p>
                        </div>

                        {/* Co-Evaluators Section (Full width, matching alignment) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-800 flex items-center gap-2">
                                        <span>ผู้ประเมินร่วม (Co-Evaluators)</span>
                                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                            เลือกแล้ว {coEvaluators.filter(Boolean).length} / 5 คน
                                        </span>
                                    </label>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        กำหนดผู้ประเมินร่วมสำหรับการประเมินทดลองงานและ KPI (สามารถประเมินแยกจากหัวหน้างานได้อิสระ)
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddCoEvaluator}
                                    disabled={coEvaluators.length >= 5}
                                    className="px-3.5 py-1.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>เพิ่มผู้ประเมินร่วม</span>
                                </button>
                            </div>

                            {coEvaluators.length === 0 ? (
                                <div className="text-center py-4 px-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 text-xs text-gray-500">
                                    ยังไม่ได้ระบุผู้ประเมินร่วม (กดปุ่ม &quot;+ เพิ่มผู้ประเมินร่วม&quot; เพื่อเลือกได้สูงสุด 5 คน)
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {coEvaluators.map((evaluatorId, idx) => (
                                        <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-200 bg-gray-50/40">
                                            <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <SearchableCombobox
                                                    options={getCoEvaluatorOptions(idx)}
                                                    value={evaluatorId}
                                                    onChange={val => handleUpdateCoEvaluator(idx, val)}
                                                    placeholder={`— เลือกผู้ประเมินร่วมคนที่ ${idx + 1} —`}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCoEvaluator(idx)}
                                                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                                                title="ลบผู้ประเมินร่วมนี้"
                                            >
                                                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Section 3: Company Benefits & Facilities */}
                <div className="border border-gray-200 rounded-2xl p-4.5 bg-white shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 text-gray-800 font-bold text-base border-b border-gray-100 pb-3">
                        <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>สวัสดิการทรัพย์สินบริษัท (Company Assets &amp; Facilities)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Accommodation */}
                        <label className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${formData.company_accommodation
                            ? 'bg-red-50/70 border-red-300 shadow-xs'
                            : 'bg-gray-50/60 border-gray-200 hover:bg-gray-100/70'
                            }`}>
                            <input
                                type="checkbox"
                                className="w-4.5 h-4.5 rounded text-red-600 focus:ring-red-500 border-gray-300 cursor-pointer accent-red-600 mt-0.5 shrink-0"
                                checked={formData.company_accommodation}
                                onChange={e => setFormData({ ...formData, company_accommodation: e.target.checked })}
                            />
                            <div>
                                <div className={`text-sm font-bold ${formData.company_accommodation ? 'text-red-900' : 'text-gray-800'}`}>
                                    ที่พักสวัสดิการพนักงาน
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    พนักงานได้รับสิทธิ์พักอาศัยในหอพัก/บ้านพักของบริษัท
                                </div>
                            </div>
                        </label>

                        {/* Car */}
                        <label className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${formData.company_car
                            ? 'bg-red-50/70 border-red-300 shadow-xs'
                            : 'bg-gray-50/60 border-gray-200 hover:bg-gray-100/70'
                            }`}>
                            <input
                                type="checkbox"
                                className="w-4.5 h-4.5 rounded text-red-600 focus:ring-red-500 border-gray-300 cursor-pointer accent-red-600 mt-0.5 shrink-0"
                                checked={formData.company_car}
                                onChange={e => setFormData({ ...formData, company_car: e.target.checked })}
                            />
                            <div>
                                <div className={`text-sm font-bold ${formData.company_car ? 'text-red-900' : 'text-gray-800'}`}>
                                    รถยนต์ประจำตำแหน่ง
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    พนักงานได้รับรถยนต์ของบริษัทเพื่อใช้งานประจำตำแหน่ง
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between bg-white shrink-0">
                <button
                    type="button"
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium transition-all cursor-pointer"
                >
                    ย้อนกลับ
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            กำลังบันทึก...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            {isEdit ? "เสร็จสิ้นการแก้ไขข้อมูลพนักงาน" : "เสร็จสิ้นการเพิ่มพนักงานใหม่"}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
