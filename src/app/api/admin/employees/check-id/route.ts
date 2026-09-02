import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrSupervisor, getSubordinateFilter } from "@/lib/adminAuth";

// Simple in-memory rate limiter
// Key: emp_id, Value: [timestamps]
const rateLimits = new Map<string, number[]>();

export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrSupervisor();
        
        // Rate limiting logic: allow 25 requests per minute per user
        // This easily handles batch entries without opening up enumeration attacks
        const now = Date.now();
        const timestamps = rateLimits.get(auth.emp_id) || [];
        // Keep only timestamps from the last minute
        const recent = timestamps.filter(t => now - t < 60000);
        
        if (recent.length >= 25) {
            return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
        }
        
        recent.push(now);
        rateLimits.set(auth.emp_id, recent);

        // Get national_id from URL
        const url = new URL(req.url);
        const national_id = url.searchParams.get("national_id");
        const exclude_emp_id = url.searchParams.get("exclude_emp_id");

        if (!national_id || national_id.trim() === "") {
            return NextResponse.json({ ok: true, exists: false });
        }

        const subordinateFilter = getSubordinateFilter(auth);

        // Build the where clause
        const where: any = {
            ...subordinateFilter,
            national_id_card: national_id.trim()
        };

        if (exclude_emp_id) {
            where.emp_id = { not: exclude_emp_id };
        }

        const count = await prisma.employees.count({ where });

        return NextResponse.json({ ok: true, exists: count > 0 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "ERROR";
        const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ ok: false, error: msg }, { status });
    }
}
