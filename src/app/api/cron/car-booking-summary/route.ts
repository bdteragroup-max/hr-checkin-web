import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDateThai } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const HR_LINE_USER_ID = process.env.HR_LINE_USER_ID;
const MANAGEMENT_LINE_USER_ID = process.env.MANAGEMENT_LINE_USER_ID;

async function sendLineFlex(to: string, flex: any, altText: string) {
    if (!LINE_CHANNEL_ACCESS_TOKEN || !to) return false;
    try {
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to,
                messages: [{ type: "flex", altText, contents: flex }],
            }),
        });
        return res.ok;
    } catch (e) {
        console.error("[CAR SUMMARY] LINE push error:", e);
        return false;
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        // 1. Get TODAY's Date in Bangkok
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const isoDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const todayDate = new Date(`${isoDate}T00:00:00Z`);

        // 2. Fetch Car Borrowings for TODAY
        const borrowings = await prisma.asset_borrowings.findMany({
            where: {
                borrow_date: todayDate,
                assets: {
                    vehicle_type: { not: null }
                }
            },
            include: {
                assets: true,
                employee: { select: { name: true } }
            },
            orderBy: { created_at: "asc" }
        });

        // 3. Calculate "Cars Left"
        // Total vehicles in the company
        const totalVehicles = await prisma.assets.count({
            where: {
                vehicle_type: { not: null }
            }
        });

        // Vehicles currently out (status = borrowed)
        const vehiclesOut = await prisma.assets.count({
            where: {
                vehicle_type: { not: null },
                status: "borrowed"
            }
        });

        const carsLeft = totalVehicles - vehiclesOut;
        const dateLabel = formatDateThai(todayDate);

        // 4. Format Flex Message
        const flex = {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#fff7ed",
                contents: [
                    { type: "text", text: "🚗 สรุปการใช้รถยนต์รายวัน", weight: "bold", size: "lg", color: "#9a3412" },
                    { type: "text", text: `ประจำวันที่: ${dateLabel}`, size: "sm", color: "#c2410c", margin: "sm" }
                ],
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "xl",
                contents: [
                    // Summary Stats
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "box",
                                layout: "vertical",
                                flex: 1,
                                contents: [
                                    { type: "text", text: "รถที่ออกวันนี้", size: "xs", color: "#94a3b8", align: "center" },
                                    { type: "text", text: `${borrowings.length}`, size: "xl", weight: "bold", color: "#9a3412", align: "center" }
                                ]
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                flex: 1,
                                contents: [
                                    { type: "text", text: "รถคงเหลือที่บริษัท", size: "xs", color: "#94a3b8", align: "center" },
                                    { type: "text", text: `${carsLeft}`, size: "xl", weight: "bold", color: "#16a34a", align: "center" }
                                ]
                            }
                        ],
                        backgroundColor: "#f9fafb",
                        paddingAll: "12px",
                        cornerRadius: "12px"
                    },
                    
                    // Detailed List
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "md",
                        contents: borrowings.length > 0 ? borrowings.map((b) => ({
                            type: "box",
                            layout: "vertical",
                            spacing: "xs",
                            contents: [
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        {
                                            type: "box",
                                            layout: "vertical",
                                            flex: 7,
                                            contents: [
                                                { type: "text", text: b.assets.name, size: "sm", weight: "bold", color: "#111827", wrap: true },
                                                { type: "text", text: b.assets.asset_id, size: "xs", color: "#6b7280", margin: "xs" }
                                            ]
                                        },
                                        { type: "text", text: b.status === 'returned' ? "คืนแล้ว" : "ยังไม่คืน", size: "xxs", color: b.status === 'returned' ? "#16a34a" : "#ea580c", flex: 3, align: "end", gravity: "top" }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "vertical",
                                    backgroundColor: "#fffaf5",
                                    paddingAll: "10px",
                                    cornerRadius: "8px",
                                    contents: [
                                        { type: "text", text: `ผู้ใช้: ${b.employee.name}`, size: "xs", color: "#4b5563" },
                                        { type: "text", text: `ไปที่: ${b.location || "ไม่ระบุ"}`, size: "xs", color: "#6b7280", margin: "xs", wrap: true },
                                        { type: "text", text: `กำหนดคืน: ${new Date(b.expected_return_date).toLocaleDateString("th-TH")}`, size: "xxs", color: "#94a3b8", margin: "xs" }
                                    ]
                                }
                            ]
                        })) : [
                            { type: "text", text: "ไม่มีการใช้รถยนต์ใหม่ในวันนี้", size: "sm", color: "#94a3b8", align: "center", margin: "xl" }
                        ]
                    }
                ],
                paddingAll: "16px"
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: `รายงาน ณ เวลา 17:00 น.`,
                        size: "xs",
                        color: "#94a3b8",
                        align: "center"
                    }
                ],
                paddingAll: "12px"
            }
        };

        // Recipients List: HR, Management, and Warehouse Managers
        const recipientIds = [
            HR_LINE_USER_ID, 
            MANAGEMENT_LINE_USER_ID, 
            "U816bdcddad4fbf4b69b203dc1ab86238", // Warehouse Officer
            "Ub6daecf693050239c2f9543dae5eee98"  // Purchasing & Warehouse Manager
        ].filter(id => !!id) as string[];
        
        for (const rid of recipientIds) {
            await sendLineFlex(rid, flex, `สรุปการใช้รถยนต์วันนี้ ${dateLabel}`);
        }

        return NextResponse.json({ ok: true, count: borrowings.length, carsLeft });

    } catch (error: any) {
        console.error("[CAR SUMMARY] Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
