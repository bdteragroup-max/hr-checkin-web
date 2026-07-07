import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
        const settings = await (prisma as any).company_settings.findFirst();
        if (!settings) {
            return NextResponse.json({
                tax_id: "0105555123456",
                name: "บริษัท เทอรา กรุ๊ป จำกัด",
                address: "-",
                branch_no: "00000"
            });
        }
        return NextResponse.json(settings);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json();
        
        let settings = await (prisma as any).company_settings.findFirst();
        
        if (settings) {
            settings = await (prisma as any).company_settings.update({
                where: { id: settings.id },
                data: {
                    tax_id: body.tax_id,
                    name: body.name,
                    address: body.address,
                    branch_no: body.branch_no
                }
            });
        } else {
            settings = await (prisma as any).company_settings.create({
                data: {
                    tax_id: body.tax_id || "0105555123456",
                    name: body.name || "บริษัท เทอรา กรุ๊ป จำกัด",
                    address: body.address || "-",
                    branch_no: body.branch_no || "00000"
                }
            });
        }
        
        return NextResponse.json({ ok: true, data: settings });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
