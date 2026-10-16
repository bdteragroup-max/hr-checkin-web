import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSchemaVersion?: number };

// Bust dev server in-memory singleton cache when schema is updated
const CURRENT_SCHEMA_VERSION = 2026101601;

if (globalForPrisma.prismaSchemaVersion !== CURRENT_SCHEMA_VERSION) {
    if (globalForPrisma.prisma) {
        try {
            globalForPrisma.prisma.$disconnect();
        } catch {}
    }
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaSchemaVersion = CURRENT_SCHEMA_VERSION;
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ["query", "info", "warn", "error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
    globalForPrisma.prismaSchemaVersion = CURRENT_SCHEMA_VERSION;
}
