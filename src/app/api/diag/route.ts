import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        const checks: any = {
            DATABASE_URL: !!process.env.DATABASE_URL,
            JWT_SECRET: !!process.env.JWT_SECRET,
            ADMIN_PEPPER: !!process.env.ADMIN_PEPPER,
            SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...` : "MISSING",
            SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10)}...` : "MISSING",
            NODE_ENV: process.env.NODE_ENV,
        };

        // 1. Try to list files in the 'uploads' bucket instead of listing all buckets
        // This is a much better test of the object policies
        let files: any[] = [];
        let storageError: any = null;

        try {
            const res = await supabase.storage.from("uploads").list("", { limit: 1 });
            files = res.data || [];
            storageError = res.error;
        } catch (e: any) {
            storageError = { message: e.message || "Native crash in bucket.list()" };
        }

        const connectionWorking = !storageError;

        return NextResponse.json({
            ok: connectionWorking,
            checks,
            storage: {
                connected: connectionWorking,
                canListObjects: !!files,
                error: storageError?.message || "NONE",
            },
            timestamp: new Date().toISOString(),
            message: connectionWorking ? "Storage connection is SUCCESSFUL!" : "Storage connection error detected.",
            action: !connectionWorking ? "Check if policies allow 'SELECT' for Everyone/Anon on the 'uploads' bucket." : "You can now try uploading files on the website!"
        });
    } catch (globalError: any) {
        return NextResponse.json({
            error: "DIAG_CRASHED",
            message: globalError.message
        }, { status: 500 });
    }
}
