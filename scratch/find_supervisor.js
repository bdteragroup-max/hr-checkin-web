const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const emps = await prisma.employees.findMany({
        where: {
            OR: [
                { emp_id: 'TP62010' },
                { name: { contains: 'เพ็ญจันทร์' } }
            ]
        },
        select: { emp_id: true, name: true, line_user_id: true }
    });
    console.log(JSON.stringify(emps, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
