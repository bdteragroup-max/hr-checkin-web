
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const emp = await prisma.employees.findFirst({
        where: { name: { contains: 'อังคณา' } },
        select: { emp_id: true, name: true, is_checkin_exempt: true, is_active: true, supervisor_id: true }
    });
    console.log(JSON.stringify(emp, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
