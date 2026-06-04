'use client';
import React, { useState, useEffect } from 'react';

export default function TrainingManager() {
  const [trainings, setTrainings] = useState<any[]>([]);
  const [kpi, setKpi] = useState({ totalEmployees: 0, trainedEmployees: 0, percentage: 0 });
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id: '', emp_id: '', course_name: '', institution_name: '',
    training_date_start: '', training_date_end: '', completion_percentage: '', effectiveness_result: ''
  });
  
  // Custom Select State
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);

  const fetchTrainings = async () => {
    try {
      const res = await fetch('/api/admin/trainings');
      const data = await res.json();
      if (data.ok) {
        setTrainings(data.data);
        setKpi(data.kpi);
      }
    } catch (e) { console.error(e); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/admin/employees');
      const data = await res.json();
      if (data.ok) setEmployees(data.list || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    Promise.all([fetchTrainings(), fetchEmployees()]).finally(() => setLoading(false));
  }, []);

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
      fetchTrainings();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ยืนยันการลบประวัติการอบรม?')) return;
    try {
      await fetch(`/api/admin/trainings/${id}`, { method: 'DELETE' });
      fetchTrainings();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{padding: '2rem'}}>กำลังโหลดข้อมูล...</div>;

  return (
    <div style={{padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto'}}>
      <h1 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1e293b'}}>
        ระบบจัดการการฝึกอบรม (Training & Development)
      </h1>
      
      {/* KPI Section */}
      <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem'}}>
        <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', flex: 1}}>
          <div style={{color: '#64748b', fontSize: '14px', marginBottom: '0.5rem'}}>พนักงานที่ผ่านการอบรมแล้ว</div>
          <div style={{fontSize: '32px', fontWeight: 'bold', color: '#3b82f6'}}>
            {kpi.trainedEmployees} <span style={{fontSize: '18px', color: '#94a3b8', fontWeight: 'normal'}}>/ {kpi.totalEmployees} คน</span>
          </div>
        </div>
        <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', flex: 1}}>
          <div style={{color: '#64748b', fontSize: '14px', marginBottom: '0.5rem'}}>ร้อยละการเข้ารับการอบรม</div>
          <div style={{fontSize: '32px', fontWeight: 'bold', color: '#10b981'}}>
            {kpi.percentage}%
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div style={{background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0'}}>
          <h2 style={{fontSize: '18px', fontWeight: '600', margin: 0}}>ประวัติการฝึกอบรม</h2>
          <button 
            onClick={() => {
              setFormData({id: '', emp_id: '', course_name: '', institution_name: '', training_date_start: '', training_date_end: '', completion_percentage: '', effectiveness_result: ''});
              setShowModal(true);
            }}
            style={{background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500}}
          >
            + เพิ่มประวัติการอบรม
          </button>
        </div>
        
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead style={{background: '#f8fafc', color: '#64748b', textAlign: 'left', fontSize: '14px'}}>
            <tr>
              <th style={{padding: '1rem 1.5rem', fontWeight: 600}}>พนักงาน</th>
              <th style={{padding: '1rem 1.5rem', fontWeight: 600}}>หลักสูตร/สถาบัน</th>
              <th style={{padding: '1rem 1.5rem', fontWeight: 600}}>วันที่อบรม</th>
              <th style={{padding: '1rem 1.5rem', fontWeight: 600}}>ความสำเร็จ (%)</th>
              <th style={{padding: '1rem 1.5rem', fontWeight: 600}}>ผลการประเมิน</th>
              <th style={{padding: '1rem 1.5rem', fontWeight: 600}}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {trainings.length === 0 ? (
              <tr><td colSpan={6} style={{padding: '2rem', textAlign: 'center', color: '#94a3b8'}}>ไม่มีข้อมูลการอบรม</td></tr>
            ) : trainings.map((t) => (
              <tr key={t.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                <td style={{padding: '1rem 1.5rem'}}>
                  <div style={{fontWeight: 500}}>{t.employee?.name || t.emp_id}</div>
                  <div style={{fontSize: '12px', color: '#64748b'}}>{t.employee?.job_positions?.title || '-'}</div>
                </td>
                <td style={{padding: '1rem 1.5rem'}}>
                  <div style={{fontWeight: 500}}>{t.course_name}</div>
                  <div style={{fontSize: '12px', color: '#64748b'}}>{t.institution_name || '-'}</div>
                </td>
                <td style={{padding: '1rem 1.5rem', fontSize: '14px'}}>
                  {t.training_date_start ? new Date(t.training_date_start).toLocaleDateString('th-TH') : '-'} 
                  {t.training_date_end && t.training_date_end !== t.training_date_start ? ` ถึง ${new Date(t.training_date_end).toLocaleDateString('th-TH')}` : ''}
                </td>
                <td style={{padding: '1rem 1.5rem', fontWeight: 500, color: t.completion_percentage >= 80 ? '#10b981' : '#f59e0b'}}>
                  {t.completion_percentage ? `${t.completion_percentage}%` : '-'}
                </td>
                <td style={{padding: '1rem 1.5rem', fontSize: '14px', maxWidth: '200px'}}>
                  {t.effectiveness_result || '-'}
                </td>
                <td style={{padding: '1rem 1.5rem'}}>
                  <button onClick={() => {
                      const emp = trainings.find(t => t.id === t.id)?.employee;
                      setFormData({
                        id: t.id, emp_id: t.emp_id, course_name: t.course_name, institution_name: t.institution_name || '',
                        training_date_start: t.training_date_start ? t.training_date_start.split('T')[0] : '',
                        training_date_end: t.training_date_end ? t.training_date_end.split('T')[0] : '',
                        completion_percentage: t.completion_percentage || '',
                        effectiveness_result: t.effectiveness_result || ''
                      });
                      setEmpSearch('');
                      setShowModal(true);
                    }} style={{background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem'}}>แก้ไข</button>
                  <button onClick={() => handleDelete(t.id)} style={{background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer'}}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50}}>
          <div style={{background: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h2 style={{marginTop: 0, marginBottom: '1.5rem'}}>{formData.id ? 'แก้ไขประวัติการอบรม' : 'เพิ่มประวัติการอบรม'}</h2>
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              
              <div style={{position: 'relative'}}>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem'}}>พนักงาน <span style={{color: 'red'}}>*</span></label>
                <input 
                  type="text"
                  required
                  placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
                  value={showEmpDropdown ? empSearch : (employees.find(e => e.emp_id === formData.emp_id) ? `${formData.emp_id} - ${employees.find(e => e.emp_id === formData.emp_id)?.name}` : '')}
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
                  style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1'}}
                />
                {showEmpDropdown && (
                  <div style={{position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                    {employees.filter(e => (e.emp_id + ' ' + e.name).toLowerCase().includes(empSearch.toLowerCase())).map(e => (
                      <div 
                        key={e.emp_id} 
                        onClick={() => {
                          setFormData({...formData, emp_id: e.emp_id});
                          setEmpSearch('');
                          setShowEmpDropdown(false);
                        }}
                        style={{padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}
                        onMouseEnter={(el) => (el.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(el) => (el.currentTarget.style.background = 'white')}
                      >
                        {e.emp_id} - {e.name}
                      </div>
                    ))}
                    {employees.filter(e => (e.emp_id + ' ' + e.name).toLowerCase().includes(empSearch.toLowerCase())).length === 0 && (
                      <div style={{padding: '0.5rem 1rem', color: '#94a3b8'}}>ไม่พบพนักงาน</div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem'}}>ชื่อหลักสูตร / หัวข้อการอบรม <span style={{color: 'red'}}>*</span></label>
                <input required type="text" value={formData.course_name} onChange={e => setFormData({...formData, course_name: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1'}} />
              </div>

              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem'}}>ชื่อสถาบัน / ผู้จัดอบรม</label>
                <input type="text" value={formData.institution_name} onChange={e => setFormData({...formData, institution_name: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1'}} />
              </div>

              <div style={{display: 'flex', gap: '1rem'}}>
                <div style={{flex: 1}}>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem'}}>วันที่เริ่มอบรม</label>
                  <input type="date" value={formData.training_date_start} onChange={e => setFormData({...formData, training_date_start: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1'}} />
                </div>
                <div style={{flex: 1}}>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem'}}>วันที่สิ้นสุดอบรม</label>
                  <input type="date" value={formData.training_date_end} onChange={e => setFormData({...formData, training_date_end: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1'}} />
                </div>
              </div>

              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem'}}>ความสำเร็จในการอบรม (%)</label>
                <input type="number" min="0" max="100" value={formData.completion_percentage} onChange={e => setFormData({...formData, completion_percentage: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1'}} />
              </div>

              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem'}}>ผลการประเมิน / ข้อเสนอแนะ</label>
                <textarea rows={3} value={formData.effectiveness_result} onChange={e => setFormData({...formData, effectiveness_result: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical'}} />
              </div>

              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem'}}>
                <button type="button" onClick={() => setShowModal(false)} style={{background: 'white', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer'}}>ยกเลิก</button>
                <button type="submit" style={{background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer'}}>บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
