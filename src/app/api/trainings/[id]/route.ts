import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token provided" }, { status: 401 });

        const decoded = verifyToken(token);
        if (!decoded || !decoded.emp_id) {
            return NextResponse.json({ error: "Invalid token data" }, { status: 401 });
        }

        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (isNaN(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        // Verify ownership
        const existingTraining = await prisma.employee_trainings.findUnique({
            where: { id }
        });

        if (!existingTraining) {
            return NextResponse.json({ error: "Training record not found" }, { status: 404 });
        }

        if (existingTraining.emp_id !== decoded.emp_id) {
            return NextResponse.json({ error: "Forbidden: You do not have permission to modify this record" }, { status: 403 });
        }

        const body = await request.json();
        
        // Whitelist allowed fields for employee update
        const { course_name, training_date_start, training_evaluation_result } = body;

        const updatedTraining = await prisma.employee_trainings.update({
            where: { id },
            data: {
                course_name: course_name !== undefined ? course_name : undefined,
                training_date_start: training_date_start ? new Date(training_date_start) : null,
                training_evaluation_result: training_evaluation_result !== undefined ? training_evaluation_result : undefined,
                updated_at: new Date()
            }
        });

        return NextResponse.json({ ok: true, data: updatedTraining });
    } catch (error) {
        console.error("Error updating employee training:", error);
        return NextResponse.json({ ok: false, error: 'Failed to update training' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token provided" }, { status: 401 });

        const decoded = verifyToken(token);
        if (!decoded || !decoded.emp_id) {
            return NextResponse.json({ error: "Invalid token data" }, { status: 401 });
        }

        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (isNaN(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        // Verify ownership
        const existingTraining = await prisma.employee_trainings.findUnique({
            where: { id }
        });

        if (!existingTraining) {
            return NextResponse.json({ error: "Training record not found" }, { status: 404 });
        }

        if (existingTraining.emp_id !== decoded.emp_id) {
            return NextResponse.json({ error: "Forbidden: You do not have permission to delete this record" }, { status: 403 });
        }

        await prisma.employee_trainings.delete({
            where: { id }
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error deleting employee training:", error);
        return NextResponse.json({ ok: false, error: 'Failed to delete training' }, { status: 500 });
    }
}
