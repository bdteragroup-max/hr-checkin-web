"use client";

import { useState, useEffect } from "react";
import styles from "./coins.module.css";
import Link from "next/link";
import {
    InformationCircleIcon,
    ArrowPathIcon,
    PaperAirplaneIcon,
    ClipboardDocumentListIcon,
    ChevronLeftIcon,
    ArrowDownCircleIcon,
    ArrowUpCircleIcon,
    GiftIcon
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon as SolidInfoIcon } from "@heroicons/react/24/solid";

interface AlertState { visible: boolean; message: string; type: "error" | "ok" | "info" }

function AlertModal({ alert, onClose }: { alert: AlertState; onClose: () => void }) {
    const isErr = alert.type === "error";
    const isInfo = alert.type === "info";

    useEffect(() => {
        if (!alert.visible) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [alert.visible, onClose]);

    if (!alert.visible) return null;

    return (
        <div className={styles.alertOverlay} onClick={onClose} role="dialog" aria-modal="true">
            <div className={styles.alertModal} onClick={e => e.stopPropagation()}>
                <div className={`${styles.alertIcon} ${isErr ? styles.alertIconErr : (isInfo ? styles.alertIconInfo : styles.alertIconOk)}`}>
                    {isErr ? <ExclamationTriangleIcon width={32} /> : (isInfo ? <SolidInfoIcon width={32} /> : <CheckCircleIcon width={32} />)}
                </div>
                <div className={`${styles.alertTitle} ${isErr ? styles.alertTitleErr : (isInfo ? styles.alertTitleInfo : styles.alertTitleOk)}`}>
                    {isErr ? "เกิดข้อผิดพลาด" : (isInfo ? "รายละเอียด" : "สำเร็จ")}
                </div>
                <div className={styles.alertMsg}>{alert.message}</div>
                <button
                    className={`${styles.alertBtn} ${isErr ? styles.alertBtnErr : (isInfo ? styles.alertBtnInfo : styles.alertBtnOk)}`}
                    onClick={onClose}
                    autoFocus
                >
                    ตกลง
                </button>
            </div>
        </div>
    );
}

export default function CoinsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [alertState, setAlertState] = useState<AlertState>({ visible: false, message: "", type: "ok" });

    // Modal state
    const [isExchangeOpen, setIsExchangeOpen] = useState(false);
    const [exchangeFrom, setExchangeFrom] = useState("BRONZE");
    const [exchangeTo, setExchangeTo] = useState("SILVER");
    const [exchangeAmount, setExchangeAmount] = useState(20);

    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [transferTo, setTransferTo] = useState("");
    const [transferAmount, setTransferAmount] = useState(1);
    const [transferMessage, setTransferMessage] = useState("");

    const [actionLoading, setActionLoading] = useState(false);

    const loadData = async () => {
        try {
            const res = await fetch("/api/me/coins");
            const json = await res.json();
            if (json.ok) {
                setData(json);
            } else {
                setError(json.error || "Failed to load");
            }
        } catch (e) {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const getBalance = (coinTypeId: string) => {
        if (!data?.balances) return 0;
        const b = data.balances.find((b: any) => b.coin_type_id === coinTypeId);
        return b ? b.balance : 0;
    };

    const handleExchange = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await fetch("/api/coins/exchange", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    from_coin_type: exchangeFrom,
                    to_coin_type: exchangeTo,
                    amount_to_exchange: Number(exchangeAmount)
                })
            });
            const json = await res.json();
            if (json.ok) {
                setAlertState({ visible: true, message: "แลกเปลี่ยนสำเร็จ!", type: "ok" });
                setIsExchangeOpen(false);
                loadData();
            } else {
                setAlertState({ visible: true, message: json.error || "เกิดข้อผิดพลาดในการแลกเปลี่ยน", type: "error" });
            }
        } catch {
            setAlertState({ visible: true, message: "เกิดข้อผิดพลาดทางเครือข่าย", type: "error" });
        }
        setActionLoading(false);
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await fetch("/api/coins/transfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    receiver_emp_id: transferTo,
                    amount: Number(transferAmount),
                    message: transferMessage
                })
            });
            const json = await res.json();
            if (json.ok) {
                setAlertState({ visible: true, message: "โอนเหรียญสำเร็จ!", type: "ok" });
                setIsTransferOpen(false);
                loadData();
            } else {
                setAlertState({ visible: true, message: json.error || "เกิดข้อผิดพลาดในการโอนเหรียญ", type: "error" });
            }
        } catch {
            setAlertState({ visible: true, message: "เกิดข้อผิดพลาดทางเครือข่าย", type: "error" });
        }
        setActionLoading(false);
    };

    if (loading) return (
        <div className={styles.wrapper}>
            <div className={styles.wrap} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text3)' }}>
                กำลังโหลดข้อมูล...
            </div>
        </div>
    );

    if (error) return (
        <div className={styles.wrapper}>
            <div className={styles.wrap} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--bad)' }}>
                ข้อผิดพลาด: {error}
            </div>
        </div>
    );

    const budgetRemaining = data?.budget?.balance || 0;

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap}>
                {/* BACK NAVIGATION */}
                <div className={styles.navHeader}>
                    <Link href="/app" className={styles.backBtn}>
                        <ChevronLeftIcon width={16} /> กลับหน้าหลัก
                    </Link>
                </div>

                {/* HERO TITLE */}
                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>คอลเลกชันเหรียญของฉัน</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <div className={styles.heroMetaDot} />
                            สะสมเหรียญรางวัล แลกเปลี่ยน และส่งมอบให้เพื่อนร่วมงาน
                        </div>
                    </div>
                </div>

                {/* COIN CARDS (Mobile Stacked) */}
                <div className={styles.grid}>
                    {/* BRONZE */}
                    <div className={styles.card}>
                        <div className={styles.tooltip} title="รับจากการเช็คอินตรงเวลา (1 เหรียญ/วัน) โอนให้เพื่อนได้" onClick={() => setAlertState({ visible: true, message: "รับจากการเช็คอินตรงเวลา (1 เหรียญ/วัน)\nโอนให้เพื่อนได้", type: "info" })}>
                            <InformationCircleIcon width={18} />
                        </div>
                        <div className={styles.iconWrap}>
                            <div className={styles.coinInner}>
                                <div className={styles.coinFront}>
                                    <img src="/images/coins/bronze.png" alt="Bronze" className={styles.coinImage} />
                                </div>
                                <div className={styles.coinBack}>
                                    <img src="/images/coins/bronze_back.png" alt="Bronze Back" className={styles.coinImage} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.coinName}>Bronze Coin</div>
                        <div className={styles.balance}>{getBalance("BRONZE")}</div>

                        <div className={styles.actions}>
                            <button className={styles.btn} onClick={() => { setExchangeFrom("BRONZE"); setExchangeTo("SILVER"); setExchangeAmount(20); setIsExchangeOpen(true); }}>
                                <ArrowPathIcon width={16} style={{ marginRight: 6 }} /> แลก
                            </button>
                            <button className={styles.btn} onClick={() => setIsTransferOpen(true)}>
                                <PaperAirplaneIcon width={16} style={{ marginRight: 6 }} /> โอน
                            </button>
                        </div>
                    </div>

                    {/* SILVER */}
                    <div className={styles.card}>
                        <div className={styles.tooltip} title="รับจากสถิติไม่ขาด ไม่ลา ตลอดทั้งเดือน หรือรับจากการนำเหรียญ Bronze มาแลกเปลี่ยน (20 Bronze = 1 Silver)" onClick={() => setAlertState({ visible: true, message: "รับจากสถิติไม่ขาด ไม่ลา ตลอดทั้งเดือน\nหรือรับจากการนำเหรียญ Bronze มาแลกเปลี่ยน\n(20 Bronze = 1 Silver)", type: "info" })}>
                            <InformationCircleIcon width={18} />
                        </div>
                        <div className={styles.iconWrap}>
                            <div className={styles.coinInner}>
                                <div className={styles.coinFront}>
                                    <img src="/images/coins/silver.png" alt="Silver" className={styles.coinImage} />
                                </div>
                                <div className={styles.coinBack}>
                                    <img src="/images/coins/silver_back.png" alt="Silver Back" className={styles.coinImage} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.coinName}>Silver Coin</div>
                        <div className={styles.balance}>{getBalance("SILVER")}</div>
                        <div className={styles.exchangeRate}>20 Bronze = 1 Silver</div>
                        <div className={`${styles.actions} ${styles.actionsSingle}`}>
                            <button className={styles.btn} onClick={() => { setExchangeFrom("SILVER"); setExchangeTo("GOLD"); setExchangeAmount(10); setIsExchangeOpen(true); }}>
                                <ArrowPathIcon width={16} style={{ marginRight: 6 }} /> แลก
                            </button>
                        </div>
                    </div>

                    {/* GOLD */}
                    <div className={styles.card}>
                        <div className={styles.tooltip} title="เหรียญระดับสูงสุด แลกจาก Silver (10 Silver = 1 Gold) หรือทำผลงานระดับสูง" onClick={() => setAlertState({ visible: true, message: "เหรียญระดับสูงสุด แลกจาก Silver\n(10 Silver = 1 Gold)\nหรือทำผลงานระดับสูง", type: "info" })}>
                            <InformationCircleIcon width={18} />
                        </div>
                        <div className={styles.iconWrap}>
                            <div className={styles.coinInner}>
                                <div className={styles.coinFront}>
                                    <img src="/images/coins/gold.png" alt="Gold" className={styles.coinImage} />
                                </div>
                                <div className={styles.coinBack}>
                                    <img src="/images/coins/gold_back.png" alt="Gold Back" className={styles.coinImage} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.coinName}>Gold Medal</div>
                        <div className={styles.balance}>{getBalance("GOLD")}</div>
                        <div className={styles.exchangeRate}>10 Silver = 1 Gold</div>
                    </div>

                    {/* KPI */}
                    <div className={styles.card}>
                        <div className={styles.tooltip} title="ได้รับจากการประเมิน KPI ประจำไตรมาส (เฉพาะเกรด A และ B)" onClick={() => setAlertState({ visible: true, message: "ได้รับจากการประเมิน KPI ประจำไตรมาส\n(เฉพาะเกรด A และ B)", type: "info" })}>
                            <InformationCircleIcon width={18} />
                        </div>
                        <div className={styles.iconWrap}>
                            <div className={styles.coinInner}>
                                <div className={styles.coinFront}>
                                    <img src="/images/coins/kpi.png" alt="KPI" className={styles.coinImage} />
                                </div>
                                <div className={styles.coinBack}>
                                    <img src="/images/coins/kpi_back.png" alt="KPI Back" className={styles.coinImage} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.coinName}>KPI Coin</div>
                        <div className={styles.balance}>{getBalance("KPI")}</div>
                    </div>

                    {/* TASK */}
                    <div className={styles.card}>
                        <div className={styles.tooltip} title="ได้รับจากหัวหน้าแผนกเมื่อปฏิบัติงานที่ได้รับมอบหมายสำเร็จ" onClick={() => setAlertState({ visible: true, message: "ได้รับจากหัวหน้าแผนกเมื่อปฏิบัติงานที่ได้รับมอบหมายสำเร็จ", type: "info" })}>
                            <InformationCircleIcon width={18} />
                        </div>
                        <div className={styles.iconWrap}>
                            <div className={styles.coinInner}>
                                <div className={styles.coinFront}>
                                    <img src="/images/coins/task.png" alt="Task" className={styles.coinImage} />
                                </div>
                                <div className={styles.coinBack}>
                                    <img src="/images/coins/task_back.png" alt="Task Back" className={styles.coinImage} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.coinName}>Task Coin</div>
                        <div className={styles.balance}>{getBalance("TASK")}</div>
                    </div>

                    {/* EVENT */}
                    <div className={styles.card}>
                        <div className={styles.tooltip} title="ได้รับจากการเข้าร่วมกิจกรรมพิเศษของบริษัท" onClick={() => setAlertState({ visible: true, message: "ได้รับจากการเข้าร่วมกิจกรรมพิเศษของบริษัท", type: "info" })}>
                            <InformationCircleIcon width={18} />
                        </div>
                        <div className={styles.iconWrap}>
                            <div className={styles.coinInner}>
                                <div className={styles.coinFront}>
                                    <img src="/images/coins/event.png" alt="Event" className={styles.coinImage} />
                                </div>
                                <div className={styles.coinBack}>
                                    <img src="/images/coins/event_back.png" alt="Event Back" className={styles.coinImage} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.coinName}>Event Coin</div>
                        <div className={styles.balance}>{getBalance("EVENT")}</div>
                    </div>
                </div>

                {/* History List (Mobile Friendly) */}
                <div className={styles.historySection}>
                    <div className={styles.historyTitle}>
                        <ClipboardDocumentListIcon width={20} />
                        ประวัติการรับ/จ่ายเหรียญ
                    </div>

                    {data?.history?.length === 0 ? (
                        <div className={styles.emptyState}>ยังไม่มีประวัติการทำรายการ</div>
                    ) : (
                        <div className={styles.historyList}>
                            {data?.history?.map((row: any) => {
                                const isPos = row.amount > 0;
                                let badgeClass = 'earn';
                                let Icon = ArrowDownCircleIcon;

                                if (row.transaction_type === "EXCHANGE") {
                                    badgeClass = 'exchange';
                                    Icon = ArrowPathIcon;
                                } else if (row.transaction_type === "TRANSFER") {
                                    badgeClass = 'transfer';
                                    Icon = GiftIcon;
                                } else if (row.transaction_type === "REDEEM" || (!isPos && row.transaction_type !== "EXCHANGE")) {
                                    badgeClass = 'spend';
                                    Icon = ArrowUpCircleIcon;
                                }

                                const typeMap: Record<string, string> = {
                                    "EARN": "ได้รับ",
                                    "SPEND": "ใช้จ่าย",
                                    "EXCHANGE": "แลกเปลี่ยน",
                                    "TRANSFER": "โอนเหรียญ",
                                    "REDEEM": "แลกรางวัล"
                                };
                                const displayType = typeMap[row.transaction_type] || row.transaction_type;

                                const descMap: Record<string, string> = {
                                    "Daily Check-in Reward": "รางวัลเช็คอินรายวัน"
                                };
                                const displayDesc = descMap[row.description] || row.description;

                                return (
                                    <div key={row.id} className={styles.historyCard}>
                                        <div className={`${styles.historyIconWrap} ${styles[badgeClass]}`}>
                                            <Icon width={20} />
                                        </div>
                                        <div className={styles.historyInfo}>
                                            <div className={styles.historyHead}>
                                                <div className={styles.historyType}>
                                                    {displayType}
                                                </div>
                                                <div className={`${styles.historyAmount} ${isPos ? styles.pos : styles.neg}`}>
                                                    {isPos ? "+" : ""}{row.amount}
                                                </div>
                                            </div>
                                            <div className={styles.historyDate}>
                                                {new Date(row.created_at).toLocaleString("th-TH")} · {row.coin_type?.name || row.coin_type_id}
                                            </div>
                                            {row.description && (
                                                <div className={styles.historyDesc}>
                                                    {displayDesc}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* EXCHANGE MODAL */}
                {isExchangeOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsExchangeOpen(false)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <h2 className={styles.modalTitle}>แลกเปลี่ยนเหรียญ</h2>
                            <form onSubmit={handleExchange}>
                                <div className={styles.formGroup}>
                                    <label>จากเหรียญ</label>
                                    <select className={styles.select} value={exchangeFrom} onChange={e => setExchangeFrom(e.target.value)}>
                                        <option value="BRONZE">Bronze</option>
                                        <option value="SILVER">Silver</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>ไปเป็นเหรียญ</label>
                                    <select className={styles.select} value={exchangeTo} onChange={e => setExchangeTo(e.target.value)}>
                                        <option value="SILVER">Silver</option>
                                        <option value="GOLD">Gold</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>จำนวนเหรียญต้นทางที่ใช้ (ขั้นต่ำ 20 Bronze หรือ 10 Silver)</label>
                                    <input type="number" className={styles.input} value={exchangeAmount} onChange={e => setExchangeAmount(Number(e.target.value))} min={10} step={10} required />
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={() => setIsExchangeOpen(false)}>ยกเลิก</button>
                                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={actionLoading}>{actionLoading ? "รอสักครู่..." : "ยืนยันการแลก"}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* TRANSFER MODAL */}
                {isTransferOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsTransferOpen(false)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <h2 className={styles.modalTitle}>โอนเหรียญ Bronze</h2>
                            <p style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '16px' }}>
                                โอนได้สูงสุด 5 เหรียญต่อครั้ง (โควต้าคงเหลือ: {budgetRemaining}/เดือน)
                            </p>
                            <form onSubmit={handleTransfer}>
                                <div className={styles.formGroup}>
                                    <label>รหัสพนักงานผู้รับ</label>
                                    <input type="text" className={styles.input} value={transferTo} onChange={e => setTransferTo(e.target.value)} required placeholder="เช่น EMP001" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>จำนวนเหรียญ Bronze</label>
                                    <input type="number" className={styles.input} value={transferAmount} onChange={e => setTransferAmount(Number(e.target.value))} min={1} max={5} required />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>ข้อความอวยพร (ไม่บังคับ)</label>
                                    <input type="text" className={styles.input} value={transferMessage} onChange={e => setTransferMessage(e.target.value)} placeholder="ขอบคุณสำหรับความช่วยเหลือ" />
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={() => setIsTransferOpen(false)}>ยกเลิก</button>
                                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={actionLoading}>{actionLoading ? "รอสักครู่..." : "ยืนยันการโอน"}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* ALERT MODAL */}
            <AlertModal alert={alertState} onClose={() => setAlertState(prev => ({ ...prev, visible: false }))} />
        </div>
    );
}
