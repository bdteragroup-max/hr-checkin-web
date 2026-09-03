"use client";

import { useState, useMemo, useEffect } from "react";
import { format, addMonths } from "date-fns";

export const ACCOMMODATION_TIERS = [
    { key: "under_1", label: "< 1 ปี", amount: 1500, minYears: 0, maxYears: 1 },
    { key: "1_to_2", label: "> 1 < 2 ปี", amount: 1800, minYears: 1, maxYears: 2 },
    { key: "2_to_3", label: "> 2 < 3 ปี", amount: 2100, minYears: 2, maxYears: 3 },
    { key: "3_to_4", label: "> 3 < 4 ปี", amount: 2400, minYears: 3, maxYears: 4 },
    { key: "4_to_5", label: "> 4 < 5 ปี", amount: 2700, minYears: 4, maxYears: 5 },
    { key: "5_plus", label: "≥ 5 ปี", amount: 3000, minYears: 5, maxYears: 999 },
];

export function getAccommodationTier(hireDateStr: string | null | undefined) {
    if (!hireDateStr) {
        return { ...ACCOMMODATION_TIERS[0], yearsCount: 0, yearsLabel: "< 1 ปี" };
    }
    try {
        const hDate = new Date(hireDateStr);
        const now = new Date();
        let yrs = now.getFullYear() - hDate.getFullYear();
        const mDiff = now.getMonth() - hDate.getMonth();
        if (mDiff < 0 || (mDiff === 0 && now.getDate() < hDate.getDate())) {
            yrs--;
        }
        if (yrs < 0) yrs = 0;

        if (yrs < 1) return { ...ACCOMMODATION_TIERS[0], yearsCount: yrs, yearsLabel: "< 1 ปี" };
        if (yrs < 2) return { ...ACCOMMODATION_TIERS[1], yearsCount: yrs, yearsLabel: "> 1 < 2 ปี" };
        if (yrs < 3) return { ...ACCOMMODATION_TIERS[2], yearsCount: yrs, yearsLabel: "> 2 < 3 ปี" };
        if (yrs < 4) return { ...ACCOMMODATION_TIERS[3], yearsCount: yrs, yearsLabel: "> 3 < 4 ปี" };
        if (yrs < 5) return { ...ACCOMMODATION_TIERS[4], yearsCount: yrs, yearsLabel: "> 4 < 5 ปี" };
        return { ...ACCOMMODATION_TIERS[5], yearsCount: yrs, yearsLabel: "≥ 5 ปี" };
    } catch {
        return { ...ACCOMMODATION_TIERS[0], yearsCount: 0, yearsLabel: "< 1 ปี" };
    }
}

export const PHONE_ALLOWANCE_CATEGORIES = [
    {
        id: "driver",
        roleName: "คนขับรถ",
        eligibility: "ตั้งแต่วันเริ่มงาน",
        under1: 300,
        y1to2: 300,
        y2plus: 300,
        isFlat: true,
        rateLabel: "300 บาท/เดือน",
    },
    {
        id: "general",
        roleName: "พนักงานทั่วไป",
        eligibility: "ผ่านทดลองงาน",
        under1: 100,
        y1to2: 200,
        y2plus: 300,
        isFlat: false,
        rateLabel: "100 - 300 บาท/เดือน (ตามอายุงาน)",
    },
    {
        id: "foreman",
        roleName: "หัวหน้าช่าง",
        eligibility: "ผ่านทดลองงาน",
        under1: 300,
        y1to2: 300,
        y2plus: 300,
        isFlat: true,
        rateLabel: "300 บาท/เดือน",
    },
    {
        id: "hr",
        roleName: "ฝ่ายบุคคล",
        eligibility: "ผ่านทดลองงาน",
        under1: 800,
        y1to2: 800,
        y2plus: 800,
        isFlat: true,
        rateLabel: "800 บาท/เดือน",
    },
    {
        id: "engineer",
        roleName: "วิศวกร",
        eligibility: "ผ่านทดลองงาน",
        under1: 500,
        y1to2: 500,
        y2plus: 500,
        isFlat: true,
        rateLabel: "500 บาท/เดือน",
    },
    {
        id: "manager",
        roleName: "ผู้จัดการ",
        eligibility: "ผ่านทดลองงาน",
        under1: 1000,
        y1to2: 1000,
        y2plus: 1000,
        isFlat: true,
        rateLabel: "1,000 บาท/เดือน",
    },
];

