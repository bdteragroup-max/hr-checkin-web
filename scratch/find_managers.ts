import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const managers = await prisma.employees.findMany({
        where: {
            OR: [
                { job_positions: { title: { contains: 'Purchasing' } } },
                { job_positions: { title: { contains: 'Warehouse' } } },
                { job_positions: { title: { contains: 'Manager' } } },
                { departments: { name: { contains: 'HR' } } }
            ]
        },
        include: {
            job_positions: true,
            departments: true
        }
    });
    console.log(JSON.stringify(managers, null, 2));
}

main();
