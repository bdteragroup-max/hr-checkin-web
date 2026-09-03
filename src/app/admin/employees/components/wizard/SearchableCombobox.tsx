"use client";

import { useState, useRef, useEffect, useMemo } from "react";

export type ComboboxOption = {
    value: string | number;
    label: string;
    subLabel?: string;
};

type Props = {
    options: ComboboxOption[];
    value: string | number | null | undefined;
    onChange: (val: any) => void;
    placeholder?: string;
    disabled?: boolean;
};

export default function SearchableCombobox({
    options,
    value,
    onChange,
    placeholder = "— ไม่ระบุ —",
    disabled = false
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Find currently selected option
    const selectedOption = useMemo(() => {
        if (value === null || value === undefined || value === "") return null;
        return options.find(o => String(o.value) === String(value)) || null;
    }, [options, value]);

    // When dropdown closes, sync input term with selected option
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm(selectedOption ? selectedOption.label : "");
        }
    }, [isOpen, selectedOption]);

    // Handle outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter options based on search query
    const filteredOptions = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o => {
            const labelMatch = o.label.toLowerCase().includes(q);
            const subMatch = o.subLabel ? o.subLabel.toLowerCase().includes(q) : false;
            const valMatch = String(o.value).toLowerCase().includes(q);
            return labelMatch || subMatch || valMatch;
        });
    }, [options, searchTerm]);

    const handleSelect = (val: string | number) => {
        onChange(val);
        setIsOpen(false);
        const opt = options.find(o => String(o.value) === String(val));
        setSearchTerm(opt ? opt.label : "");
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange("");
        setSearchTerm("");
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleInputFocus = () => {
        if (disabled) return;
        setIsOpen(true);
        // Select all text on focus for easy replacement
        if (inputRef.current) {
            inputRef.current.select();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsOpen(false);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filteredOptions.length > 0) {
                // Pick the first non-empty option or the exact match
                const target = filteredOptions.find(o => o.value !== "") || filteredOptions[0];
                if (target) {
                    handleSelect(target.value);
                }
            }
        }
    };

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Input Field (Search by typing) */}
            <div
                className={`relative flex items-center w-full h-11 px-4 rounded-xl border bg-white transition-all cursor-text ${
                    disabled
                        ? "bg-gray-100 border-gray-200 cursor-not-allowed text-gray-400"
                        : isOpen
                        ? "border-red-500 ring-2 ring-red-100"
                        : "border-gray-300 hover:border-gray-400"
                }`}
                onClick={() => {
                    if (!disabled && inputRef.current) {
                        inputRef.current.focus();
                    }
                }}
            >
                <input
                    ref={inputRef}
                    type="text"
                    disabled={disabled}
                    className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none pr-8 cursor-text"
                    value={searchTerm}
                    placeholder={placeholder}
                    onFocus={handleInputFocus}
                    onChange={e => {
                        setSearchTerm(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                />

                {/* Right Action Icons (Clear & Chevron) */}
                <div className="absolute right-3 flex items-center gap-1.5 pointer-events-auto">
                    {value !== "" && value !== null && value !== undefined && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            title="ล้างค่า"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={e => {
                            e.stopPropagation();
                            if (!disabled) {
                                setIsOpen(!isOpen);
                                if (!isOpen && inputRef.current) {
                                    inputRef.current.focus();
                                }
                            }
                        }}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                    >
                        <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Dropdown Results List */}
            {isOpen && !disabled && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {/* Default/Empty Option */}
                    <div
                        className={`px-4 py-2.5 text-sm cursor-pointer mx-1 rounded-lg transition-colors flex items-center justify-between ${
                            value === "" || value === null || value === undefined
                                ? "bg-red-50 text-red-600 font-medium"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                        }`}
                        onClick={() => handleSelect("")}
                    >
                        <span>— ไม่ระบุ —</span>
                        {(value === "" || value === null || value === undefined) && (
                            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>

                    {/* Filtered Options */}
                    {filteredOptions
                        .filter(opt => opt.value !== "")
                        .map(opt => {
                            const isSelected = String(opt.value) === String(value);
                            return (
                                <div
                                    key={String(opt.value)}
                                    className={`px-4 py-2.5 text-sm cursor-pointer mx-1 rounded-lg transition-colors flex items-center justify-between ${
                                        isSelected
                                            ? "bg-red-50 text-red-600 font-medium"
                                            : "text-gray-800 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                                    onClick={() => handleSelect(opt.value)}
                                >
                                    <div className="flex flex-col">
                                        <span>{opt.label}</span>
                                        {opt.subLabel && (
                                            <span className="text-xs text-gray-400">{opt.subLabel}</span>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <svg className="w-4 h-4 text-red-600 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                            );
                        })}

                    {filteredOptions.filter(opt => opt.value !== "").length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">
                            ไม่พบข้อมูล &quot;{searchTerm}&quot;
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
