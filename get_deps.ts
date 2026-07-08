import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const deps = await prisma.departments.findMany();
    console.log(deps);
}

main().catch(console.error).finally(() => prisma.$disconnect());
