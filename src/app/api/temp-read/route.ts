import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const emp = await prisma.employees.findUnique({
            where: { emp_id: "TP68012" },
            select: { emp_id: true, name: true }
        });
        return NextResponse.json({ ok: true, emp });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message });
    }
}
