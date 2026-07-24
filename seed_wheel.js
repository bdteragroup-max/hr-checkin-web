const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fixing test wheel event prizes...");

    // Delete existing events (cascades to prizes and tickets)
    await prisma.wheel_events.deleteMany({});
    
    // Create correct event
    const event = await prisma.wheel_events.create({
        data: {
            name: "Q3 2026 Prize Draw",
            start_date: new Date(),
            end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)),
            is_active: true,
            prizes: {
                create: [
                    { name: "1st Prize", bonus_amount: 1000, quantity: 1, is_active: true },
                    { name: "2nd Prize", bonus_amount: 500, quantity: 2, is_active: true },
                    { name: "3rd Prize", bonus_amount: 200, quantity: 5, is_active: true }
                ]
            }
        },
        include: { prizes: true }
    });

    console.log("Successfully recreated test event with correct prizes!");
    console.dir(event, { depth: null });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
