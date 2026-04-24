import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function getAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch (e) {
        return null;
    }
}

export async function GET() {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const claims = await prisma.commission_claims.findMany({
            where: { emp_id: user.emp_id },
            orderBy: { date: "desc" }
        });
        return NextResponse.json({ ok: true, list: claims });
    } catch (e) {
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const {
            date,
            customer_name,
            companion_ids, // Array of strings
            selling_price
        } = body;

        // Validation
        if (!date || !customer_name) {
            return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
        }

        const price = Number(selling_price) || 0;
        const totalCommission = price * 0.01;
        const companions = Array.isArray(companion_ids) ? companion_ids : [];
        const perPersonCommission = totalCommission / (companions.length + 1); // +1 for the submitter

        // Get employee's current supervisor
        const emp = await prisma.employees.findUnique({
            where: { emp_id: user.emp_id },
            select: { supervisor_id: true }
        });

        const claim = await prisma.commission_claims.create({
            data: {
                emp_id: user.emp_id,
                date: new Date(date),
                customer_name,
                companion_ids: companions,
                selling_price: price,
                commission_rate: 0.01,
                total_commission: totalCommission,
                per_person_commission: perPersonCommission,
                status: "pending_supervisor",
                supervisor_id: emp?.supervisor_id
            }
        });

        // Notify Supervisor
        try {
            const employeeData = await prisma.employees.findUnique({
                where: { emp_id: user.emp_id },
                select: { name: true, supervisor_id: true }
            });

            if (employeeData && employeeData.supervisor_id) {
                const supervisor = await prisma.employees.findUnique({
                    where: { emp_id: employeeData.supervisor_id },
                    select: { line_user_id: true }
                });

                if (supervisor?.line_user_id) {
                    const { sendCommissionClaimNotification } = await import("@/utils/lineMessaging");
                    await sendCommissionClaimNotification({
                        id: claim.id,
                        employeeName: employeeData.name,
                        customerName: customer_name,
                        date: new Date(date).toLocaleDateString("th-TH"),
                        totalAmount: totalCommission.toLocaleString(),
                        perPerson: perPersonCommission.toLocaleString(),
                        status: "pending_supervisor"
                    }, [supervisor.line_user_id]);
                }
            }
        } catch (err) {
            console.error("Commission notification error:", err);
        }

        return NextResponse.json({ ok: true, data: claim });
    } catch (e: any) {
        console.error("Commission claim error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
