 const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const entitlements = await prisma.leave_entitlements.findMany({
    orderBy: { leave_type_id: 'asc' }
  });
  const types = await prisma.leave_types.findMany();

  console.log('--- Leave Types ---');
  console.table(types);

  console.log('--- Leave Entitlements ---');
  console.table(entitlements);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
