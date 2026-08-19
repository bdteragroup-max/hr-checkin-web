import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (isNaN(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

        const body = await req.json();
        const dataToUpdate: any = {};

        if (body.topic_name !== undefined) {
            if (!body.topic_name.trim()) {
                return NextResponse.json({ ok: false, error: 'Topic name cannot be empty' }, { status: 400 });
            }
            const normalizedTopicName = body.topic_name.trim();
            
            // Check for duplicates
            const existing = await prisma.training_topics.findFirst({
                where: {
                    topic_name: {
                        equals: normalizedTopicName,
                        mode: 'insensitive'
                    },
                    id: { not: id }
                }
            });

            if (existing) {
                return NextResponse.json({ ok: false, error: 'Topic already exists' }, { status: 400 });
            }
            dataToUpdate.topic_name = normalizedTopicName;
        }

        if (body.is_active !== undefined) {
            dataToUpdate.is_active = body.is_active;
        }

        if (body.course_name !== undefined) {
            dataToUpdate.course_name = body.course_name ? body.course_name.trim() : null;
        }

        if (body.institution_name !== undefined) {
            dataToUpdate.institution_name = body.institution_name ? body.institution_name.trim() : null;
        }

        const updatedTopic = await prisma.training_topics.update({
            where: { id },
            data: dataToUpdate
        });

        return NextResponse.json({ ok: true, data: updatedTopic });
    } catch (error) {
        console.error("Error updating training topic:", error);
        return NextResponse.json({ ok: false, error: 'Failed to update topic' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (isNaN(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

        // Soft delete
        const deletedTopic = await prisma.training_topics.update({
            where: { id },
            data: { is_active: false }
        });

        return NextResponse.json({ ok: true, data: deletedTopic });
    } catch (error) {
        console.error("Error deleting training topic:", error);
        return NextResponse.json({ ok: false, error: 'Failed to delete topic' }, { status: 500 });
    }
}
