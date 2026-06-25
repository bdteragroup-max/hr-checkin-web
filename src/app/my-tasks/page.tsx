"use client";

import { useState, useEffect } from "react";
import globalStyles from "../leave/page.module.css";
import localStyles from "./my-tasks.module.css";
import { CheckCircleIcon, ClockIcon, XCircleIcon, UserIcon, SparklesIcon, BellAlertIcon } from "@heroicons/react/24/outline";

export default function MyTasksPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tasks?role=employee");
      const json = await res.json();
      if (json.ok) {
        setAssignments(json.assignments);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <div className={globalStyles.page}><div className={globalStyles.wrap}><div style={{textAlign:'center', padding:40}}>Loading...</div></div></div>;

  return (
    <div className={globalStyles.page}>
      <div className={globalStyles.wrap}>
        <div className={globalStyles.hero}>
          <h1 className={globalStyles.heroH1}>งานของฉัน</h1>
          <div className={globalStyles.heroMeta}>
            <div className={globalStyles.heroMetaItem}>
              <div className={globalStyles.heroMetaDot} />
              ตรวจสอบงานที่ได้รับมอบหมายจากหัวหน้างาน
            </div>
          </div>
        </div>

        <div className={globalStyles.card}>
          <div className={globalStyles.cardTitle}>รายการงาน ({assignments.length})</div>

          {assignments.some(a => a.status === 'PENDING') && (
            <div style={{ backgroundColor: '#eff6ff', color: '#1e3a8a', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #bfdbfe' }}>
              <BellAlertIcon width={24} color="#3b82f6" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>คุณได้รับมอบหมายงานจากหัวหน้างาน โปรดดูงานของคุณ</span>
            </div>
          )}

          <div className={localStyles.taskList}>
            {assignments.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 0" }}>
                ยังไม่มีงานที่ได้รับมอบหมาย
              </div>
            ) : (
              assignments.map(asg => (
                <div key={asg.id} className={localStyles.taskCard}>
                  <div className={localStyles.taskHeader}>
                    <div>
                      <h3 className={localStyles.taskTitle}>{asg.task.title}</h3>
                      {asg.task.description && <p className={localStyles.taskDesc}>{asg.task.description}</p>}
                    </div>
                    <div>
                      <span className={`${localStyles.statusBadge} ${
                        asg.status === 'COMPLETED' ? localStyles.statusCompleted : 
                        asg.status === 'OVERDUE' ? localStyles.statusOverdue : 
                        localStyles.statusPending
                      }`}>
                        {asg.status === 'COMPLETED' && <CheckCircleIcon width={16} />}
                        {asg.status === 'OVERDUE' && <XCircleIcon width={16} />}
                        {asg.status === 'PENDING' && <ClockIcon width={16} />}
                        {asg.status}
                      </span>
                    </div>
                  </div>

                  <div className={localStyles.taskMeta}>
                    <div className={localStyles.metaItem}>
                      <UserIcon width={16} /> 
                      มอบหมายโดย: {asg.task.creator?.name || 'หัวหน้างาน'}
                    </div>
                    <div className={localStyles.metaItem}>
                      <ClockIcon width={16} /> 
                      กำหนดส่ง: {new Date(asg.task.deadline).toLocaleDateString("th-TH")}
                    </div>
                    {asg.status === 'COMPLETED' && (
                      <div className={localStyles.metaItem}>
                        <span className={localStyles.coinBadge}>
                          <SparklesIcon width={14} /> +1 Task Coin Received
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
