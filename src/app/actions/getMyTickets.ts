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

    let tickets: any[] = [];
    let repairs: any[] = [];

    try {
        tickets = await prisma.supportTicket.findMany({
            where: { reporterEmail: email },
            orderBy: { createdAt: 'desc' },
            include: { User_SupportTicket_assigneeIdToUser: true }
        });
    } catch (e) {
        console.error('DB Fetch Tickets Failed:', e);
    }

    try {
        repairs = await prisma.facilityRepairRequest.findMany({
            where: { reporterEmail: email },
            orderBy: { reportedDate: 'desc' },
            include: { User_FacilityRepairRequest_assigneeIdToUser: true }
        });
    } catch (e) {
        console.error('DB Fetch Repairs Failed:', e);
    }

    // Map them to a unified format so the frontend can display both easily
    const unified = [
        ...tickets.map((t: any) => ({ 
            ...t, 
            _type: 'TICKET',
            assigneeName: t.User_SupportTicket_assigneeIdToUser?.fullName || null
        })),
        ...repairs.map((r: any) => ({ 
            ...r, 
            _type: 'FACILITY_REPAIR',
            assigneeName: r.User_FacilityRepairRequest_assigneeIdToUser?.fullName || null
        }))
    ];

    // Sort by createdAt descending
    unified.sort((a, b) => new Date(b.createdAt || b.reportedDate).getTime() - new Date(a.createdAt || a.reportedDate).getTime());
    
    return { tickets: unified };
}
