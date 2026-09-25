import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toBkkDate(d: Date | string) {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    return createClient(url, key);
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const { searchParams } = new URL(req.url);
        const startDateStr = searchParams.get("start_date");
        const endDateStr = searchParams.get("end_date");

        if (!startDateStr || !endDateStr) {
            return NextResponse.json({ ok: false, error: "MISSING_DATE_RANGE" }, { status: 400 });
        }

        // Bangkok timezone conversion
        const startInstant = new Date(`${startDateStr}T00:00:00+07:00`);
        const endInstant = new Date(`${endDateStr}T23:59:59.999+07:00`);

        // 1. Leave Requests
        const leaves = await prisma.leave_requests.findMany({
            where: { timestamp: { gte: startInstant, lte: endInstant } },
            orderBy: { timestamp: "desc" },
        });

        // 2. OT Requests
        const otRequests = await prisma.ot_requests.findMany({
            where: { created_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } } },
            orderBy: { created_at: "desc" },
        });

        // 3. Travel Claims
        const travelClaims = await prisma.travel_claims.findMany({
            where: { created_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } } },
            orderBy: { created_at: "desc" },
        });

        // 4. Clothing Requests
        const clothingRequests = await prisma.clothing_requests.findMany({
            where: { requested_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } }, variant: { include: { item: true } } },
            orderBy: { requested_at: "desc" },
        });

        // 5. Asset Borrowings
        const assetBorrowings = await prisma.asset_borrowings.findMany({
            where: { created_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } }, assets: true },
            orderBy: { created_at: "desc" },
        });

        // 6. Payment Tasks
        const paymentTasks = await prisma.payment_tasks.findMany({
            where: { createdAt: { gte: startInstant, lte: endInstant } },
            include: { jobs: { select: { jobNumber: true, customerName: true } } },
            orderBy: { createdAt: "desc" },
        });

        // 7. Commission Claims
        const commissionClaims = await prisma.commission_claims.findMany({
            where: { created_at: { gte: startInstant, lte: endInstant } },
            include: { employee: { select: { name: true, nickname: true } } },
            orderBy: { created_at: "desc" },
        });

        // 8. Storage Uploads by date
        const uploadedFiles: any[] = [];
        try {
            const supabase = getSupabaseClient();
            // Generate list of date strings
            const cur = new Date(startDateStr);
            const stop = new Date(endDateStr);
            const dateList: string[] = [];
            while (cur <= stop && dateList.length <= 60) {
                dateList.push(cur.toISOString().split("T")[0]);
                cur.setDate(cur.getDate() + 1);
            }

            for (const d of dateList) {
                const { data: files } = await supabase.storage.from("uploads").list(d, {
                    limit: 200,
                    offset: 0,
                    sortBy: { column: "name", order: "asc" },
                });

                if (files && files.length > 0) {
                    files.forEach(f => {
                        // Skip regular check-in selfie captures
                        const isRegularCheckin = /^[A-Z0-9]+-\d{8}-\d{6}-\d+\.(jpg|jpeg|png)$/i.test(f.name);
                        if (!isRegularCheckin) {
                            let docType = "เอกสารแนบทั่วไป";
                            if (f.name.includes("car-return") || f.name.includes("key-return") || f.name.includes("signature")) {
                                docType = "ตรวจสภาพและคืนรถยนต์";
                            } else if (f.name.includes("depreciation")) {
                                docType = "เบิกค่าเสื่อมราคาฝ่ายขาย";
                            } else if (f.name.includes("report") || f.name.includes("receipt")) {
                                docType = "รายงานหน้างาน / ใบเสร็จเดินทาง";
                            } else if (f.name.includes("asset-borrow")) {
                                docType = "เอกสารยืมทรัพย์สิน";
                            } else if (f.name.endsWith(".pdf") || f.name.includes("TE") || f.name.includes("TG") || f.name.includes("TP")) {
                                docType = "เอกสารแนบการลา / ใบรับรองแพทย์";
                            }

                            uploadedFiles.push({
                                date: d,
                                name: f.name,
                                size: f.metadata?.size || 0,
                                type: docType,
                                url: `https://uvbnlqwcdzlygykbhwhv.supabase.co/storage/v1/object/public/uploads/${d}/${f.name}`,
                            });
                        }
                    });
                }
            }
        } catch (storageErr) {
            console.error("Storage list error:", storageErr);
        }

        // Daily aggregated summary
        const summaryByDate: Record<string, any> = {};
        const getOrInitDay = (d: string) => {
            if (!summaryByDate[d]) {
                summaryByDate[d] = {
                    date: d,
                    leaves: 0,
                    ot: 0,
                    travel: 0,
                    clothing: 0,
                    assets: 0,
                    payments: 0,
                    commission: 0,
                    uploads: 0,
                };
            }
            return summaryByDate[d];
        };

        leaves.forEach(x => { getOrInitDay(toBkkDate(x.timestamp)).leaves++; });
        otRequests.forEach(x => { getOrInitDay(toBkkDate(x.created_at)).ot++; });
        travelClaims.forEach(x => { getOrInitDay(toBkkDate(x.created_at)).travel++; });
        clothingRequests.forEach(x => { getOrInitDay(toBkkDate(x.requested_at)).clothing++; });
        assetBorrowings.forEach(x => { getOrInitDay(toBkkDate(x.created_at)).assets++; });
        paymentTasks.forEach(x => { getOrInitDay(toBkkDate(x.createdAt)).payments++; });
        commissionClaims.forEach(x => { getOrInitDay(toBkkDate(x.created_at)).commission++; });
        uploadedFiles.forEach(x => { getOrInitDay(x.date).uploads++; });

        return NextResponse.json({
            ok: true,
            dateRange: { start_date: startDateStr, end_date: endDateStr },
            totals: {
                leaves: leaves.length,
                ot: otRequests.length,
                travel: travelClaims.length,
                clothing: clothingRequests.length,
                assets: assetBorrowings.length,
                payments: paymentTasks.length,
                commission: commissionClaims.length,
                uploads: uploadedFiles.length,
            },
            summaryByDate: Object.values(summaryByDate).sort((a, b) => a.date.localeCompare(b.date)),
            data: {
                leaves,
                otRequests,
                travelClaims,
                clothingRequests,
                assetBorrowings,
                paymentTasks,
                commissionClaims,
                uploadedFiles,
            },
        });
    } catch (e: any) {
        console.error("Activity Report API Error:", e);
        const status = e.message === "UNAUTHORIZED" ? 401 : e.message === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: e.message || "INTERNAL_ERROR" }, { status });
    }
}
