const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employees.findFirst({
    where: { name: { contains: 'อิษยา' } },
    select: { emp_id: true, name: true, is_on_trial: true }
  });

  if (!emp) {
    console.log('Employee not found');
    return;
  }

  console.log(`Employee: ${emp.name} (${emp.emp_id}) | On Trial: ${emp.is_on_trial}`);

  const leaves = await prisma.leave_requests.findMany({
    where: { emp_id: emp.emp_id },
    orderBy: { start_at: 'desc' },
    take: 10
  });

  console.log('\n--- Recent Leaves ---');
  leaves.forEach(l => {
    console.log(`ID: ${l.id} | Status: ${l.status} | Type: ${l.leave_type_id} | Start: ${l.start_date.toISOString().split('T')[0]} | Reason: ${l.reason}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
