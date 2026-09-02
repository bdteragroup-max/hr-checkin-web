import styles from "./TableComponents.module.css";
import { InboxIcon } from "@heroicons/react/24/outline";

export default function ExpiringDocsTable() {
    return (
        <div className={styles.tableCard}>
            <h3 className={styles.cardTitle}>เอกสารหมดอายุ</h3>
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ลำดับ</th>
                            <th>ประเภทเอกสาร</th>
                            <th>ชื่อเอกสาร</th>
                            <th>วันหมดอายุ</th>
                            <th>หมดอายุภายใน</th>
                        </tr>
                    </thead>
                </table>
                <div className={styles.emptyState}>
                    <InboxIcon className={styles.emptyIcon} />
                    <span>ไม่มีข้อมูล</span>
                </div>
            </div>
        </div>
    );
}
