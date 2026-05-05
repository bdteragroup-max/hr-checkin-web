const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
    console.log("Fetching all employees with nicknames...");
    const employees = await prisma.employees.findMany({
        where: { nickname: { not: null, not: "" } },
        select: { emp_id: true, name: true, nickname: true }
    });

    for (const emp of employees) {
        const formattedName = `${emp.name} (${emp.nickname})`;
        console.log(`Updating records for ${emp.name} -> ${formattedName}`);

        try {
            const checkinRes = await prisma.checkins.updateMany({
                where: { emp_id: emp.emp_id, name: emp.name },
                data: { name: formattedName }
            });
            console.log(`- Updated ${checkinRes.count} checkins`);
        } catch(e) { }

        try {
            const leaveRes = await prisma.leave_requests.updateMany({
                where: { emp_id: emp.emp_id, name: emp.name },
                data: { name: formattedName }
            });
            console.log(`- Updated ${leaveRes.count} leave requests`);
        } catch(e) { }
    }

    console.log("Backfill complete.");
}

backfill().finally(() => prisma.$disconnect());
