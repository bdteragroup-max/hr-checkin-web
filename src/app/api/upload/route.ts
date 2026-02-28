import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs"; // ให้ชัวร์ว่าใช้ fs ได้

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function safeFileName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
    // auth
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    let emp_id = "";
    try {
        const payload = verifyToken(token);
        emp_id = payload.emp_id;
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // parse formData
    const form = await req.formData();
    const file = form.get("file");
    const prefix = String(form.get("prefix") || "").trim();

    if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }

    // validate type/size
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!allowed.has(file.type)) {
        return NextResponse.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB for PDF support
    if (file.size > maxBytes) {
        return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    // date folder: YYYY-MM-DD
    const now = new Date();
    const dateFolder = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

    const ext =
        file.type === "image/png" ? "png" :
            file.type === "image/webp" ? "webp" :
                file.type === "application/pdf" ? "pdf" :
                    "jpg";

    const ms = now.getTime();
    const fileName = safeFileName(
        `${emp_id}-${prefix ? prefix + "-" : ""}${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}-${ms}.${ext}`
    );

    const uploadDir = path.join(process.cwd(), "public", "uploads", dateFolder);
    await fs.mkdir(uploadDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fullPath = path.join(uploadDir, fileName);
    await fs.writeFile(fullPath, buffer);

    const url = `/uploads/${dateFolder}/${fileName}`;
    return NextResponse.json({ ok: true, url });
}

export async function DELETE(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    let emp_id = "";
    try {
        const payload = verifyToken(token);
        emp_id = payload.emp_id;
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const fileUrl = body.url;
    if (!fileUrl || typeof fileUrl !== "string" || !fileUrl.startsWith("/uploads/")) {
        return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
    }

    const parts = fileUrl.split("/");
    const fileName = parts[parts.length - 1];

    if (!fileName.startsWith(`${emp_id}-`)) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    try {
        const fullPath = path.join(process.cwd(), "public", "uploads", parts[parts.length - 2], fileName);
        await fs.unlink(fullPath);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: true });
    }
}

