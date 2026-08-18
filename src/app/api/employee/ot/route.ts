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
        const { date_for, start_time, end_time, reason, is_forgot_clock, forgot_reason, proof_url } = body;

        if (is_forgot_clock && (!forgot_reason || forgot_reason.trim() === "")) {
            return NextResponse.json({ error: "คุณเลือกลืมลงเวลา กรุณาระบุเหตุผลที่ลืมลงเวลา" }, { status: 400 });
        }

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
        // Use date_key to accurately get check-ins for the specified shift date
        const dateForObj = new Date(date_for);
        const nextDate = new Date(dateForObj);
        nextDate.setDate(nextDate.getDate() + 1);

        const baseCheckins = await prisma.checkins.findMany({
            where: {
                emp_id: decoded.emp_id,
                date_key: dateForObj
            },
            orderBy: { timestamp: "asc" }
        });

        // Also fetch any checkouts on the next day before 06:00 AM 
        // to retroactively fix Offsite-Out/Project-Out records that were saved on the wrong date_key due to a previous bug
        const nextDayCheckins = await prisma.checkins.findMany({
            where: {
                emp_id: decoded.emp_id,
                date_key: nextDate,
                timestamp: { lt: new Date(nextDate.getTime() + 6 * 60 * 60 * 1000) }
            },
            orderBy: { timestamp: "asc" }
        });

        const shiftCheckins = [...baseCheckins, ...nextDayCheckins.filter(c => c.type.endsWith("-Out") || c.type === "Check-out")];

        let earliestIn = null;
        let latestOut = null;
        let hasDiscrepancy = false;

        if (!is_forgot_clock) {
            if (shiftCheckins.length === 0) {
                return NextResponse.json({ error: "ไม่พบข้อมูลการลงเวลาในกะที่คุณเลือก กรุณาเช็คอิน-เช็คเอาท์ให้เรียบร้อยก่อนส่งคำขอ OT หรือทำเครื่องหมาย 'ลืมลงเวลาเข้า/ออกงาน'" }, { status: 400 });
            }

            earliestIn = shiftCheckins[0].timestamp;
            const lastAction = shiftCheckins[shiftCheckins.length - 1];
            latestOut = lastAction.timestamp;

            // Ensure the user has actually checked out
            if (lastAction.type.endsWith("-In") || lastAction.type === "Check-in" || lastAction.type === "Trip-Update") {
                return NextResponse.json({ error: "คุณต้องทำการ 'บันทึกออก (Check-out)' ให้เรียบร้อยก่อน จึงจะสามารถส่งคำขอ OT ได้ หรือทำเครื่องหมาย 'ลืมลงเวลาเข้า/ออกงาน'" }, { status: 400 });
            }

            // Check window (Strict Rejection)
            if (start < earliestIn || end > latestOut) {
                const rangeStr = `${new Date(earliestIn).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit', timeZone: "Asia/Bangkok" })} - ${new Date(latestOut).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit', timeZone: "Asia/Bangkok" })}`;
                return NextResponse.json({ 
                    error: `เวลา OT ต้องอยู่ระหว่างเวลาที่เช็คอินและเช็คเอาท์จริงเท่านั้น (เวลาบันทึกจริงของคุณคือ: ${rangeStr})`
                }, { status: 400 });
            }

            // Check Discrepancy (Warning for supervisor)
            const stayMs = latestOut.getTime() - earliestIn.getTime();
            const stayHrs = stayMs / (1000 * 60 * 60);
            if (diffHrs > 5) hasDiscrepancy = true;
            else if (stayHrs > 0 && (diffHrs / stayHrs) > 0.75) hasDiscrepancy = true;
        } else {
            if (shiftCheckins.length > 0) {
                earliestIn = shiftCheckins[0].timestamp;
                latestOut = shiftCheckins[shiftCheckins.length - 1].timestamp;
            }
            hasDiscrepancy = true;
        }

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
                has_discrepancy: hasDiscrepancy,
                is_forgot_clock: Boolean(is_forgot_clock),
                forgot_reason: is_forgot_clock ? forgot_reason : null,
                proof_url: is_forgot_clock ? proof_url : null
            } as any
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
                actualIn: earliestIn ? formatTime24h(earliestIn) : "-",
                actualOut: latestOut ? formatTime24h(latestOut) : "-",
                isForgotClock: Boolean(is_forgot_clock),
                forgotReason: is_forgot_clock ? forgot_reason : ""
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
