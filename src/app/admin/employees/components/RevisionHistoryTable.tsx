import styles from "./TableComponents.module.css";
import { InboxIcon } from "@heroicons/react/24/outline";

export default function RevisionHistoryTable() {
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
                </table>
                <div className={styles.emptyState}>
                    <InboxIcon className={styles.emptyIcon} />
                    <span>ไม่มีข้อมูล</span>
                </div>
            </div>
        </div>
    );
}
