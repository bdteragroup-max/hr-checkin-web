const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Target date for today
  const targetDate = "2026-04-06";
  const startOfDay = new Date("2026-04-06T00:00:00Z");
  const endOfDay = new Date("2026-04-06T23:59:59Z");
  
  const checkins = await prisma.checkins.findMany({
    where: {
      timestamp: { gte: startOfDay, lte: endOfDay }
    },
    include: {
      employees: {
        select: { name: true }
      }
    }
  });

  console.log("Found " + checkins.length + " check-ins for 2026-04-06");
  checkins.forEach(c => {
    console.log("ID: " + c.id);
    console.log("Name: " + (c.employees ? c.employees.name : 'Unknown'));
    console.log("Type: " + c.type);
    console.log("Timestamp (UTC): " + c.timestamp.toISOString());
    console.log("TimeKey: " + c.time_key.toISOString());
    console.log("-------------------");
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
