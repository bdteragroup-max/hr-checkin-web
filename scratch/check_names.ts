import { PrismaClient } from "../src/generated/client_v2";
const prisma = new PrismaClient();

async function main() {
    const ids = ["TP68012", "TE67005"];
    const employees = await prisma.employees.findMany({
        where: { emp_id: { in: ids } }
    });
    console.log("Employees:", JSON.stringify(employees, null, 2));

    const admins = await prisma.admins.findMany({
        where: { username: { in: ids } }
    });
    console.log("Admins:", JSON.stringify(admins, null, 2));
}

main().catch(console.error);
