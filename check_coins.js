const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const coins = await prisma.coin_types.findMany();
    console.log('Coin Types:', coins.map(c => ({id: c.id, name: c.name})));
    
    const balances = await prisma.employee_coins.findMany({ where: { emp_id: 'TP68012' } });
    console.log('Balances:', balances);
    
    const tickets = await prisma.wheel_tickets.findMany({ where: { emp_id: 'TP68012' } });
    console.log('Tickets:', tickets);
}

main().finally(() => prisma.$disconnect());
