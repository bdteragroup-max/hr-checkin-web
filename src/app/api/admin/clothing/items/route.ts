import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET all items and variants
export async function GET() {
  try {
    const items = await prisma.clothing_items.findMany({
      include: {
        variants: true,
      },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(items);
  } catch (error: any) {
    console.error("GET Clothing Items Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create a new item
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, image_url, is_active, variants } = body;

    const newItem = await prisma.clothing_items.create({
      data: {
        name,
        description,
        image_url,
        is_active: is_active ?? true,
        variants: {
          create: variants?.map((v: any) => ({
            size: v.size,
            stock_quantity: v.stock_quantity || 0,
          })) || [],
        },
      },
      include: { variants: true },
    });

    return NextResponse.json(newItem);
  } catch (error: any) {
    console.error("POST Clothing Items Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT update an existing item (and its variants)
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, description, image_url, is_active, variants } = body;

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    // Update the parent item
    const updatedItem = await prisma.clothing_items.update({
      where: { id: Number(id) },
      data: {
        name,
        description,
        image_url,
        is_active,
      },
    });

    // Update variants (upsert)
    if (variants && Array.isArray(variants)) {
      for (const v of variants) {
        if (v.id) {
          await prisma.clothing_variants.update({
            where: { id: Number(v.id) },
            data: { 
              size: v.size, 
              stock_quantity: Number(v.stock_quantity) 
            },
          });
        } else {
          await prisma.clothing_variants.create({
            data: {
              item_id: Number(id),
              size: v.size,
              stock_quantity: Number(v.stock_quantity),
            },
          });
        }
      }
    }

    const finalItem = await prisma.clothing_items.findUnique({
      where: { id: Number(id) },
      include: { variants: true },
    });

    return NextResponse.json(finalItem);
  } catch (error: any) {
    console.error("PUT Clothing Items Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
