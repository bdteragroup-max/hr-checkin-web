import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const emp = await prisma.employees.findFirst({
        select: { emp_id: true, name: true }
    });
    console.log(JSON.stringify(emp, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
