import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        await requireAdmin();
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "UNAUTHORIZED" }, { status: e.message === "FORBIDDEN" ? 403 : 401 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start"); // YYYY-MM-DD
    const end = searchParams.get("end");     // YYYY-MM-DD
    const type = searchParams.get("type") || "item";
    const isEquipment = type === "equipment";

    try {
        let items: any[] = [];
        if (isEquipment) {
            items = await prisma.$queryRaw`
                SELECT id, asset_id as code, name, status FROM assets WHERE category IS NULL OR category != 'Car'
            `;
        } else {
            items = await prisma.$queryRaw`
                SELECT id, product_code as code, product_name as name, status, stock FROM products
            `;
        }

        const itemIds = items.map(p => p.id);

        // Date filter for borrowings
        const dateFilter: any = {};
        if (isEquipment) {
            dateFilter.asset_id = { in: itemIds };
        } else {
            dateFilter.product_id = { in: itemIds };
        }

        if (start || end) {
            dateFilter.borrow_date = {};
            if (start) dateFilter.borrow_date.gte = new Date(`${start}T00:00:00+07:00`);
            if (end) dateFilter.borrow_date.lte = new Date(`${end}T23:59:59+07:00`);
        } else {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            dateFilter.borrow_date = { gte: thirtyDaysAgo };
        }

        let allBorrowings: any[] = [];
        if (isEquipment) {
            allBorrowings = await prisma.asset_borrowings.findMany({
                where: dateFilter,
                include: {
                    employee: { select: { name: true, nickname: true } },
                    assets: { select: { name: true, asset_id: true } }
                },
                orderBy: { borrow_date: "desc" }
            });
        } else {
            allBorrowings = await prisma.product_borrowings.findMany({
                where: dateFilter,
                include: {
                    employee: { select: { name: true, nickname: true } },
                    product: { select: { product_name: true, product_code: true } }
                },
                orderBy: { borrow_date: "desc" }
            });
        }

        // KPI 1: Status Distribution
        let totalBorrowed = 0;
        let totalStock = 0;

        if (isEquipment) {
            totalBorrowed = items.filter(i => i.status === "borrowed").length;
            totalStock = items.length;
        } else {
            const activeBorrowings = await prisma.product_borrowings.findMany({
                where: { status: { in: ["borrowed", "reserved"] } }
            });
            totalBorrowed = activeBorrowings.reduce((sum, b) => sum + ((b as any).quantity || 1), 0);
            totalStock = items.reduce((sum, p) => sum + (Number(p.stock) || 50), 0);
        }

        const statusDistribution = {
            available: totalStock - totalBorrowed,
            borrowed: totalBorrowed,
            damaged: items.filter(p => p.status === "damaged").length,
            maintenance: items.filter(p => p.status === "maintenance").length,
            total: totalStock
        };

        // KPI 2: Frequency per Product
        const usage: Record<string, { count: number, name: string, code: string }> = {};
        allBorrowings.forEach(b => {
            const itemObj = isEquipment ? b.assets : b.product;
            const itemId = isEquipment ? b.asset_id : b.product_id;
            const key = itemId.toString();
            if (!usage[key]) {
                usage[key] = { 
                    count: 0, 
                    name: isEquipment ? itemObj.name : itemObj.product_name, 
                    code: isEquipment ? itemObj.asset_id : itemObj.product_code 
                };
            }
            usage[key].count += ((b as any).quantity || 1);
        });
        const topProducts = Object.values(usage).sort((a, b) => b.count - a.count).slice(0, 5);

        // KPI 3: Frequency per Employee
        const employeeUsage: Record<string, { count: number, name: string }> = {};
        allBorrowings.forEach(b => {
            const key = b.emp_id;
            const empName = b.employee.nickname ? `${b.employee.name} (${b.employee.nickname})` : b.employee.name;
            if (!employeeUsage[key]) {
                employeeUsage[key] = { count: 0, name: empName };
            }
            employeeUsage[key].count += ((b as any).quantity || 1);
        });
        const topEmployees = Object.values(employeeUsage).sort((a, b) => b.count - a.count).slice(0, 5);

        // KPI 4: Daily Counts
        const dailyCounts: Record<string, number> = {};
        allBorrowings.forEach(b => {
            const dateKey = new Date(b.borrow_date).toISOString().split("T")[0];
            dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + ((b as any).quantity || 1);
        });
        
        const chartData = [];
        const startChart = new Date(start || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
        const endChart = new Date(end || new Date().toISOString().split('T')[0]);
        
        for (let d = new Date(startChart); d <= endChart; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            chartData.push({
                date: dateStr,
                count: dailyCounts[dateStr] || 0
            });
        }

        return NextResponse.json({
            ok: true,
            stats: {
                statusDistribution,
                topProducts,
                topEmployees,
                borrowingsPerDay: chartData,
                recentBorrowings: allBorrowings.slice(0, 10)
            }
        });
    } catch (e: any) {
        console.error("[API/admin/reports/products] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
