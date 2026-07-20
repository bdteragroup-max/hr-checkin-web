import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function requireAdmin() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    try {
        const payload = verifyToken(token) as { emp_id: string };
        const emp = await prisma.employees.findUnique({
            where: { emp_id: payload.emp_id },
            include: { departments: true }
        });
        if (!emp || !emp.is_active) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
        return { emp };
    } catch {
        return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

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
                    processed_by: auth.emp.emp_id
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
