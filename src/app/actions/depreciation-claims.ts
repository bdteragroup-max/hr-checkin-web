'use server'
// Force TS reload

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/app/lib/pushNotification';

// Utility to get current user from token
async function getUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) throw new Error('Unauthorized');
    try {
        const decoded = verifyToken(token);
        if (!decoded?.emp_id) throw new Error('Invalid token');
        const emp = await prisma.employees.findUnique({
            where: { emp_id: decoded.emp_id }
        });
        if (!emp) throw new Error('User not found');
        return emp;
    } catch (e) {
        throw new Error('Unauthorized');
    }
}

// Utility to map emp_id to userId
async function getUserIdByEmpId(emp_id: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { employeeId: emp_id },
        select: { id: true }
    });
    return user?.id || null;
}

export async function createDepreciationClaim(data: {
    emp_id: string;
    amount: number;
    receipt_url: string;
    claim_month: Date;
}) {
    const currentUser = await getUser();
    
    // Check if the selected emp_id matches the current user's supervisor_id (direct supervisor only)
    const targetEmployee = await prisma.employees.findUnique({
        where: { emp_id: data.emp_id },
        select: { supervisor_id: true, name: true }
    });

    if (!targetEmployee || targetEmployee.supervisor_id !== currentUser.emp_id) {
        throw new Error('This employee is not eligible to submit a claim — only the employee\'s direct supervisor is eligible.');
    }

    const claim = await prisma.sales_depreciation_claims.create({
        data: {
            emp_id: data.emp_id,
            submitted_by: currentUser.emp_id,
            amount: data.amount,
            receipt_url: data.receipt_url,
            claim_month: new Date(data.claim_month),
            status: "PENDING",

        }
    });

    // Notify all Admins
    const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true }
    });
    
    await Promise.all(adminUsers.map(u => sendPushToUser(u.id, {
        title: "New Depreciation Claim Request",
        body: `${currentUser.name} submits claim for ${targetEmployee.name}`,
        url: `/admin/depreciation-claims`,
        category: "SYSTEM"
    })));

    return { success: true, claim: { ...claim, amount: claim.amount.toNumber() } };
}

export async function getMyTeamClaims(filters: { status?: string; month?: string } = {}) {
    const currentUser = await getUser();
    const where: any = { submitted_by: currentUser.emp_id };
    
    if (filters.status) {
        where.status = filters.status;
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

export async function getAllClaims(filters: { status?: string; month?: string; supervisor_id?: string } = {}) {
    const where: any = {};
    
    if (filters.status) {
        where.status = filters.status;
    }
    
    if (filters.supervisor_id) {
        where.submitted_by = filters.supervisor_id;
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

export async function approveClaim(id: number) {
    const currentUser = await getUser();
    
    const claim = await prisma.sales_depreciation_claims.findUnique({
        where: { id },
        include: { employee: true }
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
                    snapshot: { status: 'APPROVED' }
                }
            }
        }
    });

    const submitterUserId = await getUserIdByEmpId(claim.submitted_by);
    if (submitterUserId) {
        await sendPushToUser(submitterUserId, {
            title: "Depreciation claim request approved",
            body: `Amount ${claim.amount} for ${claim.employee.name} has been approved`,
            url: `/team/depreciation-claims`,
            category: "SYSTEM"
        });
    }

    return { success: true, claim: { ...updatedClaim, amount: updatedClaim.amount.toNumber() } };
}

export async function returnClaimForRevision(id: number, reason: string) {
    const currentUser = await getUser();
    
    if (!reason || reason.trim() === '') {
        throw new Error('Reason is required for returning a claim');
    }

    const claim = await prisma.sales_depreciation_claims.findUnique({
        where: { id }
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
                    snapshot: { status: 'RETURNED', reason }
                }
            }
        }
    });

    const submitterUserId = await getUserIdByEmpId(claim.submitted_by);
    if (submitterUserId) {
        await sendPushToUser(submitterUserId, {
            title: "Depreciation claim request returned for revision",
            body: reason,
            url: `/team/depreciation-claims`,
            category: "SYSTEM"
        });
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
        throw new Error('Only the original supervisor can resubmit this claim');
    }
    if (claim.status !== 'RETURNED') {
        throw new Error('Only returned claims can be resubmitted');
    }

    const updatedClaim = await prisma.sales_depreciation_claims.update({
        where: { id },
        data: {
            status: 'PENDING',
            amount: newData.amount,
            receipt_url: newData.receipt_url,
            return_reason: null, // clear the reason
            revisions: {
                create: {
                    returned_by: currentUser.emp_id,
                    snapshot: newData as any
                }
            }
        }
    });

    // Notify all Admins
    const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true }
    });
    
    await Promise.all(adminUsers.map(u => sendPushToUser(u.id, {
        title: "Depreciation Claim Resubmitted",
        body: `${currentUser.name} resubmitted claim for ${claim.employee.name}`,
        url: `/admin/depreciation-claims`,
        category: "SYSTEM"
    })));

    return { success: true, claim: { ...updatedClaim, amount: updatedClaim.amount.toNumber() } };
}

export async function getMyTeamMembers() {
    const currentUser = await getUser();
    const members = await prisma.employees.findMany({
        where: { supervisor_id: currentUser.emp_id }, // Direct supervisor only
        select: { emp_id: true, name: true, nickname: true },
        orderBy: { name: 'asc' }
    });
    return members;
}
