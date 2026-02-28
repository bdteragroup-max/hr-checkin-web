import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const username = String(body?.username || "").trim();
        const newPassword = String(body?.newPassword || "");

        if (!username || !newPassword) {
            return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
        }
        if (newPassword.length < 10) {
            return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
        }

        const pepper = process.env.ADMIN_PEPPER;
        if (!pepper) {
            return NextResponse.json(
                { error: "SERVER_MISCONFIG", detail: "Missing ADMIN_PEPPER in .env (restart dev server)" },
                { status: 500 }
            );
        }

        const hash = await bcrypt.hash(newPassword + pepper, 12);

        await prisma.admins.update({
            where: { username },
            data: { password_hash: hash },
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json(
            { error: "RESET_FAILED", detail: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
