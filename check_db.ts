import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const targetDate = "2026-04-06";
  const checkins = await prisma.checkins.findMany({
    where: {
      date_key: new Date(targetDate), // Assuming date_key is stored as YYYY-MM-DD 00:00:00 UTC
    },
    include: {
      employees: {
        select: { name: true }
      }
    }
  });

  console.log("Found check-ins for", targetDate);
  checkins.forEach(c => {
    console.log(`ID: ${c.id}, Name: ${c.employees?.name}, Type: ${c.type}, Timestamp: ${c.timestamp.toISOString()}, TimeKey: ${c.time_key.toISOString()}`);
  });
}

main().catch(console.error);
