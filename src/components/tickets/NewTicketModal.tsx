'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitTicketToCRM } from '@/app/actions/submitTicket';
import { uploadTicketAttachment } from '@/app/actions/uploadTicketAttachment';
import { XMarkIcon, PaperClipIcon, DocumentIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface NewTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NewTicketModal({ isOpen, onClose }: NewTicketModalProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({ title: '', description: '', category: 'BUG' });
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string; ticketId?: string }>({ type: null, message: '' });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const validFiles = files.filter(file => {
                if (file.size > 10 * 1024 * 1024) {
                    alert(`ไฟล์ ${file.name} มีขนาดใหญ่เกิน 10MB`);
                    return false;
                }
                return true;
            });
            setSelectedFiles(prev => [...prev, ...validFiles]);
            e.target.value = ''; // Reset input to allow re-selecting the same file if needed
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus({ type: null, message: '' });

        try {
            const res = await submitTicketToCRM(formData);
            
            let uploadErrors = 0;
            if (selectedFiles.length > 0) {
                for (const file of selectedFiles) {
                    try {
                        const fileFormData = new FormData();
                        fileFormData.append('file', file);
                        await uploadTicketAttachment(res.ticketId, fileFormData);
                    } catch (uploadError) {
                        console.error('File upload failed:', uploadError);
                        uploadErrors++;
                    }
                }
            }

            if (uploadErrors > 0) {
                setStatus({ type: 'success', message: 'ส่งแจ้งปัญหาสำเร็จ แต่แนบไฟล์บางส่วนไม่สำเร็จ', ticketId: res.ticketId });
            } else {
                setStatus({ type: 'success', message: 'ส่งข้อความรายงานปัญหาเรียบร้อยแล้ว', ticketId: res.ticketId });
            }

            // Trigger a background re-fetch of the server components (e.g. /tickets list)
            router.refresh();

            setTimeout(() => {
                onClose();
                setFormData({ title: '', description: '', category: 'BUG' });
                setSelectedFiles([]);
                setStatus({ type: null, message: '' });
            }, 3000);
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                backdropFilter: 'blur(2px)',
            }}
            onClick={onClose}
        >
            {/* Modal Content */}
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '450px',
                    maxHeight: '90dvh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'white' }}>แจ้งปัญหาการใช้งาน</h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', padding: '4px', borderRadius: '6px' }}
                    >
                        <XMarkIcon width={24} />
                    </button>
                </div>
                
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {status.type === 'success' ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#16a34a' }}>
                            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                                <CheckCircleIcon width={56} style={{ color: '#16a34a' }} />
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '18px' }}>{status.message}</div>
                            {status.ticketId && (
                                <div style={{ fontSize: '14px', marginTop: '8px', color: '#4b5563', fontWeight: 500 }}>
                                    รหัสอ้างอิง: {status.ticketId}
                                </div>
                            )}
                            <div style={{ fontSize: '14px', marginTop: '8px', color: '#4b5563' }}>ทีมงานจะรีบตรวจสอบและแก้ไขโดยเร็วที่สุด</div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {status.type === 'error' && (
                                <div style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '14px', border: '1px solid #f87171' }}>
                                    {status.message}
                                </div>
                            )}
                            
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>หัวข้อ <span style={{color: '#dc2626'}}>*</span></label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                    placeholder="เช่น กดเช็คอินไม่ได้, แผนที่คลาดเคลื่อน..."
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '14px',
                                        outline: 'none',
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>หมวดหมู่ <span style={{color: '#dc2626'}}>*</span></label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '14px',
                                        outline: 'none',
                                        backgroundColor: 'white',
                                    }}
                                >
                                    <option value="BUG">พบข้อผิดพลาด</option>
                                    <option value="FEATURE_REQUEST">เสนอแนะฟีเจอร์</option>
                                    <option value="QUESTION">สอบถามการใช้งาน</option>
                                    <option value="ACCOUNT_ACCESS">ปัญหาการเข้าสู่ระบบ</option>
                                    <option value="OTHER">อื่นๆ</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>รายละเอียด <span style={{color: '#dc2626'}}>*</span></label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    required
                                    rows={4}
                                    placeholder="อธิบายขั้นตอนที่ทำให้เกิดปัญหา หรือรายละเอียดเพิ่มเติม..."
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '14px',
                                        outline: 'none',
                                        resize: 'vertical',
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>แนบไฟล์ (ไม่เกิน 10MB/ไฟล์)</label>

                                {/* Drop zone — clicking anywhere inside triggers the hidden input */}
                                <label
                                    htmlFor="ticket-file-input"
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '20px 16px',
                                        border: '2px dashed #fca5a5',
                                        borderRadius: '10px',
                                        backgroundColor: '#fff5f5',
                                        cursor: 'pointer',
                                        transition: 'border-color 0.2s, background-color 0.2s',
                                    }}
                                    onMouseOver={(e) => {
                                        (e.currentTarget as HTMLElement).style.borderColor = '#dc2626';
                                        (e.currentTarget as HTMLElement).style.backgroundColor = '#fee2e2';
                                    }}
                                    onMouseOut={(e) => {
                                        (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5';
                                        (e.currentTarget as HTMLElement).style.backgroundColor = '#fff5f5';
                                    }}
                                >
                                    <PaperClipIcon width={28} style={{ color: '#dc2626' }} />
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626' }}>คลิกเพื่อเลือกไฟล์</span>
                                    <span style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
                                        JPG, PNG, WEBP, PDF, DOC, XLS · ไม่เกิน 10MB/ไฟล์
                                    </span>
                                </label>
                                <input
                                    id="ticket-file-input"
                                    type="file"
                                    multiple
                                    accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />

                                {selectedFiles.length > 0 && (
                                    <ul style={{ marginTop: '10px', paddingLeft: 0, listStyle: 'none' }}>
                                        {selectedFiles.map((file, i) => (
                                            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', backgroundColor: '#f3f4f6', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%', display: 'flex', alignItems: 'center', gap: '6px' }}><DocumentIcon width={14} style={{ flexShrink: 0 }} />{file.name}</span>
                                                <button type="button" onClick={() => removeFile(i)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>ลบ</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                style={{
                                    marginTop: '8px',
                                    padding: '12px',
                                    backgroundColor: isSubmitting ? '#fca5a5' : '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    fontSize: '16px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    transition: 'background-color 0.2s',
                                    boxShadow: isSubmitting ? 'none' : '0 2px 8px rgba(220, 38, 38, 0.35)',
                                }}
                            >
                                {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งแจ้งปัญหา'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
