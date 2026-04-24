import { PrismaClient } from "../src/generated/client_v2";
const prisma = new PrismaClient();

async function main() {
    const ids = ["TG58001", "TE63003"];
    const employees = await prisma.employees.findMany({
        where: { emp_id: { in: ids } },
        select: { emp_id: true, name: true, line_user_id: true }
    });
    console.log(JSON.stringify(employees, null, 2));
}

main().catch(console.error);
