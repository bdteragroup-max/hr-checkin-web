'use server';

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function submitTicketToCRM(data: {
    title: string;
    description: string;
    category?: string;
    urgency?: string;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    let reporterEmail = 'no-reply@teragroup.com';
    let reporterName = 'Unknown User';

    if (token) {
        try {
            const decoded = verifyToken(token);
            if (decoded?.emp_id) {
                const emp = await prisma.employees.findUnique({
                    where: { emp_id: decoded.emp_id },
                    select: { email: true, name: true }
                });
                
                if (emp) {
                    if (emp.email) reporterEmail = emp.email;
                    if (emp.name) reporterName = emp.name;
                }
            }
        } catch (e) {
            console.error('Failed to parse token for ticket submission:', e);
        }
    }

    const crmUrl = process.env.CRM_API_URL || 'https://sales-crm-web.vercel.app';
    const apiKey = process.env.CRM_TICKET_API_KEY;

    if (!apiKey) {
        throw new Error('ระบบไม่พร้อมใช้งาน: ไม่พบการตั้งค่า CRM API Key');
    }

    const payload = {
        title: data.title,
        description: data.description,
        category: data.category,
        urgency: data.urgency || 'MEDIUM',
        sourceModule: 'checkin',
        reporterEmail,
        reporterName
    };

    const res = await fetch(`${crmUrl}/api/external/tickets`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        let errorText = 'Unknown error';
        try {
            const errorJson = await res.json();
            errorText = errorJson.error || errorJson.message || JSON.stringify(errorJson);
        } catch (e) {
            errorText = await res.text().catch(() => 'Unknown error');
        }

        console.error('CRM Ticket Submission Failed:', res.status, errorText);

        if (res.status === 400) {
            throw new Error('ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        } else if (res.status === 401) {
            throw new Error('ไม่ได้รับอนุญาตให้เชื่อมต่อกับระบบ CRM');
        } else if (res.status === 404) {
            throw new Error('ไม่พบข้อมูลปลายทาง (404)');
        } else {
            throw new Error('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ (CRM Failed)');
        }
    }
    
    return res.json();
}
