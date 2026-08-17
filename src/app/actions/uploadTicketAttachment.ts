'use server';

export async function uploadTicketAttachment(ticketId: string, formData: FormData) {
    const crmUrl = process.env.CRM_API_URL || 'https://sales-crm-web.vercel.app';
    const apiKey = process.env.CRM_TICKET_API_KEY;

    if (!apiKey) {
        throw new Error('ระบบไม่พร้อมใช้งาน: ไม่พบการตั้งค่า CRM API Key');
    }

    const res = await fetch(
        `${crmUrl}/api/external/tickets/${ticketId}/attachments`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData, // No need to set Content-Type yourself, fetch handles multipart boundary
        }
    );
    
    if (!res.ok) {
        let errorText = 'File attachment failed';
        try {
            const errorJson = await res.json();
            errorText = errorJson.error || errorJson.message || 'File attachment failed';
        } catch (e) {
            // ignore
        }
        throw new Error(errorText);
    }
    
    return res.json();
}
