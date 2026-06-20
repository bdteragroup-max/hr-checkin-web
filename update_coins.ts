import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Updating coin types...");

    // First, try to find TASK
    const taskCoin = await prisma.coin_types.findUnique({ where: { id: "TASK" } });
    
    if (!taskCoin) {
        // Find if MILESTONE exists
        const milestoneCoin = await prisma.coin_types.findUnique({ where: { id: "MILESTONE" } });
        
        if (milestoneCoin) {
            console.log("Renaming MILESTONE to TASK...");
            await prisma.coin_types.update({
                where: { id: "MILESTONE" },
                data: {
                    id: "TASK",
                    name: "Task Coin",
                    description: "Received from your Department Head for successful completion of assigned tasks."
                }
            });
        } else {
            console.log("Creating TASK coin...");
            await prisma.coin_types.create({
                data: {
                    id: "TASK",
                    name: "Task Coin",
                    description: "Received from your Department Head for successful completion of assigned tasks."
                }
            });
        }
    } else {
        console.log("TASK coin already exists.");
    }
    
    console.log("Done!");
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
