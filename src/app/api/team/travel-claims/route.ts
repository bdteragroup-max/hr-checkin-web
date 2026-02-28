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
            where: { supervisor_id: user.emp_id },
            include: { employee: true },
            orderBy: { created_at: "desc" }
        });
        return NextResponse.json({ ok: true, list: claims });
    } catch (e: any) {
        console.error("Team travel claims GET error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const { id, status, remark } = body;

        if (!id || !status) {
            return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
        }

        // status should be 'pending_admin' (on supervisor approval) or 'rejected'
        const updateStatus = status === "approved" ? "pending_admin" : "rejected";

        const claim = await prisma.travel_claims.update({
            where: { id, supervisor_id: user.emp_id },
            data: {
                status: updateStatus,
                supervisor_remark: remark,
                supervisor_approved_at: new Date()
            }
        });

        return NextResponse.json({ ok: true, data: claim });
    } catch (e: any) {
        console.error("Team travel claims POST error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
