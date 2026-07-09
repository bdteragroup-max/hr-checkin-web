import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const { variant_id, quantity, reason } = body;
    const requestId = Number(params.id);

    if (!requestId || !variant_id || !quantity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existingRequest = await prisma.clothing_requests.findUnique({
      where: { id: requestId }
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "pending") {
      return NextResponse.json({ error: "Only pending requests can be edited" }, { status: 400 });
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

    const updatedRequest = await prisma.clothing_requests.update({
      where: { id: requestId },
      data: {
        variant_id: Number(variant_id),
        quantity: Number(quantity),
        reason
      }
    });

    return NextResponse.json(updatedRequest);
  } catch (error: any) {
    console.error("PUT User Clothing Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const requestId = Number(params.id);

    if (!requestId) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const existingRequest = await prisma.clothing_requests.findUnique({
      where: { id: requestId }
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "pending") {
      return NextResponse.json({ error: "Only pending requests can be deleted" }, { status: 400 });
    }

    await prisma.clothing_requests.delete({
      where: { id: requestId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE User Clothing Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
