import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
        let settings = await (prisma as any).company_settings.findMany({
            orderBy: { id: 'asc' }
        });
        
        if (!settings || settings.length === 0) {
            settings = [{
                id: 0,
                tax_id: "0105555123456",
                name: "บริษัท เทอรา กรุ๊ป จำกัด",
                address: "-",
                branch_no: "00000"
            }];
        }
        
        return NextResponse.json({ ok: true, list: settings });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json();
        
        if (body.id) {
            const settings = await (prisma as any).company_settings.update({
                where: { id: body.id },
                data: {
                    tax_id: body.tax_id,
                    name: body.name,
                    address: body.address,
                    branch_no: body.branch_no
                }
            });
            return NextResponse.json({ ok: true, data: settings });
        } else {
            const settings = await (prisma as any).company_settings.create({
                data: {
                    tax_id: body.tax_id || "",
                    name: body.name || "",
                    address: body.address || "",
                    branch_no: body.branch_no || ""
                }
            });
            return NextResponse.json({ ok: true, data: settings });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json();
        if (body.id) {
            await (prisma as any).company_settings.delete({ where: { id: body.id } });
        }
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
