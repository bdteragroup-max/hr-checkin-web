const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const deps = await prisma.departments.findMany();
    console.log('Deps:', deps.map(d=>d.name));
    const jobs = await prisma.job_positions.findMany();
    console.log('Jobs:', jobs.map(j=>j.title));
}
main().finally(()=>prisma.$disconnect());
