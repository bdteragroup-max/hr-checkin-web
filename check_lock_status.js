const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const employees = [
    { name: 'นางสาวธัญญาพร บุญประกอบ' },
    { name: 'นายเกริกไกร ก้อนคำ' },
    { name: 'นายอภินันท์ ทวีสังข์' },
    { name: 'นายนพรัตน์ บุญประทุม' }
  ];

  for (const e of employees) {
    const emp = await prisma.employees.findFirst({
        where: { name: e.name },
        select: { emp_id: true, name: true }
    });
    if (!emp) {
        console.log(`Employee not found: ${e.name}`);
        continue;
    }

    const payroll = await prisma.monthly_payroll_data.findMany({
        where: { emp_id: emp.emp_id, cycle_year: 2026, cycle_month: { in: [2, 3] } }
    });

    console.log(`\nEmployee: ${emp.name} (${emp.emp_id})`);
    if (payroll.length === 0) {
        console.log('  No payroll records found for Feb/Mar 2026.');
    } else {
        payroll.forEach(p => {
            console.log(`  Month: ${p.cycle_month} | Published: ${p.is_published}`);
        });
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