export function getPhoneAllowanceDetails(
    employeeData: any,
    positions: any[] = [],
    departments: any[] = [],
    selectedCategoryId?: string | null
) {
    const pos = positions.find((p: any) => String(p.id) === String(employeeData?.job_position_id));
    const dept = departments.find((d: any) => String(d.id) === String(employeeData?.department_id));
    const posTitle = (pos?.title || "").toLowerCase();
    const deptName = (dept?.name || "").toLowerCase();

    let autoCategoryId = "general";
    let autoRoleName = "พนักงานทั่วไป";

    if (posTitle.includes("ผู้จัดการ") || posTitle.includes("manager")) {
        autoCategoryId = "manager";
        autoRoleName = "ผู้จัดการ";
    } else if (deptName.includes("บุคคล") || deptName.includes("hr") || posTitle.includes("บุคคล") || posTitle.includes("hr")) {
        autoCategoryId = "hr";
        autoRoleName = "ฝ่ายบุคคล";
    } else if (posTitle.includes("วิศวกร") || posTitle.includes("engineer") || deptName.includes("วิศว") || deptName.includes("engineer")) {
        autoCategoryId = "engineer";
        autoRoleName = "วิศวกร";
    } else if (posTitle.includes("หัวหน้าช่าง") || posTitle.includes("foreman")) {
        autoCategoryId = "foreman";
        autoRoleName = "หัวหน้าช่าง";
    } else if (posTitle.includes("คนขับ") || posTitle.includes("ขับรถ") || posTitle.includes("driver")) {
        autoCategoryId = "driver";
        autoRoleName = "คนขับรถ";
    }

    const activeCategoryId = selectedCategoryId || autoCategoryId;
    const cat = PHONE_ALLOWANCE_CATEGORIES.find(c => c.id === activeCategoryId) || PHONE_ALLOWANCE_CATEGORIES[1];

    let yearsCount = 0;
    let yearsLabel = "< 1 ปี";
    let tenureCol: "under1" | "y1to2" | "y2plus" = "under1";

    if (employeeData?.hire_date) {
        try {
            const hDate = new Date(employeeData.hire_date);
            const now = new Date();
            let yrs = now.getFullYear() - hDate.getFullYear();
            const mDiff = now.getMonth() - hDate.getMonth();
            if (mDiff < 0 || (mDiff === 0 && now.getDate() < hDate.getDate())) yrs--;
            if (yrs < 0) yrs = 0;
            yearsCount = yrs;
            if (yrs < 1) {
                yearsLabel = "< 1 ปี";
                tenureCol = "under1";
            } else if (yrs < 2) {
                yearsLabel = "> 1 < 2 ปี";
                tenureCol = "y1to2";
            } else {
                yearsLabel = "≥ 2 ปีขึ้นไป";
                tenureCol = "y2plus";
            }
        } catch {
            yearsCount = 0;
            yearsLabel = "< 1 ปี";
            tenureCol = "under1";
        }
    }

    let currentAmount = cat.under1;
    if (tenureCol === "y2plus") {
        currentAmount = cat.y2plus;
    } else if (tenureCol === "y1to2") {
        currentAmount = cat.y1to2;
    }

    return {
        autoCategoryId,
        autoRoleName,
        activeCategoryId,
        selectedRoleName: cat.roleName,
        isCustomSelected: Boolean(selectedCategoryId && selectedCategoryId !== autoCategoryId),
        positionTitle: pos?.title || "",
        departmentName: dept?.name || "",
        eligibility: cat.eligibility,
        yearsLabel,
        yearsCount,
        tenureCol,
        currentAmount,
        cat
    };
}

// Helper to accurately extract position allowance, phone allowance, and itemized rows
function parseAllowancesAndPosition(employeeData: any, allowanceTypes?: any[]) {
    let posAllow = "";
    if (employeeData?.position_allowance != null && Number(employeeData.position_allowance) > 0) {
        posAllow = String(employeeData.position_allowance);
    }

    let hasPhone = Boolean(employeeData?.has_telephone_allowance);
    const itemizedRows: any[] = [];

    if (Array.isArray(employeeData?.allowances)) {
        for (const a of employeeData.allowances) {
            const typeName = a.allowance_type?.name || "";
            const isPos = typeName.includes("ค่าตำแหน่ง") || (allowanceTypes && allowanceTypes.some(t => t.id === Number(a.allowance_type_id) && t.name.includes("ค่าตำแหน่ง")));
            const isPhone = typeName.includes("ค่าโทรศัพท์") || (allowanceTypes && allowanceTypes.some(t => t.id === Number(a.allowance_type_id) && t.name.includes("ค่าโทรศัพท์")));

            if (isPos) {
                if (!posAllow && a.amount != null && Number(a.amount) > 0) {
                    posAllow = String(a.amount);
                }
                continue;
            }

            if (isPhone) {
                hasPhone = true;
                continue;
            }

            itemizedRows.push({
                allowance_type_id: String(a.allowance_type_id),
                amount: String(a.amount),
                calc_basis: a.calc_basis || "fixed_monthly",
                applies_to: a.applies_to || "always",
                sso_included: Boolean(a.sso_included),
                tax_included: a.tax_included !== undefined ? Boolean(a.tax_included) : true,
                void_on_warning: Boolean(a.void_on_warning)
            });
        }
    }

    return {
        positionAllowance: posAllow,
        hasPhoneAllowance: hasPhone,
        itemizedAllowances: itemizedRows
    };
}

