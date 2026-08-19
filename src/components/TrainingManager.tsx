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

  const { data: topics = [], isLoading: loadingTopics } = useQuery({
      queryKey: ['admin-training-topics'],
      queryFn: async () => {
          const res = await fetch('/api/admin/training-topics');
          const data = await res.json();
          return data.ok ? data.data || [] : [];
      }
  });

  const loading = loading1 || loading2 || loadingTopics;
  const trainings = trainingData?.trainings || [];
  const kpi = trainingData?.kpi || { totalEmployees: 0, trainedEmployees: 0, percentage: 0 };

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id: '', emp_id: '', course_name: '', institution_name: '',
    training_date_start: '', training_date_end: '', completion_percentage: '', effectiveness_result: '',
    training_evaluation_result: '', instructor_evaluation_result: '', training_fee: '',
    certificate_file_url: '', certificate_expiry_date: '', requires_refresher: false, refresher_date: ''
  });

  // Custom Select State
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);

  // Topic State
  const [activeTab, setActiveTab] = useState<'history' | 'topics'>('history');
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicFormData, setTopicFormData] = useState({ id: '', topic_name: '', course_name: '', institution_name: '', is_active: true });

  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicFormData.topic_name.trim()) return alert('กรุณาระบุหัวข้อการอบรม');
    const url = topicFormData.id ? `/api/admin/training-topics/${topicFormData.id}` : '/api/admin/training-topics';
    const method = topicFormData.id ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic_name: topicFormData.topic_name, 
          course_name: topicFormData.course_name, 
          institution_name: topicFormData.institution_name, 
          is_active: topicFormData.is_active 
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setShowTopicModal(false);
      queryClient.invalidateQueries({ queryKey: ['admin-training-topics'] });
    } catch (e: any) { alert(e.message); }
  };

  const handleTopicDelete = async (id: number) => {
    if (!confirm('ยืนยันการลบ(ซ่อน)หัวข้อนี้?')) return;
    try {
      await fetch(`/api/admin/training-topics/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['admin-training-topics'] });
    } catch (e) { console.error(e); }
  };

  const handleTopicEnable = async (id: number) => {
    try {
      await fetch(`/api/admin/training-topics/${id}`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
       });
      queryClient.invalidateQueries({ queryKey: ['admin-training-topics'] });
    } catch (e) { console.error(e); }
  };

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
        {activeTab === 'history' && (
          <button 
            className={styles.addBtn}
            onClick={() => {
              setFormData({id: '', emp_id: '', course_name: '', institution_name: '', training_date_start: '', training_date_end: '', completion_percentage: '', effectiveness_result: '', training_evaluation_result: '', instructor_evaluation_result: '', training_fee: '', certificate_file_url: '', certificate_expiry_date: '', requires_refresher: false, refresher_date: ''});
              setShowModal(true);
            }}
          >
            + เพิ่มประวัติการอบรม
          </button>
        )}
      </header>
      
      <div className={styles.tabContainer}>
        <div className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`} onClick={() => setActiveTab('history')}>
          ประวัติการฝึกอบรม
        </div>
        <div className={`${styles.tab} ${activeTab === 'topics' ? styles.tabActive : ''}`} onClick={() => setActiveTab('topics')}>
          จัดการหัวข้อการฝึกอบรม
        </div>
      </div>
      
      {activeTab === 'history' && (
        <>
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
                    {t.completion_percentage != null ? `${t.completion_percentage}%` : '-'}
                  </td>
                  <td>
                    {t.training_evaluation_result || t.instructor_evaluation_result || '-'}
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
                          effectiveness_result: t.effectiveness_result || '',
                          training_evaluation_result: t.training_evaluation_result || '',
                          instructor_evaluation_result: t.instructor_evaluation_result || '',
                          training_fee: t.training_fee || '',
                          certificate_file_url: t.certificate_file_url || '',
                          certificate_expiry_date: t.certificate_expiry_date ? t.certificate_expiry_date.split('T')[0] : '',
                          requires_refresher: t.requires_refresher || false,
                          refresher_date: t.refresher_date ? t.refresher_date.split('T')[0] : ''
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
        </>
      )}

      {activeTab === 'topics' && (
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2>หัวข้อการฝึกอบรม (Master List)</h2>
            <button 
              className={styles.addBtn}
              onClick={() => {
                setTopicFormData({ id: '', topic_name: '', course_name: '', institution_name: '', is_active: true });
                setShowTopicModal(true);
              }}
            >
              + เพิ่มหัวข้อ
            </button>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>หัวข้อการอบรม / หลักสูตร</th>
                  <th>สถาบันผู้จัด</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {topics.length === 0 ? (
                  <tr><td colSpan={5} className={styles.emptyState}>ไม่มีหัวข้อการอบรม</td></tr>
                ) : topics.map((t: any) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>
                      <div className={styles.primaryCell}>{t.topic_name}</div>
                      {t.course_name && <div className={styles.secondaryCell}>{t.course_name}</div>}
                    </td>
                    <td>{t.institution_name || '-'}</td>
                    <td>
                      <span style={{ color: t.is_active ? '#10b981' : '#9aa3b2', fontWeight: 600 }}>
                        {t.is_active ? 'ใช้งาน' : 'ไม่ได้ใช้งาน'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => {
                          setTopicFormData({ id: t.id, topic_name: t.topic_name, course_name: t.course_name || '', institution_name: t.institution_name || '', is_active: t.is_active });
                          setShowTopicModal(true);
                        }}>แก้ไข</button>
                        {t.is_active ? (
                          <button className={styles.deleteBtn} onClick={() => handleTopicDelete(t.id)}>ลบ</button>
                        ) : (
                          <button className={styles.editBtn} style={{ color: '#2563eb' }} onClick={() => handleTopicEnable(t.id)}>เปิดใช้งาน</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Topic Modal */}
      {showTopicModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '400px' }}>
            <h2>{topicFormData.id ? 'แก้ไขหัวข้อการอบรม' : 'เพิ่มหัวข้อการอบรม'}</h2>
            <form onSubmit={handleTopicSubmit}>
              <div className={styles.formGroup}>
                <label>หัวข้อการอบรม <span style={{color: '#d93025'}}>*</span></label>
                <input required type="text" value={topicFormData.topic_name} onChange={e => setTopicFormData({...topicFormData, topic_name: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>ชื่อหลักสูตร (ถ้ามี)</label>
                <input type="text" value={topicFormData.course_name || ''} onChange={e => setTopicFormData({...topicFormData, course_name: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>สถาบันผู้จัด (ถ้ามี)</label>
                <input type="text" value={topicFormData.institution_name || ''} onChange={e => setTopicFormData({...topicFormData, institution_name: e.target.value})} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowTopicModal(false)}>ยกเลิก</button>
                <button type="submit" className={styles.submitBtn}>บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>{formData.id ? 'แก้ไขประวัติการอบรม' : 'เพิ่มประวัติการอบรม'}</h2>
            <form onSubmit={handleSubmit}>

              <div className={styles.formGroup}>
                <label>พนักงาน <span style={{ color: '#d93025' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
                  value={showEmpDropdown ? empSearch : (employees.find((e: any) => e.emp_id === formData.emp_id) ? `${formData.emp_id} - ${employees.find((e: any) => e.emp_id === formData.emp_id)?.name}` : '')}
                  onChange={e => {
                    setEmpSearch(e.target.value);
                    if (!showEmpDropdown) setShowEmpDropdown(true);
                    setFormData({ ...formData, emp_id: '' }); // clear selection when typing
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
                          setFormData({ ...formData, emp_id: e.emp_id });
                          setEmpSearch('');
                          setShowEmpDropdown(false);
                        }}
                        className={styles.dropdownItem}
                      >
                        {e.emp_id} - {e.name}
                      </div>
                    ))}
                    {employees.filter((e: any) => (e.emp_id + ' ' + e.name).toLowerCase().includes(empSearch.toLowerCase())).length === 0 && (
                      <div className={styles.dropdownItem} style={{ color: '#9aa3b2' }}>ไม่พบพนักงาน</div>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label>ชื่อหลักสูตร / หัวข้อการอบรม <span style={{ color: '#d93025' }}>*</span></label>
                <input 
                  required 
                  type="text" 
                  list="adminTrainingTopics"
                  value={formData.course_name} 
                  onChange={e => {
                    const val = e.target.value;
                    const matchedTopic = topics.find((t: any) => t.topic_name === val);
                    if (matchedTopic) {
                      setFormData(prev => ({
                        ...prev,
                        course_name: val,
                        institution_name: matchedTopic.institution_name || prev.institution_name
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, course_name: val }));
                    }
                  }} 
                />
                <datalist id="adminTrainingTopics">
                  {topics.map((t: any) => (
                    <option key={t.id} value={t.topic_name} />
                  ))}
                </datalist>
              </div>

              <div className={styles.formGroup}>
                <label>ชื่อสถาบัน / ผู้จัดอบรม</label>
                <input type="text" value={formData.institution_name} onChange={e => setFormData({ ...formData, institution_name: e.target.value })} />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label>วันที่เริ่มอบรม</label>
                  <input type="date" value={formData.training_date_start} onChange={e => setFormData({ ...formData, training_date_start: e.target.value })} />
                </div>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label>วันที่สิ้นสุดอบรม</label>
                  <input type="date" value={formData.training_date_end} onChange={e => setFormData({ ...formData, training_date_end: e.target.value })} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>ความสำเร็จในการอบรม (%)</label>
                <input type="number" min="0" max="100" value={formData.completion_percentage} onChange={e => setFormData({ ...formData, completion_percentage: e.target.value })} />
              </div>

              <div className={styles.formGroup}>
                <label>ผลการประเมิน / ข้อเสนอแนะ (ผู้บันทึกเดิม)</label>
                <textarea rows={2} value={formData.effectiveness_result} onChange={e => setFormData({ ...formData, effectiveness_result: e.target.value })} style={{ resize: 'vertical' }} />
              </div>

              <div className={styles.formGroup}>
                <label>ค่าใช้จ่ายในการอบรม (บาท)</label>
                <input type="number" min="0" value={formData.training_fee} onChange={e => setFormData({ ...formData, training_fee: e.target.value })} />
              </div>

              <div className={styles.formGroup}>
                <label>แนบไฟล์ใบประกาศ (URL หรือแนบไฟล์)</label>
                <input type="file" accept="image/*,.pdf" onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) return alert("ขนาดไฟล์ต้องไม่เกิน 10MB");

                  const fd = new FormData();
                  fd.append('file', file);

                  try {
                    const res = await fetch('/api/upload', { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.url) setFormData({ ...formData, certificate_file_url: data.url });
                    else alert("อัปโหลดไม่สำเร็จ");
                  } catch (err) {
                    alert("เกิดข้อผิดพลาดในการอัปโหลด");
                  }
                }} />
                {formData.certificate_file_url && <div style={{ marginTop: 8 }}><a href={formData.certificate_file_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>ดูไฟล์ที่แนบไว้</a></div>}
              </div>

              <div className={styles.formGroup}>
                <label>วันที่ใบประกาศหมดอายุ</label>
                <input type="date" value={formData.certificate_expiry_date} onChange={e => setFormData({ ...formData, certificate_expiry_date: e.target.value })} />
              </div>

              <div className={styles.formGroup} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, display: 'flex' }}>
                <input type="checkbox" id="req_refresher" checked={formData.requires_refresher} onChange={e => setFormData({ ...formData, requires_refresher: e.target.checked })} style={{ width: 'auto' }} />
                <label htmlFor="req_refresher" style={{ marginBottom: 0 }}>ต้องมีการทบทวนการอบรม (Refresher)</label>
              </div>

              {formData.requires_refresher && (
                <div className={styles.formGroup}>
                  <label>กำหนดการทบทวน (วันที่)</label>
                  <input type="date" value={formData.refresher_date} onChange={e => setFormData({ ...formData, refresher_date: e.target.value })} />
                </div>
              )}

              <div className={styles.formGroup}>
                <label>ผลการประเมินการอบรม (จากพนักงาน)</label>
                <textarea rows={3} value={formData.training_evaluation_result} readOnly style={{ resize: 'vertical', backgroundColor: '#f3f4f6' }} placeholder="ส่วนนี้พนักงานเป็นผู้กรอก" />
              </div>

              <div className={styles.formGroup}>
                <label>ผลการประเมินวิทยากร (จาก HR/Admin)</label>
                <textarea rows={3} value={formData.instructor_evaluation_result} onChange={e => setFormData({ ...formData, instructor_evaluation_result: e.target.value })} style={{ resize: 'vertical' }} />
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
