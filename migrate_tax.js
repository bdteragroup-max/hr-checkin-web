const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN fixed_tax_deduction DECIMAL(10,2);');
    console.log('Migration complete');
}

main().catch(console.error).finally(() => prisma.$disconnect());
