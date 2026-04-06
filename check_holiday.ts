import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const dateStr = "2026-04-06";
  const dateKey = new Date(dateStr);
  
  const holiday = await prisma.holidays.findUnique({
    where: { date: dateKey }
  });
  
  console.log("Holiday for today:", holiday);
}

check();
