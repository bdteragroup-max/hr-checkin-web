import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET all requests for Admin
export async function GET() {
  try {
    const requests = await prisma.clothing_requests.findMany({
      include: {
        employee: {
          select: {
            name: true,
            nickname: true,
            department_id: true,
            job_position_id: true,
            departments: { select: { name: true } }
          }
        },
        variant: {
          include: {
            item: true
          }
        }
      },
      orderBy: { requested_at: "desc" },
    });
    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("GET Admin Clothing Requests Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
