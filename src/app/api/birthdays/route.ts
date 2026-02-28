import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
    try {
        // Today in Bangkok
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const m = now.getMonth() + 1;
        const d = now.getDate();

        // Fetch active employees with birthdays
        // We fetch all and filter in JS for simplicity/database compatibility
        const employees = await prisma.employees.findMany({
            where: { is_active: true, NOT: { birth_date: null } },
            select: { emp_id: true, name: true, birth_date: true }
        });

        const todayBirthdays = employees.filter(emp => {
            if (!emp.birth_date) return false;
            const b = new Date(emp.birth_date);
            return (b.getMonth() + 1) === m && b.getDate() === d;
        }).map(emp => ({
            emp_id: emp.emp_id,
            name: emp.name
        }));

        return NextResponse.json({ ok: true, list: todayBirthdays });
    } catch (e) {
        console.error("Birthday fetch error:", e);
        return NextResponse.json({ ok: false, error: "ERROR" }, { status: 500 });
    }
}
