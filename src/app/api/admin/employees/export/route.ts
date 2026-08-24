import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvEscape(s: any) {
    const v = (s ?? "").toString();
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const status = url.searchParams.get("status");
        const salaryType = url.searchParams.get("salary_type");
        const branch = url.searchParams.get("branch");
        const dept = url.searchParams.get("dept");

        const where: any = {};
        if (status === "active") where.is_active = true;
        else if (status === "inactive") where.is_active = false;

        if (salaryType && salaryType !== "all") where.salary_type = salaryType;
        if (branch && branch !== "all") where.branch_id = branch;
        if (dept && dept !== "all") where.department_id = Number(dept);

        const emps = await prisma.employees.findMany({
            where,
            include: {
                branches: { select: { name: true } },
                departments: { select: { name: true } },
                job_positions: { select: { title: true } }
            },
            orderBy: { emp_id: "asc" }
        });

        const lines: string[] = [];
        lines.push([
            "EMP_ID", 
            "NAME", 
            "NICKNAME",
            "DEPARTMENT", 
            "POSITION", 
            "BRANCH", 
            "SALARY_TYPE", 
            "BASE_SALARY",
            "STATUS",
            "HIRE_DATE",
            "RESIGNATION_DATE"
        ].map(csvEscape).join(","));

        for (const e of emps) {
            lines.push([
                e.emp_id,
                e.name,
                e.nickname || "",
                e.departments?.name || "",
                e.job_positions?.title || "",
                e.branches?.name || "",
                e.salary_type || "",
                e.base_salary ? Number(e.base_salary) : 0,
                e.is_active ? "Active" : "Inactive",
                e.hire_date ? e.hire_date.toISOString().split("T")[0] : "",
                e.resignation_date ? e.resignation_date.toISOString().split("T")[0] : ""
            ].map(csvEscape).join(","));
        }

        const csv = lines.join("\n");
        const bom = "\uFEFF"; // UTF-8 BOM for Excel

        return new Response(bom + csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="employee_list_${new Date().toISOString().split("T")[0]}.csv"`,
            },
        });

    } catch (e: any) {
        console.error("Export error:", e);
        return NextResponse.json({ ok: false, error: e.message || "ERROR" }, { status: 500 });
    }
}
