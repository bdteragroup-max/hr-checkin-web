'use server'
// Force TS reload

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/app/lib/pushNotification';

// Utility to get current user from token (supports employee token and admin token)
async function getUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const adminToken = cookieStore.get('admin_token')?.value;

    if (token) {
        try {
            const decoded = verifyToken(token);
            if (decoded?.emp_id) {
                const emp = await prisma.employees.findUnique({
                    where: { emp_id: decoded.emp_id }
                });
                if (emp) return emp;
            }
        } catch {}
    }

    if (adminToken) {
        try {
            const decoded = verifyToken(adminToken);
            if (decoded?.emp_id) {
                const emp = await prisma.employees.findUnique({
                    where: { emp_id: decoded.emp_id }
                });
                if (emp) return { ...emp, isAdmin: true } as any;

                const admin = await prisma.admins.findFirst({
                    where: { username: decoded.emp_id }
                });
                if (admin) {
                    return {
                        emp_id: admin.username,
                        name: admin.full_name || admin.username,
                        supervisor_id: null,
                        secondary_supervisor_id: null,
                        isAdmin: true
                    } as any;
                }
            }
        } catch {}
    }

    throw new Error('Unauthorized');
}

// Check current user details and initial approval eligibility
export async function getCurrentDepreciationUser() {
    try {
        const user = await getUser();
        return {
            emp_id: user.emp_id,
            name: user.name,
            isInitialApprover: user.emp_id === 'TE65001' || (user as any).isAdmin === true,
            isAdmin: (user as any).isAdmin === true
        };
    } catch {
        return null;
    }
}

// Utility to map emp_id to userId
async function getUserIdByEmpId(emp_id: string): Promise<string | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { employeeId: emp_id },
            select: { id: true }
        });
        return user?.id || null;
    } catch {
        return null;
    }
}

