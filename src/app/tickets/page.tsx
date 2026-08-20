import { getMyTickets } from '@/app/actions/getMyTickets';
import Link from 'next/link';
import { ChevronLeftIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import styles from '../app/page.module.css';

// Enable dynamic rendering
export const dynamic = 'force-dynamic';

export default async function MyTicketsPage() {
    let tickets: any[] = [];
    let error: string | null = null;

    try {
        const res = await getMyTickets();
        tickets = res.tickets || [];
    } catch (e: any) {
        error = e.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'OPEN':
                return { bg: 'var(--bad-bg)', color: 'var(--bad)', borderColor: 'var(--bad-bdr)', label: 'รอดำเนินการ' };
            case 'IN_PROGRESS':
                return { bg: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'var(--warn-bdr)', label: 'กำลังดำเนินการ' };
            case 'RESOLVED':
                return { bg: 'var(--ok-bg)', color: 'var(--ok)', borderColor: 'var(--ok-bdr)', label: 'แก้ไขแล้ว' };
            case 'CLOSED':
                return { bg: 'var(--gray-100)', color: 'var(--gray-700)', borderColor: 'var(--gray-300)', label: 'ปิดแล้ว' };
            default:
                return { bg: 'var(--gray-100)', color: 'var(--gray-700)', borderColor: 'var(--gray-300)', label: status || 'ไม่มีสถานะ' };
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.wrap} style={{ paddingTop: '16px' }}>

                <div className={styles.hero}>
                    <h1 className={styles.heroH1}>ติดตามปัญหา</h1>
                    <div className={styles.heroMeta}>
                        <div className={styles.heroMetaItem}>
                            <WrenchScrewdriverIcon width={14} /> My Tickets
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className={`${styles.statusBox} ${styles.status_bad}`}>
                        {error}
                    </div>
                ) : tickets.length === 0 ? (
                    <div className={styles.card} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text4)' }}>
                        <div style={{ marginBottom: '12px' }}><WrenchScrewdriverIcon width={48} style={{ margin: '0 auto', opacity: 0.5 }} /></div>
                        <div style={{ fontSize: '15px', fontWeight: 500 }}>ยังไม่มีการแจ้งปัญหาในระบบ</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {tickets.map((ticket: any, index: number) => {
                            const isRepair = ticket._type === 'FACILITY_REPAIR';
                            const badge = getStatusBadge(ticket.status);
                            const progress = ticket.progress || (ticket.status === 'COMPLETED' || ticket.status === 'RESOLVED' ? 100 : ticket.status === 'IN_PROGRESS' ? 50 : 0);

                            return (
                                <div key={ticket.ticketId || ticket.id || index} className={styles.card}>
                                    <div className={styles.cardHeader} style={{ marginBottom: '8px' }}>
                                        <h3 className={styles.cardTitle} style={{ textTransform: 'none', fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {isRepair ? (
                                                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #fdba74' }}>ซ่อมสาธารณูปโภค</span>
                                            ) : (
                                                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>ระบบ IT</span>
                                            )}
                                            {isRepair ? ticket.equipmentName : ticket.title}
                                        </h3>
                                        <span className={styles.cardBadge} style={{ backgroundColor: badge.bg, color: badge.color, borderColor: badge.borderColor }}>
                                            {badge.label}
                                        </span>
                                    </div>

                                    <div className={styles.kv}>
                                        <div className={styles.kvKey}>รหัสอ้างอิง</div>
                                        <div className={styles.kvVal}>{ticket.ticketId || ticket.requestNumber || ticket.id}</div>
                                        <div className={styles.kvKey}>วันที่แจ้ง</div>
                                        <div className={styles.kvVal}>{new Date(ticket.createdAt || ticket.reportedDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                        <div className={styles.kvKey}>ผู้รับผิดชอบ</div>
                                        <div className={styles.kvVal}>
                                            {ticket.assigneeName || (ticket.assignee && (ticket.assignee.name || ticket.assignee.fullName)) ? (
                                                <span style={{ color: 'var(--text)' }}>{ticket.assigneeName || ticket.assignee?.name || ticket.assignee?.fullName}</span>
                                            ) : (
                                                <span style={{ color: 'var(--text4)' }}>ยังไม่มีผู้รับเรื่อง</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styles.divider} />

                                    <div style={{ marginTop: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text3)', marginBottom: '6px', fontWeight: 600 }}>
                                            <span>ความคืบหน้า</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--gray-200)', borderRadius: '999px', overflow: 'hidden' }}>
                                            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: progress === 100 ? 'var(--ok)' : 'var(--red)', transition: 'width 0.4s ease' }}></div>
                                        </div>
                                    </div>

                                    {ticket.solutionPlan && !isRepair && (
                                        <div className={`${styles.statusBox} ${styles.status_ok}`} style={{ marginTop: '16px', background: 'var(--gray-50)', borderColor: 'var(--gray-200)', color: 'var(--text2)' }}>
                                            <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--text)' }}>แผนการแก้ไข (Solution Plan):</strong>
                                            {ticket.solutionPlan}
                                        </div>
                                    )}

                                    {isRepair && ticket.expectedCompletionDate && (
                                        <div className={`${styles.statusBox} ${styles.status_ok}`} style={{ marginTop: '16px', background: 'var(--gray-50)', borderColor: 'var(--gray-200)', color: 'var(--text2)' }}>
                                            <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--text)' }}>กำหนดเสร็จ:</strong>
                                            {new Date(ticket.expectedCompletionDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </div>
                                    )}

                                    {ticket.attachments && ticket.attachments.length > 0 && (
                                        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--gray-50)', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                                            <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '8px' }}>ไฟล์แนบ:</strong>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {ticket.attachments.map((url: string, i: number) => {
                                                    const fileName = url.split('/').pop() || `Attachment ${i + 1}`;
                                                    return (
                                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                                            <span style={{ marginRight: '6px' }}>📎</span> {fileName}
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
