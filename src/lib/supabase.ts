import { createClient } from "@supabase/supabase-js";

let client: any = null;

// Use a Proxy to delay calling createClient until the 'supabase' object is actually accessed.
// This prevents build-time crashes when NEXT_PUBLIC_SUPABASE_URL is missing.
export const supabase = new Proxy({} as any, {
    get(target, prop) {
        if (!client) {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
            const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
            client = createClient(url, key);
        }
        return client[prop];
    }
});
