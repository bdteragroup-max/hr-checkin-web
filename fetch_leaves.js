const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leaves = await prisma.leave_requests.findMany({
    take: 5,
    orderBy: { timestamp: 'desc' },
    include: {
      employees: {
        select: {
          name: true,
          line_user_id: true
        }
      }
    }
  });
  console.log(JSON.stringify(leaves, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
