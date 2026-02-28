import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
    try {
        await requireAdmin();
    } catch (e) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const ots = await prisma.ot_requests.findMany({
            orderBy: { created_at: "desc" },
            include: {
                employee: {
                    select: { name: true, departments: { select: { name: true } } }
                }
            }
        });

        // Fetch supervisor names manually since there is no direct relation mapping
        const supervisorIds = [...new Set(ots.map(o => o.supervisor_id).filter(Boolean))] as string[];
        const supervisors = await prisma.employees.findMany({
            where: { emp_id: { in: supervisorIds } },
            select: { emp_id: true, name: true }
        });
        const supMap = Object.fromEntries(supervisors.map(s => [s.emp_id, s.name]));

        const resData = ots.map(o => ({
            ...o,
            supervisor_name: o.supervisor_id ? supMap[o.supervisor_id] : null
        }));

        return NextResponse.json(resData);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
    } catch (e) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, status, approved_hours, remark } = body;

        if (!id || !status) {
            return NextResponse.json({ ok: false, error: "Missing ID or status" }, { status: 400 });
        }

        const updateData: any = {
            status,
            supervisor_remark: remark, // Admin can reuse this field or we can add admin_remark
            updated_at: new Date()
        };

        if (status === "approved" && approved_hours !== undefined) {
            updateData.approved_hours = Number(approved_hours);
        }

        const updated = await prisma.ot_requests.update({
            where: { id: Number(id) },
            data: updateData
        });

        return NextResponse.json({ ok: true, data: updated });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
