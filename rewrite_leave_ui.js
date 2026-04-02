const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'leave', 'page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const s1 = `    const [uploading, setUploading] = useState(false);
    const [leaveTypeId, setLeaveTypeId] = useState("");`;
const r1 = `    const [uploading, setUploading] = useState(false);
    const [editingId, setEditingId] = useState("");
    const [leaveTypeId, setLeaveTypeId] = useState("");`;
code = code.replace(s1, r1);

const s2 = `    async function submit() {
        if (!canSubmit) return;
        setLoading(true);
        const r = await fetch("/api/leave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                leave_type_id: leaveTypeId,
                start_at: startAt, end_at: endAt,
                reason: reason || null,
                attachment_url: attachmentUrl || null,
            }),
        });
        const data = await r.json().catch(() => ({}));
        setLoading(false);
        if (!r.ok) {
            const errMap: Record<string, string> = {
                OVERLAP_LEAVE: "ช่วงเวลาลาซ้อนกับใบลาที่มีอยู่แล้ว",
                ZERO_WORKING_DAYS: "ช่วงที่เลือกไม่มีวันทำงาน (ติดวันหยุด/อาทิตย์)",
                END_BEFORE_START: "เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม",
                SICK_ATTACHMENT_REQUIRED: "ลาป่วยเกิน 2 วันทำงาน ต้องแนบเอกสารประกอบ",
                GENDER_NOT_ALLOWED: "ประเภทลานี้ไม่ตรงตามเพศที่กำหนด",
                NO_ENTITLEMENT: "คุณยังไม่ได้รับสิทธิ์การลานี้ (อายุงานไม่ถึงเกณฑ์)",
                MAX_3_CONSECUTIVE_DAYS: "ลากิจ ลาติดต่อกันได้สูงสุด 3 วันทำงาน",
                ANNUAL_FULL_DAYS_ONLY: "ลาพักร้อนต้องลาเป็นวันเต็มเท่านั้น (08:00 - 17:00)",
                ADVANCE_NOTICE_REQUIRED: \`ประเภทลานี้ต้องแจ้งล่วงหน้าอย่างน้อย \${data?.required_days} วัน\`,
                EXCEED_ENTITLEMENT: \`ใช้วันลาเกินสิทธิ์ คงเหลือ \${data?.remaining || 0} วัน (ขอลา \${data?.requested || 0} วัน)\`,
            };
            showAlert(errMap[data?.error] || data?.error || "ส่งคำขอไม่สำเร็จ", "error");
            return;
        }
        setStartDate(""); setEndDate(""); setReason("");
        setAttachmentUrl(""); setFileName("");
        if (fileRef.current) fileRef.current.value = "";
        await load();
        showAlert(\`ส่งคำขอลาสำเร็จ\\n\${data.days} วันทำงาน · \${Math.floor((data.minutes || 0) / 60)}ชม \${(data.minutes || 0) % 60}นาที\`, "ok");
    }`;
const r2 = `    async function submit() {
        if (!canSubmit) return;
        setLoading(true);
        const method = editingId ? "PUT" : "POST";
        const payload: any = {
            leave_type_id: leaveTypeId,
            start_at: startAt, end_at: endAt,
            reason: reason || null,
            attachment_url: attachmentUrl || null,
        };
        if (editingId) payload.id = editingId;

        const r = await fetch("/api/leave", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        setLoading(false);
        if (!r.ok) {
            const errMap: Record<string, string> = {
                OVERLAP_LEAVE: "ช่วงเวลาลาซ้อนกับใบลาที่มีอยู่แล้ว",
                ZERO_WORKING_DAYS: "ช่วงที่เลือกไม่มีวันทำงาน (ติดวันหยุด/อาทิตย์)",
                END_BEFORE_START: "เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม",
                SICK_ATTACHMENT_REQUIRED: "ลาป่วยเกิน 2 วันทำงาน ต้องแนบเอกสารประกอบ",
                GENDER_NOT_ALLOWED: "ประเภทลานี้ไม่ตรงตามเพศที่กำหนด",
                NO_ENTITLEMENT: "คุณยังไม่ได้รับสิทธิ์การลานี้ (อายุงานไม่ถึงเกณฑ์)",
                MAX_3_CONSECUTIVE_DAYS: "ลากิจ ลาติดต่อกันได้สูงสุด 3 วันทำงาน",
                ANNUAL_FULL_DAYS_ONLY: "ลาพักร้อนต้องลาเป็นวันเต็มเท่านั้น (08:00 - 17:00)",
                ADVANCE_NOTICE_REQUIRED: \`ประเภทลานี้ต้องแจ้งล่วงหน้าอย่างน้อย \${data?.required_days} วัน\`,
                EXCEED_ENTITLEMENT: \`ใช้วันลาเกินสิทธิ์ คงเหลือ \${data?.remaining || 0} วัน (ขอลา \${data?.requested || 0} วัน)\`,
                CANNOT_EDIT_APPROVED: "ไม่สามารถแก้ไขใบลาที่อนุมัติแล้วได้",
            };
            showAlert(errMap[data?.error] || data?.error || "ส่งคำขอไม่สำเร็จ", "error");
            return;
        }
        setStartDate(""); setEndDate(""); setReason("");
        setAttachmentUrl(""); setFileName("");
        setEditingId("");
        if (fileRef.current) fileRef.current.value = "";
        await load();
        showAlert(editingId ? \`อัปเดตคำขอลาสำเร็จ\` : \`ส่งคำขอลาสำเร็จ\\n\${data.days} วันทำงาน · \${Math.floor((data.minutes || 0) / 60)}ชม \${(data.minutes || 0) % 60}นาที\`, "ok");
    }

    function cancelEdit() {
        setStartDate(""); setEndDate(""); setReason("");
        setAttachmentUrl(""); setFileName("");
        setEditingId("");
        if (fileRef.current) fileRef.current.value = "";
    }

    function startEdit(item: LeaveItem) {
        setEditingId(item.id);
        setLeaveTypeId(item.leave_type_id);

        const dStart = new Date(item.start_at);
        const stYear = dStart.getFullYear();
        const stMonth = String(dStart.getMonth() + 1).padStart(2, '0');
        const stDay = String(dStart.getDate()).padStart(2, '0');
        setStartDate(\`\${stYear}-\${stMonth}-\${stDay}\`);
        setStartHour(String(dStart.getHours()).padStart(2, '0'));
        setStartMin(String(dStart.getMinutes()).padStart(2, '0'));

        const dEnd = new Date(item.end_at);
        const enYear = dEnd.getFullYear();
        const enMonth = String(dEnd.getMonth() + 1).padStart(2, '0');
        const enDay = String(dEnd.getDate()).padStart(2, '0');
        setEndDate(\`\${enYear}-\${enMonth}-\${enDay}\`);
        setEndHour(String(dEnd.getHours()).padStart(2, '0'));
        setEndMin(String(dEnd.getMinutes()).padStart(2, '0'));

        setReason(item.reason || "");
        setAttachmentUrl(item.attachment_url || "");
        setFileName(item.attachment_url ? "มีไฟล์แนบอยู่แล้ว" : "");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }`;
code = code.replace(s2, r2);

const s3 = `<button className={styles.btnPrimaryFull} disabled={!canSubmit || loading} onClick={submit}>
                            {loading ? <ArrowPathIcon width={20} className="animate-spin" /> : 
                            <><PaperAirplaneIcon width={18} style={{ marginRight: 8, transform: 'rotate(-20deg)' }} /> ยืนยันการส่งใบลา</>}
                        </button>`;
const r3 = `<button className={styles.btnPrimaryFull} disabled={!canSubmit || loading} onClick={submit}>
                            {loading ? <ArrowPathIcon width={20} className="animate-spin" /> : 
                            editingId ? <><ArrowPathIcon width={18} style={{ marginRight: 8 }} /> อัปเดตใบลา</> : 
                            <><PaperAirplaneIcon width={18} style={{ marginRight: 8, transform: 'rotate(-20deg)' }} /> ยืนยันการส่งใบลา</>}
                        </button>
                        {editingId && (
                            <button className={styles.btnOutlineFull} style={{ marginTop: 8, width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-300)', backgroundColor: 'transparent', fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }} onClick={cancelEdit} disabled={loading}>
                                ยกเลิกการแก้ไข
                            </button>
                        )}`;
code = code.replace(s3, r3);

const s4 = `                                    <div className={styles.historyRowBot}>
                                        <div className={styles.colDays}>{x.days} วันทำงาน</div>
                                    </div>`;
const r4 = `                                    <div className={styles.historyRowBot}>
                                        <div className={styles.colDays}>{x.days} วันทำงาน</div>
                                        {x.status.startsWith('pending') && (
                                            <button 
                                                className={styles.btnOutlineSm} 
                                                style={{ marginLeft: "auto", fontSize: 13, padding: "4px 10px", borderRadius: 6, border: '1px solid var(--gray-300)', backgroundColor: 'white', color: 'var(--text2)' }}
                                                onClick={() => startEdit(x)}
                                            >
                                                แก้ไข
                                            </button>
                                        )}
                                    </div>`;
code = code.replace(s4, r4);

fs.writeFileSync(filePath, code);
console.log('Replaced ui correctly');
