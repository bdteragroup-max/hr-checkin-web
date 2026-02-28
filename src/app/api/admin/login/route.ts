import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/jwt";

export const runtime = "nodejs";

function getIp(req: Request) {
    const xf = req.headers.get("x-forwarded-for");
    if (xf) return xf.split(",")[0].trim();
    return "local";
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!username || !password) {
        return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const pepper = process.env.ADMIN_PEPPER;
    if (!pepper) return NextResponse.json({ error: "SERVER_MISCONFIG" }, { status: 500 });

    const ip = getIp(req);

    // ✅ rate limit 10 ครั้ง / 10 นาที ต่อ username+ip
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    const attempts = await prisma.admin_login_attempts.count({
        where: {
            username,
            ip,
            created_at: { gte: tenMinAgo },
        },
    });

    if (attempts >= 10) {
        return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }

    const admin = await prisma.admins.findUnique({
        where: { username },
        select: { id: true, username: true, password_hash: true, full_name: true },
    });

    if (!admin) {
        await prisma.admin_login_attempts.create({ data: { username, ip } });
        return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password + pepper, admin.password_hash);

    if (!ok) {
        await prisma.admin_login_attempts.create({ data: { username, ip } });
        return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    const token = signToken({ emp_id: admin.username, role: "admin" });

    const res = NextResponse.json({
        ok: true,
        admin: { username: admin.username, full_name: admin.full_name },
    });

    res.cookies.set("admin_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // For testing localhost and cross-domain if HTTP
        path: "/",
        maxAge: 60 * 60 * 12, // 12 ชม.
    });

    return res;
}
