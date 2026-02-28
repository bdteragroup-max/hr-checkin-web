import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);

    const emp_id = (body?.emp_id || "").trim();
    const name = (body?.name || "").trim();
    const pin = (body?.pin || "").trim();
    const branch_id = body?.branch_id ? String(body.branch_id).trim() : null;

    if (!emp_id || !name || !pin) {
        return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const pin_hash = await bcrypt.hash(pin, 10);

    const emp = await prisma.employees.upsert({
        where: { emp_id },
        update: { name, branch_id, is_active: true, pin_hash },
        create: { emp_id, name, branch_id, is_active: true, pin_hash },
        select: { emp_id: true, name: true, branch_id: true, is_active: true },
    });

    return NextResponse.json({ ok: true, employee: emp });
}
