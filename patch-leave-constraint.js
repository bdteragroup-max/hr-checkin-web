const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Updating leave_requests status check constraint...");
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "leave_requests" DROP CONSTRAINT IF EXISTS "chk_leave_requests_status";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "leave_requests" ADD CONSTRAINT "chk_leave_requests_status" CHECK ("status" IN ('pending', 'approved', 'rejected', 'pending_supervisor', 'pending_hr'));`);
    console.log("✅ Constraint updated successfully!");
  } catch (error) {
    console.error("❌ Failed to update constraint:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
