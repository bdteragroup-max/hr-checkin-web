import { createClient } from "@supabase/supabase-js";

let client: any = null;

// Use a Proxy to delay calling createClient until the 'supabase' object is actually accessed.
export const supabase = new Proxy({} as any, {
    get(target, prop) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        // If we haven't initialized, or if we initialized with placeholders but now have real keys
        if (!client || (client.__isPlaceholder && url && key)) {
            const finalUrl = url || "https://placeholder.supabase.co";
            const finalKey = key || "placeholder-key";
            client = createClient(finalUrl, finalKey);
            (client as any).__isPlaceholder = !url || !key;
        }
        return client[prop];
    }
});
