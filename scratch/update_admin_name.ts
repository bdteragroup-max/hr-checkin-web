import { PrismaClient } from "../src/generated/client_v2";
const prisma = new PrismaClient();

async function main() {
    const updated = await prisma.admins.update({
        where: { username: "TE67005" },
        data: { full_name: "นางสาวปาริชาติ สาคร" }
    });
    console.log("Updated admin:", updated);
}

main().catch(console.error);
