"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./redemptions.module.css";
import Link from "next/link";
import AlertModal, { AlertState } from "@/components/AlertModal";

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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rewardFilter, setRewardFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Modal State
  const [fulfillModalOpen, setFulfillModalOpen] = useState(false);
  const [fulfillId, setFulfillId] = useState<number | null>(null);
  
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>({ visible: false, message: "", type: "ok" });
  const showAlert = (message: string, type: "ok" | "error" = "ok") => setAlertState({ visible: true, message, type });
  const hideAlert = () => setAlertState(prev => ({ ...prev, visible: false }));

  const { data: redemptions = [], isLoading: loading } = useQuery<Redemption[]>({
    queryKey: ['admin-redemptions', activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/admin/redemptions?status=${activeTab}`);
      const data = await res.json();
      return data.success ? data.redemptions : [];
    }
  });

  // Client-side filtering
  const filteredRedemptions = redemptions.filter((r) => {
    // 1. Search Query (Employee Name or ID)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!r.employee.name.toLowerCase().includes(query) && !r.emp_id.toLowerCase().includes(query)) {
        return false;
      }
    }
    // 2. Reward Filter
    if (rewardFilter && r.reward.name !== rewardFilter) {
      return false;
    }
    // 3. Date Range
    if (startDate || endDate) {
      const rDate = new Date(r.redeemed_at);
      rDate.setHours(0,0,0,0);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        if (rDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(0,0,0,0);
        if (rDate > end) return false;
      }
    }
    return true;
  });

  // Unique rewards for dropdown
  const uniqueRewards = Array.from(new Set(redemptions.map(r => r.reward.name)));

  const handleExport = async () => {
    if (filteredRedemptions.length === 0) {
      showAlert("ไม่มีข้อมูลสำหรับส่งออก", "error");
      return;
    }
    setIsExporting(true);
    try {
      const res = await fetch('/api/admin/redemptions/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: filteredRedemptions, 
          status: activeTab 
        })
      });
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redemptions_${activeTab}_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      showAlert("เกิดข้อผิดพลาดในการส่งออก Excel", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const openFulfillModal = (id: number) => {
    setFulfillId(id);
    setFulfillModalOpen(true);
  };

  const handleFulfill = async () => {
    if (!fulfillId) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/redemptions/${fulfillId}/fulfill`, {
        method: "PUT"
      });
      const data = await res.json();
      if (data.success) {
        showAlert("อนุมัติสำเร็จ", "ok");
        setFulfillModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['admin-redemptions'] });
      } else {
        showAlert(data.error || "ไม่สามารถอนุมัติได้", "error");
      }
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการอนุมัติ", "error");
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
      showAlert("กรุณาระบุเหตุผลในการปฏิเสธ", "error");
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
        showAlert("ปฏิเสธคำขอและคืนเหรียญเรียบร้อยแล้ว", "ok");
        setRejectModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['admin-redemptions'] });
      } else {
        showAlert(data.error || "ไม่สามารถปฏิเสธได้", "error");
      }
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการปฏิเสธ", "error");
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

        <div className={styles.filterBar}>
          <input 
            type="text" 
            placeholder="ค้นหาชื่อ หรือ รหัสพนักงาน..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.filterInput}
          />
          <select 
            value={rewardFilter} 
            onChange={(e) => setRewardFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">ของรางวัลทั้งหมด</option>
            {uniqueRewards.map(name => (
              <option key={name as string} value={name as string}>{name as string}</option>
            ))}
          </select>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={styles.filterDate}
            title="ตั้งแต่วันที่"
          />
          <span style={{color: '#6b7280'}}>-</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={styles.filterDate}
            title="ถึงวันที่"
          />
          <button 
            className={styles.exportBtn} 
            onClick={handleExport}
            disabled={isExporting || loading || redemptions.length === 0}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isExporting ? "กำลังส่งออก..." : "ส่งออก Excel"}
          </button>
        </div>

        <div className={styles.tableCard}>
          {loading ? (
            <div className={styles.emptyState}>กำลังโหลด...</div>
          ) : redemptions.length === 0 ? (
            <div className={styles.emptyState}>ไม่พบข้อมูลการแลกของรางวัล</div>
          ) : filteredRedemptions.length === 0 ? (
            <div className={styles.emptyState}>ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา</div>
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
                  {filteredRedemptions.map((r) => (
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
                            <button className={styles.fulfillBtn} onClick={() => openFulfillModal(r.id)} disabled={processing}>
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

      {fulfillModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>ยืนยันการอนุมัติ</h2>
            <p className={styles.modalDesc}>
              คุณแน่ใจหรือไม่ที่จะอนุมัติคำขอนี้? หากอนุมัติแล้วระบบจะประมวลผลทันที
            </p>
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setFulfillModalOpen(false)}
                disabled={processing}
              >
                ยกเลิก
              </button>
              <button 
                className={styles.confirmFulfillBtn} 
                onClick={handleFulfill}
                disabled={processing}
              >
                {processing ? "กำลังประมวลผล..." : "ยืนยันการอนุมัติ"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      <AlertModal alert={alertState} onClose={hideAlert} />
    </div>
  );
}
