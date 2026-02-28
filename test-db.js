const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const checkins = await prisma.checkins.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' }
    });
    console.log(JSON.stringify(checkins, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().finally(() => prisma.$disconnect());
