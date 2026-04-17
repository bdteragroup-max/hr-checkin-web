import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { sendPayslipNotification } from "@/utils/lineMessaging";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(request.url);
        const emp_id = searchParams.get("emp_id");

        if (!emp_id) {
            return NextResponse.json({ error: "Missing emp_id (e.g. ?emp_id=TE00001)" }, { status: 400 });
        }

        // 1. Find employee
        const emp = await prisma.employees.findFirst({
            where: {
                emp_id: {
                    equals: emp_id,
                    mode: 'insensitive'
                }
            }
        });

        if (!emp) {
            return NextResponse.json({ 
                ok: false, 
                reason: "Employee not found", 
                checked_id: emp_id 
            });
        }

        if (!emp.line_user_id) {
            return NextResponse.json({ 
                ok: false, 
                reason: "No line_user_id linked for this employee", 
                employee: { id: emp.emp_id, name: emp.name } 
            });
        }

        // 2. Try sending test notification
        // Note: We use the current month/year for testing
        const now = new Date();
        const success = await sendPayslipNotification(emp.line_user_id, {
            empName: emp.name,
            month: now.getMonth() + 1,
            year: now.getFullYear()
        });

        if (success) {
            return NextResponse.json({ 
                ok: true, 
                message: "Notification sent successfully!", 
                employee: { id: emp.emp_id, name: emp.name },
                line_id: emp.line_user_id
            });
        } else {
            return NextResponse.json({ 
                ok: false, 
                reason: "LINE API rejected the message. Check server logs for exact error.", 
                employee: { id: emp.emp_id, name: emp.name },
                line_id: emp.line_user_id
            });
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
