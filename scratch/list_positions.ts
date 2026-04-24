
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const positions = await prisma.job_positions.findMany({
        select: {
            id: true,
            title: true
        }
    });
    console.log(JSON.stringify(positions, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
