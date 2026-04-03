
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    let emp = await prisma.employees.findFirst({ 
        where: { is_active: true },
        include: { supervisor: true }
    });
    
    if (!emp) {
        console.error("No active employee found.");
        return;
    }

    const testId = "TEST-LV-" + Date.now();
    const testReq = await prisma.leave_requests.create({
        data: {
            id: testId,
            emp_id: emp.emp_id,
            name: emp.name,
            leave_type_id: 'L1',
            leave_type: 'ลาพักร้อน (Test)',
            start_date: new Date(),
            end_date: new Date(),
            start_at: new Date(),
            end_at: new Date(Date.now() + 3600000 * 4), 
            days: 1,
            minutes: 240, 
            reason: 'ทดสอบระบบแจ้งเตือน Management (Final)',
            status: 'pending_hr',
            supervisor_id: emp.supervisor_id || 'SYSTEM',
            supervisor_approved_at: new Date()
        }
    });

    console.log(JSON.stringify({ created: true, id: testReq.id, empName: emp.name }));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
