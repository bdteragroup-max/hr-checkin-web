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
        const { 
            asset_id, borrow_date, expected_return_date, location, remark, photo_url_borrow,
            borrow_vehicle_status, borrow_is_clean, borrow_is_lights_ok, borrow_is_tires_ok,
            borrow_is_body_ok, borrow_is_insurance_ok, borrow_inspection_remark
        } = body;

        if (!asset_id || !borrow_date || !expected_return_date) {
            return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
        }

        // Fetch employee details (Job and Branch)
        const employee = await prisma.employees.findUnique({
            where: { emp_id: payload.emp_id },
            include: { 
                job_positions: true,
                branches: true
            }
        });

        if (!employee) return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });

        // Check if asset is available
        const asset = await prisma.assets.findUnique({
            where: { id: Number(asset_id) }
        });

        if (!asset) {
            return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
        }

        // --- 1. DATE VALIDATION ---
        const now = new Date();
        const bDate = new Date(borrow_date);
        const isFuture = bDate.setHours(0,0,0,0) > now.setHours(0,0,0,0);
        const isPast = bDate.setHours(0,0,0,0) < now.setHours(0,0,0,0);

        if (isPast) {
            return NextResponse.json({ error: "INVALID_DATE", message: "Cannot borrow for a past date." }, { status: 400 });
        }

        // --- 2. OVERLAP/AVAILABILITY CHECK ---
        // If borrowing for Today, asset MUST be available
        if (!isFuture && asset.status !== "available") {
            return NextResponse.json({ error: "ASSET_NOT_AVAILABLE", message: "This vehicle is currently borrowed by another user." }, { status: 400 });
        }

        // If reserving for Future, check if anyone else already reserved it for that day
        if (isFuture) {
            const existingReservation = await prisma.asset_borrowings.findFirst({
                where: {
                    asset_id: Number(asset_id),
                    status: { in: ["borrowed", "reserved"] },
                    borrow_date: { equals: new Date(borrow_date) }
                }
            });
            if (existingReservation) {
                return NextResponse.json({ error: "ALREADY_RESERVED", message: "This vehicle is already reserved for the selected date." }, { status: 400 });
            }
        }

        // Create transaction
        const result = await prisma.$transaction(async (tx) => {
            const borrowing = await tx.asset_borrowings.create({
                data: {
                    asset_id: Number(asset_id),
                    emp_id: payload.emp_id,
                    borrow_date: new Date(borrow_date),
                    expected_return_date: new Date(expected_return_date),
                    location: location || null,
                    condition_at_borrow: remark || null,
                    photo_url_borrow: photo_url_borrow || null,
                    status: isFuture ? "reserved" : "borrowed",
                    // New Inspection Fields
                    borrow_vehicle_status,
                    borrow_is_clean: borrow_is_clean === true,
                    borrow_is_lights_ok: borrow_is_lights_ok === true,
                    borrow_is_tires_ok: borrow_is_tires_ok === true,
                    borrow_is_body_ok: borrow_is_body_ok === true,
                    borrow_is_insurance_ok: borrow_is_insurance_ok === true,
                    borrow_inspection_remark: borrow_inspection_remark || null
                }
            });
            
            // ONLY update asset status if borrowing starts TODAY
            if (!isFuture) {
                await tx.assets.update({
                    where: { id: Number(asset_id) },
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

                const { sendAssetBorrowNotification } = await import("@/utils/lineMessaging");
                await sendAssetBorrowNotification({
                    empName: employee.name,
                    jobTitle: employee.job_positions?.title,
                    branchName: employee.branches?.name,
                    assetName: asset.name,
                    assetId: asset.asset_id,
                    borrowDate: new Date(borrow_date).toLocaleDateString("th-TH"),
                    returnDate: new Date(expected_return_date).toLocaleDateString("th-TH"),
                    location: location || "ไม่ได้ระบุ",
                    photoUrl: photo_url_borrow ?? undefined,
                    extraTargetIds: extraIds,
                    // Pass inspection data for notification
                    inspectionSummary: {
                        status: borrow_vehicle_status,
                        is_clean: borrow_is_clean,
                        is_lights_ok: borrow_is_lights_ok,
                        is_tires_ok: borrow_is_tires_ok,
                        is_body_ok: borrow_is_body_ok,
                        is_insurance_ok: borrow_is_insurance_ok,
                        remark: borrow_inspection_remark
                    }
                });
            } catch (notifyError) {
                console.error("[API/assets/borrow] Notification Error:", notifyError);
            }
        };

        sendNotification();

        return NextResponse.json({ ok: true, data: result });
    } catch (e: any) {
        console.error("[API/assets/borrow] POST Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
