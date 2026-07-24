const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.employee_coins.updateMany({
        where: { emp_id: 'TP68012', coin_type_id: 'GOLD' },
        data: { balance: 1 }
    });
    await prisma.employee_coins.updateMany({
        where: { emp_id: 'TP68012', coin_type_id: 'TASK' },
        data: { balance: 1 }
    });
    console.log("Coins refunded!");
}

main().finally(() => prisma.$disconnect());
