'use server';

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function getMyTickets() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
        throw new Error('ไม่พบข้อมูลการเข้าระบบ');
    }

    let email = null;
    
    try {
        const decoded = verifyToken(token);
        if (decoded?.emp_id) {
            const emp = await prisma.employees.findUnique({
                where: { emp_id: decoded.emp_id },
                select: { email: true }
            });
            if (emp?.email) {
                email = emp.email;
            }
        }
    } catch (e) {
        console.error('Failed to parse token for fetching tickets:', e);
        throw new Error('เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
    }

    if (!email) {
        throw new Error('ไม่พบอีเมลในระบบ ไม่สามารถดึงข้อมูลปัญหาได้');
    }

    const crmUrl = process.env.CRM_API_URL || 'https://sales-crm-web.vercel.app';
    const apiKey = process.env.CRM_TICKET_API_KEY;

    if (!apiKey) {
        throw new Error('ระบบไม่พร้อมใช้งาน: ไม่พบการตั้งค่า CRM API Key');
    }

    const res = await fetch(`${crmUrl}/api/external/tickets?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        cache: 'no-store' // Always fetch latest
    });

    if (!res.ok) {
        let errorText = 'Unknown error';
        try {
            const errorJson = await res.json();
            errorText = errorJson.error || errorJson.message || JSON.stringify(errorJson);
        } catch (e) {
            errorText = await res.text().catch(() => 'Unknown error');
        }

        console.error('CRM Fetch Tickets Failed:', res.status, errorText);

        if (res.status === 401) {
            throw new Error('ไม่ได้รับอนุญาตให้เชื่อมต่อกับระบบ CRM');
        } else if (res.status === 404) {
            // If the endpoint is strictly returning 404 when no tickets found, we could return empty array.
            // But if it means the endpoint doesn't exist, it's different.
            // Assuming 404 here means no tickets or user not found, we can return empty array.
            return { tickets: [] };
        } else {
            throw new Error('เกิดข้อผิดพลาดในการดึงข้อมูล (CRM Failed)');
        }
    }
    
    return res.json();
}
