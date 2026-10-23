import { NextResponse } from "next/server";
import { requireAdminOrSupervisor } from "@/lib/adminAuth";
import { syncAllHumanSoftEmployees } from "@/lib/humansoftSyncEmployees";

export const dynamic = "force-dynamic";

/**
 * GET: Preview or sync employees from HumanSoft
 * Query: ?dry_run=true (default: preview only)
 */
export async function GET(req: Request) {
    try {
        await requireAdminOrSupervisor();

        const { searchParams } = new URL(req.url);
        const dryRun = searchParams.get("dry_run") !== "false"; // default to preview

        const result = await syncAllHumanSoftEmployees({ dryRun });
        return NextResponse.json(result);
    } catch (e: any) {
        console.error("[HumanSoft Employee Sync GET Error]:", e);
        return NextResponse.json({ ok: false, error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}

/**
 * POST: Execute synchronization from HumanSoft into local employees table
 * Body: { dryRun?: boolean }
 */
export async function POST(req: Request) {
    try {
        await requireAdminOrSupervisor();

        const body = await req.json().catch(() => ({}));
        const dryRun = Boolean(body.dryRun);

        const result = await syncAllHumanSoftEmployees({ dryRun });
        return NextResponse.json(result);
    } catch (e: any) {
        console.error("[HumanSoft Employee Sync POST Error]:", e);
        return NextResponse.json({ ok: false, error: e.message || "INTERNAL_ERROR" }, { status: 500 });
    }
}
