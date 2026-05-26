import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const month = 5;
        const year = 2026;
        
        const startDate = new Date(Number(year), Number(month) - 1, 1);
        const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
        
        const commissionClaims = await prisma.commission_claims.findMany({
            where: {
                status: "completed",
                OR: [
                    { approved_at: { gte: startDate, lte: endDate } },
                    { date: { gte: startDate, lte: endDate } }
                ]
            }
        });
        
        const emp_id = "TP68012";
        
        const empCommissionClaimsAsMain = commissionClaims.filter(c => c.emp_id === emp_id);
        const empCommissionClaimsAsCompanion = commissionClaims.filter(c => c.companion_ids && c.companion_ids.includes(emp_id));
        
        const uniqueClaimsMap = new Map<string, number>();
        const addClaim = (c: any) => {
            try {
                const dateStr = new Date(c.date).toISOString().split('T')[0];
                const customerName = (c.customer_name || "").toLowerCase().trim();
                const key = `${customerName}-${dateStr}`;
                const amount = Number(c.per_person_commission || 0);
                if (!uniqueClaimsMap.has(key) || uniqueClaimsMap.get(key)! < amount) {
                    uniqueClaimsMap.set(key, amount);
                }
            } catch (e) {
                uniqueClaimsMap.set(c.id, Number(c.per_person_commission || 0));
            }
        };
        
        empCommissionClaimsAsMain.forEach(addClaim);
        empCommissionClaimsAsCompanion.forEach(addClaim);
        
        const calculatedCommissions = Array.from(uniqueClaimsMap.values()).reduce((a, b) => a + b, 0);
        
        const adjustments = await prisma.monthly_payroll_data.findMany({
            where: { cycle_month: Number(month), cycle_year: Number(year) }
        });
        
        const adj = adjustments.find(a => a.emp_id === emp_id);
        
        const adjCommissions = adj?.commissions ? Number(adj.commissions) : 0;
        const commissions = adjCommissions !== 0 ? adjCommissions : calculatedCommissions;
        
        return NextResponse.json({
            emp_id,
            commissionClaimsCount: commissionClaims.length,
            empCommissionClaimsAsMain,
            empCommissionClaimsAsCompanion,
            calculatedCommissions,
            adj,
            adjCommissions,
            finalCommissions: commissions,
            startDate,
            endDate
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
