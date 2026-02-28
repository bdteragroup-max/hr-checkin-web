import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

function requireAdmin(token?: string) {
    if (!token) return null;
    try {
        const payload = verifyToken(token);
        if (payload.role !== "admin") return null;
        return payload;
    } catch {
        return null;
    }
}

// GET: fetch active projects (for dropdown) or all (for admin)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1"; // If 1, admin view wants all including inactive

    try {
        const token = (await cookies()).get("admin_token")?.value;
        const isAdmin = requireAdmin(token);

        const whereClause = (all && isAdmin) ? {} : { is_active: true };

        const projects = await prisma.projects.findMany({
            where: whereClause,
            orderBy: [{ name: "asc" }]
        });
        return NextResponse.json({ ok: true, projects });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to fetch projects" }, { status: 500 });
    }
}

// POST: create a new project (Admin or Employee)
export async function POST(req: Request) {
    const adminToken = (await cookies()).get("admin_token")?.value;
    const empToken = (await cookies()).get("token")?.value;

    let isAuth = false;
    if (adminToken && requireAdmin(adminToken)) isAuth = true;
    else if (empToken) {
        try {
            const p = verifyToken(empToken);
            if (p) isAuth = true;
        } catch { }
    }

    if (!isAuth) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const body = await req.json();
        const { code, name, client_name, address, status, contact, phone, lat, lng, radius_m } = body;

        if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

        let finalCode = code;
        if (!finalCode) {
            const latest = await prisma.projects.findFirst({ orderBy: { id: "desc" } });
            const nextId = (latest?.id || 0) + 1;
            finalCode = `CUS-${String(nextId).padStart(3, "0")}`;
        }

        const project = await prisma.projects.create({
            data: {
                code: finalCode, name, client_name, address, is_active: true,
                status: status || "NEW",
                contact: contact || null,
                phone: phone || null,
                lat: lat ? Number(lat) : null,
                lng: lng ? Number(lng) : null,
                radius_m: radius_m ? Number(radius_m) : 200
            }
        });
        return NextResponse.json({ ok: true, project });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to create project" }, { status: 500 });
    }
}

// PUT: update an existing project (Admin Only)
export async function PUT(req: Request) {
    const token = (await cookies()).get("admin_token")?.value;
    if (!requireAdmin(token)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const body = await req.json();
        const { id, code, name, client_name, address, is_active, status, contact, phone, lat, lng, radius_m } = body;

        if (!id || !name) return NextResponse.json({ error: "ID and name are required" }, { status: 400 });

        const project = await prisma.projects.update({
            where: { id: parseInt(id) },
            data: {
                code,
                name,
                client_name,
                address,
                status: status || undefined,
                contact: contact !== undefined ? contact : undefined,
                phone: phone !== undefined ? phone : undefined,
                lat: lat !== undefined ? (lat ? Number(lat) : null) : undefined,
                lng: lng !== undefined ? (lng ? Number(lng) : null) : undefined,
                radius_m: radius_m !== undefined ? Number(radius_m) : undefined,
                is_active: is_active !== undefined ? is_active : true,
                updated_at: new Date()
            }
        });
        return NextResponse.json({ ok: true, project });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to update project" }, { status: 500 });
    }
}

// DELETE: remove a project (Admin Only)
export async function DELETE(req: Request) {
    const token = (await cookies()).get("admin_token")?.value;
    if (!requireAdmin(token)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        // You might want to soft-delete by setting is_active = false instead of hard deleting
        // but for now, we'll hard delete.
        await prisma.projects.delete({
            where: { id: parseInt(id) }
        });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to delete project" }, { status: 500 });
    }
}
