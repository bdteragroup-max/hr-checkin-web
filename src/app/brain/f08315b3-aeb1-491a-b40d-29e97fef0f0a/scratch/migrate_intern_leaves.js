
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Starting Intern Leave Migration...");
    
    // 1. Identify Interns
    const interns = await prisma.employees.findMany({
        where: { salary_type: "daily" },
        select: { emp_id: true }
    });
    const internIds = interns.map(i => i.emp_id);
    console.log(`Found ${internIds.length} interns.`);

    if (internIds.length === 0) {
        console.log("No interns found. Skipping.");
        return;
    }

    // 2. Find Forbidden Leaves (Personal, Emergency, Annual, etc.)
    const forbidden = ["personal", "emergency", "annual"];
    
    const countBefore = await prisma.leave_requests.count({
        where: {
            emp_id: { in: internIds },
            leave_type_id: { in: forbidden }
        }
    });
    console.log(`Found ${countBefore} records to migrate.`);

    if (countBefore === 0) {
        console.log("No records to migrate.");
        return;
    }

    // 3. Update to Unpaid Leave
    const result = await prisma.leave_requests.updateMany({
        where: {
            emp_id: { in: internIds },
            leave_type_id: { in: forbidden }
        },
        data: {
            leave_type_id: "unpaid",
            leave_type: "ลาไม่รับค่าจ้าง"
        }
    });

    console.log(`Migration Complete. Updated ${result.count} records.`);
    
    // Verification
    const countAfter = await prisma.leave_requests.count({
        where: {
            emp_id: { in: internIds },
            leave_type_id: { in: forbidden }
        }
    });
    console.log(`Verification: Remaining forbidden records for interns = ${countAfter}`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
