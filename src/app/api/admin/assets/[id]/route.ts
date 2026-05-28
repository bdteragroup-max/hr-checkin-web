import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        const body = await req.json();
        const { 
            asset_id, name, category, description, status, stock,
            company_owner, vehicle_type, brand, vehicle_model, main_user, usage_remark 
        } = body;

        // Check if another asset uses the same asset_id
        if (asset_id) {
            const existing = await prisma.assets.findFirst({
                where: { asset_id, NOT: { id } }
            });
            if (existing) {
                return NextResponse.json({ error: "ASSET_ID_ALREADY_EXISTS" }, { status: 400 });
            }
        }

        const updated = await prisma.assets.update({
            where: { id },
            data: {
                asset_id,
                name,
                category,
                description,
                status,
                stock: stock !== undefined ? Number(stock) : undefined,
                company_owner: company_owner !== undefined ? company_owner : undefined,
                vehicle_type: vehicle_type !== undefined ? vehicle_type : undefined,
                brand: brand !== undefined ? brand : undefined,
                vehicle_model: vehicle_model !== undefined ? vehicle_model : undefined,
                main_user: main_user !== undefined ? main_user : undefined,
                usage_remark: usage_remark !== undefined ? usage_remark : undefined
            }
        });

        return NextResponse.json({ ok: true, data: updated });
    } catch (e: any) {
        console.error("[API/admin/assets/[id]] PATCH Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);

        // Safety check: Cannot delete if currently borrowed or reserved
        const asset = await prisma.assets.findUnique({
            where: { id },
            include: { asset_borrowings: { where: { status: { in: ["borrowed", "reserved"] } } } }
        });

        if (!asset) {
            return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
        }

        if (asset.asset_borrowings.length > 0) {
            return NextResponse.json({ error: "CANNOT_DELETE_BORROWED_ASSET" }, { status: 400 });
        }

        await prisma.assets.delete({
            where: { id }
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/admin/assets/[id]] DELETE Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
