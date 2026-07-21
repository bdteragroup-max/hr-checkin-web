import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function POST(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const payload = verifyToken(token) as { emp_id: string };
        const body = await req.json();
        const { borrowing_id, key_photo_url, key_received_by, key_signature_url } = body;

        if (!borrowing_id || !key_photo_url || !key_received_by || !key_signature_url) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        // Find borrowing record
        const borrowing = await prisma.asset_borrowings.findFirst({
            where: { 
                id: Number(borrowing_id),
                status: "returned",
                return_status: "PENDING_KEY"
            }
        });

        if (!borrowing) {
            return NextResponse.json({ error: "BORROWING_NOT_FOUND_OR_INVALID_STATUS" }, { status: 404 });
        }

        const updatedBorrowing = await prisma.asset_borrowings.update({
            where: { id: Number(borrowing_id) },
            data: {
                key_returned_at: new Date(),
                key_photo_url,
                key_received_by,
                key_signature_url,
                return_status: "COMPLETE"
            }
        });

        return NextResponse.json({ ok: true, data: updatedBorrowing });
    } catch (e: any) {
        console.error("[API/assets/return-key] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
