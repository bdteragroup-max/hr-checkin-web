import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

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
            return NextResponse.json({ error: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น" }, { status: 400 });
        }

        // Get employee info
        const emp = await prisma.employees.findUnique({
            where: { emp_id: decoded.emp_id }
        });

        if (!emp) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        if (Number(emp.base_salary) > 20000) {
            return NextResponse.json({ error: "พนักงานที่มีฐานเงินเดือนมากกว่า 20,000 บาท ไม่สามารถขอ OT ได้" }, { status: 403 });
        }

        // Verify cycle limits (must submit before 25th of current cycle?)
        // Standard rule: just record it, supervisor approves it.

        const newOt = await prisma.ot_requests.create({
            data: {
                emp_id: decoded.emp_id,
                date_for: new Date(date_for),
                start_time: start,
                end_time: end,
                total_hours: diffHrs,
                reason: reason || "",
                status: "pending",
                supervisor_id: emp.supervisor_id
            }
        });

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

        if (existing.status !== "pending") {
            return NextResponse.json({ error: "สามารถลบได้เฉพาะคำขอที่ยังไม่อนุมัติ (pending) เท่านั้น" }, { status: 400 });
        }

        await prisma.ot_requests.delete({
            where: { id: Number(id) }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
