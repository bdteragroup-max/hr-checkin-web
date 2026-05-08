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

/** 
 * Allows both Admin tokens and Regular User tokens (if they are a supervisor) 
 */
export async function requireAdminOrSupervisor(): Promise<{ username: string; emp_id: string; role: string; isSupervisorOnly: boolean }> {
    const cookieStore = await cookies();
    
    const adminToken = cookieStore.get("admin_token")?.value;
    const userToken = cookieStore.get("token")?.value;

    let adminPayload: JwtPayload | null = null;
    let userPayload: JwtPayload | null = null;

    if (adminToken) {
        try {
            adminPayload = jwt.verify(adminToken, getSecret()) as JwtPayload;
        } catch (e) {}
    }

    if (userToken) {
        try {
            userPayload = jwt.verify(userToken, getSecret()) as JwtPayload;
        } catch (e) {}
    }

    // If Admin token exists, they have access. 
    if (adminPayload) {
        return { 
            username: adminPayload.emp_id, // admin.username
            emp_id: userPayload?.emp_id || adminPayload.emp_id, // Prefer real employee ID if linked
            role: adminPayload.role, 
            isSupervisorOnly: false 
        };
    }

    if (!userPayload?.emp_id) throw new Error("UNAUTHORIZED");

    // Verify if they are a supervisor in the DB
    const { prisma } = await import("@/lib/prisma");
    const emp = await prisma.employees.findUnique({
        where: { emp_id: userPayload.emp_id },
        select: { is_active: true }
    });

    const isSupervisorOfSomeone = await prisma.employees.findFirst({
        where: {
            OR: [
                { supervisor_id: userPayload.emp_id },
                { secondary_supervisor_id: userPayload.emp_id }
            ]
        }
    });

    if (!emp?.is_active || !isSupervisorOfSomeone) {
        throw new Error("FORBIDDEN");
    }

    return { 
        username: userPayload.emp_id, 
        emp_id: userPayload.emp_id, 
        role: "SUPERVISOR", 
        isSupervisorOnly: true 
    };
}

export async function isAdminLoggedIn(): Promise<boolean> {
    try {
        await requireAdmin();
        return true;
    } catch {
        return false;
    }
}

