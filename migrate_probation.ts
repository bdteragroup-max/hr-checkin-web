import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "employees" ADD COLUMN "probation_accommodation_allowance" BOOLEAN NOT NULL DEFAULT false;');
    console.log('Added probation_accommodation_allowance');
  } catch (e) { console.log(e.message) }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "employees" ADD COLUMN "probation_meal_allowance" BOOLEAN NOT NULL DEFAULT false;');
    console.log('Added probation_meal_allowance');
  } catch (e) { console.log(e.message) }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "employees" ADD COLUMN "probation_travel_allowance" BOOLEAN NOT NULL DEFAULT false;');
    console.log('Added probation_travel_allowance');
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
