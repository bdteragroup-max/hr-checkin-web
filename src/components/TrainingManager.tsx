'use client';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './TrainingManager.module.css';

export default function TrainingManager() {
  const queryClient = useQueryClient();
  const { data: trainingData, isLoading: loading1 } = useQuery({
      queryKey: ['admin-trainings'],
      queryFn: async () => {
          const res = await fetch('/api/admin/trainings');
          const data = await res.json();
          return data.ok ? { trainings: data.data, kpi: data.kpi } : { trainings: [], kpi: { totalEmployees: 0, trainedEmployees: 0, percentage: 0 } };
      }
  });

  const { data: employees = [], isLoading: loading2 } = useQuery({
      queryKey: ['admin-employees-list'],
      queryFn: async () => {
          const res = await fetch('/api/admin/employees');
          const data = await res.json();
          return data.ok ? data.list || [] : [];
      }
  });

  const loading = loading1 || loading2;
  const trainings = trainingData?.trainings || [];
  const kpi = trainingData?.kpi || { totalEmployees: 0, trainedEmployees: 0, percentage: 0 };

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id: '', emp_id: '', course_name: '', institution_name: '',
    training_date_start: '', training_date_end: '', completion_percentage: '', effectiveness_result: ''
  });
  
  // Custom Select State
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.emp_id) {
      alert('กรุณาเลือกพนักงานจากรายการ');
      return;
    }
    const url = formData.id ? `/api/admin/trainings/${formData.id}` : '/api/admin/trainings';
    const method = formData.id ? 'PUT' : 'POST';
    
    try {
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['admin-trainings'] });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ยืนยันการลบประวัติการอบรม?')) return;
    try {
      await fetch(`/api/admin/trainings/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['admin-trainings'] });
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className={styles.loadingState}>กำลังโหลดข้อมูล...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1>ระบบจัดการการฝึกอบรม</h1>
          <p>Training & Development Management</p>
        </div>
        <button 
          className={styles.addBtn}
          onClick={() => {
            setFormData({id: '', emp_id: '', course_name: '', institution_name: '', training_date_start: '', training_date_end: '', completion_percentage: '', effectiveness_result: ''});
            setShowModal(true);
          }}
        >
          + เพิ่มประวัติการอบรม
        </button>
      </header>
      
      {/* KPI Section */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>พนักงานที่ผ่านการอบรมแล้ว</div>
          <div className={styles.kpiValue}>
            {kpi.trainedEmployees} <span className={styles.kpiSubValue}>/ {kpi.totalEmployees} คน</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>ร้อยละการเข้ารับการอบรม</div>
          <div className={`${styles.kpiValue} ${styles.kpiValueHighlight}`}>
            {kpi.percentage}%
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2>ประวัติการฝึกอบรม</h2>
        </div>
        
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>พนักงาน</th>
                <th>หลักสูตร/สถาบัน</th>
                <th>วันที่อบรม</th>
                <th>ความสำเร็จ (%)</th>
                <th>ผลการประเมิน</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {trainings.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyState}>ไม่มีข้อมูลการอบรม</td></tr>
              ) : trainings.map((t: any) => (
                <tr key={t.id}>
                  <td>
                    <div className={styles.primaryCell}>{t.employee?.name || t.emp_id}</div>
                    <div className={styles.secondaryCell}>{t.employee?.job_positions?.title || '-'}</div>
                  </td>
                  <td>
                    <div className={styles.primaryCell}>{t.course_name}</div>
                    <div className={styles.secondaryCell}>{t.institution_name || '-'}</div>
                  </td>
                  <td>
                    {t.training_date_start ? new Date(t.training_date_start).toLocaleDateString('th-TH') : '-'} 
                    {t.training_date_end && t.training_date_end !== t.training_date_start ? ` ถึง ${new Date(t.training_date_end).toLocaleDateString('th-TH')}` : ''}
                  </td>
                  <td className={t.completion_percentage >= 80 ? styles.successText : styles.warningText}>
                    {t.completion_percentage ? `${t.completion_percentage}%` : '-'}
                  </td>
                  <td>
                    {t.effectiveness_result || '-'}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.editBtn} onClick={() => {
                          const emp = trainings.find((tr: any) => tr.id === t.id)?.employee;
                          setFormData({
                            id: t.id, emp_id: t.emp_id, course_name: t.course_name, institution_name: t.institution_name || '',
                            training_date_start: t.training_date_start ? t.training_date_start.split('T')[0] : '',
                            training_date_end: t.training_date_end ? t.training_date_end.split('T')[0] : '',
                            completion_percentage: t.completion_percentage || '',
                            effectiveness_result: t.effectiveness_result || ''
                          });
                          setEmpSearch('');
                          setShowModal(true);
                        }}>แก้ไข</button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(t.id)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>{formData.id ? 'แก้ไขประวัติการอบรม' : 'เพิ่มประวัติการอบรม'}</h2>
            <form onSubmit={handleSubmit}>
              
              <div className={styles.formGroup}>
                <label>พนักงาน <span style={{color: '#d93025'}}>*</span></label>
                <input 
                  type="text"
                  required
                  placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
                  value={showEmpDropdown ? empSearch : (employees.find((e: any) => e.emp_id === formData.emp_id) ? `${formData.emp_id} - ${employees.find((e: any) => e.emp_id === formData.emp_id)?.name}` : '')}
                  onChange={e => {
                    setEmpSearch(e.target.value);
                    if (!showEmpDropdown) setShowEmpDropdown(true);
                    setFormData({...formData, emp_id: ''}); // clear selection when typing
                  }}
                  onFocus={() => {
                    setShowEmpDropdown(true);
                    setEmpSearch('');
                  }}
                  onBlur={() => setTimeout(() => setShowEmpDropdown(false), 200)}
                />
                {showEmpDropdown && (
                  <div className={styles.dropdown}>
                    {employees.filter((e: any) => (e.emp_id + ' ' + e.name).toLowerCase().includes(empSearch.toLowerCase())).map((e: any) => (
                      <div 
                        key={e.emp_id} 
                        onClick={() => {
                          setFormData({...formData, emp_id: e.emp_id});
                          setEmpSearch('');
                          setShowEmpDropdown(false);
                        }}
                        className={styles.dropdownItem}
                      >
                        {e.emp_id} - {e.name}
                      </div>
                    ))}
                    {employees.filter((e: any) => (e.emp_id + ' ' + e.name).toLowerCase().includes(empSearch.toLowerCase())).length === 0 && (
                      <div className={styles.dropdownItem} style={{color: '#9aa3b2'}}>ไม่พบพนักงาน</div>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label>ชื่อหลักสูตร / หัวข้อการอบรม <span style={{color: '#d93025'}}>*</span></label>
                <input required type="text" value={formData.course_name} onChange={e => setFormData({...formData, course_name: e.target.value})} />
              </div>

              <div className={styles.formGroup}>
                <label>ชื่อสถาบัน / ผู้จัดอบรม</label>
                <input type="text" value={formData.institution_name} onChange={e => setFormData({...formData, institution_name: e.target.value})} />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{marginBottom: 0}}>
                  <label>วันที่เริ่มอบรม</label>
                  <input type="date" value={formData.training_date_start} onChange={e => setFormData({...formData, training_date_start: e.target.value})} />
                </div>
                <div className={styles.formGroup} style={{marginBottom: 0}}>
                  <label>วันที่สิ้นสุดอบรม</label>
                  <input type="date" value={formData.training_date_end} onChange={e => setFormData({...formData, training_date_end: e.target.value})} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>ความสำเร็จในการอบรม (%)</label>
                <input type="number" min="0" max="100" value={formData.completion_percentage} onChange={e => setFormData({...formData, completion_percentage: e.target.value})} />
              </div>

              <div className={styles.formGroup}>
                <label>ผลการประเมิน / ข้อเสนอแนะ</label>
                <textarea rows={3} value={formData.effectiveness_result} onChange={e => setFormData({...formData, effectiveness_result: e.target.value})} style={{resize: 'vertical'}} />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>ยกเลิก</button>
                <button type="submit" className={styles.submitBtn}>บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
