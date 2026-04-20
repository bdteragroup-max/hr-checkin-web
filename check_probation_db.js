const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const entitlements = await prisma.leave_entitlements.findMany();
  console.log('--- Entitlements ---');
  console.log(JSON.stringify(entitlements, null, 2));

  const probationaryEmployees = await prisma.employees.findMany({
    where: { is_on_trial: true, is_active: true },
    select: { emp_id: true, name: true, hire_date: true }
  });
  console.log('\n--- Employees on Probation ---');
  console.log(JSON.stringify(probationaryEmployees, null, 2));

  const recentLeaves = await prisma.leave_requests.findMany({
    where: { employees: { is_on_trial: true } },
    take: 5,
    orderBy: { timestamp: 'desc' },
    include: { employees: { select: { name: true, is_on_trial: true } } }
  });
  console.log('\n--- Recent Leaves by Probationary Employees ---');
  console.log(JSON.stringify(recentLeaves, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
