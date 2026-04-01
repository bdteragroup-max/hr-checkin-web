import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const depts = await prisma.departments.findMany();
    const pos = await prisma.job_positions.findMany();
    console.log("Departments:", JSON.stringify(depts, null, 2));
    console.log("Positions:", JSON.stringify(pos, null, 2));
}
main();
