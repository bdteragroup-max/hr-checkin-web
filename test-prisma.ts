import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const req = await prisma.leave_requests.findFirst({
    where: { name: { contains: "เมธี" } },
    orderBy: { timestamp: "desc" }
  });
  console.log("Found:", JSON.stringify(req, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
