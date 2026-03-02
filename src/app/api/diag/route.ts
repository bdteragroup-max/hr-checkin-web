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

        // 1. Check if we can even talk to Supabase
        let buckets: any[] = [];
        let listError: any = null;

        try {
            const res = await supabase.storage.listBuckets();
            buckets = res.data || [];
            listError = res.error;
        } catch (e: any) {
            listError = { message: e.message || "Native crash in listBuckets" };
        }

        const bucketNames = buckets.map(b => b.name);
        const uploadsExists = bucketNames.includes("uploads");

        return NextResponse.json({
            ok: uploadsExists,
            checks,
            storage: {
                availableBuckets: bucketNames,
                uploadsExists,
                listError: listError?.message || "NONE",
            },
            timestamp: new Date().toISOString(),
            help: !uploadsExists ? "Bucket 'uploads' not found. Ensure it is created and Public in Supabase." : "Storage is connected!"
        });
    } catch (globalError: any) {
        return NextResponse.json({
            error: "DIAG_CRASHED",
            message: globalError.message
        }, { status: 500 });
    }
}
