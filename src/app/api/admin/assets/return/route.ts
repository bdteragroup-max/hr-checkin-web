import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { borrowing_id, actual_return_date, condition_at_return, is_damaged, force_reset, asset_id } = body;

        // Handle Force Reset (when asset is stuck as 'borrowed' but no active borrowing record exists)
        if (force_reset && asset_id) {
            await prisma.assets.update({
                where: { id: Number(asset_id) },
                data: {
                    status: is_damaged ? "damaged" : "available",
                    updated_at: new Date()
                }
            });
            return NextResponse.json({ ok: true, message: "Asset forcefully reset to available." });
        }

        if (!borrowing_id || !actual_return_date) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        // Find the borrowing record
        const borrowing = await prisma.asset_borrowings.findUnique({
            where: { id: Number(borrowing_id) },
            include: { 
                assets: true,
                employee: { select: { name: true } }
            }
        });

        if (!borrowing || !["borrowed", "reserved"].includes(borrowing.status)) {
            return NextResponse.json({ error: "BORROWING_NOT_FOUND_OR_ALREADY_RETURNED" }, { status: 400 });
        }

        // Update in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const updatedBorrowing = await tx.asset_borrowings.update({
                where: { id: Number(borrowing_id) },
                data: {
                    actual_return_date: new Date(actual_return_date),
                    condition_at_return: condition_at_return || null,
                    is_damaged: is_damaged || false,
                    status: "returned"
                }
            });

            await tx.assets.update({
                where: { id: borrowing.asset_id },
                data: { 
                    status: is_damaged ? "damaged" : "available",
                    updated_at: new Date()
                }
            });

            return updatedBorrowing;
        });

        // 📢 LINE NOTIFICATION (Non-blocking)
        const sendNotification = async () => {
            try {
                const { sendAssetReturnNotification } = await import("@/utils/lineMessaging");
                await sendAssetReturnNotification({
                    empName: borrowing.employee.name,
                    assetName: borrowing.assets.name,
                    assetId: borrowing.assets.asset_id,
                    actualReturnDate: new Date(actual_return_date).toLocaleDateString("th-TH"),
                    condition: condition_at_return || "ปกติ",
                    isDamaged: is_damaged || false
                });
            } catch (err) {
                console.error("[API/admin/assets/return] Notification Error:", err);
            }
        };

        sendNotification();

        return NextResponse.json({ ok: true, data: result });
    } catch (e: any) {
        console.error("[API/admin/assets/return] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
