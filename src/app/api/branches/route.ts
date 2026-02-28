import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const branches = await prisma.branches.findMany({
        select: {
            id: true,
            name: true,
            center_lat: true,
            center_lon: true,
            radius_m: true,
        },
        orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, branches });
}
