"use client";

import { useState, useMemo, useEffect } from "react";
import { parseISO, differenceInYears, differenceInDays, addDays, format } from "date-fns";
import SearchableCombobox, { ComboboxOption } from "./SearchableCombobox";

// Basic Thai National ID checksum validation
const validateThaiNationalId = (id: string) => {
    const cleanId = id.replace(/[^0-9]/g, "");
    if (cleanId.length !== 13) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleanId.charAt(i)) * (13 - i);
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    return parseInt(cleanId.charAt(12)) === checkDigit;
};

// Smart name parser for prefix, first name, last name
function parseFullName(fullName: string) {
    const trimmed = (fullName || "").trim().replace(/\s+/g, ' ');
    let title_prefix: string | null = null;
    let rest = trimmed;

    const prefixes = ["ว่าที่ร้อยตรี", "นาย", "นางสาว", "นาง"];
    for (const p of prefixes) {
        if (rest.startsWith(p)) {
            title_prefix = p;
            rest = rest.slice(p.length).trim();
            break;
        }
    }

    const parts = rest.split(' ');
    const first_name = parts[0] || "";
    const last_name = parts.slice(1).join(' ') || "";

    return { title_prefix, first_name, last_name, name: trimmed };
}

// Helpers to accurately parse and preserve Nationality and Document Type
function parseNationality(data?: any) {
    if (!data) return { nationalityType: "THA", customNationality: "" };
    if (data.nationalityType) {
        return {
            nationalityType: data.nationalityType,
            customNationality: data.customNationality || ""
        };
    }
    const rawNat = (data.nationality || "").trim();
    if (!rawNat || rawNat === "THA") return { nationalityType: "THA", customNationality: "" };
    if (rawNat === "MMR" || rawNat === "LAO" || rawNat === "KHM") {
        return { nationalityType: rawNat, customNationality: "" };
    }
    return {
        nationalityType: "OTH",
        customNationality: rawNat === "OTH" ? (data.customNationality || "") : rawNat
    };
}

function parseDocType(data?: any) {
    if (!data) return { docTypeCategory: "national_id", customDocType: "" };
    if (data.docTypeCategory) {
        return {
            docTypeCategory: data.docTypeCategory,
            customDocType: data.customDocType || ""
        };
    }
    const rawDoc = (data.id_document_type || "").trim();
    if (!rawDoc || rawDoc === "national_id") return { docTypeCategory: "national_id", customDocType: "" };
    if (rawDoc === "passport") return { docTypeCategory: "passport", customDocType: "" };
    return {
        docTypeCategory: "other",
        customDocType: rawDoc === "other" ? (data.customDocType || "") : rawDoc
    };
}

// Format date to Thai Buddhist Era (DD/MM/BBBB)
function formatThaiBE(isoDateStr: string | null | undefined): string {
    if (!isoDateStr) return "";
    try {
        const d = parseISO(isoDateStr);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const beYear = d.getFullYear() + 543;
        return `${day}/${month}/${beYear}`;
    } catch {
        return "";
    }
}

