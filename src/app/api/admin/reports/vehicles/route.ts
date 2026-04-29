import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    // 1. Auth check - Admins use admin_token
    const token = (await cookies()).get("admin_token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const decoded = verifyToken(token) as { role: string };
        if (decoded.role !== "admin") {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }
    } catch (e) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        // Fetch all vehicle-related data
        const [allAssets, allBorrowings] = await Promise.all([
            prisma.assets.findMany({
                where: { 
                    OR: [
                        { category: "Car" },
                        { vehicle_type: { not: null } }
                    ]
                },
                select: { 
                    id: true, 
                    asset_id: true, 
                    name: true, 
                    status: true,
                    brand: true,
                    vehicle_model: true,
                    company_owner: true
                }
            }),
            prisma.asset_borrowings.findMany({
                include: {
                    employee: { select: { name: true } },
                    assets: { select: { name: true, asset_id: true } }
                },
                orderBy: { borrow_date: "desc" }
            })
        ]);

        // KPI 1: Status Distribution
        const statusDistribution = {
            available: allAssets.filter(a => a.status === "available").length,
            borrowed: allAssets.filter(a => a.status === "borrowed").length,
            damaged: allAssets.filter(a => a.status === "damaged").length,
            maintenance: allAssets.filter(a => a.status === "maintenance").length,
            total: allAssets.length
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

        // KPI 4: Borrowings per Day (Last 30 days)
        const dailyCounts: Record<string, number> = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        allBorrowings.forEach(b => {
            const d = new Date(b.borrow_date);
            if (d >= thirtyDaysAgo) {
                const dateKey = d.toISOString().split("T")[0];
                dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
            }
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
                recentBorrowings: allBorrowings.slice(0, 50) // Last 50 for the table
            }
        });

    } catch (error: any) {
        console.error("[VEHICLE REPORT API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
