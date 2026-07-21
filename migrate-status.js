const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE asset_borrowings
    SET return_status = 'COMPLETE'
    WHERE actual_return_date IS NOT NULL;
  `);
  console.log('Updated records:', result);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
