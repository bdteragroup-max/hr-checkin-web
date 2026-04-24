import { PrismaClient } from "../src/generated/client_v2";
const prisma = new PrismaClient();

async function main() {
    const list = await prisma.admins.findMany();
    console.log(JSON.stringify(list, null, 2));
}

main().catch(console.error);
