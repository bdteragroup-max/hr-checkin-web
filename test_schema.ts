import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
    const l = await prisma.leave_requests.findFirst();
    console.log(l);
    await prisma.$disconnect();
}
test();
