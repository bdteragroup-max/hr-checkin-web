import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const branches = await prisma.branches.count();
    const employees = await prisma.employees.count();
    return NextResponse.json({ ok: true, branches, employees });
}
