"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import styles from "./TableComponents.module.css";
import { InboxIcon } from "@heroicons/react/24/outline";

type RevisionItem = {
    id: string;
    target_id: string;
    target_name: string;
    edited_by: string;
    timestamp: string;
    notes: string;
};

export default function RevisionHistoryTable() {
    const { data: revisions = [], isLoading } = useQuery<RevisionItem[]>({
        queryKey: ["admin-employees-revisions"],
        queryFn: async () => {
            const res = await fetch("/api/admin/employees/revisions");
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            return data.list || [];
        }
    });

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return format(d, "dd/MM/yyyy HH:mm", { locale: th });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className={styles.tableCard}>
            <h3 className={styles.cardTitle}>ประวัติการแก้ไขข้อมูลพนักงาน</h3>
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>แก้ไขของ</th>
                            <th>แก้ไขโดย</th>
                            <th>วันที่แก้ไข</th>
                            <th>หมายเหตุ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {revisions.map((rev) => (
                            <tr key={rev.id}>
                                <td>
                                    <div className={styles.targetCol}>
                                        <span className={styles.empName}>{rev.target_name}</span>
                                        {rev.target_id && <span className={styles.empIdBadge}>{rev.target_id}</span>}
                                    </div>
                                </td>
                                <td>
                                    <span className={styles.editorText}>{rev.edited_by}</span>
                                </td>
                                <td>
                                    <span className={styles.dateCol}>{formatDate(rev.timestamp)}</span>
                                </td>
                                <td>
                                    <span className={styles.badgeNote}>{rev.notes}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {isLoading ? (
                    <div className={styles.loadingState}>
                        <span>กำลังโหลดประวัติการแก้ไข...</span>
                    </div>
                ) : revisions.length === 0 ? (
                    <div className={styles.emptyState}>
                        <InboxIcon className={styles.emptyIcon} />
                        <span>ไม่มีข้อมูล</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
