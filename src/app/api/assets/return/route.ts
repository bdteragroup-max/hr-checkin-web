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
        const { borrowing_id, actual_return_date, condition_at_return, is_damaged, photo_url_return } = body;

        if (!borrowing_id || !actual_return_date) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        // Find borrowing record and ensure it belongs to this employee or their supervisor
        const borrowing = await prisma.asset_borrowings.findFirst({
            where: { 
                id: Number(borrowing_id),
                OR: [
                    { emp_id: payload.emp_id },
                    { 
                        employee: { 
                            OR: [
                                { supervisor_id: payload.emp_id },
                                { secondary_supervisor_id: payload.emp_id }
                            ]
                        } 
                    }
                ],
                status: { in: ["borrowed", "reserved"] }
            },
            include: { 
                assets: true,
                employee: { 
                    include: { 
                        job_positions: true, 
                        branches: true 
                    } 
                } as any
            }
        });

        if (!borrowing) {
            return NextResponse.json({ error: "BORROWING_NOT_FOUND_OR_ALREADY_RETURNED" }, { status: 404 });
        }

        // Process in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const safeParseDate = (dateStr: string) => {
                if (!dateStr) return new Date();
                if (dateStr.includes("Z") || (dateStr.includes("+") && dateStr.includes("T"))) return new Date(dateStr);
                if (dateStr.includes("T")) return new Date(`${dateStr}+07:00`);
                return new Date(`${dateStr}T00:00:00+07:00`);
            };

            const updatedBorrowing = await tx.asset_borrowings.update({
                where: { id: Number(borrowing_id) },
                data: {
                    actual_return_date: safeParseDate(actual_return_date),
                    condition_at_return: condition_at_return || null,
                    is_damaged: is_damaged || false,
                    photo_url_return: photo_url_return || null,
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
                // Find ACT.Purchase&warehouse Mgr. to notify as well
                const warehouseMgrs = await prisma.employees.findMany({
                    where: {
                        job_positions: {
                            title: "ACT.Purchase&warehouse Mgr."
                        },
                        is_active: true
                    },
                    select: { line_user_id: true }
                });
                const extraIds = warehouseMgrs
                    .map(m => m.line_user_id)
                    .filter(id => !!id) as string[];

                const { sendAssetReturnNotification } = await import("@/utils/lineMessaging");
                const { formatName } = await import("@/utils/formatName");
                await sendAssetReturnNotification({
                    empName: formatName((borrowing.employee as any).name, (borrowing.employee as any).nickname),
                    jobTitle: (borrowing.employee as any).job_positions?.title,
                    branchName: (borrowing.employee as any).branches?.name,
                    assetName: borrowing.assets.name,
                    assetId: borrowing.assets.asset_id,
                    actualReturnDate: new Date(actual_return_date).toLocaleDateString("th-TH"),
                    condition: condition_at_return || "ปกติ",
                    isDamaged: is_damaged || false,
                    photoUrl: photo_url_return ?? undefined,
                    location: borrowing.location ?? undefined,
                    extraTargetIds: extraIds
                });
            } catch (err) {
                console.error("[API/assets/return] Notification Error:", err);
            }
        };

        sendNotification();

        return NextResponse.json({ ok: true, data: result });
    } catch (e: any) {
        console.error("[API/assets/return] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
