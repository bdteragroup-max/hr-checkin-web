import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (e) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        if (!decoded?.emp_id) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

        // Fetch requests from employees where supervisor_id = this user
        const requests = await prisma.ot_requests.findMany({
            where: {
                employee: {
                    supervisor_id: decoded.emp_id
                },
                status: "pending"
            },
            include: {
                employee: {
                    select: { name: true, emp_id: true }
                }
            },
            orderBy: { created_at: "desc" }
        });

        // Also fetch history of already approved/rejected ones
        const history = await prisma.ot_requests.findMany({
            where: {
                employee: {
                    supervisor_id: decoded.emp_id
                },
                status: { not: "pending" }
            },
            include: {
                employee: {
                    select: { name: true, emp_id: true }
                }
            },
            orderBy: { updated_at: "desc" },
            take: 50
        });

        return NextResponse.json({ pending: requests, history });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const token = (await cookies()).get("token")?.value;
        if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (e) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        const body = await request.json();
        const { id, status, approved_hours } = body;

        if (!id || !status) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const reqId = Number(id);

        // Verify that the OT request belongs to a subordinate of this supervisor
        const existing = await prisma.ot_requests.findUnique({
            where: { id: reqId },
            include: { employee: true }
        });

        if (!existing || existing.employee.supervisor_id !== decoded.emp_id) {
            return NextResponse.json({ error: "Unauthorized or not found" }, { status: 403 });
        }

        const updateData: any = {
            status,
            approved_at: new Date(),
            supervisor_id: decoded.emp_id
        };

        if (status === "approved" && approved_hours !== undefined) {
            updateData.approved_hours = Number(approved_hours);
        }

        const updated = await prisma.ot_requests.update({
            where: { id: reqId },
            data: updateData
        });

        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
