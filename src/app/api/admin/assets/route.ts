import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const assets = await prisma.assets.findMany({
            include: {
                asset_borrowings: {
                    where: { status: "borrowed" },
                    include: {
                        employee: { select: { name: true } }
                    }
                }
            },
            orderBy: { name: "asc" }
        });
        return NextResponse.json(assets);
    } catch (e: any) {
        console.error("[API/admin/assets] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { asset_id, name, category, description } = body;

        if (!asset_id || !name) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        // Check for duplicate asset_id
        const existing = await prisma.assets.findUnique({
            where: { asset_id }
        });

        if (existing) {
            return NextResponse.json({ error: "ASSET_ID_ALREADY_EXISTS" }, { status: 400 });
        }

        const newAsset = await prisma.assets.create({
            data: {
                asset_id,
                name,
                category: category || null,
                description: description || null,
                status: "available"
            }
        });

        return NextResponse.json({ ok: true, data: newAsset });
    } catch (e: any) {
        console.error("[API/admin/assets] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
