import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        const body = await req.json();

        const updatedTraining = await prisma.employee_trainings.update({
            where: { id },
            data: {
                course_name: body.course_name,
                institution_name: body.institution_name,
                training_date_start: body.training_date_start ? new Date(body.training_date_start) : null,
                training_date_end: body.training_date_end ? new Date(body.training_date_end) : null,
                completion_percentage: body.completion_percentage ? parseFloat(body.completion_percentage) : null,
                effectiveness_result: body.effectiveness_result,
                certificate_file_url: body.certificate_file_url,
                training_evaluation_result: body.training_evaluation_result,
                instructor_evaluation_result: body.instructor_evaluation_result,
                training_fee: body.training_fee ? parseFloat(body.training_fee) : null,
                certificate_expiry_date: body.certificate_expiry_date ? new Date(body.certificate_expiry_date) : null,
                requires_refresher: body.requires_refresher === true || body.requires_refresher === 'true',
                refresher_date: body.refresher_date ? new Date(body.refresher_date) : null,
                assessor_id: body.assessor_id || null,
                updated_at: new Date()
            }
        });

        return NextResponse.json({ ok: true, data: updatedTraining });
    } catch (error) {
        console.error("Error updating training:", error);
        return NextResponse.json({ ok: false, error: 'Failed to update training' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        await prisma.employee_trainings.delete({
            where: { id }
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error deleting training:", error);
        return NextResponse.json({ ok: false, error: 'Failed to delete training' }, { status: 500 });
    }
}
