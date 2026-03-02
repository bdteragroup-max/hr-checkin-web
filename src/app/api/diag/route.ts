import { NextResponse } from "next/server";

export async function GET() {
    const checks = {
        DATABASE_URL: !!process.env.DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        ADMIN_PEPPER: !!process.env.ADMIN_PEPPER,
        SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NODE_ENV: process.env.NODE_ENV,
    };

    const allOk = Object.values(checks).every(v => v !== false && v !== undefined);

    return NextResponse.json({
        ok: allOk,
        checks,
        message: allOk ? "All environment variables are detected!" : "Some environment variables are MISSING. Check your Vercel settings.",
    });
}
