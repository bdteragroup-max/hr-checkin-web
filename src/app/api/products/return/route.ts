import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function POST(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const body = await req.json();
        const { borrowing_id, actual_return_date, condition_at_return, is_damaged, photo_url_return } = body;

        if (!borrowing_id || !actual_return_date) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        const borrowing = await prisma.product_borrowings.findUnique({
            where: { id: Number(borrowing_id) },
            include: { product: true }
        });

        if (!borrowing) return NextResponse.json({ error: "BORROWING_NOT_FOUND" }, { status: 404 });

        const returnDate = new Date(actual_return_date.includes("T") ? actual_return_date : `${actual_return_date}T00:00:00+07:00`);

        await prisma.$transaction([
            prisma.product_borrowings.update({
                where: { id: Number(borrowing_id) },
                data: {
                    actual_return_date: returnDate,
                    condition_at_return,
                    is_damaged: !!is_damaged,
                    photo_url_return,
                    status: "returned"
                }
            }),
            prisma.products.update({
                where: { id: borrowing.product_id },
                data: { status: is_damaged ? "damaged" : "available" }
            })
        ]);

        // 📢 LINE NOTIFICATION (Non-blocking)
        const sendNotification = async () => {
            try {
                // Fetch employee details for notification
                const employee = await prisma.employees.findUnique({
                    where: { emp_id: borrowing.emp_id },
                    include: { job_positions: true }
                }) as any;

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

                const { sendProductReturnNotification } = await import("@/utils/lineMessaging");
                const { formatName } = await import("@/utils/formatName");
                
                await sendProductReturnNotification({
                    empName: employee ? formatName(employee.name, employee.nickname) : "ไม่ทราบชื่อ",
                    productName: borrowing.product.product_name,
                    productCode: borrowing.product.product_code || String(borrowing.product.id),
                    actualReturnDate: returnDate.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                    condition: condition_at_return || "ปกติ",
                    isDamaged: !!is_damaged,
                    photoUrl: photo_url_return ?? undefined,
                    extraTargetIds: extraIds,
                    jobTitle: employee?.job_positions?.title,
                    companyName: borrowing.product.company_name || undefined
                });
            } catch (notifyError) {
                console.error("[API/products/return] Notification Error:", notifyError);
            }
        };

        sendNotification();

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[API/products/return] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
