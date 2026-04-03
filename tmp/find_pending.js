
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pending = await prisma.leave_requests.findFirst({
    where: { status: 'pending_hr' },
    select: { id: true, name: true, leave_type: true }
  });

  if (pending) {
    console.log(JSON.stringify({ found: true, ...pending }));
  } else {
    console.log(JSON.stringify({ found: false }));
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
