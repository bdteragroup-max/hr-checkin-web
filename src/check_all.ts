import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const projects = await prisma.projects.findMany();
    console.log("All projects:", projects);
    const branches = await prisma.branches.findMany();
    console.log("All branches:", branches);
}
main().catch(console.error).finally(() => prisma.$disconnect());
