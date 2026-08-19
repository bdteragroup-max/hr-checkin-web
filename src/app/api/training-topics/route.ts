import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Return only active topics for employees
        const topics = await prisma.training_topics.findMany({
            where: { is_active: true },
            orderBy: { topic_name: 'asc' }
        });
        return NextResponse.json({ ok: true, data: topics });
    } catch (error) {
        console.error("Error fetching training topics:", error);
        return NextResponse.json({ ok: false, error: 'Failed to fetch topics' }, { status: 500 });
    }
}
