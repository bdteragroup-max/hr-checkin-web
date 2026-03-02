import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

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
    console.log("[UPLOAD DEBUG] Starting upload process...");
    const form = await req.formData();
    const file = form.get("file");
    const prefix = String(form.get("prefix") || "").trim();

    if (!file || !(file instanceof File)) {
        console.error("[UPLOAD ERROR] No file found in form data");
        return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }
    console.log("[UPLOAD DEBUG] File received:", file.name, "Type:", file.type, "Size:", file.size);

    // validate type/size
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!allowed.has(file.type)) {
        return NextResponse.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
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

    const filePath = `${dateFolder}/${fileName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    console.log("[UPLOAD DEBUG] Uploading to Supabase bucket 'uploads' at path:", filePath);
    const { data, error } = await supabase.storage
        .from("uploads")
        .upload(filePath, buffer, {
            contentType: file.type,
            upsert: true
        });

    if (error) {
        console.error("[UPLOAD ERROR] Supabase upload failed:", error);
        return NextResponse.json({ error: "UPLOAD_FAILED", details: error.message }, { status: 500 });
    }
    console.log("[UPLOAD DEBUG] Supabase upload success!");

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

    return NextResponse.json({ ok: true, url: publicUrl });
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
    if (!fileUrl || typeof fileUrl !== "string") {
        return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
    }

    // Extract path from public URL
    // Format: https://.../storage/v1/object/public/uploads/YYYY-MM-DD/filename.ext
    const urlParts = fileUrl.split("/uploads/");
    if (urlParts.length < 2) return NextResponse.json({ ok: true });

    const filePath = urlParts[1];
    const fileName = filePath.split("/").pop() || "";

    if (!fileName.startsWith(`${emp_id}-`)) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    try {
        await supabase.storage.from("uploads").remove([filePath]);
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("Supabase delete error:", e);
        return NextResponse.json({ ok: true });
    }
}
