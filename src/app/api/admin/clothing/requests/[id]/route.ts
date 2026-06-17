import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const { status, admin_note, approved_by } = body;
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

    // Prepare update data
    const updateData: any = { status };
    if (admin_note !== undefined) updateData.admin_note = admin_note;
    if (approved_by !== undefined) updateData.approved_by = approved_by;

    if (status === "approved" && existingRequest.status !== "approved") {
      updateData.approved_at = new Date();
      // Deduct stock immediately!
      await prisma.clothing_variants.update({
        where: { id: existingRequest.variant_id },
        data: {
          stock_quantity: {
            decrement: existingRequest.quantity
          }
        }
      });
    } else if (status === "fulfilled" && existingRequest.status !== "fulfilled") {
      updateData.fulfilled_at = new Date();
      if (!existingRequest.approved_at) {
         updateData.approved_at = new Date(); // Implicitly approve if fulfilled directly
         // Deduct stock!
         await prisma.clothing_variants.update({
           where: { id: existingRequest.variant_id },
           data: {
             stock_quantity: {
               decrement: existingRequest.quantity
             }
           }
         });
      }
    } else if (status === "rejected" && (existingRequest.status === "approved" || existingRequest.status === "fulfilled")) {
      // Restore stock!
      await prisma.clothing_variants.update({
        where: { id: existingRequest.variant_id },
        data: {
          stock_quantity: {
            increment: existingRequest.quantity
          }
        }
      });
    }

    const updatedRequest = await prisma.clothing_requests.update({
      where: { id: requestId },
      data: updateData,
      include: {
        employee: { select: { name: true, nickname: true } },
        variant: { include: { item: true } }
      }
    });

    return NextResponse.json(updatedRequest);
  } catch (error: any) {
    console.error("PUT Admin Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
