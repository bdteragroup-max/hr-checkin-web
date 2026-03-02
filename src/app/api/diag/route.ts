import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const checks = {
        DATABASE_URL: !!process.env.DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        ADMIN_PEPPER: !!process.env.ADMIN_PEPPER,
        SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NODE_ENV: process.env.NODE_ENV,
    };

    const { data: bucketData, error: bucketError } = await (supabase.storage as any).getBucket("uploads").catch(() => ({ data: null, error: { message: "NOT_ACCESSIBLE" } }));

    const allOk = Object.values(checks).every(v => v !== false && v !== undefined) && !bucketError;

    return NextResponse.json({
        ok: allOk,
        checks,
        storage: {
            bucketFound: !!bucketData,
            error: bucketError?.message || "NONE",
        },
        message: allOk ? "All environment variables are detected and Storage is accessible!" : "Check logs for details.",
    });
}
