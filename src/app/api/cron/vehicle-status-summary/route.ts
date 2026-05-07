import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";
const HR_LINE_USER_ID = process.env.HR_LINE_USER_ID;
const MANAGEMENT_LINE_USER_ID = process.env.MANAGEMENT_LINE_USER_ID;

async function pushLineMessage(to: string, messages: any[]) {
    if (!LINE_CHANNEL_ACCESS_TOKEN || !to) return false;
    try {
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({ to, messages }),
        });
        return res.ok;
    } catch (e) {
        console.error("[VEHICLE SUMMARY] LINE push error:", e);
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
        const todayStr = getTodayBangkokISO();
        const startOfDay = new Date(`${todayStr}T00:00:00+07:00`);
        const endOfDay = new Date(`${todayStr}T23:59:59+07:00`);

        // 1. Borrowed Today
        const borrowedToday = await prisma.asset_borrowings.findMany({
            where: {
                borrow_date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                employee: { select: { name: true } },
                assets: { select: { name: true, asset_id: true } }
            }
        });

        // 2. Returned Today
        const returnedToday = await prisma.asset_borrowings.findMany({
            where: {
                actual_return_date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                employee: { select: { name: true } },
                assets: { select: { name: true, asset_id: true } }
            }
        });

        // 3. Still Borrowed (Active)
        const activeBorrowings = await prisma.asset_borrowings.findMany({
            where: {
                status: "borrowed",
                actual_return_date: null
            },
            include: {
                employee: { select: { name: true } },
                assets: { select: { name: true, asset_id: true } }
            }
        });

        const lines = [
            "📊 สรุปสถานะการใช้รถประจำวัน",
            `วันที่: ${startOfDay.toLocaleDateString("th-TH")}`,
            "---------------------------"
        ];

        // Borrowed Today
        lines.push(`✅ ยืมวันนี้ (${borrowedToday.length}):`);
        if (borrowedToday.length > 0) {
            borrowedToday.forEach(b => {
                lines.push(`• ${b.employee.name} ยืม ${b.assets.name} (${b.assets.asset_id})`);
            });
        } else {
            lines.push("• ไม่มีรายการยืมใหม่");
        }

        lines.push("");

        // Returned Today
        lines.push(`🔄 คืนวันนี้ (${returnedToday.length}):`);
        if (returnedToday.length > 0) {
            returnedToday.forEach(r => {
                lines.push(`• ${r.employee.name} คืน ${r.assets.name} (${r.assets.asset_id})`);
            });
        } else {
            lines.push("• ไม่มีรายการคืน");
        }

        lines.push("");

        // Active Borrowings
        lines.push(`🚗 กำลังใช้งานอยู่ (${activeBorrowings.length}):`);
        if (activeBorrowings.length > 0) {
            activeBorrowings.forEach(a => {
                lines.push(`• ${a.employee.name}: ${a.assets.name} (${a.assets.asset_id})`);
            });
        } else {
            lines.push("• ไม่มีรถที่กำลังใช้งาน");
        }

        const message = lines.join("\n");

        // Recipients List
        const recipientIds = [HR_LINE_USER_ID, MANAGEMENT_LINE_USER_ID, "U816bdcddad4fbf4b69b203dc1ab86238", "Ub6daecf693050239c2f9543dae5eee98"].filter(id => !!id) as string[];

        for (const rid of recipientIds) {
            await pushLineMessage(rid, [{ type: "text", text: message }]);
        }

        return NextResponse.json({ ok: true, summary: message });

    } catch (error: any) {
        console.error("[VEHICLE SUMMARY] Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
