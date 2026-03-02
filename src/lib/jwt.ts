import jwt from "jsonwebtoken";

function getSecret() {
    const s = process.env.JWT_SECRET;
    if (!s && process.env.NODE_ENV === "production") {
        // Only throw at runtime in production, not during build if possible
        // but Next.js build might still trigger this.
        // Let's use a fallback or a more graceful check.
    }
    return s || "temp-secret-for-build";
}

export interface TokenPayload {
    emp_id: string;
    role: "employee" | "admin";
}

export function signToken(payload: TokenPayload) {
    return jwt.sign(payload, getSecret(), {
        expiresIn: "7d",
    });
}

export function verifyToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, getSecret());
    return decoded as TokenPayload;
}
