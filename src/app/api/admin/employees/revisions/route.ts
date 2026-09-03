import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor } from "@/lib/adminAuth";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    try {
        await requireAdminOrSupervisor();

        // 1. Check existing audit logs for employees
        let logs = await prisma.auditLog.findMany({
            where: { resource: "employees" },
            orderBy: { timestamp: "desc" },
            take: 30
        });

        // 2. If AuditLog has no records yet, seed recent edits from employees table
        if (logs.length === 0) {
            const recentEmployees = await prisma.employees.findMany({
                orderBy: { updated_at: "desc" },
                take: 15,
                select: {
                    emp_id: true,
                    name: true,
                    created_at: true,
                    updated_at: true
                }
            });

            const seedEntries = [];
            for (const emp of recentEmployees) {
                const isCreated = Math.abs((emp.updated_at?.getTime() || 0) - (emp.created_at?.getTime() || 0)) < 2000;
                seedEntries.push({
                    id: crypto.randomUUID(),
                    userId: "admin",
                    action: isCreated ? "CREATE_EMPLOYEE" : "UPDATE_EMPLOYEE_BASIC",
                    resource: "employees",
                    resourceId: emp.emp_id,
                    details: JSON.stringify({
                        targetName: emp.name,
                        summary: isCreated ? "สร้างข้อมูลพนักงานใหม่" : "แก้ไขข้อมูลพนักงาน"
                    }),
                    timestamp: emp.updated_at || emp.created_at || new Date()
                });
            }

            if (seedEntries.length > 0) {
                await prisma.auditLog.createMany({
                    data: seedEntries
                }).catch(console.error);

                logs = await prisma.auditLog.findMany({
                    where: { resource: "employees" },
                    orderBy: { timestamp: "desc" },
                    take: 30
                });
            }
        }

        // 3. Resolve employee and editor names
        const empIds = new Set<string>();
        for (const log of logs) {
            if (log.resourceId) empIds.add(log.resourceId);
            if (log.userId && log.userId !== "admin") empIds.add(log.userId);
        }

        const employees = await prisma.employees.findMany({
            where: { emp_id: { in: Array.from(empIds) } },
            select: { emp_id: true, name: true, nickname: true }
        });
        const empMap = new Map(employees.map(e => [e.emp_id, e.nickname ? `${e.name} (${e.nickname})` : e.name]));

        const list = logs.map(log => {
            let detailsObj: any = {};
            try {
                if (log.details) detailsObj = JSON.parse(log.details);
            } catch {
                detailsObj = { summary: log.details };
            }

            const targetName = empMap.get(log.resourceId || "") || detailsObj.targetName || log.resourceId || "-";
            const editorName = empMap.get(log.userId) || (log.userId === "admin" ? "ผู้ดูแลระบบ (Admin)" : log.userId);

            let note = detailsObj.summary;
            if (!note) {
                if (log.action === "CREATE_EMPLOYEE") note = "สร้างข้อมูลพนักงานใหม่";
                else if (log.action === "UPDATE_EMPLOYEE_BASIC") note = "แก้ไขข้อมูลทั่วไปพนักงาน";
                else if (log.action === "UPDATE_EMPLOYEE_SALARY") note = "แก้ไขข้อมูลเงินเดือนและสวัสดิการ";
                else if (log.action === "UPDATE_EMPLOYEE_ONBOARDING") note = "แก้ไขการตั้งค่าระบบและผู้ประเมิน";
                else note = "แก้ไขข้อมูลพนักงาน";
            }

            return {
                id: log.id,
                target_id: log.resourceId,
                target_name: targetName,
                edited_by: editorName,
                timestamp: log.timestamp.toISOString(),
                action: log.action,
                notes: note
            };
        });

        return NextResponse.json({ ok: true, list });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}
