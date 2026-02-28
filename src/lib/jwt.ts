import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in .env");
}

export interface TokenPayload {
    emp_id: string;
    role: "employee" | "admin";
}

export function signToken(payload: TokenPayload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: "7d",
    });
}

export function verifyToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as TokenPayload;
}
