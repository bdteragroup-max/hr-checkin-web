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

    try {
        // Fetch all vehicle assets
        const vehicleAssets = await prisma.assets.findMany({
            where: {
                OR: [
                    { category: "Car" },
                    { vehicle_type: { not: null } }
                ]
            },
            select: { id: true, asset_id: true, name: true, status: true, brand: true, vehicle_model: true }
        });

        const vehicleIds = vehicleAssets.map(a => a.id);

        // Date filter for borrowings
        const dateFilter: any = {
            asset_id: { in: vehicleIds }
        };

        if (start || end) {
            dateFilter.borrow_date = {};
            if (start) dateFilter.borrow_date.gte = new Date(`${start}T00:00:00+07:00`);
            if (end) dateFilter.borrow_date.lte = new Date(`${end}T23:59:59+07:00`);
        } else {
            // Default 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            dateFilter.borrow_date = { gte: thirtyDaysAgo };
        }

        const allBorrowings = await prisma.asset_borrowings.findMany({
            where: dateFilter,
            include: {
                employee: { select: { name: true } },
                assets: { select: { name: true, asset_id: true } }
            },
            orderBy: { borrow_date: "desc" }
        });

        // KPI 1: Status Distribution
        const statusDistribution = {
            available: vehicleAssets.filter(a => a.status === "available").length,
            borrowed: vehicleAssets.filter(a => a.status === "borrowed").length,
            damaged: vehicleAssets.filter(a => a.status === "damaged").length,
            maintenance: vehicleAssets.filter(a => a.status === "maintenance").length,
            total: vehicleAssets.length
        };

        // KPI 2: Frequency per Vehicle
        const vehicleUsage: Record<string, { count: number, name: string, id: string }> = {};
        allBorrowings.forEach(b => {
            const key = b.asset_id.toString();
            if (!vehicleUsage[key]) {
                vehicleUsage[key] = { count: 0, name: b.assets.name, id: b.assets.asset_id };
            }
            vehicleUsage[key].count++;
        });
        const topVehicles = Object.values(vehicleUsage).sort((a, b) => b.count - a.count);

        // KPI 3: Frequency per Employee
        const employeeUsage: Record<string, { count: number, name: string }> = {};
        allBorrowings.forEach(b => {
            const key = b.emp_id;
            if (!employeeUsage[key]) {
                employeeUsage[key] = { count: 0, name: b.employee.name };
            }
            employeeUsage[key].count++;
        });
        const topEmployees = Object.values(employeeUsage).sort((a, b) => b.count - a.count);

        // KPI 4: Daily Counts
        const dailyCounts: Record<string, number> = {};
        allBorrowings.forEach(b => {
            const dateKey = new Date(b.borrow_date).toISOString().split("T")[0];
            dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
        });
        const borrowingsPerDay = Object.entries(dailyCounts)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({
            ok: true,
            stats: {
                statusDistribution,
                topVehicles,
                topEmployees,
                borrowingsPerDay,
                recentBorrowings: allBorrowings.slice(0, 100) // Increase to 100
            }
        });

    } catch (error: any) {
        console.error("[VEHICLE REPORT API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await requireAdmin();
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "UNAUTHORIZED" }, { status: e.message === "FORBIDDEN" ? 403 : 401 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
        return NextResponse.json({ error: "START_AND_END_DATE_REQUIRED" }, { status: 400 });
    }

    try {
        // Fetch vehicle IDs to ensure we only delete vehicle records
        const vehicleAssets = await prisma.assets.findMany({
            where: {
                OR: [
                    { category: "Car" },
                    { vehicle_type: { not: null } }
                ]
            },
            select: { id: true }
        });
        const vehicleIds = vehicleAssets.map(a => a.id);

        const deleteResult = await prisma.asset_borrowings.deleteMany({
            where: {
                asset_id: { in: vehicleIds },
                borrow_date: {
                    gte: new Date(`${start}T00:00:00+07:00`),
                    lte: new Date(`${end}T23:59:59+07:00`)
                }
            }
        });

        return NextResponse.json({ ok: true, deletedCount: deleteResult.count });
    } catch (error: any) {
        console.error("[VEHICLE REPORT API DELETE] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
