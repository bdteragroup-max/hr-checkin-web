const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mocking the route logic for a quick test push
async function testPush() {
    const sid = 'TG00001';
    const sup = await prisma.employees.findUnique({
        where: { emp_id: sid },
        select: { line_user_id: true, name: true }
    });

    if (!sup || !sup.line_user_id) {
        console.log("No supervisor found with line_user_id");
        return;
    }

    console.log(`Found supervisor: ${sup.name} (${sup.line_user_id})`);

    // We'll hit the actual cron endpoint using node-fetch (or similar) or just run the logic.
    // For simplicity, let's try to hit the local dev server first.
    try {
        const res = await fetch(`http://localhost:3000/api/cron/approval-reminders?secret=hr-checkin-secret-123`, {
            method: 'GET'
        });
        const data = await res.json();
        console.log("Cron trigger result:", data);
    } catch (e) {
        console.log("Failed to hit local server, checking if it's running...");
        console.error(e.message);
    }
}

testPush().finally(() => prisma.$disconnect());
