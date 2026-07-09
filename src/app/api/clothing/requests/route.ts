import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST a new request
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { emp_id, variant_id, quantity, reason } = body;

    if (!emp_id || !variant_id || !quantity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify stock availability
    const variant = await prisma.clothing_variants.findUnique({
      where: { id: Number(variant_id) }
    });

    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    if (variant.stock_quantity < quantity) {
      return NextResponse.json({ error: "Not enough stock available" }, { status: 400 });
    }

    const newRequest = await prisma.clothing_requests.create({
      data: {
        emp_id,
        variant_id: Number(variant_id),
        quantity: Number(quantity),
        reason
      }
    });

    return NextResponse.json(newRequest);
  } catch (error: any) {
    console.error("POST User Clothing Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET user's request history
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const emp_id = url.searchParams.get("emp_id");

    if (!emp_id) {
      return NextResponse.json({ error: "emp_id is required" }, { status: 400 });
    }

    const requests = await prisma.clothing_requests.findMany({
      where: { emp_id },
      include: {
        variant: {
          include: {
            item: {
              include: {
                variants: true
              }
            }
          }
        }
      },
      orderBy: { requested_at: "desc" }
    });

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("GET User Clothing Requests Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
