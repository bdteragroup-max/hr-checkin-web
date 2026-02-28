import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));

        const username = String(body?.username || "").trim();
        const password = String(body?.password || "");
        const full_name = body?.full_name ? String(body.full_name) : null;

        if (!username || !password) {
            return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
        }
        if (password.length < 10) {
            return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
        }

        const pepper = process.env.ADMIN_PEPPER;
        if (!pepper) {
            return NextResponse.json(
                { error: "SERVER_MISCONFIG", detail: "Missing ADMIN_PEPPER in .env (restart dev server after setting)" },
                { status: 500 }
            );
        }

        const passwordHash = await bcrypt.hash(password + pepper, 12);

        await prisma.admins.create({
            data: {
                username,
                password_hash: passwordHash,
                full_name,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        // ✅ คืน JSON เสมอ
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // Unique constraint (username ซ้ำ)
            if (err.code === "P2002") {
                return NextResponse.json({ error: "USERNAME_EXISTS" }, { status: 409 });
            }
        }

        return NextResponse.json(
            { error: "CREATE_ADMIN_FAILED", detail: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
