const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "general_allowance" DECIMAL(12,2) DEFAULT 0;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "monthly_payroll_data" ADD COLUMN IF NOT EXISTS "general_allowance_override" DECIMAL(10,2);`);
        console.log("Migration done successfully.");
    } catch(e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
