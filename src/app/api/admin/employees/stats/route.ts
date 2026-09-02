import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor, getSubordinateFilter } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrSupervisor();

        // 1) Filter for subordinates if not a full admin
        const subordinateFilter = getSubordinateFilter(auth);

        // We only want active employees for stats
        const activeFilter = { is_active: true, ...subordinateFilter };

        // Fetch Branches for mapping
        const branches = await prisma.branches.findMany({ select: { id: true, name: true } });
        const branchMap = new Map(branches.map((b: { id: string; name: string }) => [b.id, b.name]));

        // Transaction for all counts
        const [
            totalCount,
            incompleteCount,
            genderGroups,
            salaryTypeGroups,
            branchGroups,
            nationalityGroups
        ] = await prisma.$transaction([
            prisma.employees.count({ where: activeFilter }),
            prisma.employees.count({ where: { ...subordinateFilter, is_active: true, is_onboarding_complete: false } }),
            prisma.employees.groupBy({
                by: ["gender"],
                where: activeFilter,
                _count: true,
                orderBy: { gender: "asc" }
            }),
            prisma.employees.groupBy({
                by: ["salary_type"],
                where: activeFilter,
                _count: true,
                orderBy: { salary_type: "asc" }
            }),
            prisma.employees.groupBy({
                by: ["branch_id"],
                where: activeFilter,
                _count: true,
                orderBy: { branch_id: "asc" }
            }),
            prisma.employees.groupBy({
                by: ["nationality"],
                where: activeFilter,
                _count: true,
                orderBy: { nationality: "asc" }
            }),
        ]);

        // Process Gender
        let male = 0;
        let female = 0;
        let other = 0;
        let genderUnspecified = 0;
        for (const g of genderGroups) {
            const count = Number(g._count) || 0;
            if (g.gender === "M") male += count;
            else if (g.gender === "F") female += count;
            else if (g.gender === "O") other += count;
            else genderUnspecified += count;
        }

        // Process Salary Type (Employee Type)
        let monthly = 0;
        let daily = 0;
        let partTime = 0;
        let contract = 0;
        for (const s of salaryTypeGroups) {
            const count = Number(s._count) || 0;
            if (s.salary_type === "monthly") monthly += count;
            else if (s.salary_type === "daily") daily += count;
            else contract += count; // Map anything else or null to contract / unspecified
        }

        // Process Branch
        const branchStats = branchGroups.map(b => ({
            branchId: b.branch_id,
            branchName: b.branch_id ? (branchMap.get(b.branch_id) || b.branch_id) : "ไม่ระบุสาขา",
            count: Number(b._count) || 0
        })).sort((a, b) => b.count - a.count);

        // Process Nationality
        let thai = 0;
        let foreign = 0;
        let unspecifiedNat = 0;
        for (const n of nationalityGroups) {
            const count = Number(n._count) || 0;
            if (n.nationality === "THA") thai += count;
            else if (!n.nationality) unspecifiedNat += count;
            else foreign += count;
        }

        const nationalityStats = {
            thai,
            foreign,
            unspecified: unspecifiedNat
        };

        return NextResponse.json({
            ok: true,
            stats: {
                totalActive: totalCount,
                incompleteOnboarding: incompleteCount,
                gender: {
                    male,
                    female,
                    other,
                    unspecified: genderUnspecified
                },
                type: {
                    monthly,
                    daily,
                    partTime,
                    contract
                },
                branchStats,
                nationality: nationalityStats
            }
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}
