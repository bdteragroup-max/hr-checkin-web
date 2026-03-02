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

        // 1. READ TEST
        let files: any[] = [];
        let readError: any = null;
        try {
            const res = await supabase.storage.from("uploads").list("", { limit: 1 });
            files = res.data || [];
            readError = res.error;
        } catch (e: any) {
            readError = { message: e.message };
        }

        // 2. WRITE TEST (Upload a tiny dummy image file to bypass MIME check)
        let writeOk = false;
        let writeError: any = null;
        const testPath = `.diag-test-${Date.now()}.jpg`;
        try {
            // A tiny valid 1x1 pixel JPEG if possible, but just a buffer with image/jpeg type usually satisfies Supabase if it's not inspecting content deeply
            const { data, error } = await supabase.storage.from("uploads").upload(testPath, Buffer.from("diag-test"), {
                contentType: "image/jpeg",
                upsert: true
            });
            if (error) {
                writeError = error;
            } else {
                writeOk = true;
                // Cleanup
                await supabase.storage.from("uploads").remove([testPath]);
            }
        } catch (e: any) {
            writeError = { message: e.message };
        }

        return NextResponse.json({
            ok: writeOk && !readError,
            checks,
            storage: {
                readAccess: !readError,
                writeAccess: writeOk,
                readError: readError?.message || "NONE",
                writeError: writeError?.message || "NONE",
            },
            timestamp: new Date().toISOString(),
            message: writeOk ? "Storage WRITE Test SUCCESSFUL!" : "Storage WRITE Test FAILED.",
            action: !writeOk ? "Check if policies allow 'INSERT' for Everyone/Anon on the 'uploads' bucket." : "Connection is perfect. Issue might be file parsing."
        });
    } catch (globalError: any) {
        return NextResponse.json({
            error: "DIAG_CRASHED",
            message: globalError.message
        }, { status: 500 });
    }
}
