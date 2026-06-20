import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { emp_id } = verifyToken(token);

        const url = new URL(req.url);
        const role = url.searchParams.get("role") || "employee"; // 'employee' or 'head'

        if (role === "head") {
            const createdTasks = await prisma.tasks.findMany({
                where: { created_by: emp_id },
                include: {
                    assignments: {
                        include: { employee: { select: { name: true, emp_id: true } } }
                    }
                },
                orderBy: { created_at: "desc" }
            });
            return NextResponse.json({ ok: true, tasks: createdTasks });
        } else {
            const assignedTasks = await prisma.task_assignments.findMany({
                where: { emp_id },
                include: {
                    task: { include: { creator: { select: { name: true, emp_id: true } } } }
                },
                orderBy: { task: { deadline: "asc" } }
            });
            return NextResponse.json({ ok: true, assignments: assignedTasks });
        }

    } catch (e: any) {
        console.error("GET Tasks Error:", e);
        return NextResponse.json({ ok: false, error: "SERVER_ERROR", details: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { emp_id } = verifyToken(token);

        const body = await req.json();
        const { title, description, deadline, assigned_to } = body;

        if (!title || !deadline || !assigned_to || !Array.isArray(assigned_to) || assigned_to.length === 0) {
            return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
        }

        // Check if user is a supervisor
        const isSupervisor = await prisma.employees.findFirst({
            where: { supervisor_id: emp_id }
        });

        if (!isSupervisor) {
            return NextResponse.json({ error: "FORBIDDEN_NOT_DEPT_HEAD" }, { status: 403 });
        }

        const task = await prisma.tasks.create({
            data: {
                title,
                description,
                created_by: emp_id,
                deadline: new Date(deadline),
                assignments: {
                    create: assigned_to.map((assigneeId: string) => ({
                        emp_id: assigneeId
                    }))
                }
            },
            include: {
                assignments: true
            }
        });

        return NextResponse.json({ ok: true, task });

    } catch (e: any) {
        console.error("POST Tasks Error:", e);
        return NextResponse.json({ ok: false, error: "SERVER_ERROR", details: e.message }, { status: 500 });
    }
}
