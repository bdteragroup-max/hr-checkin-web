import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";


export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function jsonSafe<T>(v: T): any {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(jsonSafe);
    if (v && typeof v === "object") {
        const out: any = {};
        for (const [k, val] of Object.entries(v as any)) out[k] = jsonSafe(val);
        return out;
    }
    return v;
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const status = url.searchParams.get("status") || ""; // pending/approved/rejected
        const empId = url.searchParams.get("emp_id") || "";
        const startDate = url.searchParams.get("startDate") || "";
        const endDate = url.searchParams.get("endDate") || "";
        const date = url.searchParams.get("date") || ""; // YYYY-MM-DD (backward compatibility)

        const where: any = {};
        if (status) {
            if (status === "pending" || status === "pending_hr") {
                where.status = { in: ["pending", "pending_hr"] };
            } else {
                where.status = status;
            }
        }
        if (empId) where.emp_id = empId;

        // Date range filtering
        if (startDate && endDate) {
            // captures any overlap with the range [startDate, endDate]
            where.start_date = { lte: new Date(`${endDate}T23:59:59.999Z`) };
            where.end_date = { gte: new Date(`${startDate}T00:00:00.000Z`) };
        } else if (startDate) {
            where.start_date = { gte: new Date(`${startDate}T00:00:00.000Z`) };
        } else if (endDate) {
            where.end_date = { lte: new Date(`${endDate}T23:59:59.999Z`) };
        } else if (date) {
            // fallback for backward compatibility: exact date overlap
            const d = new Date(`${date}T00:00:00.000Z`);
            where.start_date = { lte: d };
            where.end_date = { gte: d };
        }

        const rows = await prisma.leave_requests.findMany({
            where,
            orderBy: { approved_at: "desc" }, // ถ้าไม่มี approved_at ให้เปลี่ยนเป็น created_at
            take: 2000,
            select: {
                id: true,
                emp_id: true,
                name: true,
                leave_type: true,
                reason: true,
                start_date: true,
                end_date: true,
                start_at: true,
                end_at: true,
                days: true,
                minutes: true,
                status: true,
                approved_by: true,
                approved_at: true,
                supervisor_id: true,
                supervisor_approved_at: true,
                handover_person: true,
                attachment_url: true,
                substitute_date: true,
                employees: {
                    select: {
                        name: true,
                        nickname: true,
                        supervisor_id: true,
                        departments: {
                            select: { name: true }
                        }
                    }
                }
            },
        });

        const formattedRows = rows.map((r: any) => {
            const empName = r.employees?.name || r.name;
            const nickname = r.employees?.nickname;
            let finalName = empName;
            if (nickname && !empName.includes(`(${nickname})`)) {
                finalName = `${empName} (${nickname})`;
            }

            let updatedLeaveType = r.leave_type;
            if (r.days === 0.5 && r.start_at) {
                const bkkHour = parseInt(new Date(r.start_at).toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", hour12: false }));
                if (bkkHour < 12) {
                    updatedLeaveType += " (ครึ่งเช้า 08:00-12:00)";
                } else {
                    updatedLeaveType += " (ครึ่งบ่าย 13:00-17:00)";
                }
            }

            return {
                ...r,
                name: finalName,
                leave_type: updatedLeaveType
            };
        });

        return NextResponse.json(jsonSafe({ ok: true, list: formattedRows }));
    } catch (e: any) {
        console.error("leaves GET error:", e);
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}