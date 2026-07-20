import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const emps = ['TP69022', 'TG69001', 'TP65004'];
    
    for (const emp_id of emps) {
        await prisma.$transaction(async (tx) => {
            await tx.employee_coins.upsert({
                where: {
                    emp_id_coin_type_id: { emp_id, coin_type_id: 'BRONZE' }
                },
                update: {
                    balance: { increment: 1 }
                },
                create: {
                    emp_id,
                    coin_type_id: 'BRONZE',
                    balance: 1
                }
            });

            await tx.coin_ledgers.create({
                data: {
                    emp_id,
                    coin_type_id: 'BRONZE',
                    amount: 1,
                    transaction_type: 'EARN',
                    description: 'ได้รับรางวัลจิตอาสา'
                }
            });
        });
        console.log(`Awarded 1 Bronze coin to ${emp_id}`);
    }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
