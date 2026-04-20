const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sample = await prisma.leave_requests.findMany({
    where: {
      id: { startsWith: 'LV-HIST-' },
      leave_type_id: 'unpaid'
    },
    take: 5,
    select: { id: true, status: true, approved_by: true, start_date: true }
  });

  console.log('Sample Updated Records Status:');
  console.log(JSON.stringify(sample, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
