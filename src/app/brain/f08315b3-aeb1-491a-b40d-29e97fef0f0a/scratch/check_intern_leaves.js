
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const interns = await prisma.employees.findMany({
        where: { salary_type: "daily" },
        select: { emp_id: true, name: true }
    });
    
    console.log(`Found ${interns.length} interns.`);
    
    const internIds = interns.map(i => i.emp_id);
    
    const leaves = await prisma.leave_requests.groupBy({
        by: ['leave_type_id', 'leave_type'],
        where: { emp_id: { in: internIds } },
        _count: true
    });
    
    console.log("Intern Leave Counts by Type:");
    console.log(JSON.stringify(leaves, null, 2));
}

main().catch(console.error);
