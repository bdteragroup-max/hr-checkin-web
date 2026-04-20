const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const affectedRequests = await prisma.leave_requests.findMany({
    where: {
      leave_type_id: 'personal',
      employees: { is_on_trial: true }
    },
    include: {
      employees: {
        select: { name: true, is_on_trial: true }
      }
    }
  });

  console.log(`Found ${affectedRequests.length} personal leave requests for probationary employees.`);
  
  for (const req of affectedRequests) {
    console.log(`- Request ID: ${req.id} | Employee: ${req.employees.name} | Date: ${req.start_date}`);
  }

  if (affectedRequests.length > 0) {
    console.log('\nUpdating records...');
    const result = await prisma.leave_requests.updateMany({
      where: {
        id: { in: affectedRequests.map(r => r.id) }
      },
      data: {
        leave_type_id: 'unpaid',
        leave_type: 'ลาไม่รับค่าจ้าง'
      }
    });
    console.log(`Successfully updated ${result.count} records.`);
  } else {
    console.log('No updates needed.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
