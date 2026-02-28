const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const res = await prisma.$queryRaw`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conname LIKE 'chk_checkins_%'
        `;
        console.log(res);
    } catch (e) { console.error(e) }
}

main().finally(() => prisma.$disconnect());
