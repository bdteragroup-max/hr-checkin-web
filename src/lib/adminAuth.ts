import { cookies } from "next/headers";
import jwt, { JwtPayload } from "jsonwebtoken";

export type AdminTokenPayload = {
    emp_id: string; // admin.username ถูกใส่ใน emp_id ตาม /api/admin/login
    role: "admin";
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

    if (role !== "admin" || typeof emp_id !== "string" || !emp_id) {
        throw new Error("FORBIDDEN");
    }

    return { emp_id, role: "admin" };
}
