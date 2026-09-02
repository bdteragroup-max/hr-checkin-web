"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { 
    UsersIcon, 
    DocumentCheckIcon, 
    BuildingOfficeIcon,
    GlobeAltIcon 
} from "@heroicons/react/24/outline";
import styles from "./DashboardView.module.css";
import ExpiringDocsTable from "./ExpiringDocsTable";
import RevisionHistoryTable from "./RevisionHistoryTable";

// Define the stat component here for simplicity, or we can extract it to StatCard.tsx later
function StatCard({ title, items, total, loading }: any) {
    return (
        <div className={styles.card}>
            <h3 className={styles.cardTitle}>{title}</h3>
            {loading ? (
                <div className={styles.loader}>กำลังโหลด...</div>
            ) : (
                <div className={styles.statList}>
                    {items.map((item: any, idx: number) => (
                        <div key={idx} className={styles.statItem}>
                            <div className={styles.statLabel}>{item.label}</div>
                            <div className={styles.statValue}>{item.value} <span className={styles.unit}>คน</span></div>
                        </div>
                    ))}
                    {total !== undefined && (
                        <div className={styles.statTotal}>
                            <span className={styles.totalLabel}>รวม</span>
                            <span className={styles.totalValue}>{total}</span>
                            <span className={styles.unit}>คน</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function DashboardView() {
    const router = useRouter();
    const { data: statsData, isLoading } = useQuery({
        queryKey: ["admin-employees-stats"],
        queryFn: async () => {
            const res = await fetch("/api/admin/employees/stats");
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            return data.stats;
        }
    });

    const maxQuota = 100000; // TODO: Fetch from tenant config in the future
    const currentCount = statsData?.totalActive || 0;
    const usagePercent = (currentCount / maxQuota) * 100;

    return (
        <div className={styles.wrap}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.h1}>ข้อมูลพนักงาน</h1>
                </div>
                
                <div className={styles.headerRight}>
                    <div className={styles.quotaWrap}>
                        <div className={styles.quotaText}>
                            {isLoading ? (
                                <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>กำลังโหลด...</span>
                            ) : (
                                `${currentCount.toLocaleString()} / ${maxQuota.toLocaleString()} คน`
                            )}
                        </div>
                        <div className={styles.progressBar}>
                            <div 
                                className={`${styles.progressFill} ${usagePercent > 90 ? styles.progressDanger : styles.progressWarning}`} 
                                style={{ width: `${Math.min(usagePercent, 100)}%` }} 
                            />
                        </div>
                    </div>
                    <button className={styles.btnAdd} onClick={() => router.push('/admin/employees/list?add=true')}>+ เพิ่มพนักงาน</button>
                </div>
            </div>

            <h2 className={styles.sectionTitle}>Dashboard</h2>
            
            {!isLoading && statsData?.incompleteOnboarding > 0 && (
                <div style={{
                    background: "var(--bad-bg)",
                    border: "1px solid var(--bad-border)",
                    color: "var(--bad)",
                    padding: "12px 16px",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 500,
                    fontSize: 14
                }}>
                    <span>⚠️ พบพนักงานที่มีข้อมูลยังไม่สมบูรณ์ {statsData.incompleteOnboarding} คน (กรุณาอัปเดตข้อมูลเพื่อให้คำนวณเงินเดือนได้)</span>
                </div>
            )}
            
            <div className={styles.statsGrid}>
                {/* Gender */}
                <StatCard 
                    title="เพศ" 
                    loading={isLoading}
                    items={[
                        { label: "ชาย", value: statsData?.gender?.male || 0 },
                        { label: "หญิง", value: statsData?.gender?.female || 0 },
                        { label: "อื่นๆ/ไม่ระบุ", value: (statsData?.gender?.other || 0) + (statsData?.gender?.unspecified || 0) },
                    ]}
                    total={statsData?.totalActive}
                />

                {/* Type */}
                <StatCard 
                    title="ประเภทพนักงาน" 
                    loading={isLoading}
                    items={[
                        { label: "พนักงานรายเดือน", value: statsData?.type?.monthly || 0 },
                        { label: "พนักงานรายวัน", value: statsData?.type?.daily || 0 },
                        { label: "พนักงานพาร์ทไทม์", value: statsData?.type?.partTime || 0 },
                        { label: "พนักงานเหมาจ่าย", value: statsData?.type?.contract || 0 },
                    ]}
                />

                {/* Branches - using a slightly different layout for branches since it can be a long list */}
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>พนักงานแต่ละสาขา</h3>
                    {isLoading ? (
                        <div className={styles.loader}>กำลังโหลด...</div>
                    ) : (
                        <div className={styles.branchList}>
                            {statsData?.branchStats?.length > 0 ? (
                                statsData.branchStats.map((b: any, i: number) => (
                                    <div key={i} className={styles.branchItem}>
                                        <div className={styles.branchName}>{b.branchName}</div>
                                        <div className={styles.branchCount}>{b.count} <span className={styles.unit}>คน</span></div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.emptyText}>ไม่มีข้อมูล</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.statsGridSecondary}>
                <StatCard 
                    title="สัญชาติ" 
                    loading={isLoading}
                    items={[
                        { label: "ไทย", value: statsData?.nationality?.thai || 0 },
                        { label: "ต่างชาติ", value: statsData?.nationality?.foreign || 0 },
                        { label: "ไม่ระบุสัญชาติ / บุคคลพื้นที่สูง", value: statsData?.nationality?.unspecified || 0 },
                    ]}
                />
            </div>

            <div className={styles.tablesWrap}>
                <ExpiringDocsTable />
                <RevisionHistoryTable />
            </div>
        </div>
    );
}
