const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Leave Types...');
  
  const leaveTypes = [
    { id: 'annual', name: 'ลาพักร้อน', gender_rule: 'ALL', max_days: 15, count_mode: 'WORK', require_attachment: false },
    { id: 'sick', name: 'ลาป่วย', gender_rule: 'ALL', max_days: 30, count_mode: 'WORK', require_attachment: true },
    { id: 'personal', name: 'ลากิจ', gender_rule: 'ALL', max_days: 6, count_mode: 'WORK', require_attachment: false },
    { id: 'maternity', name: 'ลาคลอด', gender_rule: 'FEMALE', max_days: 120, count_mode: 'CALENDAR', require_attachment: true },
    { id: 'paternity', name: 'ลาดูแลภรรยาคลอดบุตร', gender_rule: 'MALE', max_days: 15, count_mode: 'CALENDAR', require_attachment: true },
    { id: 'ordination', name: 'ลาบวช', gender_rule: 'MALE', max_days: 15, count_mode: 'CALENDAR', require_attachment: true },
    { id: 'unpaid', name: 'ลาไม่รับค่าจ้าง', gender_rule: 'ALL', max_days: null, count_mode: 'WORK', require_attachment: false },
  ];

  for (const lt of leaveTypes) {
    await prisma.leave_types.upsert({
      where: { id: lt.id },
      update: lt,
      create: lt,
    });
  }

  console.log('📊 Seeding Leave Entitlements...');

  const entitlements = [
    // Sick Leave - 30 days for everyone
    { leave_type_id: 'sick', min_years: 0, days: 30 },
    
    // Personal Leave - 6 days for everyone
    { leave_type_id: 'personal', min_years: 0, days: 6 },
    
    // Annual Leave - Tiered based on service years
    { leave_type_id: 'annual', min_years: 1, days: 6 },
    { leave_type_id: 'annual', min_years: 2, days: 7 },
    { leave_type_id: 'annual', min_years: 3, days: 8 },
    { leave_type_id: 'annual', min_years: 5, days: 10 },
    { leave_type_id: 'annual', min_years: 10, days: 15 },
    
    // Others
    { leave_type_id: 'maternity', min_years: 0, days: 120 },
    { leave_type_id: 'paternity', min_years: 0, days: 15 },
    { leave_type_id: 'ordination', min_years: 0, days: 15 },
  ];

  for (const ent of entitlements) {
    await prisma.leave_entitlements.upsert({
      where: { leave_type_id_min_years: { leave_type_id: ent.leave_type_id, min_years: ent.min_years } },
      update: ent,
      create: ent,
    });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
