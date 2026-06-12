import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { sendOtApprovalFlexMessage, sendEmployeeOtStatusNotification } from "@/utils/lineMessaging";
import { formatName } from "@/utils/formatName";

export async function POST(request: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token provided" }, { status: 401 });

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (err) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        if (!decoded || !decoded.emp_id) {
            return NextResponse.json({ error: "Invalid token data" }, { status: 401 });
        }

        const body = await request.json();
        const { date_for, start_time, end_time, reason } = body;

        // Calculate hours
        const start = new Date(start_time);
        const end = new Date(end_time);

        let diffMs = end.getTime() - start.getTime();
        let diffHrs = diffMs / (1000 * 60 * 60);

        if (diffHrs <= 0) {
            end.setDate(end.getDate() + 1);
            diffMs = end.getTime() - start.getTime();
            diffHrs = diffMs / (1000 * 60 * 60);
        }

        // --- NEW: VALIDATION AGAINST ACTUAL CHECK-IN/OUT ---
        const shiftCheckins = await prisma.checkins.findMany({
            where: {
                emp_id: decoded.emp_id,
                timestamp: {
                    gte: new Date(start.getTime() - 24 * 60 * 60 * 1000),
                    lte: new Date(end.getTime() + 24 * 60 * 60 * 1000)
                }
            },
            orderBy: { timestamp: "asc" }
        });

        if (shiftCheckins.length === 0) {
            return NextResponse.json({ error: "ไม่พบข้อมูลการลงเวลาในกะที่คุณเลือก กรุณาเช็คอิน-เช็คเอาท์ให้เรียบร้อยก่อนส่งคำขอ OT" }, { status: 400 });
        }

        const earliestIn = shiftCheckins[0].timestamp;
        const latestOut = shiftCheckins[shiftCheckins.length - 1].timestamp;

        // Check window (Strict Rejection)
        if (start < earliestIn || end > latestOut) {
            const rangeStr = `${new Date(earliestIn).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit', timeZone: "Asia/Bangkok" })} - ${new Date(latestOut).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit', timeZone: "Asia/Bangkok" })}`;
            return NextResponse.json({ 
                error: `เวลา OT ต้องอยู่ระหว่างเวลาที่เช็คอินและเช็คเอาท์จริงเท่านั้น (เวลาบันทึกจริงของคุณคือ: ${rangeStr})`
            }, { status: 400 });
        }

        // Check Discrepancy (Warning for supervisor)
        // If OT hours > 5 OR (OT hours / Total stay duration) > 0.7
        const stayMs = latestOut.getTime() - earliestIn.getTime();
        const stayHrs = stayMs / (1000 * 60 * 60);
        let hasDiscrepancy = false;
        if (diffHrs > 5) hasDiscrepancy = true;
        else if (stayHrs > 0 && (diffHrs / stayHrs) > 0.75) hasDiscrepancy = true;

        // Get employee info
        const emp = await prisma.employees.findUnique({
            where: { emp_id: decoded.emp_id },
            include: { 
                supervisor: { select: { line_user_id: true, name: true } }
            }
        }) as any;

        if (!emp) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        if (Number(emp.base_salary) > 20000) {
            return NextResponse.json({ error: "พนักงานที่มีฐานเงินเดือนมากกว่า 20,000 บาท ไม่สามารถขอ OT ได้" }, { status: 403 });
        }

        const newOt = await prisma.ot_requests.create({
            data: {
                emp_id: decoded.emp_id,
                date_for: new Date(date_for),
                start_time: start,
                end_time: end,
                total_hours: diffHrs,
                reason: reason || "",
                status: "pending_supervisor",
                supervisor_id: emp.supervisor_id,
                actual_start_at: earliestIn,
                actual_end_at: latestOut,
                has_discrepancy: hasDiscrepancy
            }
        });

        if (emp.supervisor?.line_user_id) {
            const { formatDateShortThai, formatTime24h } = await import("@/utils/time");
            sendOtApprovalFlexMessage(emp.supervisor.line_user_id, {
                id: newOt.id,
                empName: formatName(emp.name, emp.nickname),
                dateFor: formatDateShortThai(date_for),
                startTime: formatTime24h(start),
                endTime: formatTime24h(end),
                totalHours: Number(diffHrs),
                reason: reason || "",
                hasDiscrepancy: hasDiscrepancy,
                actualIn: formatTime24h(earliestIn),
                actualOut: formatTime24h(latestOut)
            }).catch(console.error);
        }

        // ✉️ Confirm to employee that their OT request was received
        if (emp.line_user_id) {
            const { formatDateShortThai, formatTime24h } = await import("@/utils/time");
            sendEmployeeOtStatusNotification(emp.line_user_id, {
                empName: formatName(emp.name, emp.nickname),
                dateFor: formatDateShortThai(date_for),
                startTime: formatTime24h(start),
                endTime: formatTime24h(end),
                totalHours: Number(diffHrs),
                reason: reason || "",
                status: "pending_supervisor",
            }).catch(console.error);
        }

        return NextResponse.json(newOt);
    } catch (e: any) {
        console.error("OT Request Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (err) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        if (!decoded?.emp_id) return NextResponse.json({ error: "Invalid token data" }, { status: 401 });

        const requests = await prisma.ot_requests.findMany({
            where: { emp_id: decoded.emp_id },
            orderBy: { created_at: "desc" }
        });

        return NextResponse.json(requests);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (err) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        if (!decoded?.emp_id) return NextResponse.json({ error: "Invalid token data" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

        const existing = await prisma.ot_requests.findFirst({
            where: { id: Number(id), emp_id: decoded.emp_id }
        });

        if (!existing) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        if (existing.status !== "pending_supervisor") {
            return NextResponse.json({ error: "สามารถลบได้เฉพาะคำขอที่ยังไม่อนุมัติโดยหัวหน้า (pending_supervisor) เท่านั้น" }, { status: 400 });
        }

        await prisma.ot_requests.delete({
            where: { id: Number(id) }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
