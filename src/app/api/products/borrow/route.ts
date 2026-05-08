import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function POST(req: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const payload = verifyToken(token) as { emp_id: string; role: string };
        const body = await req.json();
        const { 
            product_id, borrow_date, expected_return_date, location, remark, photo_url_borrow,
            borrower_emp_id
        } = body;

        const isAdmin = payload.role === "admin" || payload.role === "SUPER_ADMIN" || payload.role === "WAREHOUSE_MANAGER";
        const targetEmpId = (isAdmin && borrower_emp_id) ? borrower_emp_id : payload.emp_id;

        if (!product_id || !borrow_date || !expected_return_date) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        const employee = await prisma.employees.findUnique({
            where: { emp_id: targetEmpId },
            include: { job_positions: true, branches: true }
        }) as any;

        if (!employee) return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });

        const product = await prisma.products.findUnique({
            where: { id: Number(product_id) }
        });

        if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });

        let isDateOnly = false;
        const safeParseDate = (dateStr: string) => {
            if (!dateStr) return new Date(NaN);
            if (dateStr.includes("Z") || (dateStr.includes("+") && dateStr.includes("T"))) return new Date(dateStr);
            if (dateStr.includes("T")) return new Date(`${dateStr}+07:00`);
            isDateOnly = true;
            return new Date(`${dateStr}T00:00:00+07:00`);
        };

        const borrowStart = safeParseDate(borrow_date);
        const borrowEnd = safeParseDate(expected_return_date);
        const now = new Date();

        if (isNaN(borrowStart.getTime()) || isNaN(borrowEnd.getTime())) {
            return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
        }

        if (borrowEnd <= borrowStart) {
            return NextResponse.json({ error: "INVALID_DATE_RANGE" }, { status: 400 });
        }

        const overlapping = await prisma.product_borrowings.findFirst({
            where: {
                product_id: Number(product_id),
                status: { in: ["borrowed", "reserved"] },
                AND: [
                    { borrow_date: { lt: borrowEnd } },
                    { expected_return_date: { gt: borrowStart } }
                ]
            }
        });

        if (overlapping) {
            return NextResponse.json({ error: "TIME_OVERLAP" }, { status: 400 });
        }

        const isFuture = borrowStart > now;

        const result = await prisma.$transaction(async (tx) => {
            const borrowing = await tx.product_borrowings.create({
                data: {
                    product_id: Number(product_id),
                    emp_id: targetEmpId,
                    borrow_date: borrowStart,
                    expected_return_date: borrowEnd,
                    location: location || null,
                    condition_at_borrow: remark || null,
                    photo_url_borrow: photo_url_borrow || null,
                    status: isFuture ? "reserved" : "borrowed"
                }
            });
            
            if (!isFuture) {
                await tx.products.update({
                    where: { id: Number(product_id) },
                    data: { status: "borrowed" }
                });
            }
            return borrowing;
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

                const { sendProductBorrowNotification } = await import("@/utils/lineMessaging");
                const { formatName } = await import("@/utils/formatName");
                
                await sendProductBorrowNotification({
                    empName: formatName(employee.name, employee.nickname),
                    jobTitle: employee.job_positions?.title,
                    branchName: employee.branches?.name,
                    productName: product.product_name,
                    productCode: product.product_code || String(product.id),
                    borrowDate: borrowStart.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                    returnDate: borrowEnd.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                    location: location || "ไม่ได้ระบุ",
                    photoUrl: photo_url_borrow ?? undefined,
                    extraTargetIds: extraIds,
                    remark: remark || undefined,
                    companyName: product.company_name || undefined
                });
            } catch (notifyError) {
                console.error("[API/products/borrow] Notification Error:", notifyError);
            }
        };

        sendNotification();

        return NextResponse.json({ ok: true, data: result });
    } catch (e: any) {
        console.error("[API/products/borrow] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
