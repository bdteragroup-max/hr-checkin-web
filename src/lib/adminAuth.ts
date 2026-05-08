import { cookies } from "next/headers";
import jwt, { JwtPayload } from "jsonwebtoken";

export type AdminTokenPayload = {
    emp_id: string; // admin.username
    role: string;
};

function getSecret(): string {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error("JWT_SECRET_NOT_SET");
    return s;
}

/** ✅ Next.js ของคุณ cookies() เป็น async ต้อง await */
export async function requireAdmin(): Promise<AdminTokenPayload> {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    console.log("[AUTH DEBUG] Detected Admin Token:", token ? "Exists" : "MISSING");
    if (!token) throw new Error("UNAUTHORIZED");

    const decoded = jwt.verify(token, getSecret()) as JwtPayload;

    const emp_id = decoded?.emp_id;
    const role = decoded?.role;

    if (typeof emp_id !== "string" || !emp_id || typeof role !== "string") {
        throw new Error("FORBIDDEN");
    }
    
    // We expect a role like "SUPER_ADMIN" or "WAREHOUSE_MANAGER"
    // The previous role "admin" is also allowed for backward compatibility during migration
    if (role !== "admin" && !role.includes("_ADMIN") && !role.includes("_MANAGER")) {
        throw new Error("FORBIDDEN");
    }

    return { emp_id, role };
}

export async function isAdminLoggedIn(): Promise<boolean> {
    try {
        await requireAdmin();
        return true;
    } catch {
        return false;
    }
}

