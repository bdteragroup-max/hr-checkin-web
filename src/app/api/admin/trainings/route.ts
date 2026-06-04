import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const trainings = await prisma.employee_trainings.findMany({
            include: {
                employee: {
                    select: { name: true, job_positions: { select: { title: true } }, departments: { select: { name: true } } }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        // Calculate KPI: % of active employees who have received training
        const activeEmployeesCount = await prisma.employees.count({
            where: { is_active: true }
        });

        const distinctTrainedEmployees = await prisma.employee_trainings.groupBy({
            by: ['emp_id'],
            _count: { emp_id: true }
        });
        
        const trainedCount = distinctTrainedEmployees.length;
        const trainingPercentage = activeEmployeesCount > 0 ? ((trainedCount / activeEmployeesCount) * 100).toFixed(2) : 0;

        return NextResponse.json({
            ok: true,
            data: trainings,
            kpi: {
                totalEmployees: activeEmployeesCount,
                trainedEmployees: trainedCount,
                percentage: parseFloat(trainingPercentage.toString())
            }
        });
    } catch (error) {
        console.error("Error fetching trainings:", error);
        return NextResponse.json({ ok: false, error: 'Failed to fetch trainings' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        const newTraining = await prisma.employee_trainings.create({
            data: {
                emp_id: body.emp_id,
                course_name: body.course_name,
                institution_name: body.institution_name,
                training_date_start: body.training_date_start ? new Date(body.training_date_start) : null,
                training_date_end: body.training_date_end ? new Date(body.training_date_end) : null,
                completion_percentage: body.completion_percentage ? parseFloat(body.completion_percentage) : null,
                effectiveness_result: body.effectiveness_result,
                certificate_file_url: body.certificate_file_url,
                assessor_id: body.assessor_id || null,
            }
        });

        return NextResponse.json({ ok: true, data: newTraining });
    } catch (error) {
        console.error("Error creating training:", error);
        return NextResponse.json({ ok: false, error: 'Failed to create training' }, { status: 500 });
    }
}
