const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leaves = await prisma.leave_requests.findMany({
    take: 10,
    orderBy: { timestamp: 'desc' }
  });
  console.log(leaves.map(l => ({id: l.id, h: l.handover_person})));
}

main().catch(console.error).finally(() => prisma.$disconnect());
