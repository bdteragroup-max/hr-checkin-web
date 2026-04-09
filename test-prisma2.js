const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const req = await prisma.leave_requests.findUnique({
    where: { id: "LV-1775620443095-4edf49" }
  });
  console.log("Handover person property:", req.handover_person);
  console.log("Using as any:", req.handover_person);
  
  const leaveData = {
    empName: req.name,
    handoverPerson: req.handover_person
  };

  console.log("Serialized:", leaveData);
}

main().catch(console.error).finally(() => prisma.$disconnect());
