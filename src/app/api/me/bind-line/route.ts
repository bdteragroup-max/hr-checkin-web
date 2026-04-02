import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    let p;
    try {
        p = verifyToken(token) as { emp_id: string; role: string };
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const line_user_id = String(body.line_user_id || "").trim();

    if (!line_user_id) {
        return NextResponse.json({ error: "MISSING_LINE_ID" }, { status: 400 });
    }

    // Check if another employee already bound this line ID
    const existingBinding = await prisma.employees.findFirst({
        where: {
            line_user_id,
            NOT: { emp_id: p.emp_id },
        },
    });

    if (existingBinding) {
        return NextResponse.json({ error: "LINE_ID_ALREADY_BOUND_TO_OTHER_EMPLOYEE" }, { status: 409 });
    }

    try {
        await prisma.employees.update({
            where: { emp_id: p.emp_id },
            data: { line_user_id },
        });
        return NextResponse.json({ ok: true, line_user_id });
    } catch (e: any) {
        console.error("Bind LINE error:", e);
        return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    let p;
    try {
        p = verifyToken(token) as { emp_id: string; role: string };
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        await prisma.employees.update({
            where: { emp_id: p.emp_id },
            data: { line_user_id: null },
        });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("Unbind LINE error:", e);
        return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }
}
