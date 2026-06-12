import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await prisma.clothing_items.findMany({
      where: {
        is_active: true
      },
      include: {
        variants: true
      },
      orderBy: { id: "asc" }
    });
    return NextResponse.json(items);
  } catch (error: any) {
    console.error("GET User Clothing Items Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
