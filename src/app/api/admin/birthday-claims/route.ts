import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";


export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
        const claims = await prisma.birthday_claims.findMany({
            include: {
                employees: { select: { nickname: true } }
            },
            orderBy: { created_at: "desc" }
        });

        const formattedClaims = claims.map((c: any) => {
            const nickname = c.employees?.nickname;
            let finalName = c.name || "";
            if (nickname && !finalName.includes(`(${nickname})`)) {
                finalName = `${finalName} (${nickname})`;
            }
            return {
                ...c,
                name: finalName
            };
        });

        return NextResponse.json({ ok: true, claims: formattedClaims });
    } catch (e) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
}
