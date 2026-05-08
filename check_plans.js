
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const plans = await prisma.daily_work_plans.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
    include: { employees: { select: { name: true } } }
  });
  console.log(JSON.stringify(plans, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
