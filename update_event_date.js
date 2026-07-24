const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Updating end_date for active wheel event...");

    // Find active event
    const event = await prisma.wheel_events.findFirst({
        where: { is_active: true }
    });

    if (event) {
        // Set end_date to July 25, 2026, at 11:00 AM (Thailand time GMT+7)
        // 11:00 AM GMT+7 is 04:00 AM UTC
        const updatedEvent = await prisma.wheel_events.update({
            where: { id: event.id },
            data: {
                end_date: new Date("2026-07-25T11:00:00+07:00")
            }
        });
        console.log("Successfully updated event end_date!");
        console.dir(updatedEvent);
    } else {
        console.log("No active event found to update.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
