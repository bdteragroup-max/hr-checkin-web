import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token provided" }, { status: 401 });

        const decoded = verifyToken(token);
        if (!decoded || !decoded.emp_id) {
            return NextResponse.json({ error: "Invalid token data" }, { status: 401 });
        }

        const trainings = await prisma.employee_trainings.findMany({
            where: { emp_id: decoded.emp_id },
            orderBy: { created_at: 'desc' }
        });

        return NextResponse.json({ ok: true, data: trainings });
    } catch (error) {
        console.error("Error fetching employee trainings:", error);
        return NextResponse.json({ ok: false, error: 'Failed to fetch trainings' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token provided" }, { status: 401 });

        const decoded = verifyToken(token);
        if (!decoded || !decoded.emp_id) {
            return NextResponse.json({ error: "Invalid token data" }, { status: 401 });
        }

        const body = await request.json();
        
        // Whitelist allowed fields for employee creation
        const { course_name, institution_name, training_date_start, completion_percentage, training_evaluation_result } = body;

        if (!course_name) {
            return NextResponse.json({ error: "Training topic is required" }, { status: 400 });
        }

        const newTraining = await prisma.employee_trainings.create({
            data: {
                emp_id: decoded.emp_id,
                course_name: course_name,
                institution_name: institution_name || null,
                training_date_start: training_date_start ? new Date(training_date_start) : null,
                completion_percentage: completion_percentage ? parseFloat(completion_percentage) : null,
                training_evaluation_result: training_evaluation_result || null,
            }
        });

        return NextResponse.json({ ok: true, data: newTraining });
    } catch (error) {
        console.error("Error creating employee training:", error);
        return NextResponse.json({ ok: false, error: 'Failed to create training' }, { status: 500 });
    }
}
