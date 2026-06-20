"use client";

import { useState, useEffect } from "react";
import globalStyles from "../../leave/page.module.css";
import localStyles from "./tasks.module.css";
import { PlusIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";

export default function TeamTasksPage() {
  const [budget, setBudget] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [subordinates, setSubordinates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, assignmentId: number | null}>({isOpen: false, assignmentId: null});
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, message: string, type: "success" | "error"}>({isOpen: false, message: "", type: "success"});
  const [newTask, setNewTask] = useState({ title: "", description: "", deadline: "" });
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [resBudget, resTasks, resSubs] = await Promise.all([
        fetch("/api/tasks/budget"),
        fetch("/api/tasks?role=head"),
        fetch("/api/me/subordinates")
      ]);

      const bJson = await resBudget.json();
      if (bJson.ok) setBudget(bJson.budget);

      const tJson = await resTasks.json();
      if (tJson.ok) setTasks(tJson.tasks);

      const sJson = await resSubs.json();
      if (sJson.ok) setSubordinates(sJson.subordinates);
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.deadline || selectedAssignees.length === 0) {
      setErrorMsg("กรุณากรอกข้อมูลให้ครบถ้วนและเลือกผู้รับมอบหมายอย่างน้อย 1 คน");
      return;
    }
    setCreateLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description,
          deadline: newTask.deadline,
          assigned_to: selectedAssignees
        })
      });

      const json = await res.json();
      if (json.ok) {
        setIsModalOpen(false);
        setNewTask({ title: "", description: "", deadline: "" });
        setSelectedAssignees([]);
        setAssigneeSearchQuery("");
        loadData();
      } else {
        setErrorMsg(json.error || "Failed to create task");
      }
    } catch (e) {
      setErrorMsg("Network error");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCompleteAssignment = async (assignmentId: number) => {
    try {
      const res = await fetch(`/api/tasks/assignments/${assignmentId}/complete`, {
        method: "POST"
      });
      const json = await res.json();
      if (json.ok) {
        setAlertModal({ isOpen: true, message: "มอบ Task Coin สำเร็จ!", type: "success" });
        loadData();
      } else {
        setAlertModal({ isOpen: true, message: "เกิดข้อผิดพลาด: " + (json.error || "Unknown"), type: "error" });
      }
    } catch (e) {
      setAlertModal({ isOpen: true, message: "Network error", type: "error" });
    }
  };

  if (loading) return <div className={globalStyles.page}><div className={globalStyles.wrap}><div style={{textAlign:'center', padding:40}}>Loading...</div></div></div>;

  return (
    <div className={globalStyles.page}>
      <div className={globalStyles.wrap}>
        <div className={globalStyles.hero}>
          <h1 className={globalStyles.heroH1}>จัดการ Task ทีม</h1>
          <div className={globalStyles.heroMeta}>
            <div className={globalStyles.heroMetaItem}>
              <div className={globalStyles.heroMetaDot} />
              มอบหมายงานและให้ Task Coin แก่ทีมงาน
            </div>
          </div>
        </div>

        {budget && (
          <div style={{ marginBottom: "24px" }}>
            <div className={localStyles.budgetCard}>
              <span className={localStyles.budgetLabel}>งบ Task Coin เดือนนี้</span>
              <span className={localStyles.budgetValue}>{budget.used_this_month} / {budget.monthly_limit}</span>
            </div>
          </div>
        )}

        <div className={globalStyles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--gray-100)", flexWrap: "wrap", gap: "12px" }}>
            <div className={globalStyles.cardTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: "none" }}>รายการมอบหมายงาน ({tasks.length})</div>
            {budget && (
              <button 
                className={localStyles.btnPrimary} 
                onClick={() => setIsModalOpen(true)}
                style={{ padding: "8px 16px", fontSize: "14px" }}
              >
                <PlusIcon width={18} />
                สร้าง Task
              </button>
            )}
          </div>

          <div className={localStyles.taskList}>
            {tasks.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 0" }}>
                ยังไม่มีงานที่มอบหมาย
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className={localStyles.taskCard}>
                  <div className={localStyles.taskHeader} style={{ flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h3 className={localStyles.taskTitle}>{task.title}</h3>
                      {task.description && <p className={localStyles.taskDesc}>{task.description}</p>}
                      <div className={localStyles.taskMeta}>
                        <span><ClockIcon width={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />กำหนดส่ง: {new Date(task.deadline).toLocaleDateString("th-TH")}</span>
                        <span>สร้างเมื่อ: {new Date(task.created_at).toLocaleDateString("th-TH")}</span>
                      </div>
                    </div>
                  </div>

                  <div className={localStyles.assignmentList}>
                    {task.assignments.map((asg: any) => (
                      <div key={asg.id} className={localStyles.assignmentRow}>
                        <div className={localStyles.assigneeInfo}>
                          <div className={localStyles.avatar}>
                            {asg.employee.name.substring(0,2)}
                          </div>
                          <span className={localStyles.assigneeName}>{asg.employee.name}</span>
                          <span className={`${localStyles.statusBadge} ${
                            asg.status === 'COMPLETED' ? localStyles.statusCompleted : 
                            asg.status === 'OVERDUE' ? localStyles.statusOverdue : 
                            localStyles.statusPending
                          }`}>
                            {asg.status === 'COMPLETED' && <CheckCircleIcon width={14} style={{ display: 'inline', marginRight: 4 }} />}
                            {asg.status === 'OVERDUE' && <XCircleIcon width={14} style={{ display: 'inline', marginRight: 4 }} />}
                            {asg.status === 'PENDING' && <ClockIcon width={14} style={{ display: 'inline', marginRight: 4 }} />}
                            {asg.status}
                          </span>
                        </div>
                        {asg.status !== 'COMPLETED' ? (
                          <button 
                            className={localStyles.completeBtn}
                            onClick={() => setConfirmModal({ isOpen: true, assignmentId: asg.id })}
                            disabled={budget?.used_this_month >= budget?.monthly_limit}
                            title={budget?.used_this_month >= budget?.monthly_limit ? "งบประมาณเดือนนี้หมดแล้ว" : "กดให้เหรียญ"}
                          >
                            <CheckCircleIcon width={16} style={{ marginRight: 6 }} />
                            ทำสำเร็จ (ให้เหรียญ)
                          </button>
                        ) : (
                          <span style={{ fontSize: 13, color: "var(--ok)", fontWeight: 600 }}>✓ ได้รับเหรียญแล้ว</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {isModalOpen && (
          <div className={localStyles.modalOverlay}>
            <div className={localStyles.modalContent}>
              <h2 className={localStyles.modalTitle}>มอบหมาย Task ใหม่</h2>
              
              <div className={globalStyles.form}>
                <div>
                  <label className={globalStyles.label}>ชื่องาน *</label>
                  <input 
                    type="text" 
                    className={globalStyles.input} 
                    value={newTask.title}
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                    placeholder="เช่น ส่งรายงานประจำเดือน"
                  />
                </div>
                
                <div>
                  <label className={globalStyles.label}>รายละเอียด (ถ้ามี)</label>
                  <textarea 
                    className={globalStyles.textarea} 
                    value={newTask.description}
                    onChange={e => setNewTask({...newTask, description: e.target.value})}
                  />
                </div>

                <div>
                  <label className={globalStyles.label}>กำหนดส่ง *</label>
                  <input 
                    type="date" 
                    className={globalStyles.input} 
                    value={newTask.deadline}
                    onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                  />
                </div>

                <div>
                  <label className={globalStyles.label}>ผู้รับมอบหมาย *</label>
                  <input 
                    type="text"
                    placeholder="ค้นหาชื่อผู้รับมอบหมาย..."
                    className={globalStyles.input}
                    style={{ marginBottom: "8px", padding: "10px 14px", fontSize: "14px" }}
                    value={assigneeSearchQuery}
                    onChange={e => setAssigneeSearchQuery(e.target.value)}
                  />
                  <div className={localStyles.checkboxList}>
                    {subordinates
                      .filter(sub => sub.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()))
                      .map(sub => (
                      <label key={sub.emp_id} className={localStyles.checkboxItem}>
                        <input 
                          type="checkbox"
                          checked={selectedAssignees.includes(sub.emp_id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedAssignees([...selectedAssignees, sub.emp_id]);
                            else setSelectedAssignees(selectedAssignees.filter(id => id !== sub.emp_id));
                          }}
                        />
                        {sub.name} <span style={{ color: "var(--text3)", fontSize: 13, marginLeft: 4 }}>({sub.job_positions?.title || 'Staff'})</span>
                      </label>
                    ))}
                    {subordinates.length === 0 && (
                      <div style={{ padding: 8, color: 'var(--text4)', fontSize: 13 }}>ไม่มีผู้ใต้บังคับบัญชาในระบบ</div>
                    )}
                  </div>
                </div>
              </div>

              {errorMsg && <div className={localStyles.errorMsg}>{errorMsg}</div>}

              <div className={localStyles.modalActions}>
                <button 
                  className={localStyles.btnCancel} 
                  onClick={() => setIsModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button 
                  className={localStyles.btnPrimary} 
                  onClick={handleCreateTask}
                  disabled={createLoading}
                >
                  {createLoading ? "กำลังสร้าง..." : "สร้าง Task"}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className={localStyles.modalOverlay}>
            <div className={localStyles.modalContent} style={{ maxWidth: "400px", padding: "24px" }}>
              <h2 className={localStyles.modalTitle} style={{ borderBottom: "none", paddingBottom: 0, fontSize: "18px" }}>
                ยืนยันการสำเร็จงาน
              </h2>
              <p style={{ color: "var(--text2)", fontSize: "15px", marginBottom: "24px", lineHeight: "1.5" }}>
                คุณต้องการกดสำเร็จงานและมอบ Task Coin ให้กับพนักงานใช่หรือไม่?
              </p>
              
              <div className={localStyles.modalActions} style={{ marginTop: 0 }}>
                <button 
                  className={localStyles.btnCancel} 
                  onClick={() => setConfirmModal({ isOpen: false, assignmentId: null })}
                >
                  ยกเลิก
                </button>
                <button 
                  className={localStyles.btnPrimary} 
                  onClick={() => {
                    if (confirmModal.assignmentId) {
                      handleCompleteAssignment(confirmModal.assignmentId);
                    }
                    setConfirmModal({ isOpen: false, assignmentId: null });
                  }}
                >
                  <CheckCircleIcon width={18} />
                  ยืนยัน
                </button>
              </div>
            </div>
          </div>
        )}

        {alertModal.isOpen && (
          <div className={localStyles.modalOverlay}>
            <div className={localStyles.modalContent} style={{ maxWidth: "360px", padding: "24px", textAlign: "center" }}>
              <div style={{ marginBottom: "16px" }}>
                {alertModal.type === "success" ? (
                  <CheckCircleIcon width={48} style={{ color: "var(--ok)", margin: "0 auto" }} />
                ) : (
                  <XCircleIcon width={48} style={{ color: "var(--bad)", margin: "0 auto" }} />
                )}
              </div>
              <h2 className={localStyles.modalTitle} style={{ borderBottom: "none", paddingBottom: 0, fontSize: "18px", marginBottom: "8px" }}>
                {alertModal.type === "success" ? "สำเร็จ" : "ข้อผิดพลาด"}
              </h2>
              <p style={{ color: "var(--text2)", fontSize: "15px", marginBottom: "24px", lineHeight: "1.5" }}>
                {alertModal.message}
              </p>
              <button 
                className={localStyles.btnPrimary} 
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
              >
                ตกลง
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
