import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const availableAssets = await prisma.assets.findMany({
            where: { status: "available" },
            orderBy: { name: "asc" }
        });
        return NextResponse.json(availableAssets);
    } catch (e: any) {
        console.error("[API/assets/available] GET Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
