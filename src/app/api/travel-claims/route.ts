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
        const claims = await prisma.travel_claims.findMany({
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
            end_date,
            claim_type,
            site_name,
            is_overnight,
            accommodation_amount,
            accommodation_receipt_url,
            report_url,
            has_pre_approval,
            is_supervisor_shared
        } = body;

        // Validation
        if (!date || !claim_type || !site_name || !report_url) {
            return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
        }

        // Rule: Overnight stays require a receipt
        if (is_overnight && !accommodation_receipt_url && Number(accommodation_amount) > 0) {
            return NextResponse.json({ ok: false, error: "Accommodation receipt is required for overnight stays" }, { status: 400 });
        }

        // Rule: Accommodation limit is 600 unless shared with supervisor or pre-approved
        const amount = Number(accommodation_amount) || 0;
        if (is_overnight && amount > 600 && !is_supervisor_shared && !has_pre_approval) {
            return NextResponse.json({ ok: false, error: "Accommodation amount cannot exceed 600 THB unless shared with supervisor or pre-approved" }, { status: 400 });
        }

        // Get employee's current supervisor and salary_type
        const emp = await prisma.employees.findUnique({
            where: { emp_id: user.emp_id },
            select: { supervisor_id: true, salary_type: true }
        });

        // Rule: Interns (salary_type: daily) cannot claim upcountry allowance
        if (claim_type === "upcountry" && emp?.salary_type === "daily") {
            return NextResponse.json({ ok: false, error: "Interns are prohibited from claiming allowances for working outside the province. Please check your status daily at http://localhost:3000/admin/employees." }, { status: 403 });
        }

        const claim = await prisma.travel_claims.create({
            data: {
                emp_id: user.emp_id,
                date: new Date(date),
                end_date: end_date ? new Date(end_date) : new Date(date),
                claim_type,
                site_name,
                is_overnight: !!is_overnight,
                accommodation_amount: Number(accommodation_amount) || 0,
                accommodation_receipt_url,
                report_url,
                has_pre_approval: !!has_pre_approval,
                is_supervisor_shared: !!is_supervisor_shared,
                status: "pending_supervisor",
                supervisor_id: emp?.supervisor_id
            } as any
        });

        // Notify Supervisor
        try {
            const employeeData = await prisma.employees.findUnique({
                where: { emp_id: user.emp_id },
                select: { name: true, nickname: true, supervisor_id: true }
            });

            if (employeeData) {
                const supervisor = await prisma.employees.findUnique({
                    where: { emp_id: employeeData.supervisor_id || "" },
                    select: { line_user_id: true }
                });

                const employeeWithLine = await prisma.employees.findUnique({
                    where: { emp_id: user.emp_id },
                    select: { line_user_id: true }
                });

                const { sendTravelClaimNotification } = await import("@/utils/lineMessaging");
                const { formatName } = await import("@/utils/formatName");
                const empDisplayName = formatName(employeeData.name, (employeeData as any).nickname);
                
                // 1. Notify Supervisor (Action required)
                if (supervisor?.line_user_id) {
                    await sendTravelClaimNotification({
                        id: claim.id,
                        employeeName: empDisplayName,
                        claimType: body.claim_type,
                        siteName: body.site_name,
                        dateRange: `${body.date}${body.end_date ? ` - ${body.end_date}` : ""}`,
                        amount: `${body.accommodation_amount || 0} THB`,
                        status: "pending_supervisor",
                        reportUrl: body.report_url
                    }, [supervisor.line_user_id]);
                }

                // 2. Notify Employee (Submission confirmation)
                if (employeeWithLine?.line_user_id) {
                    await sendTravelClaimNotification({
                        id: claim.id,
                        employeeName: empDisplayName,
                        claimType: body.claim_type,
                        siteName: body.site_name,
                        dateRange: `${body.date}${body.end_date ? ` - ${body.end_date}` : ""}`,
                        amount: `${body.accommodation_amount || 0} THB`,
                        status: "pending_supervisor",
                        reportUrl: body.report_url,
                        hideButtons: true
                    }, [employeeWithLine.line_user_id]);
                }
            }
        } catch (error) {
            console.error("Travel claim notification error:", error);
        }

        return NextResponse.json({ ok: true, data: claim });
    } catch (e: any) {
        console.error("Travel claim error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
