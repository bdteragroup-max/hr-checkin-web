"use client";

import { useEffect, useState } from "react";
import styles from "./AlertModal.module.css";

export interface AlertState {
    visible: boolean;
    message: string;
    type: "error" | "ok";
}

interface AlertModalProps {
    alert: AlertState;
    onClose: () => void;
    onConfirm?: () => void;
    onConfirmInput?: (val: string) => void; // Added
    confirmText?: string;
    cancelText?: string;
    inputPlaceholder?: string; // Added
    defaultValue?: string; // Added
}

export default function AlertModal({
    alert, onClose, onConfirm, onConfirmInput, // Added onConfirmInput
    confirmText = "ตกลง", cancelText = "ยกเลิก",
    inputPlaceholder = "ระบุข้อมูล...", // Added
    defaultValue = "" // Added
}: AlertModalProps) {
    const [inputValue, setInputValue] = useState(defaultValue); // Changed from useEffectState to useState
    const isErr = alert.type === "error";
    const isConfirm = !!onConfirm || !!onConfirmInput; // Updated
    const isPrompt = !!onConfirmInput; // Added

    useEffect(() => {
        if (!alert.visible) return;
        setInputValue(defaultValue); // Added
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [alert.visible, onClose, defaultValue]); // Added defaultValue to dependencies

    // Removed useEffectState function as it's replaced by direct useState usage

    if (!alert.visible) return null;

    const handleConfirm = () => { // Added handleConfirm function
        if (onConfirmInput) onConfirmInput(inputValue);
        else if (onConfirm) onConfirm();
        else onClose();
    };

    return (
        <div className={styles.alertOverlay} onClick={onClose} role="dialog" aria-modal="true">
            <div className={styles.alertModal} onClick={e => e.stopPropagation()}>
                <div className={`${styles.alertIcon} ${isErr ? styles.alertIconErr : styles.alertIconOk}`}>
                    {isErr ? "⚠" : "✓"}
                </div>
                <div className={`${styles.alertTitle} ${isErr ? styles.alertTitleErr : styles.alertTitleOk}`}>
                    {isConfirm ? "ยืนยันการดำเนินการ" : (isErr ? "เกิดข้อผิดพลาด" : "สำเร็จ")}
                </div>
                <div className={styles.alertMsg}>{alert.message}</div>

                {isPrompt && ( // Conditionally rendered input field
                    <input
                        className={styles.alertInput}
                        type="text"
                        placeholder={inputPlaceholder}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        autoFocus
                    />
                )}

                <div style={{ display: "flex", gap: 12, width: "100%" }}>
                    {isConfirm && (
                        <button className={styles.alertBtnSecondary} onClick={onClose}>
                            {cancelText}
                        </button>
                    )}
                    <button
                        className={`${styles.alertBtn} ${isErr ? styles.alertBtnErr : styles.alertBtnOk}`}
                        onClick={handleConfirm} // Changed onClick to handleConfirm
                        autoFocus={!isPrompt} // Updated autoFocus logic
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
