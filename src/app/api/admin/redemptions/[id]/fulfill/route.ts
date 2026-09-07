import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminOrSupervisor } from "@/lib/adminAuth";
import { cookies } from "next/headers";

async function authenticateAdmin() {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get("admin_token")?.value;
    const userToken = cookieStore.get("token")?.value;

    if (adminToken) {
        try {
            const admin = await requireAdmin();
            const emp = await prisma.employees.findFirst({
                where: { emp_id: { equals: admin.emp_id, mode: "insensitive" } },
                select: { emp_id: true }
            });
            return { ok: true as const, empId: emp?.emp_id || null, username: admin.emp_id, role: admin.role };
        } catch {}
    }

    if (userToken) {
        try {
            const auth = await requireAdminOrSupervisor();
            const emp = await prisma.employees.findFirst({
                where: { emp_id: { equals: auth.emp_id, mode: "insensitive" } },
                select: { emp_id: true }
            });
            return { ok: true as const, empId: emp?.emp_id || null, username: auth.username, role: auth.role };
        } catch {}
    }

    return { ok: false as const, error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateAdmin();
    if (!auth.ok) return auth.error;

    const idStr = (await params).id;
    const redemptionId = parseInt(idStr, 10);
    if (isNaN(redemptionId)) {
        return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    try {
        await prisma.$transaction(async (tx) => {
            const redemption = await tx.reward_redemptions.findFirst({
                where: { id: redemptionId, status: "pending" },
                include: { reward: true }
            });

            if (!redemption) {
                throw new Error("Already processed or not found");
            }

            await tx.reward_redemptions.update({
                where: { id: redemptionId },
                data: { 
                    status: "fulfilled", 
                    fulfilled_at: new Date(),
                    processed_by: auth.empId
                }
            });

            // Automatically add to payroll if it's a Cash Coupon
            if (redemption.reward.name.includes("คูปองเงินสด") || redemption.reward.name.includes("Cash Coupon")) {
                const match = redemption.reward.name.match(/(\d+)/);
                if (match) {
                    const cashValue = parseInt(match[1], 10) * redemption.quantity;
                    const now = new Date();
                    const cycleMonth = now.getMonth() + 1;
                    const cycleYear = now.getFullYear();

                    const payroll = await tx.monthly_payroll_data.findUnique({
                        where: {
                            emp_id_cycle_month_cycle_year: {
                                emp_id: redemption.emp_id,
                                cycle_month: cycleMonth,
                                cycle_year: cycleYear
                            }
                        }
                    });

                    const currentBenefits = payroll?.other_benefits ? Number(payroll.other_benefits) : 0;
                    const newBenefits = currentBenefits + cashValue;

                    await tx.monthly_payroll_data.upsert({
                        where: {
                            emp_id_cycle_month_cycle_year: {
                                emp_id: redemption.emp_id,
                                cycle_month: cycleMonth,
                                cycle_year: cycleYear
                            }
                        },
                        update: {
                            other_benefits: newBenefits,
                            updated_at: new Date()
                        },
                        create: {
                            emp_id: redemption.emp_id,
                            cycle_month: cycleMonth,
                            cycle_year: cycleYear,
                            other_benefits: newBenefits
                        }
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Fulfill Redemption Error:", error.message);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fulfill redemption" },
            { status: 400 }
        );
    }
}
