const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCount() {
    try {
        const count = await prisma.$queryRaw`SELECT COUNT(*) FROM "products"`;
        console.log('Total products in database:', count);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkCount();
