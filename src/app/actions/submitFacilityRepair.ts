'use server';

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function submitFacilityRepair(data: {
    equipmentName: string;
    location: string;
    issueDetail: string;
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
            console.error('Failed to parse token for repair submission:', e);
        }
    }

    try {
        const { randomUUID } = require('crypto');
        
        // Generate request number (e.g., FAC-26082001)
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const datePrefixForQuery = `${yyyy.toString().substring(2)}${mm}${dd}`;

        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const count = await prisma.facilityRepairRequest.count({
            where: {
                createdAt: {
                    gte: startOfDay,
                }
            }
        });
        const requestNumber = `FAC-${datePrefixForQuery}${(count + 1).toString().padStart(2, '0')}`;
        
        // Find reporterId if possible
        let reporterId = null;
        if (reporterEmail !== 'no-reply@teragroup.com') {
            const user = await prisma.user.findUnique({ where: { email: reporterEmail } });
            if (user) reporterId = user.id;
        }

        const repair = await prisma.facilityRepairRequest.create({
            data: {
                id: randomUUID(),
                requestNumber,
                equipmentName: data.equipmentName,
                location: data.location,
                issueDetail: data.issueDetail,
                sourceModule: 'checkin',
                reporterEmail,
                reporterName,
                reporterId,
                status: 'REPORTED'
            }
        });

        // Notify admins and technicians
        const notifyUsers = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'TECHNICIAN'] } }
        });

        if (notifyUsers.length > 0) {
            await prisma.notification.createMany({
                data: notifyUsers.map((u) => ({
                    id: randomUUID(),
                    userId: u.id,
                    type: 'FACILITY_REPAIR_CREATED',
                    title: 'แจ้งซ่อมใหม่',
                    message: `มีการแจ้งซ่อมอุปกรณ์: ${data.equipmentName}`,
                    linkUrl: null
                }))
            });
        }

        return { success: true, repair };
    } catch (e: any) {
        console.error('Direct Facility Repair Submission Failed:', e);
        throw new Error('เกิดข้อผิดพลาดในการบันทึกข้อมูล (DB Failed)');
    }
}