export default function Step2Allowances({
    empId,
    employeeData,
    positions = [],
    departments = [],
    mode = "create",
    onComplete,
    onBack,
    onClose
}: {
    empId: string;
    employeeData: any;
    positions?: any[];
    departments?: any[];
    mode?: "create" | "edit";
    onComplete: (data?: any) => void;
    onBack: () => void;
    onClose?: () => void;
}) {
    const isEdit = mode === "edit" || Boolean(employeeData?.isExistingInDb || employeeData?.emp_id);
    const [allowanceTypes, setAllowanceTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const initialParsed = useMemo(() => parseAllowancesAndPosition(employeeData), [employeeData]);

    // Form State
    const [baseSalary, setBaseSalary] = useState(
        employeeData?.base_salary ? String(employeeData.base_salary) : ""
    );
    const [salaryType, setSalaryType] = useState(
        employeeData?.salary_type || "monthly"
    );
    const [positionAllowance, setPositionAllowance] = useState(
        initialParsed.positionAllowance
    );
    const [allowanceMode, setAllowanceMode] = useState(
        employeeData?.allowance_mode || "itemized"
    );
    const [fixedTaxDeduction, setFixedTaxDeduction] = useState(
        employeeData?.fixed_tax_deduction != null ? String(employeeData.fixed_tax_deduction) : "0"
    );
    const [taxMethod, setTaxMethod] = useState(
        employeeData?.fixed_tax_deduction && Number(employeeData.fixed_tax_deduction) > 0 ? "fixed" : "auto"
    );
    const [ssoMethod, setSsoMethod] = useState("auto");
    const [hasPhoneAllowance, setHasPhoneAllowance] = useState(
        initialParsed.hasPhoneAllowance
    );
    const [selectedPhoneCategory, setSelectedPhoneCategory] = useState<string | null>(null);

    // Rows
    const [allowances, setAllowances] = useState<any[]>(initialParsed.itemizedAllowances);

    // Working Days Preview
    const [probationDays, setProbationDays] = useState<number | null>(null);
    const [postProbationDays, setPostProbationDays] = useState<number | null>(null);

    useEffect(() => {
        if (employeeData) {
            if (employeeData.base_salary !== undefined) {
                setBaseSalary(employeeData.base_salary ? String(employeeData.base_salary) : "");
            }
            if (employeeData.salary_type) {
                setSalaryType(employeeData.salary_type);
            }
            if (employeeData.allowance_mode) {
                setAllowanceMode(employeeData.allowance_mode);
            }
            if (employeeData.fixed_tax_deduction != null) {
                setFixedTaxDeduction(String(employeeData.fixed_tax_deduction));
                setTaxMethod(Number(employeeData.fixed_tax_deduction) > 0 ? "fixed" : "auto");
            }

            const parsedRes = parseAllowancesAndPosition(employeeData, allowanceTypes);
            if (parsedRes.positionAllowance || employeeData.position_allowance !== undefined) {
                setPositionAllowance(parsedRes.positionAllowance || (employeeData.position_allowance ? String(employeeData.position_allowance) : ""));
            }
            if (employeeData.has_telephone_allowance !== undefined || parsedRes.hasPhoneAllowance) {
                setHasPhoneAllowance(Boolean(employeeData.has_telephone_allowance) || parsedRes.hasPhoneAllowance);
            }
            if (Array.isArray(employeeData.allowances)) {
                setAllowances(parsedRes.itemizedAllowances);
            }
        }
    }, [employeeData, allowanceTypes]);

    useEffect(() => {
        // Fetch allowance types for this company
        const companyId = employeeData?.company_id || (empId?.startsWith("TE") ? 3 : empId?.startsWith("TP") ? 4 : 2);
        fetch(`/api/admin/allowances/types?company_id=${companyId}&emp_id=${empId}`)
            .then(res => res.json())
            .then(data => {
                if (data.ok) {
                    const list = data.list || [];
                    setAllowanceTypes(list);
                    // ONLY in create mode for a brand new employee: default to Accommodation/Rental allowance if list is empty
                    if (!isEdit) {
                        setAllowances(prev => {
                            if (prev.length === 0) {
                                const accType = list.find((t: any) => t.name.includes("ค่าที่พัก"));
                                if (accType) {
                                    const tier = getAccommodationTier(employeeData?.hire_date);
                                    return [{
                                        allowance_type_id: String(accType.id),
                                        amount: String(tier.amount),
                                        calc_basis: "fixed_monthly",
                                        applies_to: "after_probation",
                                        sso_included: false,
                                        tax_included: true,
                                        void_on_warning: true
                                    }];
                                }
                            }
                            return prev;
                        });
                    }
                }
            })
            .catch(console.error);

        // Fetch working days for preview (current cycle)
        fetch(`/api/admin/payroll/working-days`)
            .then(res => res.json())
            .then(data => {
                if (data.ok) {
                    const days = data.maxWorkdays;
                    if (employeeData.is_on_trial) {
                        setProbationDays(days);
                        setPostProbationDays(days);
                    } else {
                        setPostProbationDays(days);
                    }
                }
            })
            .catch(console.error);
    }, [employeeData]);

    const addRow = () => {
        setAllowances([...allowances, {
            allowance_type_id: "",
            amount: "",
            calc_basis: "fixed_monthly",
            applies_to: "always",
            sso_included: false,
            tax_included: true,
            void_on_warning: false
        }]);
    };

    const updateRow = (index: number, field: string, value: any) => {
        const newArr = [...allowances];
        newArr[index][field] = value;
        setAllowances(newArr);
    };

    const handleTypeChange = (index: number, newTypeId: string) => {
        const type = allowanceTypes.find(t => String(t.id) === String(newTypeId));
        const newArr = [...allowances];
        newArr[index].allowance_type_id = newTypeId;

        if (type) {
            const isAccommodation = type.name.includes("ค่าที่พัก");
            const isMeal = type.name.includes("ค่าอาหาร");
            const isTravel = type.name.includes("ค่าเดินทาง");

            if (isAccommodation) {
                const tier = getAccommodationTier(employeeData?.hire_date);
                newArr[index].amount = String(tier.amount);
                newArr[index].calc_basis = "fixed_monthly";
                newArr[index].applies_to = "after_probation"; // สิทธิ์ที่เบิกได้: ผ่านทดลองงาน
                newArr[index].sso_included = false;
                newArr[index].tax_included = true;
                newArr[index].void_on_warning = true;
            } else if (isMeal) {
                if (!newArr[index].amount) newArr[index].amount = "100";
                newArr[index].calc_basis = "daily_attendance";
                newArr[index].applies_to = "always";
            } else if (isTravel) {
                if (!newArr[index].amount) newArr[index].amount = "60";
                newArr[index].calc_basis = "daily_attendance";
                newArr[index].applies_to = "always";
            } else {
                newArr[index].sso_included = Boolean(type.default_sso_included);
                newArr[index].tax_included = Boolean(type.default_tax_included);
            }
        }
        setAllowances(newArr);
    };

    const removeRow = (index: number) => {
        setAllowances(allowances.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        let finalAllowances = allowances.filter(a => a.allowance_type_id && a.amount !== "");

        if (salaryType === "daily") {
            finalAllowances = [];
        } else {
            const phoneType = allowanceTypes.find(t => t.name.includes("ค่าโทรศัพท์"));
            finalAllowances = finalAllowances.filter(a => {
                const t = allowanceTypes.find(at => at.id == a.allowance_type_id);
                return !t?.name?.includes("ค่าโทรศัพท์");
            });

            if (hasPhoneAllowance && phoneType) {
                const phoneDetails = getPhoneAllowanceDetails(employeeData, positions, departments, selectedPhoneCategory);
                finalAllowances.push({
                    allowance_type_id: phoneType.id,
                    amount: String(phoneDetails.currentAmount),
                    calc_basis: "fixed_monthly",
                    applies_to: phoneDetails.cat.eligibility === "ตั้งแต่วันเริ่มงาน" ? "always" : "after_probation",
                    sso_included: false,
                    tax_included: true,
                    void_on_warning: true,
                });
            }
        }

        // Validation
        if (!baseSalary || isNaN(Number(baseSalary)) || Number(baseSalary) < 0) {
            return setError("กรุณากรอกเงินเดือนพื้นฐาน / ค่าแรงให้ถูกต้อง");
        }

        if (salaryType !== "daily") {
            for (let a of finalAllowances) {
                if (!a.allowance_type_id) return setError("กรุณาเลือกประเภทสวัสดิการสำหรับทุกรายการ");
                if (!a.amount || isNaN(Number(a.amount))) return setError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
            }
        }

        setLoading(true);
        try {
            const payload = {
                step: 2,
                base_salary: baseSalary ? Number(baseSalary) : null,
                salary_type: salaryType,
                position_allowance: positionAllowance ? Number(positionAllowance) : 0,
                allowance_mode: allowanceMode,
                fixed_tax_deduction: taxMethod === 'fixed' ? fixedTaxDeduction : 0,
                has_telephone_allowance: hasPhoneAllowance,
                allowances: finalAllowances
            };

            const res = await fetch(`/api/admin/employees/${empId}/wizard`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.ok) {
                onComplete(payload);
            } else {
                setError(data.error || "ไม่สามารถบันทึกข้อมูลสวัสดิการได้");
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
                <div className="bg-red-50/70 text-red-800 text-sm p-3 rounded-xl border border-red-200">
                    กำลังตั้งค่าสำหรับรหัสพนักงาน: <strong className="font-mono font-bold">{empId}</strong>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-200 text-sm">{error}</div>}

                {/* Salary Section */}
                <div className="border border-gray-200 rounded-2xl p-4.5 bg-white shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 text-gray-800 font-bold text-base border-b border-gray-100 pb-3">
                        <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>ข้อมูลเงินเดือน &amp; ค่าตอบแทนหลัก (Base Salary &amp; Compensation)</span>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        {/* Salary Amount */}
                        <div className="col-span-5">
                            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                                {salaryType === "daily" ? "ค่าแรงรายวัน (บาท/วัน)" : "เงินเดือนพื้นฐาน (บาท/เดือน)"} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full h-11 px-4 pr-12 rounded-xl border border-gray-300 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                                    placeholder={salaryType === "daily" ? "เช่น 450" : "เช่น 15000"}
                                    value={baseSalary}
                                    onChange={e => setBaseSalary(e.target.value)}
                                    required
                                />
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
                                    บาท
                                </span>
                            </div>
                        </div>

                        {/* Salary Type */}
                        <div className="col-span-4">
                            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                                รูปแบบการจ้าง
                            </label>
                            <select
                                className="w-full h-11 px-3 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                                value={salaryType}
                                onChange={e => setSalaryType(e.target.value)}
                            >
                                <option value="monthly">พนักงานรายเดือน (Monthly)</option>
                                <option value="daily">พนักงานรายวัน (Daily)</option>
                            </select>
                        </div>

                        {/* Position Allowance */}
                        <div className="col-span-3">
                            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                                ค่าตำแหน่ง (บาท)
                                {salaryType === "daily" && <span className="text-xs text-gray-400 font-normal ml-1">(เฉพาะรายเดือน)</span>}
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    disabled={salaryType === "daily"}
                                    className={`w-full h-11 px-4 pr-12 rounded-xl border border-gray-300 text-sm font-mono focus:outline-none transition-all ${salaryType === "daily" ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white text-gray-800 focus:ring-2 focus:ring-red-100 focus:border-red-500"}`}
                                    placeholder="0"
                                    value={salaryType === "daily" ? "0" : positionAllowance}
                                    onChange={e => setPositionAllowance(e.target.value)}
                                />
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
                                    บาท
                                </span>
                            </div>
                        </div>
                    </div>

                    {baseSalary && Number(baseSalary) > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-gray-600">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>
                                    {salaryType === "daily"
                                        ? `ค่าแรงคำนวณ: ${Number(baseSalary).toLocaleString()} บาท/วัน`
                                        : `ประมาณการค่าจ้างต่อวัน (ฐาน 30 วัน): ${(Number(baseSalary) / 30).toFixed(2)} บาท/วัน`
                                    }
                                </span>
                            </div>
                            {positionAllowance && Number(positionAllowance) > 0 && (
                                <span className="font-semibold text-gray-700">
                                    รวมฐาน + ค่าตำแหน่ง: {(Number(baseSalary) + Number(positionAllowance)).toLocaleString()} บาท
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Working Days Summary Preview */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="border p-4 rounded bg-gray-50">
                        <h3 className="font-bold text-gray-700 mb-2">แสดงตัวอย่างสำหรับช่วงทดลองงาน</h3>
                        <p className="text-sm text-gray-600">คำนวณจำนวนวันทำงานสูงสุดสำหรับรอบบิลปัจจุบัน</p>
                        <div className="text-2xl font-bold mt-2">
                            {employeeData.is_checkin_exempt ? "0 วัน (ได้รับการยกเว้น)" : `${probationDays || '--'} วัน`}
                        </div>
                    </div>
                    <div className="border p-4 rounded bg-gray-50">
                        <h3 className="font-bold text-gray-700 mb-2">แสดงตัวอย่างหลังจากผ่านโปร</h3>
                        <p className="text-sm text-gray-600">คำนวณจำนวนวันทำงานสูงสุดหลังจากผ่านการทดลองงาน</p>
                        <div className="text-2xl font-bold mt-2">
                            {employeeData.is_checkin_exempt ? "0 วัน (ได้รับการยกเว้น)" : `${postProbationDays || '--'} วัน`}
                        </div>
                    </div>
                </div>

                {/* Tax and SSO */}
                <div className="border-t pt-6 grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-bold mb-3">วิธีการหักภาษี</h3>
                        <select
                            className="w-full border p-2 rounded mb-3"
                            value={taxMethod}
                            onChange={e => setTaxMethod(e.target.value)}
                        >
                            <option value="auto">คำนวณอัตโนมัติ (แบบก้าวหน้า)</option>
                            <option value="fixed">กำหนดจำนวนคงที่ต่อเดือน</option>
                        </select>
                        {taxMethod === 'fixed' && (
                            <input
                                type="number"
                                className="w-full border p-2 rounded"
                                placeholder="ระบุจำนวนเงิน (บาท)"
                                value={fixedTaxDeduction}
                                onChange={e => setFixedTaxDeduction(e.target.value)}
                                required
                            />
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold mb-3">ประกันสังคม</h3>
                        <select
                            className="w-full border p-2 rounded mb-3"
                            value={ssoMethod}
                            onChange={e => setSsoMethod(e.target.value)}
                        >
                            <option value="auto">เริ่มคำนวณทันที</option>
                            <option value="delayed">เริ่มหักในเดือนถัดไป</option>
                        </select>
                    </div>
                </div>

                {/* Allowances or Daily Notice */}
                {salaryType === "daily" ? (
                    <div className="border-t border-gray-100 pt-6">
                        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-5 text-amber-950">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">📋</span>
                                <div>
                                    <h3 className="font-bold text-base text-amber-900">เงื่อนไขสิทธิประโยชน์พนักงานรายวัน (Daily Wage Employee)</h3>
                                    <p className="text-xs text-amber-700">ตามระเบียบข้อบังคับและแนวทางการจ่ายค่าตอบแทนของบริษัท</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                <div className="bg-white p-4 rounded-xl border border-red-100 shadow-2xs">
                                    <div className="text-xs font-bold text-red-600 flex items-center gap-1.5 mb-1.5">
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        ไม่ได้รับสวัสดิการและเบี้ยเลี้ยง
                                    </div>
                                    <div className="text-xs text-gray-600 leading-relaxed">
                                        พนักงานรายวัน<strong>ไม่ได้รับสวัสดิการและเงินเพิ่มใดๆ</strong> เช่น ค่าที่พัก, ค่าอาหาร, ค่าเดินทาง, เบี้ยขยัน, ค่าโทรศัพท์ หรือค่าตำแหน่ง
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs">
                                    <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mb-1.5">
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        มีสิทธิ์ขอทำงานล่วงเวลา (OT) และยื่นใบลาได้
                                    </div>
                                    <div className="text-xs text-gray-600 leading-relaxed">
                                        พนักงานรายวัน<strong>สามารถขออนุมัติทำงานล่วงเวลา (OT) และยื่นขอลาได้ตามปกติ</strong> โดยคำนวณฐานค่าแรงตามจำนวนวันที่มาปฏิบัติงานจริง
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="border-t border-gray-100 pt-6 space-y-4">
                        <div className="flex justify-between items-center mb-1">
                        <h3 className="font-bold text-lg text-gray-800">สวัสดิการและเบี้ยเลี้ยง</h3>
                        <select
                            className="h-10 px-3 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 bg-white"
                            value={allowanceMode}
                            onChange={e => setAllowanceMode(e.target.value)}
                        >
                            <option value="itemized">แสดงแยกรายการ (ในสลิปเงินเดือน)</option>
                            <option value="lump_sum">แบบเหมาจ่าย (รวมเป็นยอดเดียว)</option>
                        </select>
                    </div>

                    {/* Mobile Phone Allowance Box */}
                    {(() => {
                        const phoneDetails = getPhoneAllowanceDetails(employeeData, positions, departments, selectedPhoneCategory);

                        return (
                            <div className={`border rounded-2xl p-4.5 transition-all shadow-2xs ${hasPhoneAllowance
                                ? "bg-white border-red-200 ring-1 ring-red-100"
                                : "bg-gray-50/40 border-gray-200 hover:border-gray-300"
                                }`}>
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300 cursor-pointer accent-red-600"
                                            checked={hasPhoneAllowance}
                                            onChange={e => setHasPhoneAllowance(e.target.checked)}
                                        />
                                        <div>
                                            <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                รับค่าโทรศัพท์ (Mobile Phone Allowance)
                                            </span>
                                            {!hasPhoneAllowance && (
                                                <span className="text-xs text-gray-500 block mt-0.5 ml-6">
                                                    สิทธิ์รายบุคคลตามตำแหน่งงานและอายุงาน (จ่ายพร้อมเงินเดือน)
                                                </span>
                                            )}
                                        </div>
                                    </label>
                                    {hasPhoneAllowance && (
                                        <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                                            อัตราที่ได้รับ: {phoneDetails.currentAmount.toLocaleString()} บาท/เดือน
                                        </span>
                                    )}
                                </div>

                                {hasPhoneAllowance && (
                                    <div className="pt-3 mt-3 border-t border-gray-100 space-y-3">
                                        {/* Position and Tenure Detection Badge */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                                            <div className="flex items-center flex-wrap gap-2 text-gray-700">
                                                <span className="font-semibold text-gray-800">กลุ่มตำแหน่งที่เลือก:</span>
                                                <span className="font-bold text-red-600 bg-red-50/90 px-2.5 py-0.5 rounded-md border border-red-200">
                                                    {phoneDetails.selectedRoleName}
                                                </span>
                                                {phoneDetails.isCustomSelected ? (
                                                    <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                                                        กำหนดเองโดยผู้ใช้
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                                                        ตรวจจับอัตโนมัติตามตำแหน่ง
                                                    </span>
                                                )}
                                                {phoneDetails.positionTitle && (
                                                    <span className="text-gray-500">({phoneDetails.positionTitle})</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <span>อายุงาน: <strong className="text-gray-800">{phoneDetails.yearsLabel}</strong></span>
                                                <span>• สิทธิ์: <strong className="text-gray-800">{phoneDetails.eligibility}</strong></span>
                                            </div>
                                        </div>

                                        {/* Position Rate Table matching attached image */}
                                        <div>
                                            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mb-1.5">
                                                <span>คลิกเลือกแถวในตารางเพื่อเลือกกลุ่มตำแหน่งงาน (สามารถเปลี่ยนได้):</span>
                                                {phoneDetails.isCustomSelected && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedPhoneCategory(null)}
                                                        className="text-red-600 hover:text-red-700 underline font-medium cursor-pointer"
                                                    >
                                                        คืนค่าเป็นตรวจจับอัตโนมัติ ({phoneDetails.autoRoleName})
                                                    </button>
                                                )}
                                            </div>
                                            <div className="overflow-hidden border border-gray-200 rounded-xl shadow-2xs">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                                        <tr>
                                                            <th className="py-2.5 px-3">ตำแหน่งงาน (คลิกเลือก)</th>
                                                            <th className="py-2.5 px-3">สิทธิ์ที่เบิกได้</th>
                                                            <th className={`py-2.5 px-3 text-center ${phoneDetails.tenureCol === 'under1' ? 'text-red-600 font-bold bg-red-50/50' : ''}`}>&lt; 1 ปี</th>
                                                            <th className={`py-2.5 px-3 text-center ${phoneDetails.tenureCol === 'y1to2' ? 'text-red-600 font-bold bg-red-50/50' : ''}`}>&gt; 1 &lt; 2 ปี</th>
                                                            <th className={`py-2.5 px-3 text-center ${phoneDetails.tenureCol === 'y2plus' ? 'text-red-600 font-bold bg-red-50/50' : ''}`}>&ge; 2 ปีขึ้นไป</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 bg-white">
                                                        {PHONE_ALLOWANCE_CATEGORIES.map(cat => {
                                                            const isSelected = phoneDetails.activeCategoryId === cat.id;
                                                            const isAutoDetected = phoneDetails.autoCategoryId === cat.id;

                                                            return (
                                                                <tr
                                                                    key={cat.id}
                                                                    onClick={() => setSelectedPhoneCategory(cat.id)}
                                                                    className={`group cursor-pointer transition-all ${isSelected
                                                                        ? "bg-red-50/80 font-semibold text-red-900 border-l-4 border-l-red-600"
                                                                        : "text-gray-700 hover:bg-gray-50/80"
                                                                        }`}
                                                                >
                                                                    <td className="py-2.5 px-3 flex items-center gap-2">
                                                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${isSelected
                                                                            ? "border-red-600 bg-red-600 shadow-xs ring-2 ring-red-100"
                                                                            : "border-gray-300 bg-white group-hover:border-red-400"
                                                                            }`}>
                                                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                                        </div>
                                                                        <span className={isSelected ? "font-bold text-red-900" : "font-medium"}>
                                                                            {cat.roleName}
                                                                        </span>
                                                                        {isAutoDetected && (
                                                                            <span className="text-[10px] bg-gray-100 text-gray-500 font-normal px-1.5 py-0.5 rounded ml-1 border border-gray-200">
                                                                                ระบบตรวจพบ
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-3">
                                                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${cat.eligibility === 'ตั้งแต่วันเริ่มงาน'
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                            : 'bg-gray-100 text-gray-600'
                                                                            }`}>
                                                                            {cat.eligibility}
                                                                        </span>
                                                                    </td>
                                                                    <td className={`py-2.5 px-3 text-center font-mono ${isSelected && phoneDetails.tenureCol === 'under1' ? 'font-bold text-red-600 bg-red-100/60 rounded' : ''
                                                                        }`}>
                                                                        {cat.under1.toLocaleString()}.-
                                                                    </td>
                                                                    <td className={`py-2.5 px-3 text-center font-mono ${isSelected && phoneDetails.tenureCol === 'y1to2' ? 'font-bold text-red-600 bg-red-100/60 rounded' : ''
                                                                        }`}>
                                                                        {cat.y1to2.toLocaleString()}.-
                                                                    </td>
                                                                    <td className={`py-2.5 px-3 text-center font-mono ${isSelected && phoneDetails.tenureCol === 'y2plus' ? 'font-bold text-red-600 bg-red-100/60 rounded' : ''
                                                                        }`}>
                                                                        {cat.y2plus.toLocaleString()}.-
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Conditions & Notice */}
                                        <div className="text-[11.5px] text-gray-600 space-y-1.5 pt-1 border-t border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-3.5 h-3.5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span><strong className="text-gray-800">กำหนดการจ่าย:</strong> จ่ายพร้อมเงินเดือน</span>
                                            </div>
                                            <div className="bg-red-50/70 border border-red-200 text-red-800 rounded-xl p-2.5 flex items-start gap-2 text-xs font-medium">
                                                <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <span><strong>เงื่อนไขสำคัญ:</strong> ยกเว้นพนักงานที่ได้รับโทรศัพท์บริษัท จะไม่ได้ค่าโทรศัพท์</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <div className="space-y-4">
                        {allowances.map((row, index) => (
                            <div key={index} className="border border-gray-200 rounded-2xl p-4.5 bg-gray-50/40 relative grid grid-cols-12 gap-3.5 shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => removeRow(index)}
                                    className="absolute top-3 right-3 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                    title="ลบรายการนี้"
                                    aria-label="ลบรายการนี้"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>

                                <div className="col-span-3">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">ประเภท</label>
                                    <div className="relative">
                                        <select
                                            className="w-full h-10 px-3 pr-8 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white appearance-none cursor-pointer"
                                            value={row.allowance_type_id}
                                            onChange={e => handleTypeChange(index, e.target.value)}
                                        >
                                            <option value="">-- เลือก --</option>
                                            {allowanceTypes.filter(t => !t.name.includes("ค่าโทรศัพท์") && !t.name.includes("ค่าตำแหน่ง")).map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <svg className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">จำนวนเงิน</label>
                                    <input
                                        type="number"
                                        className="w-full h-10 px-3 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white"
                                        value={row.amount}
                                        onChange={e => updateRow(index, 'amount', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="col-span-4">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">รูปแบบการคำนวณ</label>
                                    <div className="relative">
                                        <select
                                            className="w-full h-10 px-3 pr-8 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white appearance-none cursor-pointer"
                                            value={row.calc_basis}
                                            onChange={e => updateRow(index, 'calc_basis', e.target.value)}
                                        >
                                            <option value="fixed_monthly">ยอดคงที่ต่อเดือน</option>
                                            <option value="daily_attendance">จ่ายตามวันมาทำงาน</option>
                                        </select>
                                        <svg className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="col-span-3">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">ให้สำหรับ</label>
                                    <div className="relative">
                                        <select
                                            className="w-full h-10 px-3 pr-8 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 transition-all bg-white appearance-none cursor-pointer"
                                            value={row.applies_to}
                                            onChange={e => updateRow(index, 'applies_to', e.target.value)}
                                        >
                                            <option value="always">ตลอดเวลา</option>
                                            <option value="probation_only">เฉพาะช่วงทดลองงาน</option>
                                            <option value="after_probation">หลังจากผ่านโปร</option>
                                        </select>
                                        <svg className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>

                                <div className="col-span-12 flex flex-wrap gap-6 text-sm mt-1 pt-3 border-t border-gray-200/80">
                                    <label className="flex items-center gap-2 cursor-pointer text-gray-700 select-none">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300 cursor-pointer accent-red-600"
                                            checked={row.tax_included}
                                            onChange={e => updateRow(index, 'tax_included', e.target.checked)}
                                        /> นำไปคำนวณภาษี
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-gray-700 select-none">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300 cursor-pointer accent-red-600"
                                            checked={row.sso_included}
                                            onChange={e => updateRow(index, 'sso_included', e.target.checked)}
                                        /> หักประกันสังคม
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-red-600 select-none font-medium">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300 cursor-pointer accent-red-600"
                                            checked={row.void_on_warning}
                                            onChange={e => updateRow(index, 'void_on_warning', e.target.checked)}
                                        /> หักเมื่อได้ใบเตือน
                                    </label>
                                </div>

                                {(() => {
                                    const selectedType = allowanceTypes.find(t => String(t.id) === String(row.allowance_type_id));
                                    const isAccommodation = selectedType?.name?.includes("ค่าที่พัก");
                                    const hasTravelRow = allowances.some((a, aIdx) => {
                                        if (aIdx === index) return false;
                                        const t = allowanceTypes.find(at => String(at.id) === String(a.allowance_type_id));
                                        return t?.name?.includes("ค่าเดินทาง") || t?.name?.includes("เบี้ยเลี้ยง");
                                    });
                                    const currentTier = getAccommodationTier(employeeData?.hire_date);

                                    if (!isAccommodation) return null;

                                    return (
                                        <div className="col-span-12 mt-2 bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-900 flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                                    </svg>
                                                    อัตราค่าที่พักตามอายุงาน (สิทธิ์ที่เบิกได้: ผ่านทดลองงาน | จ่ายพร้อมเงินเดือน)
                                                </span>
                                                <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-0.5 rounded-full border border-gray-200">
                                                    อายุงานปัจจุบัน: {currentTier.yearsLabel}
                                                </span>
                                            </div>

                                            <div>
                                                <div className="text-[11px] text-gray-500 mb-1.5 font-medium">
                                                    คลิกเลือกระดับอัตราตามอายุงานเพื่อปรับยอดเงินอัตโนมัติ:
                                                </div>
                                                <div className="grid grid-cols-6 gap-2">
                                                    {ACCOMMODATION_TIERS.map(tier => {
                                                        const isMatched = currentTier.key === tier.key;
                                                        const isSelected = String(row.amount) === String(tier.amount);
                                                        return (
                                                            <button
                                                                key={tier.key}
                                                                type="button"
                                                                onClick={() => updateRow(index, 'amount', String(tier.amount))}
                                                                className={`text-center py-2 px-1.5 rounded-xl border text-xs transition-all cursor-pointer ${isSelected
                                                                    ? "bg-red-600 text-white font-bold border-red-600 shadow-xs ring-2 ring-red-100"
                                                                    : isMatched
                                                                        ? "bg-white text-red-600 font-bold border-red-300 ring-1 ring-red-200 hover:bg-red-50/50"
                                                                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                                                    }`}
                                                            >
                                                                <div className="text-[11px] leading-tight opacity-90">{tier.label}</div>
                                                                <div className="text-xs font-extrabold mt-0.5">{tier.amount.toLocaleString()}.-</div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="border-t border-gray-100 pt-2.5 text-[11.5px] text-gray-600 space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-3.5 h-3.5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span><strong className="text-gray-800">สิทธิ์ที่เบิกได้:</strong> ได้รับทุกคนตามระดับอายุงาน (1,500 - 3,000 บาท/เดือน)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-3.5 h-3.5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span><strong className="text-gray-800">เงื่อนไขสิทธิ์:</strong> ยกเว้นเฉพาะพนักงานที่มีสวัสดิการบ้านพักพนักงานของบริษัท</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-3.5 h-3.5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span><strong className="text-gray-800">กำหนดการจ่าย:</strong> จ่ายพร้อมเงินเดือน (ยอดคงที่ต่อเดือน)</span>
                                                </div>
                                                {employeeData?.company_accommodation && (
                                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 flex items-center gap-2 text-xs font-medium mt-1.5">
                                                        <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                        <span><strong>มีสวัสดิการบ้านพัก:</strong> พนักงานท่านนี้ระบุใช้สิทธิ์บ้านพักพนักงานของบริษัท (ระบบจึงไม่จ่ายค่าที่พักนี้)</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addRow}
                            className="w-full h-11 rounded-xl border border-red-600 text-red-600 bg-white hover:bg-red-50 text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            เพิ่มรายการสวัสดิการ
                        </button>
                    </div>
                </div>
            )}
            </div>

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
                    className="px-6 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-medium shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                    {loading ? "กำลังบันทึก..." : "ถัดไป"}
                </button>
            </div>
        </form>
    );
}
