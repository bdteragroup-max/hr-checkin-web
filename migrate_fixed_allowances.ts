import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "employees" ADD COLUMN "fixed_accommodation_allowance" DECIMAL(12,2) DEFAULT 0;');
    console.log('Added fixed_accommodation_allowance');
  } catch (e) { console.log(e.message) }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "employees" ADD COLUMN "fixed_meal_allowance" DECIMAL(12,2) DEFAULT 0;');
    console.log('Added fixed_meal_allowance');
  } catch (e) { console.log(e.message) }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "employees" ADD COLUMN "fixed_travel_allowance" DECIMAL(12,2) DEFAULT 0;');
    console.log('Added fixed_travel_allowance');
  } catch (e) { console.log(e.message) }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
