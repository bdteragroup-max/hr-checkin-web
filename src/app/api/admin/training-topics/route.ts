import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const topics = await prisma.training_topics.findMany({
            orderBy: { topic_name: 'asc' }
        });
        return NextResponse.json({ ok: true, data: topics });
    } catch (error) {
        console.error("Error fetching training topics:", error);
        return NextResponse.json({ ok: false, error: 'Failed to fetch topics' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        if (!body.topic_name || !body.topic_name.trim()) {
            return NextResponse.json({ ok: false, error: 'Topic name is required' }, { status: 400 });
        }

        const normalizedTopicName = body.topic_name.trim();

        // Check for duplicates (case-insensitive)
        const existing = await prisma.training_topics.findFirst({
            where: {
                topic_name: {
                    equals: normalizedTopicName,
                    mode: 'insensitive'
                }
            }
        });

        if (existing) {
            return NextResponse.json({ ok: false, error: 'Topic already exists' }, { status: 400 });
        }

        const newTopic = await prisma.training_topics.create({
            data: {
                topic_name: normalizedTopicName,
                course_name: body.course_name ? body.course_name.trim() : null,
                institution_name: body.institution_name ? body.institution_name.trim() : null,
                is_active: body.is_active !== undefined ? body.is_active : true
            }
        });

        return NextResponse.json({ ok: true, data: newTopic });
    } catch (error) {
        console.error("Error creating training topic:", error);
        return NextResponse.json({ ok: false, error: 'Failed to create topic' }, { status: 500 });
    }
}
