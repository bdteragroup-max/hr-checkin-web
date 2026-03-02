import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function getAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch (e) {
        return null;
    }
}

export async function GET() {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const claims = await prisma.travel_claims.findMany({
            where: { emp_id: user.emp_id },
            orderBy: { date: "desc" }
        });
        return NextResponse.json({ ok: true, list: claims });
    } catch (e) {
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const {
            date,
            end_date,
            claim_type,
            site_name,
            is_overnight,
            accommodation_amount,
            accommodation_receipt_url,
            report_url,
            has_pre_approval,
            is_supervisor_shared
        } = body;

        // Validation
        if (!date || !claim_type || !site_name || !report_url) {
            return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
        }

        // Rule: Overnight stays require a receipt
        if (is_overnight && !accommodation_receipt_url && Number(accommodation_amount) > 0) {
            return NextResponse.json({ ok: false, error: "Accommodation receipt is required for overnight stays" }, { status: 400 });
        }

        // Rule: Accommodation limit is 600 unless shared with supervisor or pre-approved
        const amount = Number(accommodation_amount) || 0;
        if (is_overnight && amount > 600 && !is_supervisor_shared && !has_pre_approval) {
            return NextResponse.json({ ok: false, error: "Accommodation amount cannot exceed 600 THB unless shared with supervisor or pre-approved" }, { status: 400 });
        }

        // Get employee's current supervisor
        const emp = await prisma.employees.findUnique({
            where: { emp_id: user.emp_id },
            select: { supervisor_id: true }
        });

        const claim = await prisma.travel_claims.create({
            data: {
                emp_id: user.emp_id,
                date: new Date(date),
                end_date: end_date ? new Date(end_date) : new Date(date),
                claim_type,
                site_name,
                is_overnight: !!is_overnight,
                accommodation_amount: Number(accommodation_amount) || 0,
                accommodation_receipt_url,
                report_url,
                has_pre_approval: !!has_pre_approval,
                is_supervisor_shared: !!is_supervisor_shared,
                status: "pending_supervisor",
                supervisor_id: emp?.supervisor_id
            } as any
        });

        return NextResponse.json({ ok: true, data: claim });
    } catch (e: any) {
        console.error("Travel claim error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
