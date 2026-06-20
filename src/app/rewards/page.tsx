"use client";

import { useState, useEffect } from "react";
import styles from "./rewards.module.css";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { GiftIcon } from "@heroicons/react/24/outline";

export default function RewardsCatalog() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modal State
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch user balances
      const resUser = await fetch("/api/me/coins");
      const userJson = await resUser.json();
      if (userJson.ok) {
        setBalances(userJson.balances);
        setCurrentUser(userJson.employee);
      }

      // Fetch active rewards
      const resRewards = await fetch("/api/rewards");
      const rewardsJson = await resRewards.json();
      if (rewardsJson.success) {
        setRewards(rewardsJson.rewards);
      }
    } catch (e) {
      setError("Failed to load rewards data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getBalance = (coinTypeId: string) => {
    const b = balances.find((b: any) => b.coin_type_id === coinTypeId.toUpperCase() || b.coin_type_id === coinTypeId);
    return b ? b.balance : 0;
  };

  const getCoinImage = (type: string) => {
    const t = type.toLowerCase();
    return `/images/coins/${t}.png`;
  };

  const openRedeemModal = (reward: any) => {
    setSelectedReward(reward);
    setRedeemError("");
    setRedeemSuccess(false);
    setIsModalOpen(true);
  };

  const closeRedeemModal = () => {
    setIsModalOpen(false);
    setSelectedReward(null);
  };

  const handleRedeem = async () => {
    if (!selectedReward || !currentUser) return;
    setRedeemLoading(true);
    setRedeemError("");

    try {
      const res = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: currentUser.emp_id,
          reward_id: selectedReward.id,
          quantity: 1
        }),
      });

      const json = await res.json();
      if (json.success) {
        setRedeemSuccess(true);
        loadData(); // Refresh balances and stock
      } else {
        setRedeemError(json.error || "Failed to redeem reward");
      }
    } catch (e) {
      setRedeemError("Network error occurred.");
    } finally {
      setRedeemLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.container}>กำลังโหลดรายการ...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.hero}>
          <div>
            <h1 className={styles.heroH1}>แคตตาล็อกของรางวัล</h1>
            <div className={styles.heroMeta}>
              <div className={styles.heroMetaItem}>
                <div className={styles.heroMetaDot} />
                แลกเหรียญที่คุณสะสมไว้เพื่อรับของรางวัลและสิทธิพิเศษ!
              </div>
            </div>
          </div>
        </div>

        <div className={styles.balancesStrip}>
          {['BRONZE', 'SILVER', 'GOLD', 'KPI', 'TASK', 'EVENT'].map((type) => {
            const bal = getBalance(type);
            if (bal === 0) return null;
            return (
              <div key={type} className={styles.balanceItem}>
                <img src={getCoinImage(type)} className={styles.balanceIcon} alt={type} />
                <div>
                  <div className={styles.balanceValue}>{bal}</div>
                  <div className={styles.balanceLabel}>{type}</div>
                </div>
              </div>
            );
          })}
        </div>

        {rewards.length === 0 ? (
          <div className={styles.emptyState}>
            <GiftIcon className={styles.emptyStateIcon} />
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--text3)" }}>
              ของรางวัลกำลังมาเร็วๆ นี้...
            </div>
            <div style={{ fontSize: "13px", marginTop: "4px", color: "var(--text4)" }}>
              Gifts coming soon
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {rewards.map((r) => {
              const rewardCosts = r.costs && r.costs.length > 0 ? r.costs : [{coin_type: r.required_coin_type, amount: r.required_coins}];
              const canAfford = rewardCosts.every((c: any) => getBalance(c.coin_type) >= c.amount);
              const hasStock = r.stock_quantity > 0;
              const disabled = !canAfford || !hasStock;

              return (
                <div key={r.id} className={styles.card}>
                  <div className={styles.cardImageWrapper}>
                    {r.image_url && <img src={r.image_url} alt={r.name} className={styles.cardImage} />}
                    <div className={`${styles.stockBadge} ${!hasStock ? styles.stockOut : ""}`}>
                    {hasStock ? `เหลือ ${r.stock_quantity} ชิ้น` : 'สินค้าหมด'}
                  </div>
                  </div>
                  <div className={styles.cardContent}>
                    <h3 className={styles.itemName}>{r.name}</h3>
                    <p className={styles.itemDesc}>{r.description}</p>
                    <div className={styles.cardFooter}>
                      <div className={styles.price} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        {rewardCosts.map((c: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <img src={getCoinImage(c.coin_type)} className={styles.priceIcon} alt="Coin" />
                            <span style={{ color: getBalance(c.coin_type) >= c.amount ? '#111827' : '#ef4444' }}>{c.amount}</span>
                          </div>
                        ))}
                      </div>
                      <button 
                      className={styles.redeemBtn} 
                      disabled={disabled}
                      onClick={() => openRedeemModal(r)}
                    >
                      แลกรางวัล
                    </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isModalOpen && selectedReward && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHandle} />
            
            {redeemSuccess ? (
              <div className={styles.successContent}>
                <CheckCircleIcon className={styles.successIcon} />
                <h2 className={styles.successTitle}>แลกรางวัลสำเร็จ!</h2>
                <p className={styles.successDesc}>
                  ส่งคำขอแลก <strong>{selectedReward.name}</strong> เรียบร้อยแล้ว ฝ่ายบุคคลจะดำเนินการให้เร็วๆ นี้
                </p>
                <button className={styles.successBtn} onClick={closeRedeemModal}>เสร็จสิ้น</button>
              </div>
            ) : (
              <>
                <div className={styles.modalHeader}>
                  <h2>ยืนยันการแลกรางวัล</h2>
                </div>
                
                <div className={styles.modalBody}>
                  {selectedReward.image_url && (
                    <img src={selectedReward.image_url} alt={selectedReward.name} className={styles.modalImage} />
                  )}
                  
                  <div style={{ textAlign: "center", marginBottom: "8px" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: "700" }}>{selectedReward.name}</div>
                    <div style={{ color: "var(--text3)", fontSize: "13px" }}>{selectedReward.description}</div>
                  </div>
                  
                  <div className={styles.modalCost}>
                    <span className={styles.modalCostLabel}>ใช้เหรียญ</span>
                    <div className={styles.modalCostValue} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(selectedReward.costs && selectedReward.costs.length > 0 ? selectedReward.costs : [{coin_type: selectedReward.required_coin_type, amount: selectedReward.required_coins}]).map((c: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <img src={getCoinImage(c.coin_type)} className={styles.priceIcon} alt="Coin" />
                            {c.amount} {c.coin_type}
                          </div>
                      ))}
                    </div>
                  </div>
                  
                  {redeemError && <div className={styles.errorAlert}>{redeemError}</div>}
                  
                  <div className={styles.modalActions}>
                    <button className={styles.cancelBtn} onClick={closeRedeemModal} disabled={redeemLoading}>ยกเลิก</button>
                    <button className={styles.confirmBtn} onClick={handleRedeem} disabled={redeemLoading}>
                      {redeemLoading ? "กำลังดำเนินการ..." : "ยืนยัน"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
