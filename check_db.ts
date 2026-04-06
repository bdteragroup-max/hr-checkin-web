import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const targetDate = "2026-04-06";
  const checkins = await prisma.checkins.findMany({
    where: {
      date_key: new Date(targetDate),
    },
  });

  console.log("Found check-ins for", targetDate);
  checkins.forEach(c => {
    console.log(`ID: ${c.id}, Name: ${c.name}, Type: ${c.type}, Timestamp: ${c.timestamp.toISOString()}, TimeKey: ${c.time_key.toISOString()}`);
  });
}

main().catch(console.error);