export async function createDepreciationClaim(data: {
    emp_id: string;
    amount: number;
    receipt_url: string;
    claim_month: Date;
}) {
    const currentUser = await getUser();
    
    // Check if the selected emp_id matches direct supervisor, secondary supervisor, or self
    const targetEmployee = await prisma.employees.findUnique({
        where: { emp_id: data.emp_id },
        select: { supervisor_id: true, secondary_supervisor_id: true, name: true, nickname: true }
    });

    const isDirectSupervisor = targetEmployee?.supervisor_id === currentUser.emp_id;
    const isSecondarySupervisor = targetEmployee?.secondary_supervisor_id === currentUser.emp_id;
    const isSelf = data.emp_id === currentUser.emp_id;

    if (!targetEmployee || (!isDirectSupervisor && !isSecondarySupervisor && !isSelf)) {
        throw new Error('พนักงานท่านนี้ไม่เข้าเกณฑ์การยื่นคำขอ — ต้องเป็นหัวหน้าโดยตรง หรือพนักงานยื่นด้วยตนเองเท่านั้น');
    }

    // If submitted by Khun Natthinee herself, it bypasses initial approval to PENDING_HR
    const initialStatus = currentUser.emp_id === 'TE65001' ? 'PENDING_HR' : 'PENDING_INITIAL';

    const claim = await prisma.sales_depreciation_claims.create({
        data: {
            emp_id: data.emp_id,
            submitted_by: currentUser.emp_id,
            amount: data.amount,
            receipt_url: data.receipt_url,
            claim_month: new Date(data.claim_month),
            status: initialStatus,
            initial_approved_by: currentUser.emp_id === 'TE65001' ? 'TE65001' : null,
            initial_approved_at: currentUser.emp_id === 'TE65001' ? new Date() : null,
        }
    });

    const empDisplay = targetEmployee.name + (targetEmployee.nickname ? ` (${targetEmployee.nickname})` : '');
    const monthStr = new Date(data.claim_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

    // 1. Notify Khun Natthinee (TE65001) for initial approval if not submitted by herself
    if (currentUser.emp_id !== 'TE65001') {
        try {
            const natthinee = await prisma.employees.findUnique({
                where: { emp_id: 'TE65001' },
                select: { line_user_id: true }
            });
            if (natthinee?.line_user_id) {
                const { sendDepreciationClaimNotification } = await import("@/utils/lineMessaging");
                await sendDepreciationClaimNotification({
                    id: claim.id,
                    employeeName: empDisplay,
                    submitterName: currentUser.name,
                    month: monthStr,
                    amount: Number(data.amount).toLocaleString(),
                    receiptUrl: data.receipt_url,
                    status: 'PENDING_INITIAL'
                }, [natthinee.line_user_id]);
            }
        } catch (notifyErr) {
            console.error('Notify Khun Natthinee error (ignored):', notifyErr);
        }
    }

    // 2. Notify HR if directly PENDING_HR
    if (initialStatus === 'PENDING_HR' && process.env.HR_LINE_USER_ID) {
        try {
            const { sendDepreciationClaimNotification } = await import("@/utils/lineMessaging");
            await sendDepreciationClaimNotification({
                id: claim.id,
                employeeName: empDisplay,
                submitterName: currentUser.name,
                month: monthStr,
                amount: Number(data.amount).toLocaleString(),
                receiptUrl: data.receipt_url,
                status: 'PENDING_HR'
            }, [process.env.HR_LINE_USER_ID]);
        } catch (notifyErr) {
            console.error('Notify HR error (ignored):', notifyErr);
        }
    }

    return { success: true, claim: { ...claim, amount: claim.amount.toNumber() } };
}

// Fetch claims pending initial approval by Khun Natthinee (TE65001) or Admin
export async function getInitialApprovalPendingClaims() {
    const currentUser = await getUser();
    const isApprover = currentUser.emp_id === 'TE65001' || (currentUser as any).isAdmin === true;
    if (!isApprover) {
        return [];
    }

    const claims = await prisma.sales_depreciation_claims.findMany({
        where: {
            status: { in: ['PENDING_INITIAL', 'PENDING'] }
        },
        include: {
            employee: { select: { name: true, nickname: true, emp_id: true } },
            supervisor: { select: { name: true, nickname: true, emp_id: true } }
        },
        orderBy: { created_at: 'desc' }
    });

    return claims.map((c: any) => ({
        ...c,
        amount: c.amount.toNumber()
    }));
}

// Initial approval by Khun Natthinee (TE65001)
export async function initialApproveClaim(id: number) {
    const currentUser = await getUser();
    const isApprover = currentUser.emp_id === 'TE65001' || (currentUser as any).isAdmin === true;
    if (!isApprover) {
        throw new Error('เฉพาะคุณณัฎธินี (TE65001) หรือผู้ดูแลระบบเท่านั้นที่สามารถอนุมัติเบื้องต้นได้');
    }

    const claim = await prisma.sales_depreciation_claims.findUnique({
        where: { id },
        include: {
            employee: { select: { name: true, nickname: true, emp_id: true, line_user_id: true } },
            supervisor: { select: { name: true, nickname: true, emp_id: true, line_user_id: true } }
        }
    });

    if (!claim) throw new Error('ไม่พบข้อมูลคำขอเบิก');

    const updatedClaim = await prisma.sales_depreciation_claims.update({
        where: { id },
        data: {
            status: 'PENDING_HR',
            initial_approved_by: currentUser.emp_id,
            initial_approved_at: new Date(),
            revisions: {
                create: {
                    returned_by: currentUser.emp_id,
                    snapshot: { 
                        status: 'PENDING_HR', 
                        initial_approved_by: currentUser.emp_id,
                        initial_approved_at: new Date()
                    }
                }
            }
        }
    });

    const monthStr = new Date(claim.claim_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const empDisplay = claim.employee.name + (claim.employee.nickname ? ` (${claim.employee.nickname})` : '');

    // Notify Submitter (Manager) that Initial Approval passed and forwarded to HR
    if (claim.supervisor.line_user_id) {
        try {
            const { sendDepreciationClaimNotification } = await import("@/utils/lineMessaging");
            await sendDepreciationClaimNotification({
                id: claim.id,
                employeeName: empDisplay,
                submitterName: claim.supervisor.name,
                month: monthStr,
                amount: Number(claim.amount).toLocaleString(),
                receiptUrl: claim.receipt_url,
                status: 'PENDING_HR'
            }, [claim.supervisor.line_user_id]);
        } catch (e) {
            console.error('Notify submitter error (ignored):', e);
        }
    }

    // Notify HR that the claim passed initial review and is waiting for HR
    if (process.env.HR_LINE_USER_ID) {
        try {
            const { sendDepreciationClaimNotification } = await import("@/utils/lineMessaging");
            await sendDepreciationClaimNotification({
                id: claim.id,
                employeeName: empDisplay,
                submitterName: claim.supervisor.name,
                month: monthStr,
                amount: Number(claim.amount).toLocaleString(),
                receiptUrl: claim.receipt_url,
                status: 'PENDING_HR'
            }, [process.env.HR_LINE_USER_ID]);
        } catch (e) {
            console.error('Notify HR error (ignored):', e);
        }
    }

    return { success: true, claim: { ...updatedClaim, amount: updatedClaim.amount.toNumber() } };
}

export async function getMyTeamClaims(filters: { status?: string; month?: string } = {}) {
    const currentUser = await getUser();
    const where: any = { submitted_by: currentUser.emp_id };
    
    if (filters.status) {
        if (filters.status === 'PENDING') {
            where.status = { in: ['PENDING', 'PENDING_INITIAL', 'PENDING_HR'] };
        } else {
            where.status = filters.status;
        }
    }
    
    if (filters.month) {
        const date = new Date(filters.month);
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        where.claim_month = {
            gte: startOfMonth,
            lte: endOfMonth
        };
    }

    const claims = await prisma.sales_depreciation_claims.findMany({
        where,
        include: {
            employee: { select: { name: true, nickname: true, emp_id: true } }
        },
        orderBy: { created_at: 'desc' }
    });

    return claims.map((c: any) => ({
        ...c,
        amount: c.amount.toNumber()
    }));
}

export async function getAllClaims(filters: { status?: string; month?: string; startDate?: string; endDate?: string; supervisor_id?: string } = {}) {
    const where: any = {};
    
    if (filters.status && filters.status !== 'all') {
        if (filters.status === 'PENDING') {
            where.status = { in: ['PENDING_INITIAL', 'PENDING_HR', 'PENDING'] };
        } else if (filters.status === 'PENDING_INITIAL') {
            where.status = { in: ['PENDING_INITIAL', 'PENDING'] };
        } else if (filters.status === 'PENDING_HR') {
            where.status = 'PENDING_HR';
        } else {
            where.status = filters.status;
        }
    }
    
    if (filters.supervisor_id && filters.supervisor_id !== 'all') {
        where.submitted_by = filters.supervisor_id;
    }
    
    if (filters.startDate && filters.endDate) {
        where.claim_month = {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate)
        };
    } else if (filters.month) {
        const date = new Date(filters.month);
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        where.claim_month = {
            gte: startOfMonth,
            lte: endOfMonth
        };
    }

    const claims = await prisma.sales_depreciation_claims.findMany({
        where,
        include: {
            employee: { select: { name: true, nickname: true, emp_id: true } },
            supervisor: { select: { name: true, nickname: true, emp_id: true } }
        },
        orderBy: { created_at: 'desc' }
    });

    return claims.map((c: any) => ({
        ...c,
        amount: c.amount.toNumber()
    }));
}

// Final approval by HR / Admin
export async function approveClaim(id: number) {
    const currentUser = await getUser();
    
    const claim = await prisma.sales_depreciation_claims.findUnique({
        where: { id },
        include: {
            employee: { select: { name: true, nickname: true, emp_id: true, line_user_id: true } },
            supervisor: { select: { name: true, nickname: true, emp_id: true, line_user_id: true } }
        }
    });

    if (!claim) throw new Error('Claim not found');

    const updatedClaim = await prisma.sales_depreciation_claims.update({
        where: { id },
        data: {
            status: 'APPROVED',
            approved_by: currentUser.emp_id,
            approved_at: new Date(),
            revisions: {
                create: {
                    returned_by: currentUser.emp_id,
                    snapshot: { status: 'APPROVED', approved_by: currentUser.emp_id }
                }
            }
        }
    });

    const monthStr = new Date(claim.claim_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const empDisplay = claim.employee.name + (claim.employee.nickname ? ` (${claim.employee.nickname})` : '');

    // Notify Submitter and Employee
    const lineRecipients: string[] = [];
    if (claim.supervisor.line_user_id) lineRecipients.push(claim.supervisor.line_user_id);
    if (claim.employee.line_user_id && !lineRecipients.includes(claim.employee.line_user_id)) {
        lineRecipients.push(claim.employee.line_user_id);
    }

    if (lineRecipients.length > 0) {
        try {
            const { sendDepreciationClaimNotification } = await import("@/utils/lineMessaging");
            await sendDepreciationClaimNotification({
                id: claim.id,
                employeeName: empDisplay,
                submitterName: claim.supervisor.name,
                month: monthStr,
                amount: Number(claim.amount).toLocaleString(),
                receiptUrl: claim.receipt_url,
                status: 'APPROVED'
            }, lineRecipients);
        } catch (e) {
            console.error('Notify approved error (ignored):', e);
        }
    }

    return { success: true, claim: { ...updatedClaim, amount: updatedClaim.amount.toNumber() } };
}

// Return claim for revision (can be called by Khun Natthinee or HR)
export async function returnClaimForRevision(id: number, reason: string) {
    const currentUser = await getUser();
    
    if (!reason || reason.trim() === '') {
        throw new Error('กรุณาระบุเหตุผลการตีกลับ');
    }

    const claim = await prisma.sales_depreciation_claims.findUnique({
        where: { id },
        include: {
            employee: { select: { name: true, nickname: true, emp_id: true } },
            supervisor: { select: { name: true, nickname: true, emp_id: true, line_user_id: true } }
        }
    });

    if (!claim) throw new Error('Claim not found');

    const updatedClaim = await prisma.sales_depreciation_claims.update({
        where: { id },
        data: {
            status: 'RETURNED',
            return_reason: reason,
            revisions: {
                create: {
                    return_reason: reason,
                    returned_by: currentUser.emp_id,
                    snapshot: { status: 'RETURNED', reason, returned_by: currentUser.name || currentUser.emp_id }
                }
            }
        }
    });

    // Notify Submitter
    if (claim.supervisor.line_user_id) {
        try {
            const { sendDepreciationClaimNotification } = await import("@/utils/lineMessaging");
            const monthStr = new Date(claim.claim_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
            await sendDepreciationClaimNotification({
                id: claim.id,
                employeeName: claim.employee.name,
                submitterName: claim.supervisor.name,
                month: monthStr,
                amount: Number(claim.amount).toLocaleString(),
                receiptUrl: claim.receipt_url,
                status: 'RETURNED',
                returnReason: reason
            }, [claim.supervisor.line_user_id]);
        } catch (e) {
            console.error('Notify returned error (ignored):', e);
        }
    }

    return { success: true, claim: { ...updatedClaim, amount: updatedClaim.amount.toNumber() } };
}

export async function resubmitClaim(id: number, newData: { amount: number; receipt_url: string }) {
    const currentUser = await getUser();
    
    const claim = await prisma.sales_depreciation_claims.findUnique({
        where: { id },
        include: { employee: true }
    });

    if (!claim) throw new Error('Claim not found');
    if (claim.submitted_by !== currentUser.emp_id) {
        throw new Error('เฉพาะหัวหน้าผู้ส่งเรื่องเท่านั้นที่สามารถแก้ไขและส่งใหม่ได้');
    }
    if (claim.status !== 'RETURNED') {
        throw new Error('เฉพาะรายการที่ถูกตีกลับเท่านั้นที่สามารถแก้ไขและส่งใหม่ได้');
    }

    const nextStatus = currentUser.emp_id === 'TE65001' ? 'PENDING_HR' : 'PENDING_INITIAL';

    const updatedClaim = await prisma.sales_depreciation_claims.update({
        where: { id },
        data: {
            status: nextStatus,
            amount: newData.amount,
            receipt_url: newData.receipt_url,
            return_reason: null, // clear the reason
            initial_approved_by: currentUser.emp_id === 'TE65001' ? 'TE65001' : null,
            initial_approved_at: currentUser.emp_id === 'TE65001' ? new Date() : null,
            revisions: {
                create: {
                    returned_by: currentUser.emp_id,
                    snapshot: newData as any
                }
            }
        }
    });

    // Notify Khun Natthinee if needed
    if (currentUser.emp_id !== 'TE65001') {
        try {
            const natthinee = await prisma.employees.findUnique({
                where: { emp_id: 'TE65001' },
                select: { line_user_id: true }
            });
            if (natthinee?.line_user_id) {
                const { sendDepreciationClaimNotification } = await import("@/utils/lineMessaging");
                const monthStr = new Date(claim.claim_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
                await sendDepreciationClaimNotification({
                    id: claim.id,
                    employeeName: claim.employee.name,
                    submitterName: currentUser.name,
                    month: monthStr,
                    amount: Number(newData.amount).toLocaleString(),
                    receiptUrl: newData.receipt_url,
                    status: 'PENDING_INITIAL'
                }, [natthinee.line_user_id]);
            }
        } catch (e) {
            console.error('Notify resubmit error (ignored):', e);
        }
    }

    return { success: true, claim: { ...updatedClaim, amount: updatedClaim.amount.toNumber() } };
}

export async function getMyTeamMembers() {
    const currentUser = await getUser();
    
    const self = await prisma.employees.findUnique({
        where: { emp_id: currentUser.emp_id },
        select: { emp_id: true, name: true, nickname: true, supervisor: { select: { name: true } } }
    });

    const members = await prisma.employees.findMany({
        where: {
            OR: [
                { supervisor_id: currentUser.emp_id },
                { secondary_supervisor_id: currentUser.emp_id }
            ]
        },
        select: { emp_id: true, name: true, nickname: true, supervisor: { select: { name: true } } },
        orderBy: { name: 'asc' }
    });
    
    const allMembers = [];
    if (self) allMembers.push(self);
    allMembers.push(...members);
    
    const unique = new Map();
    for (const m of allMembers) {
        unique.set(m.emp_id, m);
    }

    return Array.from(unique.values());
}
