"use client";

import { useState, useEffect } from "react";
import styles from "./redemptions.module.css";
import Link from "next/link";

interface Employee {
  name: string;
  emp_id: string;
}

interface Reward {
  name: string;
  required_coins: number;
  required_coin_type: string;
}

interface Processor {
  name: string;
}

interface Redemption {
  id: number;
  emp_id: string;
  reward_id: number;
  quantity: number;
  points_spent: number;
  coin_type_id: string | null;
  status: "pending" | "fulfilled" | "rejected";
  redeemed_at: string;
  fulfilled_at: string | null;
  cancelled_reason: string | null;
  employee: Employee;
  reward: Reward;
  processor: Processor | null;
}

export default function AdminRedemptionsPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRedemptions = async (status: "pending" | "history") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/redemptions?status=${status}`);
      const data = await res.json();
      if (data.success) {
        setRedemptions(data.redemptions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedemptions(activeTab);
  }, [activeTab]);

  const handleFulfill = async (id: number) => {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะอนุมัติคำขอนี้?")) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/redemptions/${id}/fulfill`, {
        method: "PUT"
      });
      const data = await res.json();
      if (data.success) {
        alert("อนุมัติสำเร็จ");
        fetchRedemptions(activeTab);
      } else {
        alert(data.error || "ไม่สามารถอนุมัติได้");
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการอนุมัติ");
    } finally {
      setProcessing(false);
    }
  };

  const openRejectModal = (id: number) => {
    setRejectId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!rejectId) return;
    if (!rejectReason.trim()) {
      alert("กรุณาระบุเหตุผลในการปฏิเสธ");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/redemptions/${rejectId}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelled_reason: rejectReason })
      });
      const data = await res.json();
      if (data.success) {
        alert("ปฏิเสธคำขอและคืนเหรียญเรียบร้อยแล้ว");
        setRejectModalOpen(false);
        fetchRedemptions(activeTab);
      } else {
        alert(data.error || "ไม่สามารถปฏิเสธได้");
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการปฏิเสธ");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <h1 className={styles.heroH1}>อนุมัติการแลกของรางวัล</h1>
            <div className={styles.heroMeta}>
              <div className={styles.heroMetaDot} />
              จัดการคำขอแลกเหรียญรางวัลของพนักงาน
            </div>
          </div>
          <div>
            <Link href="/admin/rewards">
              <button style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                กลับไปจัดการของรางวัล
              </button>
            </Link>
          </div>
        </div>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'pending' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            รออนุมัติ
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'history' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('history')}
          >
            ประวัติการอนุมัติ
          </button>
        </div>

        <div className={styles.tableCard}>
          {loading ? (
            <div className={styles.emptyState}>กำลังโหลด...</div>
          ) : redemptions.length === 0 ? (
            <div className={styles.emptyState}>ไม่พบข้อมูลการแลกของรางวัล</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>พนักงาน</th>
                    <th>ของรางวัล</th>
                    <th>จำนวนเหรียญที่ใช้</th>
                    {activeTab === 'pending' ? (
                      <th>จัดการ</th>
                    ) : (
                      <th>สถานะ</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className={styles.date}>
                          {new Date(r.redeemed_at).toLocaleDateString()}<br/>
                          {new Date(r.redeemed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </td>
                      <td>
                        <div className={styles.employeeName}>{r.employee.name}</div>
                        <div style={{fontSize: '12px', color: '#6b7280'}}>รหัสพนักงาน: {r.emp_id}</div>
                      </td>
                      <td>
                        <div className={styles.rewardName}>{r.reward.name}</div>
                        <div style={{fontSize: '12px', color: '#6b7280'}}>จำนวน: {r.quantity}</div>
                      </td>
                      <td>
                        <div className={styles.amount}>
                          {r.points_spent} {r.coin_type_id || r.reward.required_coin_type}
                        </div>
                      </td>
                      {activeTab === 'pending' ? (
                        <td>
                          <div className={styles.actions}>
                            <button className={styles.fulfillBtn} onClick={() => handleFulfill(r.id)} disabled={processing}>
                              อนุมัติ
                            </button>
                            <button className={styles.rejectBtn} onClick={() => openRejectModal(r.id)} disabled={processing}>
                              ปฏิเสธ
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td>
                          {r.status === 'fulfilled' && <span className={`${styles.badge} ${styles.badgeFulfilled}`}>อนุมัติแล้ว</span>}
                          {r.status === 'rejected' && <span className={`${styles.badge} ${styles.badgeRejected}`}>ปฏิเสธแล้ว</span>}
                          
                          {r.processor && (
                            <div className={styles.processorName}>โดย: {r.processor.name}</div>
                          )}
                          
                          {r.status === 'rejected' && r.cancelled_reason && (
                            <div className={styles.cancelReason}>เหตุผล: {r.cancelled_reason}</div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {rejectModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>ปฏิเสธการแลกของรางวัล</h2>
            <p className={styles.modalDesc}>
              การดำเนินการนี้จะคืนสินค้ากลับเข้าสู่ระบบและคืนเหรียญให้กับพนักงาน และไม่สามารถยกเลิกได้
            </p>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>เหตุผลในการปฏิเสธ (จำเป็น)</label>
              <textarea 
                className={styles.input} 
                rows={3} 
                placeholder="เช่น สินค้าหมด"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>

            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setRejectModalOpen(false)}
                disabled={processing}
              >
                ยกเลิก
              </button>
              <button 
                className={styles.confirmRejectBtn} 
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
              >
                {processing ? "กำลังประมวลผล..." : "ยืนยันการปฏิเสธ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
