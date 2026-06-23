import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const taskId = parseInt(id, 10);
        
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;

        // Check if task exists and belongs to this supervisor
        const task = await prisma.tasks.findUnique({
            where: { id: taskId },
            include: { assignments: true }
        });

        if (!task) return NextResponse.json({ error: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        if (task.created_by !== supervisorId) return NextResponse.json({ error: "FORBIDDEN", message: "Not your task" }, { status: 403 });

        // Check if any assignment is already COMPLETED
        const hasCompleted = task.assignments.some(a => a.status === 'COMPLETED');
        if (hasCompleted) {
            return NextResponse.json({ error: "BAD_REQUEST", message: "ไม่สามารถลบงานนี้ได้เนื่องจากมีพนักงานทำสำเร็จแล้ว" }, { status: 400 });
        }

        await prisma.tasks.delete({
            where: { id: taskId }
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/TASKS/DELETE] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR", message: e.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const taskId = parseInt(id, 10);
        
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const decoded = verifyToken(token);
        const supervisorId = decoded.emp_id;

        const body = await request.json();
        const { title, description, deadline, assigned_to } = body;

        if (!title || !deadline || !assigned_to || !Array.isArray(assigned_to) || assigned_to.length === 0) {
            return NextResponse.json({ error: "BAD_REQUEST", message: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
        }

        // Check task
        const task = await prisma.tasks.findUnique({
            where: { id: taskId },
            include: { assignments: true }
        });

        if (!task) return NextResponse.json({ error: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        if (task.created_by !== supervisorId) return NextResponse.json({ error: "FORBIDDEN", message: "Not your task" }, { status: 403 });

        const currentAssignees = task.assignments.map(a => a.emp_id);
        const newAssignees = assigned_to;

        // Verify we are not removing anyone who is already COMPLETED
        for (const a of task.assignments) {
            if (a.status === 'COMPLETED' && !newAssignees.includes(a.emp_id)) {
                return NextResponse.json({ error: "BAD_REQUEST", message: `ไม่สามารถนำพนักงาน (${a.emp_id}) ออกจากงานได้เนื่องจากพนักงานทำสำเร็จแล้ว` }, { status: 400 });
            }
        }

        // Perform updates in a transaction
        await prisma.$transaction(async (tx) => {
            // Update task details
            await tx.tasks.update({
                where: { id: taskId },
                data: {
                    title,
                    description,
                    deadline: new Date(deadline)
                }
            });

            // Handle assignments
            const toAdd = newAssignees.filter(empId => !currentAssignees.includes(empId));
            const toRemove = currentAssignees.filter(empId => !newAssignees.includes(empId));

            if (toRemove.length > 0) {
                await tx.task_assignments.deleteMany({
                    where: {
                        task_id: taskId,
                        emp_id: { in: toRemove }
                    }
                });
            }

            if (toAdd.length > 0) {
                await tx.task_assignments.createMany({
                    data: toAdd.map(empId => ({
                        task_id: taskId,
                        emp_id: empId,
                        status: 'PENDING'
                    }))
                });
            }
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/TASKS/PUT] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR", message: e.message }, { status: 500 });
    }
}
