import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        const action = body?.action; // "request_otp" | "verify_and_reset"
        const emp_id = (body?.emp_id || "").trim();
        const phone_number = (body?.phone_number || "").trim();

        if (!emp_id || !phone_number) {
            return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
        }

        const emp = await prisma.employees.findUnique({
            where: { emp_id },
            select: { emp_id: true, phone_number: true, is_active: true, otp_code: true, otp_expires_at: true }
        });

        if (!emp || !emp.is_active) {
            return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
        }

        // Strictly validate phone number against DB
        if (!emp.phone_number || emp.phone_number.trim() !== phone_number) {
            return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
        }

        if (action === "request_otp") {
            const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

            await prisma.employees.update({
                where: { emp_id },
                data: { otp_code: otp, otp_expires_at: expiresAt }
            });

            // Simulate SMS sending
            console.log(`[SMS MOCK] Send OTP ${otp} to ${phone_number} for EMP ${emp_id}`);

            return NextResponse.json({ ok: true, message: "OTP sent", otp_debug: otp });
        } else if (action === "verify_and_reset") {
            const pin = (body?.pin || "").trim();
            const otp = (body?.otp || "").trim();

            if (!pin || !otp) {
                return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
            }

            if (pin.length < 4) {
                return NextResponse.json({ error: "PIN_TOO_SHORT" }, { status: 400 });
            }

            if (emp.otp_code !== otp) {
                return NextResponse.json({ error: "INVALID_OTP" }, { status: 401 });
            }

            if (!emp.otp_expires_at || emp.otp_expires_at < new Date()) {
                return NextResponse.json({ error: "EXPIRED_OTP" }, { status: 401 });
            }

            // Valid! Hash new PIN and clear OTP
            const pin_hash = await bcrypt.hash(pin, 10);

            await prisma.employees.update({
                where: { emp_id },
                data: { pin_hash, otp_code: null, otp_expires_at: null }
            });

            return NextResponse.json({ ok: true, message: "PIN updated successfully" });
        } else {
            return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
        }

    } catch (e: any) {
        console.error("Reset PIN error:", e);
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
}