export default function Step1BasicInfo({
    companies,
    branches,
    departments,
    positions,
    initialData,
    empId,
    onComplete,
    onClose
}: {
    companies: any[];
    branches: any[];
    departments: any[];
    positions: any[];
    initialData?: any;
    empId?: string | null;
    onComplete: (data: any, rawState?: any) => void;
    onClose: () => void;
}) {
    const initNat = parseNationality(initialData);
    const initDoc = parseDocType(initialData);

    const [fullName, setFullName] = useState(() => initialData?.fullName || initialData?.name || "");
    const [nationalityType, setNationalityType] = useState(() => initNat.nationalityType);
    const [customNationality, setCustomNationality] = useState(() => initNat.customNationality);
    const [docTypeCategory, setDocTypeCategory] = useState(() => initDoc.docTypeCategory);
    const [customDocType, setCustomDocType] = useState(() => initDoc.customDocType);
    const [formData, setFormData] = useState(() => {
        if (initialData?.formData) {
            return { ...initialData.formData };
        }
        if (initialData) {
            let days = "119";
            if (initialData.probation_days) {
                days = String(initialData.probation_days);
            } else if (initialData.hire_date && initialData.probation_end_date) {
                try {
                    const diff = differenceInDays(parseISO(String(initialData.probation_end_date).slice(0, 10)), parseISO(String(initialData.hire_date).slice(0, 10)));
                    if (diff > 0) days = String(diff);
                } catch { }
            }

            return {
                emp_id: initialData.emp_id || empId || "",
                company_id: String(initialData.company_id || "2"),
                branch_id: initialData.branch_id || "",
                title_prefix: initialData.title_prefix || "",
                first_name: initialData.first_name || "",
                last_name: initialData.last_name || "",
                nickname: initialData.nickname || "",
                department_id: initialData.department_id ? String(initialData.department_id) : "",
                job_position_id: initialData.job_position_id ? String(initialData.job_position_id) : "",
                nationality: initialData.nationality || "THA",
                id_document_type: initialData.id_document_type || "national_id",
                national_id_card: initialData.national_id_card || "",
                birth_date: initialData.birth_date ? String(initialData.birth_date).slice(0, 10) : "",
                gender: initialData.gender || "",
                hire_date: initialData.hire_date ? String(initialData.hire_date).slice(0, 10) : "",
                salary_type: initialData.salary_type || "monthly",
                is_on_trial: initialData.is_on_trial ?? true,
                probation_days: days,
                is_checkin_exempt: initialData.is_checkin_exempt ?? false,
                is_active: initialData.is_active ?? true,
                resignation_date: initialData.resignation_date ? String(initialData.resignation_date).slice(0, 10) : ""
            };
        }
        return {
            emp_id: empId || "",
            company_id: "2", // Default Tera Group
            branch_id: "",
            title_prefix: "",
            first_name: "",
            last_name: "",
            nickname: "",
            department_id: "",
            job_position_id: "",
            nationality: "THA",
            id_document_type: "national_id",
            national_id_card: "",
            birth_date: "",
            gender: "",
            hire_date: "",
            salary_type: "monthly",
            is_on_trial: true,
            probation_days: "119",
            is_checkin_exempt: false,
            is_active: true,
            resignation_date: ""
        };
    });

    // Synchronize state whenever initialData or empId updates (e.g. async fetch from wizard)
    useEffect(() => {
        if (!initialData) return;
        const nat = parseNationality(initialData);
        setNationalityType(nat.nationalityType);
        setCustomNationality(nat.customNationality);

        const doc = parseDocType(initialData);
        setDocTypeCategory(doc.docTypeCategory);
        setCustomDocType(doc.customDocType);

        if (initialData.fullName || initialData.name) {
            setFullName(initialData.fullName || initialData.name || "");
        } else if (initialData.first_name || initialData.last_name) {
            setFullName([initialData.title_prefix, initialData.first_name, initialData.last_name].filter(Boolean).join(" "));
        }

        if (initialData.formData) {
            setFormData({ ...initialData.formData });
        } else {
            let days = "119";
            if (initialData.probation_days) {
                days = String(initialData.probation_days);
            } else if (initialData.hire_date && initialData.probation_end_date) {
                try {
                    const diff = differenceInDays(parseISO(String(initialData.probation_end_date).slice(0, 10)), parseISO(String(initialData.hire_date).slice(0, 10)));
                    if (diff > 0) days = String(diff);
                } catch { }
            }

            setFormData((prev: any) => ({
                ...prev,
                emp_id: initialData.emp_id || prev.emp_id || empId || "",
                company_id: String(initialData.company_id || prev.company_id || "2"),
                branch_id: initialData.branch_id || prev.branch_id || "",
                title_prefix: initialData.title_prefix || prev.title_prefix || "",
                first_name: initialData.first_name || prev.first_name || "",
                last_name: initialData.last_name || prev.last_name || "",
                nickname: initialData.nickname || prev.nickname || "",
                department_id: initialData.department_id ? String(initialData.department_id) : prev.department_id,
                job_position_id: initialData.job_position_id ? String(initialData.job_position_id) : prev.job_position_id,
                nationality: initialData.nationality || prev.nationality || "THA",
                id_document_type: initialData.id_document_type || prev.id_document_type || "national_id",
                national_id_card: initialData.national_id_card || prev.national_id_card || "",
                birth_date: initialData.birth_date ? String(initialData.birth_date).slice(0, 10) : prev.birth_date,
                gender: initialData.gender || prev.gender || "",
                hire_date: initialData.hire_date ? String(initialData.hire_date).slice(0, 10) : prev.hire_date,
                salary_type: initialData.salary_type || prev.salary_type || "monthly",
                is_on_trial: initialData.is_on_trial !== undefined ? initialData.is_on_trial : prev.is_on_trial,
                probation_days: days,
                is_checkin_exempt: initialData.is_checkin_exempt !== undefined ? initialData.is_checkin_exempt : prev.is_checkin_exempt,
                is_active: initialData.is_active !== undefined ? initialData.is_active : prev.is_active,
                resignation_date: initialData.resignation_date ? String(initialData.resignation_date).slice(0, 10) : prev.resignation_date
            }));
        }
    }, [initialData, empId]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Calculate Age
    const age = useMemo(() => {
        if (!formData.birth_date) return null;
        try {
            return differenceInYears(new Date(), parseISO(formData.birth_date));
        } catch {
            return null;
        }
    }, [formData.birth_date]);

    // Calculate Probation End Date
    const probationEndDate = useMemo(() => {
        if (!formData.is_on_trial || !formData.hire_date || !formData.probation_days) return null;
        try {
            return format(addDays(parseISO(formData.hire_date), parseInt(formData.probation_days)), "yyyy-MM-dd");
        } catch {
            return null;
        }
    }, [formData.is_on_trial, formData.hire_date, formData.probation_days]);

    // Handle Name Input with auto-parsing
    const handleNameChange = (val: string) => {
        setFullName(val);
        const parsed = parseFullName(val);
        setFormData((prev: any) => ({
            ...prev,
            title_prefix: parsed.title_prefix || "",
            first_name: parsed.first_name,
            last_name: parsed.last_name
        }));
    };

    // Filter positions by department
    const filteredPositions = useMemo(() => {
        if (!formData.department_id) return positions;
        return positions?.filter((p: any) => p.department_id === Number(formData.department_id));
    }, [positions, formData.department_id]);

    // Format options for search-by-typing comboboxes
    const branchOptions: ComboboxOption[] = useMemo(() => {
        return (branches || []).map((b: any) => ({
            value: b.id,
            label: b.name,
            subLabel: b.id
        }));
    }, [branches]);

    const departmentOptions: ComboboxOption[] = useMemo(() => {
        return (departments || []).map((d: any) => ({
            value: d.id,
            label: d.name
        }));
    }, [departments]);

    const positionOptions: ComboboxOption[] = useMemo(() => {
        return (filteredPositions || []).map((p: any) => ({
            value: p.id,
            label: p.title
        }));
    }, [filteredPositions]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const parsed = parseFullName(fullName);
        if (!parsed.name) {
            return setError("กรุณากรอกชื่อ-สกุล");
        }

        const effectiveDocType = docTypeCategory === "other"
            ? (customDocType.trim() || "other")
            : docTypeCategory;

        if (docTypeCategory === "national_id" && formData.national_id_card) {
            if (!validateThaiNationalId(formData.national_id_card)) {
                return setError("หมายเลขบัตรประชาชนไม่ถูกต้องตามหลักการคำนวณ 13 หลัก");
            }
        }

        setLoading(true);
        try {
            // Infer company_id from emp_id if typed, or default to 2
            let companyId = Number(formData.company_id) || 2;
            const empIdUpper = formData.emp_id.trim().toUpperCase();
            if (empIdUpper.startsWith("TE")) companyId = 3;
            else if (empIdUpper.startsWith("TP")) companyId = 4;
            else if (empIdUpper.startsWith("TG")) companyId = 2;

            const payload = {
                emp_id: formData.emp_id.trim() || undefined,
                company_id: companyId,
                name: parsed.name,
                title_prefix: parsed.title_prefix,
                first_name: parsed.first_name,
                last_name: parsed.last_name,
                nickname: formData.nickname.trim() || null,
                branch_id: formData.branch_id || null,
                department_id: formData.department_id ? Number(formData.department_id) : null,
                job_position_id: formData.job_position_id ? Number(formData.job_position_id) : null,
                nationality: nationalityType === "OTH" ? (customNationality.trim() || "OTH") : nationalityType,
                id_document_type: effectiveDocType,
                national_id_card: formData.national_id_card.trim() || null,
                birth_date: formData.birth_date || null,
                gender: formData.gender || null,
                hire_date: formData.hire_date || null,
                salary_type: formData.salary_type || "monthly",
                is_on_trial: formData.is_on_trial,
                probation_end_date: probationEndDate,
                is_checkin_exempt: formData.is_checkin_exempt,
                is_active: formData.is_active,
                resignation_date: !formData.is_active ? (formData.resignation_date || new Date().toISOString().split("T")[0]) : null,
                is_onboarding_complete: false
            };

            const effectiveEmpId = (empId || initialData?.emp_id || formData.emp_id.trim() || undefined);
            const isExisting = Boolean(empId || initialData?.isExistingInDb || (initialData?.emp_id && initialData?.emp_id === effectiveEmpId));

            if (!formData.is_active && !formData.resignation_date) {
                setError("กรุณาระบุวันที่ลาออก");
                return;
            }

            let res;
            if (isExisting && effectiveEmpId) {
                // Update existing employee in database
                res = await fetch("/api/admin/employees", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...payload,
                        emp_id: effectiveEmpId
                    })
                });
            } else {
                // Create new employee
                res = await fetch("/api/admin/employees", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            }

            const data = await res.json();
            if (data.ok) {
                const currentRawState = {
                    fullName,
                    nationalityType,
                    customNationality,
                    docTypeCategory,
                    customDocType,
                    formData: {
                        ...formData,
                        emp_id: data.employee?.emp_id || effectiveEmpId,
                        is_active: formData.is_active,
                        resignation_date: formData.resignation_date
                    },
                    isExistingInDb: true
                };
                onComplete(data.employee, currentRawState);
            } else {
                setError(data.error || "ไม่สามารถบันทึกข้อมูลพนักงานได้");
            }
        } catch (err: any) {
            setError(err.message || "เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable Form Content */}
            <div className="overflow-y-auto flex-1 px-7 py-3 space-y-4 pr-6">
                {error && (
                    <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-200">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {/* Row 1 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            รหัสพนักงาน <span className="text-red-500">*</span>
                            {(empId || initialData?.emp_id) && (
                                <span className="text-[11px] text-emerald-600 font-normal ml-2">
                                    ✓ บันทึกในระบบแล้ว
                                </span>
                            )}
                        </label>
                        <input
                            type="text"
                            className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white font-mono disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                            value={formData.emp_id}
                            onChange={e => setFormData({ ...formData, emp_id: e.target.value })}
                            placeholder="เช่น TG69050 (เว้นว่างเพื่อสร้างอัตโนมัติ)"
                            disabled={Boolean(empId || initialData?.emp_id)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">สาขา</label>
                        <SearchableCombobox
                            options={branchOptions}
                            value={formData.branch_id}
                            onChange={val => setFormData({ ...formData, branch_id: val })}
                            placeholder="— ไม่ระบุ —"
                        />
                    </div>

                    {/* Row 2 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">แผนก</label>
                        <SearchableCombobox
                            options={departmentOptions}
                            value={formData.department_id}
                            onChange={val => setFormData({ ...formData, department_id: val, job_position_id: "" })}
                            placeholder="— ไม่ระบุ —"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">ตำแหน่ง</label>
                        <SearchableCombobox
                            options={positionOptions}
                            value={formData.job_position_id}
                            onChange={val => setFormData({ ...formData, job_position_id: val })}
                            placeholder="— ไม่ระบุ —"
                        />
                    </div>

                    {/* Row 3 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            ชื่อ-สกุล <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                            value={fullName}
                            onChange={e => handleNameChange(e.target.value)}
                            placeholder="เช่น นาย สมชาย ใจดี"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">ชื่อเล่น</label>
                        <input
                            type="text"
                            className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                            value={formData.nickname}
                            onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                            placeholder=""
                        />
                    </div>

                    {/* Row 4 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">สัญชาติ</label>
                        {nationalityType === "OTH" ? (
                            <div className="grid grid-cols-5 gap-2">
                                <div className="relative col-span-2">
                                    <select
                                        className="w-full h-11 px-3 pr-7 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white appearance-none cursor-pointer"
                                        value={nationalityType}
                                        onChange={e => {
                                            setNationalityType(e.target.value);
                                            if (e.target.value !== "OTH") setCustomNationality("");
                                        }}
                                    >
                                        <option value="THA">ไทย</option>
                                        <option value="MMR">พม่า</option>
                                        <option value="LAO">ลาว</option>
                                        <option value="KHM">กัมพูชา</option>
                                        <option value="OTH">อื่นๆ</option>
                                    </select>
                                    <svg
                                        className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                                <div className="col-span-3">
                                    <input
                                        type="text"
                                        placeholder="ระบุสัญชาติ เช่น ญี่ปุ่น"
                                        className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                                        value={customNationality}
                                        onChange={e => setCustomNationality(e.target.value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <select
                                    className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white appearance-none cursor-pointer"
                                    value={nationalityType}
                                    onChange={e => {
                                        setNationalityType(e.target.value);
                                        if (e.target.value !== "OTH") setCustomNationality("");
                                    }}
                                >
                                    <option value="THA">ไทย</option>
                                    <option value="MMR">พม่า</option>
                                    <option value="LAO">ลาว</option>
                                    <option value="KHM">กัมพูชา</option>
                                    <option value="OTH">อื่นๆ (ระบุ)</option>
                                </select>
                                <svg
                                    className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">ประเภทเอกสาร</label>
                        {docTypeCategory === "other" ? (
                            <div className="grid grid-cols-5 gap-2">
                                <div className="relative col-span-2">
                                    <select
                                        className="w-full h-11 px-3 pr-7 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white appearance-none cursor-pointer"
                                        value={docTypeCategory}
                                        onChange={e => {
                                            setDocTypeCategory(e.target.value);
                                            if (e.target.value !== "other") setCustomDocType("");
                                        }}
                                    >
                                        <option value="national_id">บัตร ปปช</option>
                                        <option value="passport">พาสปอร์ต</option>
                                        <option value="other">อื่นๆ</option>
                                    </select>
                                    <svg
                                        className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                                <div className="col-span-3">
                                    <input
                                        type="text"
                                        placeholder="ระบุประเภทเอกสาร"
                                        className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                                        value={customDocType}
                                        onChange={e => setCustomDocType(e.target.value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <select
                                    className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white appearance-none cursor-pointer"
                                    value={docTypeCategory}
                                    onChange={e => {
                                        setDocTypeCategory(e.target.value);
                                        if (e.target.value !== "other") setCustomDocType("");
                                    }}
                                >
                                    <option value="national_id">บัตร ปปช</option>
                                    <option value="passport">พาสปอร์ต</option>
                                    <option value="other">อื่นๆ (ระบุ)</option>
                                </select>
                                <svg
                                    className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Row 5 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            หมายเลขเอกสาร <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                            value={formData.national_id_card}
                            onChange={e => setFormData({ ...formData, national_id_card: e.target.value })}
                            placeholder={docTypeCategory === "national_id" ? "เลขประจำตัว 13 หลัก" : "ระบุหมายเลขเอกสาร"}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            วันเกิด {age !== null && <span className="text-xs font-normal text-gray-500">({age} ปี)</span>}
                        </label>
                        <input
                            type="date"
                            className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                            value={formData.birth_date}
                            onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                        />
                    </div>

                    {/* Row 6 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">เพศ</label>
                        <div className="relative">
                            <select
                                className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white appearance-none cursor-pointer"
                                value={formData.gender}
                                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                            >
                                <option value="">— ไม่ระบุ —</option>
                                <option value="M">ชาย</option>
                                <option value="F">หญิง</option>
                                <option value="O">อื่นๆ</option>
                            </select>
                            <svg
                                className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            วันที่เริ่มงาน <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                            value={formData.hire_date}
                            onChange={e => setFormData({ ...formData, hire_date: e.target.value })}
                            required
                        />
                    </div>

                    {/* Row 7 */}
                    <div>
                        <div className="flex items-center mb-1.5 h-5">
                            <label className="block text-sm font-semibold text-gray-800">ประเภทการจ่ายเงิน</label>
                        </div>
                        <div className="relative">
                            <select
                                className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white appearance-none cursor-pointer"
                                value={formData.salary_type}
                                onChange={e => setFormData({ ...formData, salary_type: e.target.value })}
                            >
                                <option value="monthly">รายเดือน</option>
                                <option value="daily">รายวัน</option>
                            </select>
                            <svg
                                className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1.5 h-5">
                            <label className="block text-sm font-semibold text-gray-800">การทดลองงาน</label>
                            {formData.is_on_trial && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <span>ระยะเวลา:</span>
                                    <div className="relative">
                                        <select
                                            className="h-6 pl-2 pr-5 rounded-md border border-gray-300 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-400 cursor-pointer appearance-none"
                                            value={formData.probation_days}
                                            onChange={e => setFormData({ ...formData, probation_days: e.target.value })}
                                        >
                                            <option value="90">90 วัน</option>
                                            <option value="119">119 วัน</option>
                                            <option value="120">120 วัน</option>
                                        </select>
                                        <svg className="w-3 h-3 text-gray-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div
                            className={`w-full h-11 px-4 rounded-xl border transition-all flex items-center justify-between ${formData.is_on_trial
                                ? "border-gray-300 bg-white"
                                : "border-gray-200 bg-gray-50/60"
                                }`}
                        >
                            <label className="flex items-center gap-2.5 cursor-pointer select-none whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                    checked={formData.is_on_trial}
                                    onChange={e => setFormData({ ...formData, is_on_trial: e.target.checked })}
                                />
                                <span className="text-sm font-medium text-gray-800">ทดลองงาน</span>
                            </label>

                            {formData.is_on_trial ? (
                                <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                                    {probationEndDate ? `สิ้นสุด ${formatThaiBE(probationEndDate)}` : "(รอระบุวันเริ่มงาน)"}
                                </span>
                            ) : (
                                <span className="text-xs text-gray-400">บรรจุเป็นพนักงานประจำ</span>
                            )}
                        </div>
                    </div>

                    {/* Row 8: Checkin Exemption */}
                    <div className="col-span-2 pt-1">
                        <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300"
                                checked={formData.is_checkin_exempt}
                                onChange={e => setFormData({ ...formData, is_checkin_exempt: e.target.checked })}
                            />
                            <div>
                                <div className="text-sm font-medium text-gray-800">พนักงานคนนี้ไม่ต้องลงเวลาเข้า/ออกงาน</div>
                                <div className="text-xs text-gray-500">ยกเว้นการตรวจสอบการสแกนเวลาเข้างานสำหรับพนักงานตำแหน่งพิเศษ</div>
                            </div>
                        </label>
                    </div>

                    {/* Employment Status Section (Edit / Existing Employee Only) */}
                    {Boolean(empId || initialData?.emp_id) && (
                        <div className="col-span-2 p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${formData.is_active ? "bg-emerald-500" : "bg-red-500"}`}></span>
                                        <span>สถานะการทำงาน: {formData.is_active ? "กำลังทำงานอยู่ (Active)" : "พ้นสภาพ / ลาออกแล้ว (Inactive)"}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {formData.is_active
                                            ? "พนักงานสามารถเข้าสู่ระบบและลงเวลาทำงานได้ตามปกติ (ปิดสวิตช์เมื่อพนักงานลาออก)"
                                            : "พนักงานพ้นสภาพแล้ว จะไม่สามารถลงเวลาหรือรับการแจ้งเตือนใดๆ ได้อีก"}
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.is_active}
                                        onChange={e => {
                                            const active = e.target.checked;
                                            setFormData({
                                                ...formData,
                                                is_active: active,
                                                resignation_date: active ? "" : (formData.resignation_date || new Date().toISOString().split("T")[0])
                                            });
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>

                            {!formData.is_active && (
                                <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-2">
                                    <label className="block text-xs font-bold text-red-800">
                                        ระบุวันที่ลาออก (วันที่ออกจริง) <span className="text-red-600">* จำเป็น</span>
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full h-10 px-3 rounded-lg border border-red-300 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200"
                                        value={formData.resignation_date}
                                        onChange={e => setFormData({ ...formData, resignation_date: e.target.value })}
                                        required
                                    />
                                    <p className="text-[11px] text-red-600">
                                        * เมื่อบันทึกการลาออก ระบบจะหยุดส่งแจ้งเตือนหาพนักงานคนนี้ทันที และหากเป็นหัวหน้างาน ระบบจะเลื่อนผู้ประเมินร่วมลำดับที่ 1 ขึ้นเป็นหัวหน้างานให้ลูกน้องโดยอัตโนมัติ
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Footer Pinned at Bottom */}
            <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-white shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium transition-all cursor-pointer"
                >
                    ยกเลิก
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-medium shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                    {loading ? "กำลังบันทึก..." : "ถัดไป"}
                </button>
            </div>
        </form>
    );
}
