import { PrismaClient } from '../src/generated/client_v2';

const prisma = new PrismaClient();

async function main() {
    console.log("Updating 'Mid-Year' to 'Mid-Year Assessment'...");
    
    const result = await prisma.kpi_evaluations.updateMany({
        where: {
            session_name: "Mid-Year"
        },
        data: {
            session_name: "Mid-Year Assessment"
        }
    });
    
    console.log(`Updated ${result.count} evaluations.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
