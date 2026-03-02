import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
        console.warn("Supabase credentials missing in production!");
    }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
