
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkLine() {
    const total = await prisma.employees.count({ where: { is_active: true } });
    const linked = await prisma.employees.count({ where: { is_active: true, NOT: { line_user_id: null } } });
    console.log(`Active Employees: ${total}`);
    console.log(`Linked to LINE: ${linked}`);
    console.log(`Unlinked: ${total - linked}`);
}

checkLine().catch(console.error).finally(() => prisma.$disconnect());
