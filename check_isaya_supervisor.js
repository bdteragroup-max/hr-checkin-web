const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employees.findUnique({
    where: { emp_id: 'TG68020' },
    include: {
      supervisor: {
        select: { emp_id: true, name: true, line_user_id: true }
      }
    }
  });

  console.log(JSON.stringify(emp, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
