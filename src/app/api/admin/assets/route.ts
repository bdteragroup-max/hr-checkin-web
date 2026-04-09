import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const categoryExclude = searchParams.get("category_exclude");

        const whereClause: any = {};
        if (category) {
            whereClause.category = category;
        } else if (categoryExclude) {
            whereClause.category = { not: categoryExclude };
        }

        const assets = await prisma.assets.findMany({
            where: whereClause,
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
        const { 
            asset_id, name, category, description,
            company_owner, vehicle_type, brand, vehicle_model, main_user, usage_remark 
        } = body;

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

        const isVehicle = !!(company_owner || vehicle_type || brand || vehicle_model || main_user);
        const finalCategory = isVehicle ? 'Car' : (category || null);

        const newAsset = await prisma.assets.create({
            data: {
                asset_id,
                name,
                category: finalCategory,
                description: description || null,
                company_owner: company_owner || null,
                vehicle_type: vehicle_type || null,
                brand: brand || null,
                vehicle_model: vehicle_model || null,
                main_user: main_user || null,
                usage_remark: usage_remark || null,
                status: "available"
            }
        });

        return NextResponse.json({ ok: true, data: newAsset });
    } catch (e: any) {
        console.error("[API/admin/assets] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
