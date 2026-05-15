"use client";

import { useEffect, useState } from "react";
import styles from "./BirthdayBanner.module.css";
import { SparklesIcon, CakeIcon } from "@heroicons/react/24/outline";

interface BirthdayUser {
    emp_id: string;
    name: string;
}

export default function BirthdayBanner() {
    const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchBirthdays() {
            try {
                const res = await fetch("/api/birthdays", { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    setBirthdays(data.list || []);
                }
            } catch (error) {
                console.error("Failed to fetch birthdays:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchBirthdays();
    }, []);

    if (loading || birthdays.length === 0) return null;

    return (
        <div className={styles.birthdayBanner}>
            <div className={styles.birthdayIcon}>
                <SparklesIcon width={24} height={24} />
            </div>
            <div className={styles.birthdayContent}>
                <div className={styles.birthdayTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    สุขสันต์วันเกิด! <CakeIcon width={20} className="text-pink-200" />
                </div>
                <div className={styles.birthdayNames}>
                    วันนี้เป็นวันเกิดของคุณ: {birthdays.map(b => b.name).join(", ")}
                </div>
            </div>
        </div>
    );
}
