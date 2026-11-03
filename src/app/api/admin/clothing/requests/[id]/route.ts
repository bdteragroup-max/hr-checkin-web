import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const { status, admin_note, approved_by, variant_id, quantity } = body;
    const requestId = Number(params.id);

    if (!requestId) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Get current request to check status
    const existingRequest = await prisma.clothing_requests.findUnique({
      where: { id: requestId },
      include: { variant: true }
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const oldVariantId = existingRequest.variant_id;
    const oldQuantity = existingRequest.quantity;
    const oldStatus = existingRequest.status;

    const newVariantId = variant_id !== undefined ? Number(variant_id) : oldVariantId;
    const newQuantity = quantity !== undefined ? Number(quantity) : oldQuantity;
    const newStatus = status !== undefined ? status : oldStatus;

    if (newQuantity <= 0 || isNaN(newQuantity)) {
      return NextResponse.json({ error: "จำนวนต้องมากกว่า 0" }, { status: 400 });
    }

    const wasDeducted = oldStatus === "approved" || oldStatus === "fulfilled";
    const willBeDeducted = newStatus === "approved" || newStatus === "fulfilled";

    // Prepare update data
    const updateData: any = {
      status: newStatus,
      variant_id: newVariantId,
      quantity: newQuantity,
    };
    if (admin_note !== undefined) updateData.admin_note = admin_note;
    if (approved_by !== undefined) updateData.approved_by = approved_by;

    if (newStatus === "approved" && oldStatus !== "approved") {
      updateData.approved_at = new Date();
    } else if (newStatus === "fulfilled" && oldStatus !== "fulfilled") {
      updateData.fulfilled_at = new Date();
      if (!existingRequest.approved_at) {
        updateData.approved_at = new Date();
      }
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      if (wasDeducted && !willBeDeducted) {
        // Restore stock to old variant
        await tx.clothing_variants.update({
          where: { id: oldVariantId },
          data: { stock_quantity: { increment: oldQuantity } }
        });
      } else if (!wasDeducted && willBeDeducted) {
        // Deduct stock from new variant
        await tx.clothing_variants.update({
          where: { id: newVariantId },
          data: { stock_quantity: { decrement: newQuantity } }
        });
      } else if (wasDeducted && willBeDeducted) {
        // Adjust stock if variant or quantity changed
        if (oldVariantId !== newVariantId) {
          await tx.clothing_variants.update({
            where: { id: oldVariantId },
            data: { stock_quantity: { increment: oldQuantity } }
          });
          await tx.clothing_variants.update({
            where: { id: newVariantId },
            data: { stock_quantity: { decrement: newQuantity } }
          });
        } else if (oldQuantity !== newQuantity) {
          await tx.clothing_variants.update({
            where: { id: oldVariantId },
            data: { stock_quantity: { increment: oldQuantity - newQuantity } }
          });
        }
      }

      return tx.clothing_requests.update({
        where: { id: requestId },
        data: updateData,
        include: {
          employee: { select: { name: true, nickname: true } },
          variant: { include: { item: true } }
        }
      });
    });

    return NextResponse.json(updatedRequest);
  } catch (error: any) {
    console.error("PUT Admin Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
