"use client";

import { useState, useEffect } from "react";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2Allowances from "./Step2Allowances";
import Step3Onboarding from "./Step3Onboarding";

type Props = {
    onClose: () => void;
    onSuccess: () => void;
    branches: any[];
    departments: any[];
    positions: any[];
    employees: any[];
    mode?: "create" | "edit";
    initialEmployee?: any;
};

export default function EmployeeWizard({
    onClose,
    onSuccess,
    branches,
    departments,
    positions,
    employees,
    mode = "create",
    initialEmployee
}: Props) {
    const isEdit = mode === "edit" || Boolean(initialEmployee?.emp_id);
    const [currentStep, setCurrentStep] = useState(1);
    const [empId, setEmpId] = useState<string | null>(initialEmployee?.emp_id || null);
    const [employeeData, setEmployeeData] = useState<any>(initialEmployee || null);
    const [step1State, setStep1State] = useState<any>(null);
    const [companies, setCompanies] = useState<any[]>([]);
    const [fetchingDetails, setFetchingDetails] = useState(false);

    useEffect(() => {
        fetch("/api/admin/companies")
            .then(res => res.json())
            .then(data => setCompanies(data.list || []))
            .catch(console.error);

        // In edit mode, fetch complete employee details (including allowances and co-evaluators)
        if (isEdit && initialEmployee?.emp_id) {
            setFetchingDetails(true);
            fetch(`/api/admin/employees/${initialEmployee.emp_id}/wizard`)
                .then(res => res.json())
                .then(data => {
                    if (data.ok && data.employee) {
                        setEmployeeData((prev: any) => ({
                            ...prev,
                            ...data.employee
                        }));
                    }
                })
                .catch(console.error)
                .finally(() => setFetchingDetails(false));
        }
    }, [isEdit, initialEmployee?.emp_id]);

    const handleStep1Complete = (data: any, rawState?: any) => {
        setEmpId(data.emp_id);
        setEmployeeData((prev: any) => {
            const clean: any = {};
            for (const [k, v] of Object.entries(data || {})) {
                if (v !== undefined) clean[k] = v;
            }
            return {
                ...prev,
                ...clean
            };
        });
        if (rawState) {
            setStep1State(rawState);
        }
        setCurrentStep(2);
    };

    const handleStep2Complete = (step2Data?: any) => {
        if (step2Data) {
            setEmployeeData((prev: any) => ({
                ...prev,
                ...step2Data
            }));
        }
        setCurrentStep(3);
    };

    const handleStep3Complete = () => {
        onSuccess();
        onClose();
    };

    const steps = [
        { num: 1, label: "ข้อมูลพื้นฐาน" },
        { num: 2, label: "เงินเดือน & ภาษี" },
        { num: 3, label: "ตั้งค่าระบบ" }
    ];

    const canNavigateToStep = (targetStep: number) => {
        if (isEdit) return true;
        if (targetStep === 1) return true;
        if (targetStep === 2) return Boolean(empId);
        if (targetStep === 3) return Boolean(empId);
        return false;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col relative overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="px-7 pt-6 pb-2 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {isEdit ? "แก้ไขข้อมูลพนักงาน" : "สร้างพนักงานใหม่"}
                            </h2>
                            {isEdit && employeeData && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                    รหัสพนักงาน: <span className="font-mono font-bold text-red-600">{employeeData.emp_id}</span>
                                    {employeeData.name && (
                                        <span className="text-gray-700 ml-1.5 font-medium">({employeeData.name})</span>
                                    )}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
                            aria-label="ปิด"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Stepper Tabs */}
                    <div className="grid grid-cols-3 gap-3">
                        {steps.map((step) => {
                            const isActive = currentStep === step.num;
                            const isClickable = canNavigateToStep(step.num);
                            return (
                                <button
                                    key={step.num}
                                    type="button"
                                    onClick={() => {
                                        if (isClickable) setCurrentStep(step.num);
                                    }}
                                    disabled={!isClickable}
                                    className={`flex items-center justify-center py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                                        isActive
                                            ? "border border-red-200 bg-red-50/70 text-red-600 shadow-xs"
                                            : isClickable
                                            ? "bg-gray-100/90 hover:bg-gray-200/80 text-gray-600 border border-transparent cursor-pointer"
                                            : "bg-gray-100/50 text-gray-400 border border-transparent cursor-not-allowed opacity-60"
                                    }`}
                                >
                                    <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mr-2 shrink-0 ${
                                            isActive
                                                ? "bg-red-600 text-white"
                                                : "bg-gray-300 text-gray-700"
                                        }`}
                                    >
                                        {step.num}
                                    </span>
                                    <span className="truncate">{step.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Step Content */}
                <div className="flex-1 min-h-0 flex flex-col pt-3">
                    <div className={currentStep === 1 ? "flex flex-col flex-1 min-h-0" : "hidden"}>
                        <Step1BasicInfo
                            companies={companies}
                            branches={branches}
                            departments={departments}
                            positions={positions}
                            initialData={step1State || employeeData}
                            empId={empId}
                            onComplete={handleStep1Complete}
                            onClose={onClose}
                        />
                    </div>

                    {empId && (
                        <div className={currentStep === 2 ? "flex flex-col flex-1 min-h-0" : "hidden"}>
                            <Step2Allowances
                                empId={empId}
                                employeeData={employeeData}
                                positions={positions}
                                departments={departments}
                                mode={isEdit ? "edit" : "create"}
                                onComplete={handleStep2Complete}
                                onBack={() => setCurrentStep(1)}
                                onClose={onClose}
                            />
                        </div>
                    )}

                    {empId && (
                        <div className={currentStep === 3 ? "flex flex-col flex-1 min-h-0" : "hidden"}>
                            <Step3Onboarding
                                empId={empId}
                                employeeData={employeeData}
                                employees={employees}
                                mode={isEdit ? "edit" : "create"}
                                onComplete={handleStep3Complete}
                                onBack={() => setCurrentStep(2)}
                                onClose={onClose}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
