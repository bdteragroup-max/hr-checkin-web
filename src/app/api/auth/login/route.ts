
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/jwt";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const emp_id = (body?.emp_id || "").trim();
  const pin = (body?.pin || "").trim();

  if (!emp_id || !pin) return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });

  const emp = await prisma.employees.findUnique({ where: { emp_id } });
  if (!emp || !emp.is_active || !emp.pin_hash) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const ok = await bcrypt.compare(pin, emp.pin_hash);
  if (!ok) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });

  const token = signToken({ emp_id: emp.emp_id, role: "employee" });

  const res = NextResponse.json({ ok: true, emp_id: emp.emp_id, name: emp.name });
  res.cookies.set("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // localhost
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
