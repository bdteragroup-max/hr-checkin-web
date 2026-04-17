const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employees.findUnique({
    where: { emp_id: 'TE69004' },
    select: {
      emp_id: true,
      name: true,
      hire_date: true,
      probation_evaluations: {
        select: { evaluation_no: true },
        orderBy: { evaluation_no: 'desc' },
        take: 1
      }
    }
  });
  console.log(JSON.stringify(emp, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
